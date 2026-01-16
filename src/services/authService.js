/**
 * Authentication Service
 * Handles PIN verification and OTP management
 */

const { User, OTP, Session, AuditLog } = require('../models');
const config = require('../config');
const logger = require('../utils/logger');
const { hash, generateOTP, generateReference } = require('../utils/encryption');
const SessionManager = require('./sessionManager');
const MarisAPI = require('../maris-api/client');

class AuthService {
  constructor() {
    this.sessionManager = new SessionManager();
    this.marisAPI = new MarisAPI();
    this.maxPinAttempts = config.security.maxPinAttempts;
    this.otpExpiryMinutes = config.security.otpExpiryMinutes;
  }

  /**
   * Verify user PIN
   * @param {Object} user - User model instance
   * @param {string} pin - PIN entered by user
   * @param {Object} state - Conversation state
   */
  async verifyPin(user, pin, state) {
    try {
      // Validate PIN format (5 digits)
      if (!pin || !/^\d{5}$/.test(pin)) {
        return {
          type: 'text',
          text: 'Please enter a valid 5-digit PIN.',
        };
      }

      // Check if user is blocked
      if (user.is_blocked) {
        const blockExpiry = user.blocked_until ? new Date(user.blocked_until) : null;
        if (blockExpiry && blockExpiry > new Date()) {
          const waitTime = Math.ceil((blockExpiry - new Date()) / 60000);
          return {
            type: 'text',
            text: `Your account is locked. Please try again in ${waitTime} minutes.`,
          };
        }
        // Unblock if time expired
        await user.update({
          is_blocked: false,
          blocked_reason: null,
          blocked_until: null,
          pin_attempts: 0,
        });
      }

      // Verify PIN with MTC Maris API
      const pinValid = await this.marisAPI.verifyPin(user.maris_account_id, pin);

      if (!pinValid) {
        // Increment failed attempts
        const newAttempts = user.pin_attempts + 1;
        const remainingAttempts = this.maxPinAttempts - newAttempts;

        await user.update({
          pin_attempts: newAttempts,
          last_pin_attempt: new Date(),
        });

        // Audit log
        await AuditLog.log({
          userId: user.id,
          action: 'PIN_VERIFICATION_FAILED',
          category: 'AUTHENTICATION',
          severity: 'WARNING',
          status: 'FAILURE',
          metadata: { attempt: newAttempts },
        });

        // Block if max attempts exceeded
        if (newAttempts >= this.maxPinAttempts) {
          const blockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
          await user.update({
            is_blocked: true,
            blocked_reason: 'Too many failed PIN attempts',
            blocked_until: blockUntil,
          });

          logger.warn('User blocked due to failed PIN attempts', {
            userId: user.id,
            attempts: newAttempts,
          });

          return {
            type: 'text',
            text: `Too many incorrect PIN attempts. Your account has been locked for 30 minutes for security.\n\nIf you've forgotten your PIN, please visit any MTC shop to reset it.`,
          };
        }

        return {
          type: 'text',
          text: `Incorrect PIN. You have ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.\n\nPlease enter your 5-digit PIN:`,
        };
      }

      // PIN verified successfully
      // Reset attempts
      await user.update({
        pin_attempts: 0,
        last_pin_attempt: null,
      });

      // Create/update session
      let session = await this.sessionManager.getActiveSession(user.id);
      if (!session) {
        session = await this.sessionManager.createSession(user.id);
      }
      await this.sessionManager.setAuthenticated(session.id, 'PIN_VERIFIED');

      // Clear awaiting input
      await state.update({ awaiting_input: null });

      // Audit log
      await AuditLog.log({
        userId: user.id,
        action: 'PIN_VERIFICATION_SUCCESS',
        category: 'AUTHENTICATION',
        status: 'SUCCESS',
      });

      logger.info('User authenticated successfully', { userId: user.id });

      // Return welcome message with menu
      return {
        type: 'menu',
        greeting: `Welcome ${user.first_name || 'back'}! You're now logged in.`,
      };
    } catch (error) {
      logger.error('PIN verification error', { userId: user.id, error: error.message });
      return {
        type: 'text',
        text: 'Authentication failed. Please try again later.',
      };
    }
  }

