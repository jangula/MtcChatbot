/**
 * Audit Log Model
 * Records all significant system events for compliance
 */

module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Action performed',
    },
    category: {
      type: DataTypes.ENUM(
        'AUTHENTICATION',
        'TRANSACTION',
        'ACCOUNT',
        'SECURITY',
        'SYSTEM',
        'ADMIN'
      ),
      allowNull: false,
    },
    severity: {
      type: DataTypes.ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL'),
      defaultValue: 'INFO',
    },
    status: {
      type: DataTypes.ENUM('SUCCESS', 'FAILURE', 'PENDING'),
      defaultValue: 'SUCCESS',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    request_data: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Sanitized request data',
    },
    response_data: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Sanitized response data',
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Related transaction/session reference',
    },
  }, {
    tableName: 'audit_logs',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['action'] },
      { fields: ['category'] },
      { fields: ['severity'] },
      { fields: ['created_at'] },
      { fields: ['reference'] },
    ],
  });

  // Class method to create audit entry
  AuditLog.log = async function(data) {
    return this.create({
      user_id: data.userId || null,
      action: data.action,
      category: data.category || 'SYSTEM',
      severity: data.severity || 'INFO',
      status: data.status || 'SUCCESS',
      description: data.description,
      ip_address: data.ipAddress,
      user_agent: data.userAgent,
      request_data: data.requestData || {},
      response_data: data.responseData || {},
      metadata: data.metadata || {},
      reference: data.reference,
    });
  };

  return AuditLog;
};
