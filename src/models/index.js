/**
 * Database Models Index
 * Exports all Sequelize models and associations
 */

const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

// Import model definitions
const UserModel = require('./User');
const SessionModel = require('./Session');
const TransactionModel = require('./Transaction');
const OTPModel = require('./OTP');
const ConversationStateModel = require('./ConversationState');
const AuditLogModel = require('./AuditLog');

// Initialize models
const User = UserModel(sequelize, DataTypes);
const Session = SessionModel(sequelize, DataTypes);
const Transaction = TransactionModel(sequelize, DataTypes);
const OTP = OTPModel(sequelize, DataTypes);
const ConversationState = ConversationStateModel(sequelize, DataTypes);
const AuditLog = AuditLogModel(sequelize, DataTypes);

// Define associations
User.hasMany(Session, { foreignKey: 'user_id', as: 'sessions' });
Session.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Transaction, { foreignKey: 'user_id', as: 'transactions' });
Transaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(OTP, { foreignKey: 'user_id', as: 'otps' });
OTP.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasOne(ConversationState, { foreignKey: 'user_id', as: 'conversationState' });
ConversationState.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = {
  sequelize,
  User,
  Session,
  Transaction,
  OTP,
  ConversationState,
  AuditLog,
};
