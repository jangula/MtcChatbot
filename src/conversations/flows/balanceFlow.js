/**
 * Balance Check Flow
 * Displays user's wallet balance
 */

const BaseFlow = require('./baseFlow');

class BalanceFlow extends BaseFlow {
  constructor() {
    super('CHECK_BALANCE');
  }

  /**
   * Start balance check - directly shows balance
   */
  async start(user, state, session) {
    try {
      const result = await this.marisAPI.getBalance(user.maris_account_id);

      if (result.success) {
        await this.auditLog(user.id, 'BALANCE_CHECK', { status: 'SUCCESS' });

        return this.completeFlow(
          `*Your MTC Maris Balance*\n\n` +
          `Wallet Balance: ${this.formatAmount(result.balance)}\n` +
          `Available: ${this.formatAmount(result.availableBalance)}\n` +
          (result.savingsBalance > 0 ? `Savings: ${this.formatAmount(result.savingsBalance)}\n` : '') +
          `\nLast updated: ${new Date().toLocaleTimeString()}`
        );
      } else {
        return this.completeFlow('Unable to retrieve balance. Please try again later.');
      }
    } catch (error) {
      return this.completeFlow('An error occurred. Please try again later.');
    }
  }

  /**
   * Process - not needed for balance check
   */
  async process(user, state, message, session) {
    return this.start(user, state, session);
  }
}

module.exports = BalanceFlow;
