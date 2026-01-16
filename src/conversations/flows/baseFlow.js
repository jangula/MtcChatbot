/**
 * Base Flow Class
 * Abstract base class for all conversation flows
 */

const logger = require('../../utils/logger');
const { Transaction, AuditLog } = require('../../models');
const MarisAPI = require('../../maris-api/client');

class BaseFlow {
  constructor(flowName) {
    this.flowName = flowName;
    this.marisAPI = new MarisAPI();
  }

  /**
   * Start the flow - to be implemented by subclasses
   */
  async start(user, state, session) {
    throw new Error('start() must be implemented by subclass');
  }

  /**
   * Process user input - to be implemented by subclasses
   */
  async process(user, state, message, session) {
    throw new Error('process() must be implemented by subclass');
  }

  /**
   * Helper: Update conversation state
   */
  async updateState(state, updates) {
    await state.update({
      ...updates,
      updated_at: new Date(),
    });
  }

  /**
   * Helper: Set awaiting input
   */
  async setAwaitingInput(state, inputType, step = null) {
    await this.updateState(state, {
      awaiting_input: inputType,
      current_step: step || state.current_step,
    });
  }

  /**
   * Helper: Update flow data
   */
  async updateFlowData(state, key, value) {
    const flowData = { ...state.flow_data, [key]: value };
    await this.updateState(state, { flow_data: flowData });
  }

  /**
   * Helper: Create transaction record
   */
  async createTransaction(user, type, data) {
    try {
      const transaction = await Transaction.create({
        user_id: user.id,
        reference: data.reference,
        maris_reference: data.marisReference,
        type,
        status: 'PENDING',
        amount: data.amount,
        fee: data.fee || 0,
        currency: 'NAD',
        recipient_phone: data.recipientPhone,
        recipient_name: data.recipientName,
        biller_code: data.billerCode,
        biller_account: data.billerAccount,
        product_code: data.productCode,
        description: data.description,
        metadata: data.metadata || {},
      });

      logger.logTransaction(type, 'PENDING', data.reference);
      return transaction;
    } catch (error) {
      logger.error('Failed to create transaction', { error: error.message });
      throw error;
    }
  }

  /**
   * Helper: Update transaction status
   */
  async updateTransaction(reference, status, additionalData = {}) {
    try {
      const transaction = await Transaction.findOne({ where: { reference } });
      if (transaction) {
        await transaction.update({
          status,
          ...additionalData,
          completed_at: ['COMPLETED', 'FAILED'].includes(status) ? new Date() : null,
        });
        logger.logTransaction(transaction.type, status, reference);
      }
      return transaction;
    } catch (error) {
      logger.error('Failed to update transaction', { error: error.message });
    }
  }

  /**
   * Helper: Format currency
   */
  formatAmount(amount) {
    return `NAD ${parseFloat(amount).toFixed(2)}`;
  }

  /**
   * Helper: Mask phone number
   */
  maskPhone(phone) {
    if (!phone || phone.length < 10) return '****';
    return phone.substring(0, 3) + '****' + phone.slice(-4);
  }

  /**
   * Helper: Create error response
   */
  errorResponse(message = 'Something went wrong. Please try again.') {
    return {
      type: 'text',
      text: message,
    };
  }

  /**
   * Helper: Create flow complete response
   */
  completeFlow(message) {
    return {
      flowComplete: true,
      type: 'text',
      text: message,
    };
  }

  /**
   * Helper: Audit log
   */
  async auditLog(userId, action, data = {}) {
    await AuditLog.log({
      userId,
      action,
      category: 'TRANSACTION',
      status: data.status || 'SUCCESS',
      reference: data.reference,
      metadata: data.metadata,
    });
  }
}

module.exports = BaseFlow;
