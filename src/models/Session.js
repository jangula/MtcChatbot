/**
 * Session Model
 * Manages user authentication sessions with auto-expiry
 */

module.exports = (sequelize, DataTypes) => {
  const Session = sequelize.define('Session', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    session_token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    is_authenticated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether PIN authentication completed',
    },
    is_otp_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether OTP verification completed',
    },
    auth_level: {
      type: DataTypes.ENUM('NONE', 'OTP_VERIFIED', 'PIN_VERIFIED', 'FULL'),
      defaultValue: 'NONE',
      comment: 'Current authentication level',
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    last_activity: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    device_info: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'sessions',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['session_token'], unique: true },
      { fields: ['expires_at'] },
      { fields: ['is_active'] },
    ],
  });

  // Instance methods
  Session.prototype.isExpired = function() {
    return new Date() > new Date(this.expires_at);
  };

  Session.prototype.isInactive = function(timeoutMinutes) {
    const inactiveTime = new Date() - new Date(this.last_activity);
    return inactiveTime > timeoutMinutes * 60 * 1000;
  };

  return Session;
};
