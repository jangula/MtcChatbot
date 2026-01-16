/**
 * Airtime Purchase Flow
 * Handles airtime purchase for self and others
 */

const BaseFlow = require('./baseFlow');
const { extractPhoneNumber, extractAmount, isConfirmedYes } = require('../../whatsapp/messageParser');
const { generateReference, isValidNamibianPhone, normalizePhoneNumber } = require('../../utils/encryption');

class AirtimeFlow extends BaseFlow {
  constructor() {
    super('BUY_AIRTIME');
    this.steps = {
      START: 'START',
      SELECT_RECIPIENT: 'SELECT_RECIPIENT',
      ENTER_PHONE: 'ENTER_PHONE',
      ENTER_AMOUNT: 'ENTER_AMOUNT',
      CONFIRM: 'CONFIRM',
      PROCESSING: 'PROCESSING',
    };
  }

  /**
   * Start airtime flow
   */
  async start(user, state, session) {
    await this.updateState(state, {
      current_step: this.steps.SELECT_RECIPIENT,
      flow_data: {},
    });

    return {
      type: 'buttons',
      header: 'Buy Airtime',
      text: 'Who would you like to buy airtime for?',
      buttons: [
        { id: 'SELF', title: 'My Number' },
        { id: 'OTHER', title: 'Another Number' },
      ],
      footer: 'Reply CANCEL to go back',
    };
  }

  /**
   * Process user input
   */
  async process(user, state, message, session) {
    const { content, type, buttonId } = message;
    const step = state.current_step;

    switch (step) {
      case this.steps.SELECT_RECIPIENT:
        return this.handleRecipientSelection(user, state, content, buttonId);

      case this.steps.ENTER_PHONE:
        return this.handlePhoneInput(user, state, content);

      case this.steps.ENTER_AMOUNT:
        return this.handleAmountInput(user, state, content);

      case this.steps.CONFIRM:
        return this.handleConfirmation(user, state, message);

      default:
        return this.start(user, state, session);
    }
  }

  /**
   * Handle recipient selection (self or other)
   */
  async handleRecipientSelection(user, state, content, buttonId) {
    const selection = buttonId || content?.toUpperCase();

    if (selection === 'SELF' || content === '1') {
      // Buying for self
      await this.updateFlowData(state, 'recipient', user.phone_number);
      await this.updateFlowData(state, 'recipientDisplay', 'My Number');
      await this.updateFlowData(state, 'isSelf', true);
      await this.setAwaitingInput(state, 'AMOUNT', this.steps.ENTER_AMOUNT);

      return {
        type: 'text',
        text: `*Buy Airtime - My Number*\n\nEnter the amount you want to buy (NAD 5 - NAD 5000):\n\nExample: 50`,
      };
    }

    if (selection === 'OTHER' || content === '2') {
      // Buying for another number
      await this.updateFlowData(state, 'isSelf', false);
      await this.setAwaitingInput(state, 'PHONE', this.steps.ENTER_PHONE);

      return {
        type: 'text',
        text: `*Buy Airtime - Other Number*\n\nEnter the phone number to buy airtime for:\n\nExample: 0811234567`,
      };
    }

    // Invalid selection
    return {
      type: 'buttons',
      text: 'Please select an option:',
      buttons: [
        { id: 'SELF', title: 'My Number' },
        { id: 'OTHER', title: 'Another Number' },
      ],
    };
  }

  /**
   * Handle phone number input
   */
  async handlePhoneInput(user, state, content) {
    const phoneNumber = extractPhoneNumber(content) || normalizePhoneNumber(content);

    if (!isValidNamibianPhone(content)) {
      return {
        type: 'text',
        text: `Invalid phone number. Please enter a valid Namibian mobile number.\n\nExample: 0811234567 or 264811234567`,
      };
    }

    await this.updateFlowData(state, 'recipient', phoneNumber);
    await this.updateFlowData(state, 'recipientDisplay', this.maskPhone(phoneNumber));
    await this.setAwaitingInput(state, 'AMOUNT', this.steps.ENTER_AMOUNT);

    return {
      type: 'text',
      text: `*Buy Airtime for ${this.maskPhone(phoneNumber)}*\n\nEnter the amount you want to buy (NAD 5 - NAD 5000):\n\nExample: 50`,
    };
  }

  /**
   * Handle amount input
   */
  async handleAmountInput(user, state, content) {
    const amount = extractAmount(content);

    if (!amount || amount < 5 || amount > 5000) {
      return {
        type: 'text',
        text: `Invalid amount. Please enter an amount between NAD 5 and NAD 5000.\n\nExample: 50`,
      };
    }

    await this.updateFlowData(state, 'amount', amount);
    await this.setAwaitingInput(state, 'CONFIRMATION', this.steps.CONFIRM);

    const flowData = state.flow_data;
    const recipient = flowData.isSelf ? 'your number' : flowData.recipientDisplay;

    return {
      type: 'confirmation',
      text: `*Confirm Airtime Purchase*\n\n` +
        `Recipient: ${recipient}\n` +
        `Amount: ${this.formatAmount(amount)}\n` +
        `Fee: NAD 0.00\n` +
        `Total: ${this.formatAmount(amount)}\n\n` +
        `Confirm this transaction?`,
    };
  }

  /**
   * Handle confirmation
   */
  async handleConfirmation(user, state, message) {
    if (!isConfirmedYes(message)) {
      return this.completeFlow('Transaction cancelled.');
    }

    const flowData = state.flow_data;
    const reference = generateReference('AIR');

    await this.updateState(state, { current_step: this.steps.PROCESSING });

    // Create transaction record
    await this.createTransaction(user, flowData.isSelf ? 'AIRTIME_SELF' : 'AIRTIME_OTHER', {
      reference,
      amount: flowData.amount,
      recipientPhone: flowData.recipient,
      description: `Airtime purchase for ${flowData.recipientDisplay}`,
    });

    // Call Maris API
    const result = await this.marisAPI.purchaseAirtime(
      user.maris_account_id,
      flowData.recipient,
      flowData.amount
    );

    if (result.success) {
      await this.updateTransaction(reference, 'COMPLETED', {
        maris_reference: result.marisReference,
      });

      await this.auditLog(user.id, 'AIRTIME_PURCHASE', {
        status: 'SUCCESS',
        reference,
        metadata: { amount: flowData.amount, recipient: this.maskPhone(flowData.recipient) },
      });

      const recipient = flowData.isSelf ? 'your number' : flowData.recipientDisplay;
      return this.completeFlow(
        `*Transaction Successful*\n\n` +
        `${this.formatAmount(flowData.amount)} airtime sent to ${recipient}.\n\n` +
        `Reference: ${reference}\n` +
        `New Balance: ${this.formatAmount(result.newBalance)}`
      );
    } else {
      await this.updateTransaction(reference, 'FAILED', {
        failure_reason: result.error,
      });

      return this.completeFlow(
        `*Transaction Failed*\n\n` +
        `${result.error || 'Unable to process airtime purchase.'}\n\n` +
        `Please try again later.`
      );
    }
  }
}

module.exports = AirtimeFlow;
