/**
 * User Model
 * Stores user information linked to MTC Maris accounts
 */

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: 'Normalized phone number (264XXXXXXXXX)',
    },
    whatsapp_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      comment: 'WhatsApp user ID',
    },
    maris_account_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'MTC Maris wallet account ID',
    },
    is_registered: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether user has registered MTC Maris account',
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether phone number is OTP verified',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Account active status',
    },
    is_blocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether account is blocked due to security',
    },
    blocked_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    blocked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    pin_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Failed PIN attempts counter',
    },
    last_pin_attempt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    language: {
      type: DataTypes.STRING(5),
      defaultValue: 'en',
      comment: 'Preferred language code',
    },
    last_activity: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Additional user metadata',
    },
  }, {
    tableName: 'users',
    indexes: [
      { fields: ['phone_number'], unique: true },
      { fields: ['whatsapp_id'] },
      { fields: ['maris_account_id'] },
      { fields: ['is_active', 'is_blocked'] },
    ],
  });

  return User;
};
