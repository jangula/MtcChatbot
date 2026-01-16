/**
 * Transaction Model
 * Records all financial transactions for audit trail
 */

module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define('Transaction', {
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
    reference: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: 'Unique transaction reference',
    },
    maris_reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Reference from MTC Maris system',
    },
    type: {
      type: DataTypes.ENUM(
        'AIRTIME_SELF',
        'AIRTIME_OTHER',
        'DATA_BUNDLE',
        'P2P_TRANSFER',
        'BILL_PAYMENT',
        'MERCHANT_PAYMENT',
        'LOAN_APPLICATION',
        'LOAN_REPAYMENT',
        'SAVINGS_DEPOSIT',
        'SAVINGS_WITHDRAWAL',
        'INSURANCE_PAYMENT',
        'CASH_IN',
        'CASH_OUT'
      ),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'FAILED',
        'CANCELLED',
        'REVERSED'
      ),
      defaultValue: 'PENDING',
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'NAD',
    },
    fee: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'Amount + Fee',
    },
    recipient_phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Recipient phone for P2P/airtime',
    },
    recipient_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    biller_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Bill payment biller code',
    },
    biller_account: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Customer account at biller',
    },
    product_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Product code for bundles/services',
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    failure_reason: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Additional transaction data',
    },
    initiated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'transactions',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['reference'], unique: true },
      { fields: ['maris_reference'] },
      { fields: ['type'] },
      { fields: ['status'] },
      { fields: ['created_at'] },
      { fields: ['user_id', 'created_at'] },
    ],
    hooks: {
      beforeCreate: (transaction) => {
        if (transaction.amount && transaction.fee) {
          transaction.total_amount = parseFloat(transaction.amount) + parseFloat(transaction.fee);
        }
      },
    },
  });

  return Transaction;
};
