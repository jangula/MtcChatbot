/**
 * Bill Payment Flow
 * Handles utility and service bill payments
 */

const BaseFlow = require('./baseFlow');
const { extractAmount, isConfirmedYes } = require('../../whatsapp/messageParser');
const { generateReference } = require('../../utils/encryption');
const config = require('../../config');

class BillPaymentFlow extends BaseFlow {
  constructor() {
    super('PAY_BILL');
    this.steps = {
      START: 'START',
      SELECT_BILLER: 'SELECT_BILLER',
      ENTER_ACCOUNT: 'ENTER_ACCOUNT',
      ENTER_AMOUNT: 'ENTER_AMOUNT',
      CONFIRM: 'CONFIRM',
      PROCESSING: 'PROCESSING',
    };
    this.billers = config.menu.billPaymentOptions;
  }

  async start(user, state, session) {
    await this.updateState(state, {
      current_step: this.steps.SELECT_BILLER,
      flow_data: {},
    });

    const sections = [{
      title: 'Bill Payment',
      rows: this.billers.map((b) => ({
        id: b.biller,
        title: b.label,
        description: `Pay ${b.label}`,
      })),
    }];

    return {
      type: 'list',
      header: 'Pay Bill',
      text: 'Select the service you want to pay:',
      buttonText: 'Select Biller',
      sections,
      footer: 'Reply CANCEL to go back',
    };
  }

  async process(user, state, message, session) {
    const { content, listId } = message;
    const step = state.current_step;

    switch (step) {
      case this.steps.SELECT_BILLER:
        return this.handleBillerSelection(user, state, listId || content);

      case this.steps.ENTER_ACCOUNT:
        return this.handleAccountInput(user, state, content);

      case this.steps.ENTER_AMOUNT:
        return this.handleAmountInput(user, state, content);

      case this.steps.CONFIRM:
        return this.handleConfirmation(user, state, message);

      default:
        return this.start(user, state, session);
    }
  }

  async handleBillerSelection(user, state, billerCode) {
    const biller = this.billers.find((b) => b.biller === billerCode || b.id === billerCode);

    if (!biller) {
      return {
        type: 'text',
        text: 'Invalid selection. Please select a biller from the list.',
      };
    }

    await this.updateFlowData(state, 'billerCode', biller.biller);
    await this.updateFlowData(state, 'billerName', biller.label);
    await this.setAwaitingInput(state, 'ACCOUNT', this.steps.ENTER_ACCOUNT);

    const accountLabel = biller.biller === 'ELECTRICITY' ? 'meter number' : 'account number';

    return {
      type: 'text',
      text: `*Pay ${biller.label}*\n\nEnter your ${accountLabel}:`,
    };
  }

  async handleAccountInput(user, state, content) {
    if (!content || content.length < 5) {
      return {
        type: 'text',
        text: 'Invalid account number. Please enter a valid account number:',
      };
    }

    await this.updateFlowData(state, 'customerAccount', content.trim());
    await this.setAwaitingInput(state, 'AMOUNT', this.steps.ENTER_AMOUNT);

    return {
      type: 'text',
      text: `*${state.flow_data.billerName}*\nAccount: ${content.trim()}\n\nEnter the amount to pay (NAD 10 - NAD 50000):`,
    };
  }

  async handleAmountInput(user, state, content) {
    const amount = extractAmount(content);

    if (!amount || amount < 10 || amount > 50000) {
      return {
        type: 'text',
        text: 'Invalid amount. Please enter an amount between NAD 10 and NAD 50000:',
      };
    }

    const balanceResult = await this.marisAPI.getBalance(user.maris_account_id);
    if (amount > balanceResult.availableBalance) {
      return {
        type: 'text',
        text: `Insufficient balance. Your available balance is ${this.formatAmount(balanceResult.availableBalance)}.\n\nPlease enter a smaller amount:`,
      };
    }

    await this.updateFlowData(state, 'amount', amount);
    await this.setAwaitingInput(state, 'CONFIRMATION', this.steps.CONFIRM);

    const flowData = state.flow_data;

    return {
      type: 'confirmation',
      text: `*Confirm Bill Payment*\n\n` +
        `Biller: ${flowData.billerName}\n` +
        `Account: ${flowData.customerAccount}\n` +
        `Amount: ${this.formatAmount(amount)}\n` +
        `Fee: NAD 0.00\n` +
        `Total: ${this.formatAmount(amount)}\n\n` +
        `Confirm this payment?`,
    };
  }

  async handleConfirmation(user, state, message) {
    if (!isConfirmedYes(message)) {
      return this.completeFlow('Payment cancelled.');
    }

    const flowData = state.flow_data;
    const reference = generateReference('BIL');

    await this.updateState(state, { current_step: this.steps.PROCESSING });

    await this.createTransaction(user, 'BILL_PAYMENT', {
      reference,
      amount: flowData.amount,
      billerCode: flowData.billerCode,
      billerAccount: flowData.customerAccount,
      description: `${flowData.billerName} payment`,
    });

    const result = await this.marisAPI.payBill(
      user.maris_account_id,
      flowData.billerCode,
      flowData.customerAccount,
      flowData.amount
    );

    if (result.success) {
      await this.updateTransaction(reference, 'COMPLETED', {
        maris_reference: result.marisReference,
      });

      let successMsg = `*Payment Successful*\n\n` +
        `${flowData.billerName} payment of ${this.formatAmount(flowData.amount)} completed.\n\n` +
        `Reference: ${reference}\n`;

      if (result.token) {
        successMsg += `Token: ${result.token}\n`;
      }

      successMsg += `New Balance: ${this.formatAmount(result.newBalance)}`;

      return this.completeFlow(successMsg);
    } else {
      await this.updateTransaction(reference, 'FAILED', { failure_reason: result.error });
      return this.completeFlow(`*Payment Failed*\n\n${result.error || 'Unable to process payment.'}`);
    }
  }
}

module.exports = BillPaymentFlow;
