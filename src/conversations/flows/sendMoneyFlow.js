/**
 * Send Money Flow (P2P Transfer)
 * Handles wallet-to-wallet transfers
 */

const BaseFlow = require('./baseFlow');
const { extractPhoneNumber, extractAmount, isConfirmedYes } = require('../../whatsapp/messageParser');
const { generateReference, isValidNamibianPhone, normalizePhoneNumber } = require('../../utils/encryption');

class SendMoneyFlow extends BaseFlow {
  constructor() {
    super('SEND_MONEY');
    this.steps = {
      START: 'START',
      ENTER_RECIPIENT: 'ENTER_RECIPIENT',
      ENTER_AMOUNT: 'ENTER_AMOUNT',
      CONFIRM: 'CONFIRM',
      PROCESSING: 'PROCESSING',
    };
  }

  /**
   * Start send money flow
   */
  async start(user, state, session) {
    await this.updateState(state, {
      current_step: this.steps.ENTER_RECIPIENT,
      flow_data: {},
    });

    return {
      type: 'text',
      text: `*Send Money*\n\nEnter the recipient's phone number:\n\nExample: 0811234567`,
    };
  }

  /**
   * Process user input
   */
  async process(user, state, message, session) {
    const { content } = message;
    const step = state.current_step;

    switch (step) {
      case this.steps.ENTER_RECIPIENT:
        return this.handleRecipientInput(user, state, content);

      case this.steps.ENTER_AMOUNT:
        return this.handleAmountInput(user, state, content);

      case this.steps.CONFIRM:
        return this.handleConfirmation(user, state, message);

      default:
        return this.start(user, state, session);
    }
  }

  /**
   * Handle recipient phone input
   */
  async handleRecipientInput(user, state, content) {
    const phoneNumber = extractPhoneNumber(content) || normalizePhoneNumber(content);

    if (!isValidNamibianPhone(content)) {
      return {
        type: 'text',
        text: `Invalid phone number. Please enter a valid Namibian mobile number.\n\nExample: 0811234567`,
      };
    }

    // Check if sending to self
    if (phoneNumber === user.phone_number) {
      return {
        type: 'text',
        text: `You cannot send money to yourself. Please enter a different number.`,
      };
    }

    // Check if recipient has Maris account
    const accountCheck = await this.marisAPI.checkAccount(phoneNumber);

    if (!accountCheck.exists) {
      return {
        type: 'text',
        text: `This number is not registered on MTC Maris. The recipient needs an MTC Maris account to receive money.\n\nPlease enter a different number:`,
      };
    }

    await this.updateFlowData(state, 'recipient', phoneNumber);
    await this.updateFlowData(state, 'recipientDisplay', this.maskPhone(phoneNumber));
    await this.setAwaitingInput(state, 'AMOUNT', this.steps.ENTER_AMOUNT);

    return {
      type: 'text',
      text: `*Send Money to ${this.maskPhone(phoneNumber)}*\n\nEnter the amount to send (NAD 1 - NAD 25000):\n\nExample: 100`,
    };
  }

  /**
   * Handle amount input
   */
  async handleAmountInput(user, state, content) {
    const amount = extractAmount(content);

    if (!amount || amount < 1 || amount > 25000) {
      return {
        type: 'text',
        text: `Invalid amount. Please enter an amount between NAD 1 and NAD 25000.\n\nExample: 100`,
      };
    }

    // Check balance
    const balanceResult = await this.marisAPI.getBalance(user.maris_account_id);
    if (amount > balanceResult.availableBalance) {
      return {
        type: 'text',
        text: `Insufficient balance. Your available balance is ${this.formatAmount(balanceResult.availableBalance)}.\n\nPlease enter a smaller amount:`,
      };
    }

    await this.updateFlowData(state, 'amount', amount);
    await this.updateFlowData(state, 'fee', 0); // P2P transfers are usually free
    await this.setAwaitingInput(state, 'CONFIRMATION', this.steps.CONFIRM);

    const flowData = state.flow_data;

    return {
      type: 'confirmation',
      text: `*Confirm Money Transfer*\n\n` +
        `Recipient: ${flowData.recipientDisplay}\n` +
        `Amount: ${this.formatAmount(amount)}\n` +
        `Fee: NAD 0.00\n` +
        `Total: ${this.formatAmount(amount)}\n\n` +
        `Confirm this transfer?`,
    };
  }

  /**
   * Handle confirmation
   */
  async handleConfirmation(user, state, message) {
    if (!isConfirmedYes(message)) {
      return this.completeFlow('Transfer cancelled.');
    }

    const flowData = state.flow_data;
    const reference = generateReference('P2P');

    await this.updateState(state, { current_step: this.steps.PROCESSING });

    // Create transaction record
    await this.createTransaction(user, 'P2P_TRANSFER', {
      reference,
      amount: flowData.amount,
      fee: flowData.fee,
      recipientPhone: flowData.recipient,
      description: `Transfer to ${flowData.recipientDisplay}`,
    });

    // Call Maris API
    const result = await this.marisAPI.transferMoney(
      user.maris_account_id,
      flowData.recipient,
      flowData.amount
    );

    if (result.success) {
      await this.updateTransaction(reference, 'COMPLETED', {
        maris_reference: result.marisReference,
        recipient_name: result.recipientName,
      });

      await this.auditLog(user.id, 'P2P_TRANSFER', {
        status: 'SUCCESS',
        reference,
        metadata: { amount: flowData.amount, recipient: flowData.recipientDisplay },
      });

      return this.completeFlow(
        `*Transfer Successful*\n\n` +
        `${this.formatAmount(flowData.amount)} sent to ${result.recipientName || flowData.recipientDisplay}.\n\n` +
        `Reference: ${reference}\n` +
        `New Balance: ${this.formatAmount(result.newBalance)}`
      );
    } else {
      await this.updateTransaction(reference, 'FAILED', {
        failure_reason: result.error,
      });

      return this.completeFlow(
        `*Transfer Failed*\n\n` +
        `${result.error || 'Unable to complete transfer.'}\n\n` +
        `Please try again later.`
      );
    }
  }
}

module.exports = SendMoneyFlow;
