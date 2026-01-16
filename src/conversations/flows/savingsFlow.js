/**
 * Savings Flow
 */

const BaseFlow = require('./baseFlow');

class SavingsFlow extends BaseFlow {
  constructor() {
    super('SAVINGS');
  }

  async start(user, state, session) {
    const balance = await this.marisAPI.getBalance(user.maris_account_id);

    return {
      type: 'buttons',
      header: 'MTC Maris Savings',
      text: `Your Savings Balance: ${this.formatAmount(balance.savingsBalance || 0)}\n\nWhat would you like to do?`,
      buttons: [
        { id: 'DEPOSIT', title: 'Deposit' },
        { id: 'WITHDRAW', title: 'Withdraw' },
        { id: 'HISTORY', title: 'View History' },
      ],
    };
  }

  async process(user, state, message, session) {
    const { buttonId, content } = message;
    const selection = buttonId || content?.toUpperCase();

    if (selection === 'DEPOSIT' || selection === '1') {
      return this.completeFlow('Savings deposit feature coming soon. Type MENU for other options.');
    }
    if (selection === 'WITHDRAW' || selection === '2') {
      return this.completeFlow('Savings withdrawal feature coming soon. Type MENU for other options.');
    }
    if (selection === 'HISTORY' || selection === '3') {
      return this.completeFlow('No savings transactions found. Type MENU for other options.');
    }

    return this.start(user, state, session);
  }
}

module.exports = SavingsFlow;
