/**
 * Transaction History Flow
 * Displays recent transaction history
 */

const BaseFlow = require('./baseFlow');

class HistoryFlow extends BaseFlow {
  constructor() {
    super('TRANSACTION_HISTORY');
  }

  /**
   * Start history flow - shows recent transactions
   */
  async start(user, state, session) {
    try {
      const result = await this.marisAPI.getTransactionHistory(user.maris_account_id, 5);

      if (result.success && result.transactions.length > 0) {
        let historyText = `*Recent Transactions*\n\n`;

        result.transactions.forEach((txn, index) => {
          const date = new Date(txn.date).toLocaleDateString();
          const amount = txn.amount >= 0 ? `+${this.formatAmount(txn.amount)}` : this.formatAmount(txn.amount);
          historyText += `${index + 1}. ${txn.description}\n`;
          historyText += `   ${amount} | ${date}\n`;
          historyText += `   Ref: ${txn.reference}\n\n`;
        });

        await this.auditLog(user.id, 'VIEW_HISTORY', { status: 'SUCCESS' });

        return this.completeFlow(historyText);
      } else if (result.success) {
        return this.completeFlow('No recent transactions found.');
      } else {
        return this.completeFlow('Unable to retrieve transaction history. Please try again later.');
      }
    } catch (error) {
      return this.completeFlow('An error occurred. Please try again later.');
    }
  }

  async process(user, state, message, session) {
    return this.start(user, state, session);
  }
}

module.exports = HistoryFlow;
