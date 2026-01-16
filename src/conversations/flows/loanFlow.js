/**
 * Instant Loan Flow
 */

const BaseFlow = require('./baseFlow');
const { extractAmount, isConfirmedYes } = require('../../whatsapp/messageParser');
const { generateReference } = require('../../utils/encryption');

class LoanFlow extends BaseFlow {
  constructor() {
    super('INSTANT_LOAN');
    this.steps = {
      START: 'START',
      SELECT_ACTION: 'SELECT_ACTION',
      ENTER_AMOUNT: 'ENTER_AMOUNT',
      CONFIRM: 'CONFIRM',
    };
  }

  async start(user, state, session) {
    await this.updateState(state, { current_step: this.steps.SELECT_ACTION, flow_data: {} });

    return {
      type: 'buttons',
      header: 'Instant Loan',
      text: 'What would you like to do?',
      buttons: [
        { id: 'APPLY', title: 'Apply for Loan' },
        { id: 'CHECK_ELIGIBILITY', title: 'Check Eligibility' },
        { id: 'LOAN_HISTORY', title: 'Loan History' },
      ],
    };
  }

  async process(user, state, message, session) {
    const { content, buttonId } = message;
    const step = state.current_step;

    switch (step) {
      case this.steps.SELECT_ACTION:
        return this.handleActionSelection(user, state, buttonId || content);
      case this.steps.ENTER_AMOUNT:
        return this.handleAmountInput(user, state, content);
      case this.steps.CONFIRM:
        return this.handleConfirmation(user, state, message);
      default:
        return this.start(user, state, session);
    }
  }

  async handleActionSelection(user, state, action) {
    // Map number inputs to actions
    const actionMap = { '1': 'APPLY', '2': 'CHECK_ELIGIBILITY', '3': 'LOAN_HISTORY' };
    action = actionMap[action] || action?.toUpperCase();

    if (action === 'CHECK_ELIGIBILITY') {
      const eligibility = await this.marisAPI.checkLoanEligibility(user.maris_account_id);
      if (eligibility.eligible) {
        return this.completeFlow(
          `*Loan Eligibility*\n\nYou are eligible for a loan up to ${this.formatAmount(eligibility.maxAmount)}.\n` +
          `Interest Rate: ${eligibility.interestRate}%\n\nType MENU to apply.`
        );
      }
      return this.completeFlow('*Loan Eligibility*\n\nYou are not currently eligible for a loan. Please try again later.');
    }

    if (action === 'LOAN_HISTORY') {
      return this.completeFlow('*Loan History*\n\nNo active or previous loans found.');
    }

    if (action === 'APPLY') {
      const eligibility = await this.marisAPI.checkLoanEligibility(user.maris_account_id);
      if (!eligibility.eligible) {
        return this.completeFlow('You are not currently eligible for a loan.');
      }

      await this.updateFlowData(state, 'maxAmount', eligibility.maxAmount);
      await this.updateFlowData(state, 'interestRate', eligibility.interestRate);
      await this.setAwaitingInput(state, 'AMOUNT', this.steps.ENTER_AMOUNT);

      return {
        type: 'text',
        text: `*Apply for Instant Loan*\n\nYou can borrow up to ${this.formatAmount(eligibility.maxAmount)}.\n` +
          `Interest Rate: ${eligibility.interestRate}%\n\nEnter loan amount:`,
      };
    }

    return this.start(user, state, null);
  }

  async handleAmountInput(user, state, content) {
    const amount = extractAmount(content);
    const maxAmount = state.flow_data.maxAmount;

    if (!amount || amount < 50 || amount > maxAmount) {
      return { type: 'text', text: `Please enter an amount between NAD 50 and ${this.formatAmount(maxAmount)}:` };
    }

    const interest = amount * (state.flow_data.interestRate / 100);
    const total = amount + interest;

    await this.updateFlowData(state, 'amount', amount);
    await this.updateFlowData(state, 'interest', interest);
    await this.updateFlowData(state, 'totalRepayment', total);
    await this.setAwaitingInput(state, 'CONFIRMATION', this.steps.CONFIRM);

    return {
      type: 'confirmation',
      text: `*Confirm Loan Application*\n\n` +
        `Loan Amount: ${this.formatAmount(amount)}\n` +
        `Interest: ${this.formatAmount(interest)}\n` +
        `Total Repayment: ${this.formatAmount(total)}\n` +
        `Due: 30 days\n\nConfirm?`,
    };
  }

  async handleConfirmation(user, state, message) {
    if (!isConfirmedYes(message)) {
      return this.completeFlow('Loan application cancelled.');
    }

    const flowData = state.flow_data;
    const result = await this.marisAPI.applyLoan(user.maris_account_id, flowData.amount);

    if (result.success) {
      return this.completeFlow(
        `*Loan Approved*\n\n${this.formatAmount(result.approvedAmount)} has been credited to your wallet.\n\n` +
        `Repayment: ${this.formatAmount(result.totalRepayment)}\nDue: ${new Date(result.dueDate).toLocaleDateString()}\n` +
        `Ref: ${result.reference}`
      );
    }
    return this.completeFlow(`*Loan Application Failed*\n\n${result.error || 'Please try again later.'}`);
  }
}

module.exports = LoanFlow;