  /**
   * Generate and send OTP
   * @param {Object} user - User model instance
   * @param {string} purpose - OTP purpose
   */
  async generateAndSendOTP(user, purpose = 'TRANSACTION') {
    try {
      // Invalidate any existing OTPs
      await OTP.update(
        { is_expired: true },
        {
          where: {
            user_id: user.id,
            purpose,
            is_used: false,
            is_expired: false,
          },
        }
      );

      // Generate new OTP
      const otpValue = generateOTP(6);
      const otpHash = hash(otpValue);
      const reference = generateReference('OTP');
      const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000);

      // Save OTP
      await OTP.create({
        user_id: user.id,
        phone_number: user.phone_number,
        otp_hash: otpHash,
        purpose,
        expires_at: expiresAt,
        reference,
      });

      // Send OTP via SMS
      const smsSent = await this.sendOTPViaSMS(user.phone_number, otpValue, purpose);

      if (!smsSent) {
        logger.error('Failed to send OTP SMS', { userId: user.id });
        return { success: false, error: 'Failed to send OTP' };
      }

      logger.info('OTP generated and sent', { userId: user.id, purpose, reference });

      return {
        success: true,
        reference,
        expiresAt,
      };
    } catch (error) {
      logger.error('OTP generation error', { userId: user.id, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify OTP
   * @param {Object} user - User model instance
   * @param {string} otpValue - OTP entered by user
   * @param {string} purpose - OTP purpose
   */
  async verifyOTP(user, otpValue, purpose = 'TRANSACTION') {
    try {
      const otpHash = hash(otpValue);

      // Find valid OTP
      const otp = await OTP.findOne({
        where: {
          user_id: user.id,
          otp_hash: otpHash,
          purpose,
          is_used: false,
          is_expired: false,
        },
        order: [['created_at', 'DESC']],
      });

      if (!otp) {
        // Increment attempts on latest OTP
        const latestOtp = await OTP.findOne({
          where: { user_id: user.id, purpose, is_used: false, is_expired: false },
          order: [['created_at', 'DESC']],
        });

        if (latestOtp) {
          await latestOtp.update({ attempts: latestOtp.attempts + 1 });
          if (latestOtp.attempts >= latestOtp.max_attempts) {
            await latestOtp.update({ is_expired: true });
            return { success: false, error: 'OTP expired due to too many attempts', expired: true };
          }
        }

        return { success: false, error: 'Invalid OTP' };
      }

      // Check if OTP is still valid
      if (!otp.isValid()) {
        return { success: false, error: 'OTP has expired', expired: true };
      }

      // Mark OTP as used
      await otp.update({
        is_used: true,
        used_at: new Date(),
      });

      // Audit log
      await AuditLog.log({
        userId: user.id,
        action: 'OTP_VERIFICATION_SUCCESS',
        category: 'AUTHENTICATION',
        status: 'SUCCESS',
        reference: otp.reference,
      });

      return { success: true, reference: otp.reference };
    } catch (error) {
      logger.error('OTP verification error', { userId: user.id, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send OTP via SMS gateway
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} otp - OTP value
   * @param {string} purpose - OTP purpose
   */
  async sendOTPViaSMS(phoneNumber, otp, purpose) {
    // In production, this would integrate with MTC's SMS gateway
    // For development, we'll log it
    const purposeMessages = {
      REGISTRATION: 'MTC Maris registration',
      TRANSACTION: 'MTC Maris transaction',
      PIN_RESET: 'PIN reset',
    };

    const message = `Your MTC Maris OTP for ${purposeMessages[purpose] || 'verification'} is: ${otp}. Valid for ${this.otpExpiryMinutes} minutes. Do not share this code.`;

    if (config.app.env === 'development') {
      logger.info('DEV: OTP SMS', { phoneNumber: phoneNumber.slice(-4), otp, message });
      return true;
    }

    // Production: Send via SMS gateway
    try {
      // await smsGateway.send(phoneNumber, message);
      return true;
    } catch (error) {
      logger.error('SMS send failed', { error: error.message });
      return false;
    }
  }
}

module.exports = AuthService;
