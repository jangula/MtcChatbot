/**
 * Registration Flow
 * Handles new user registration for MTC Maris
 */

const BaseFlow = require('./baseFlow');
const AuthService = require('../../services/authService');

class RegistrationFlow extends BaseFlow {
  constructor() {
    super('REGISTRATION');
    this.authService = new AuthService();
    this.steps = {
      START: 'START',
      ENTER_FIRST_NAME: 'ENTER_FIRST_NAME',
      ENTER_LAST_NAME: 'ENTER_LAST_NAME',
      ENTER_ID_NUMBER: 'ENTER_ID_NUMBER',
      CREATE_PIN: 'CREATE_PIN',
      CONFIRM_PIN: 'CONFIRM_PIN',
      VERIFY_OTP: 'VERIFY_OTP',
      COMPLETE: 'COMPLETE',
    };
  }

  async start(user, state, session) {
    await this.updateState(state, {
      current_step: this.steps.ENTER_FIRST_NAME,
      flow_data: {},
    });

    return {
      type: 'text',
      text: `*Register for MTC Maris*\n\nLet's set up your MTC Maris wallet.\n\nPlease enter your first name:`,
    };
  }

  async process(user, state, message, session) {
    const { content } = message;
    const step = state.current_step;

    switch (step) {
      case this.steps.ENTER_FIRST_NAME:
        return this.handleFirstName(user, state, content);
      case this.steps.ENTER_LAST_NAME:
        return this.handleLastName(user, state, content);
      case this.steps.ENTER_ID_NUMBER:
        return this.handleIdNumber(user, state, content);
      case this.steps.CREATE_PIN:
        return this.handleCreatePin(user, state, content);
      case this.steps.CONFIRM_PIN:
        return this.handleConfirmPin(user, state, content);
      case this.steps.VERIFY_OTP:
        return this.handleOtpVerification(user, state, content);
      default:
        return this.start(user, state, session);
    }
  }

  async handleFirstName(user, state, content) {
    if (!content || content.length < 2 || content.length > 50) {
      return { type: 'text', text: 'Please enter a valid first name (2-50 characters):' };
    }

    await this.updateFlowData(state, 'firstName', content.trim());
    await this.setAwaitingInput(state, 'LAST_NAME', this.steps.ENTER_LAST_NAME);

    return { type: 'text', text: `Thanks ${content.trim()}!\n\nNow enter your last name:` };
  }

  async handleLastName(user, state, content) {
    if (!content || content.length < 2 || content.length > 50) {
      return { type: 'text', text: 'Please enter a valid last name (2-50 characters):' };
    }

    await this.updateFlowData(state, 'lastName', content.trim());
    await this.setAwaitingInput(state, 'ID_NUMBER', this.steps.ENTER_ID_NUMBER);

    return {
      type: 'text',
      text: `*Identity Verification*\n\nPlease enter your Namibian ID number or Passport number:`,
    };
  }

  async handleIdNumber(user, state, content) {
    const idNumber = content.replace(/\s/g, '').toUpperCase();

    // Basic validation (11 digits for Namibian ID)
    if (idNumber.length < 6 || idNumber.length > 20) {
      return { type: 'text', text: 'Invalid ID/Passport number. Please enter a valid number:' };
    }

    await this.updateFlowData(state, 'idNumber', idNumber);
    await this.setAwaitingInput(state, 'PIN', this.steps.CREATE_PIN);

    return {
      type: 'text',
      text: `*Create Your PIN*\n\nCreate a 5-digit PIN for your wallet.\nThis PIN will be used to access your account and authorize transactions.\n\nEnter your 5-digit PIN:`,
    };
  }

  async handleCreatePin(user, state, content) {
    if (!/^\d{5}$/.test(content)) {
      return { type: 'text', text: 'PIN must be exactly 5 digits. Please try again:' };
    }

    // Check for weak PINs
    const weakPins = ['12345', '11111', '22222', '33333', '44444', '55555', '00000', '54321'];
    if (weakPins.includes(content)) {
      return { type: 'text', text: 'This PIN is too easy to guess. Please choose a stronger PIN:' };
    }

    await this.updateFlowData(state, 'pin', content);
    await this.setAwaitingInput(state, 'CONFIRM_PIN', this.steps.CONFIRM_PIN);

    return { type: 'text', text: 'Please confirm your PIN by entering it again:' };
  }

  async handleConfirmPin(user, state, content) {
    if (content !== state.flow_data.pin) {
      await this.setAwaitingInput(state, 'PIN', this.steps.CREATE_PIN);
      return { type: 'text', text: 'PINs do not match. Please create your PIN again:' };
    }

    // Send OTP for verification
    const otpResult = await this.authService.generateAndSendOTP(user, 'REGISTRATION');

    if (!otpResult.success) {
      return { type: 'text', text: 'Failed to send verification code. Please try again.' };
    }

    await this.setAwaitingInput(state, 'OTP', this.steps.VERIFY_OTP);

    return {
      type: 'text',
      text: `*Verify Your Number*\n\nA 6-digit verification code has been sent to your phone via SMS.\n\nEnter the code to complete registration:`,
    };
  }

  async handleOtpVerification(user, state, content) {
    const otpResult = await this.authService.verifyOTP(user, content, 'REGISTRATION');

    if (!otpResult.success) {
      if (otpResult.expired) {
        return {
          type: 'text',
          text: 'Verification code expired. Please type REGISTER to start again.',
        };
      }
      return { type: 'text', text: 'Invalid code. Please enter the correct verification code:' };
    }

    // Register with Maris API
    const flowData = state.flow_data;
    const registrationResult = await this.marisAPI.registerAccount({
      phoneNumber: user.phone_number,
      firstName: flowData.firstName,
      lastName: flowData.lastName,
      idNumber: flowData.idNumber,
      pin: flowData.pin,
    });

    if (registrationResult.success) {
      // Update user record
      await user.update({
        is_registered: true,
        is_verified: true,
        first_name: flowData.firstName,
        last_name: flowData.lastName,
        maris_account_id: registrationResult.accountId,
      });

      await this.auditLog(user.id, 'REGISTRATION_COMPLETE', { status: 'SUCCESS' });

      return this.completeFlow(
        `*Registration Successful!*\n\n` +
        `Welcome to MTC Maris, ${flowData.firstName}!\n\n` +
        `Your wallet is ready. You can now:\n` +
        `• Send and receive money\n` +
        `• Buy airtime and data\n` +
        `• Pay bills\n` +
        `• And much more!\n\n` +
        `Type MENU to get started.`
      );
    }

    return this.completeFlow(`Registration failed: ${registrationResult.error || 'Please try again later.'}`);
  }
}

module.exports = RegistrationFlow;
