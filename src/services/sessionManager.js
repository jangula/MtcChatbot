/**
 * Session Manager Service
 * Handles user session lifecycle with security compliance
 */

const { Session, User, AuditLog } = require('../models');
const config = require('../config');
const logger = require('../utils/logger');
const { generateReference } = require('../utils/encryption');
const { v4: uuidv4 } = require('uuid');

class SessionManager {
  constructor() {
    this.sessionTimeoutMs = config.security.sessionTimeoutMinutes * 60 * 1000;
  }

  /**
   * Create a new session for user
   * @param {string} userId - User ID
   * @param {Object} options - Additional session options
   */
  async createSession(userId, options = {}) {
    try {
      // Invalidate any existing active sessions
      await this.invalidateUserSessions(userId);

      // Calculate expiry time
      const expiresAt = new Date(Date.now() + this.sessionTimeoutMs);

      // Create new session
      const session = await Session.create({
        user_id: userId,
        session_token: uuidv4(),
        is_authenticated: false,
        is_otp_verified: options.otpVerified || false,
        auth_level: 'NONE',
        expires_at: expiresAt,
        last_activity: new Date(),
        ip_address: options.ipAddress,
        device_info: options.deviceInfo || {},
        is_active: true,
      });

      logger.info('Session created', { userId, sessionId: session.id });

      // Audit log
      await AuditLog.log({
        userId,
        action: 'SESSION_CREATED',
        category: 'AUTHENTICATION',
        status: 'SUCCESS',
        reference: session.session_token,
      });

      return session;
    } catch (error) {
      logger.error('Failed to create session', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get active session for user
   * @param {string} userId - User ID
   */
  async getActiveSession(userId) {
    const session = await Session.findOne({
      where: {
        user_id: userId,
        is_active: true,
      },
      order: [['created_at', 'DESC']],
    });

    if (!session) return null;

    // Check if session expired
    if (session.isExpired()) {
      await this.invalidateSession(session.id, 'EXPIRED');
      return null;
    }

    // Check for inactivity timeout
    if (session.isInactive(config.security.sessionTimeoutMinutes)) {
      await this.invalidateSession(session.id, 'INACTIVE');
      return null;
    }

    return session;
  }

  /**
   * Update session to authenticated state
   * @param {string} sessionId - Session ID
   * @param {string} authLevel - Authentication level
   */
  async setAuthenticated(sessionId, authLevel = 'PIN_VERIFIED') {
    const session = await Session.findByPk(sessionId);
    if (!session) return null;

    await session.update({
      is_authenticated: true,
      auth_level: authLevel,
      last_activity: new Date(),
    });

    logger.info('Session authenticated', { sessionId, authLevel });

    await AuditLog.log({
      userId: session.user_id,
      action: 'SESSION_AUTHENTICATED',
      category: 'AUTHENTICATION',
      status: 'SUCCESS',
      metadata: { authLevel },
    });

    return session;
  }

  /**
   * Update session activity timestamp
   * @param {string} sessionId - Session ID
   */
  async updateActivity(sessionId) {
    await Session.update(
      { last_activity: new Date() },
      { where: { id: sessionId } }
    );
  }

  /**
   * Extend session expiry
   * @param {string} sessionId - Session ID
   */
  async extendSession(sessionId) {
    const newExpiry = new Date(Date.now() + this.sessionTimeoutMs);
    await Session.update(
      {
        expires_at: newExpiry,
        last_activity: new Date(),
      },
      { where: { id: sessionId } }
    );
  }

  /**
   * Invalidate a specific session
   * @param {string} sessionId - Session ID
   * @param {string} reason - Reason for invalidation
   */
  async invalidateSession(sessionId, reason = 'LOGOUT') {
    await Session.update(
      { is_active: false },
      { where: { id: sessionId } }
    );

    logger.info('Session invalidated', { sessionId, reason });
  }

  /**
   * Invalidate all sessions for a user
   * @param {string} userId - User ID
   */
  async invalidateUserSessions(userId) {
    await Session.update(
      { is_active: false },
      { where: { user_id: userId, is_active: true } }
    );
  }

  /**
   * Cleanup expired sessions (run periodically)
   */
  async cleanupExpiredSessions() {
    const { Op } = require('sequelize');

    const result = await Session.update(
      { is_active: false },
      {
        where: {
          is_active: true,
          expires_at: { [Op.lt]: new Date() },
        },
      }
    );

    if (result[0] > 0) {
      logger.info('Cleaned up expired sessions', { count: result[0] });
    }
  }

  /**
   * Get session statistics for admin
   */
  async getSessionStats() {
    const { Op } = require('sequelize');
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);

    const [active, authenticated, recentlyCreated] = await Promise.all([
      Session.count({ where: { is_active: true, expires_at: { [Op.gt]: now } } }),
      Session.count({ where: { is_active: true, is_authenticated: true, expires_at: { [Op.gt]: now } } }),
      Session.count({ where: { created_at: { [Op.gt]: oneHourAgo } } }),
    ]);

    return { active, authenticated, recentlyCreated };
  }
}

module.exports = SessionManager;
