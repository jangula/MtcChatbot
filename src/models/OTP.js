/**
 * OTP Model
 * Stores one-time passwords for verification
 */

module.exports = (sequelize, DataTypes) => {
  const OTP = sequelize.define('OTP', {
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
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    otp_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Hashed OTP value',
    },
    purpose: {
      type: DataTypes.ENUM(
        'REGISTRATION',
        'LOGIN',
        'TRANSACTION',
        'PIN_RESET',
        'DEVICE_VERIFICATION'
      ),
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of verification attempts',
    },
    max_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 3,
    },
    is_used: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_expired: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    reference: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Reference for linking to transaction',
    },
  }, {
    tableName: 'otps',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['phone_number'] },
      { fields: ['expires_at'] },
      { fields: ['is_used', 'is_expired'] },
    ],
  });

  // Instance methods
  OTP.prototype.isValid = function() {
    return !this.is_used &&
           !this.is_expired &&
           new Date() < new Date(this.expires_at) &&
           this.attempts < this.max_attempts;
  };

  return OTP;
};
