/**
 * Data Bundle Purchase Flow
 */

const BaseFlow = require('./baseFlow');
const { extractPhoneNumber, isConfirmedYes } = require('../../whatsapp/messageParser');
const { generateReference, isValidNamibianPhone, normalizePhoneNumber } = require('../../utils/encryption');

class DataBundleFlow extends BaseFlow {
  constructor() {
    super('BUY_DATA');
    this.steps = {
      START: 'START',
      SELECT_RECIPIENT: 'SELECT_RECIPIENT',
      ENTER_PHONE: 'ENTER_PHONE',
      SELECT_BUNDLE: 'SELECT_BUNDLE',
      CONFIRM: 'CONFIRM',
      PROCESSING: 'PROCESSING',
    };
  }

  async start(user, state, session) {
    await this.updateState(state, {
      current_step: this.steps.SELECT_RECIPIENT,
      flow_data: {},
    });

    return {
      type: 'buttons',
      header: 'Buy Data Bundle',
      text: 'Who would you like to buy data for?',
      buttons: [
        { id: 'SELF', title: 'My Number' },
        { id: 'OTHER', title: 'Another Number' },
      ],
    };
  }

  async process(user, state, message, session) {
    const { content, buttonId, listId } = message;
    const step = state.current_step;

    switch (step) {
      case this.steps.SELECT_RECIPIENT:
        return this.handleRecipientSelection(user, state, buttonId || content);
      case this.steps.ENTER_PHONE:
        return this.handlePhoneInput(user, state, content);
      case this.steps.SELECT_BUNDLE:
        return this.handleBundleSelection(user, state, listId || content);
      case this.steps.CONFIRM:
        return this.handleConfirmation(user, state, message);
      default:
        return this.start(user, state, session);
    }
  }

  async handleRecipientSelection(user, state, selection) {
    if (selection === 'SELF' || selection === '1') {
      await this.updateFlowData(state, 'recipient', user.phone_number);
      await this.updateFlowData(state, 'isSelf', true);
      return this.showBundleList(user, state);
    }

    if (selection === 'OTHER' || selection === '2') {
      await this.updateFlowData(state, 'isSelf', false);
      await this.setAwaitingInput(state, 'PHONE', this.steps.ENTER_PHONE);
      return { type: 'text', text: '*Buy Data - Other Number*\n\nEnter the phone number:' };
    }

    return { type: 'text', text: 'Please select My Number or Another Number.' };
  }

  async handlePhoneInput(user, state, content) {
    if (!isValidNamibianPhone(content)) {
      return { type: 'text', text: 'Invalid phone number. Please enter a valid number:' };
    }
    await this.updateFlowData(state, 'recipient', normalizePhoneNumber(content));
    return this.showBundleList(user, state);
  }

  async showBundleList(user, state) {
    const bundlesResult = await this.marisAPI.getDataBundles();
    await this.updateFlowData(state, 'bundles', bundlesResult.bundles);
    await this.setAwaitingInput(state, 'BUNDLE', this.steps.SELECT_BUNDLE);

    const sections = [{
      title: 'Data Bundles',
      rows: bundlesResult.bundles.map((b) => ({
        id: b.code,
        title: b.name,
        description: `NAD ${b.price} - ${b.validity}`,
      })),
    }];

    return {
      type: 'list',
      header: 'Select Data Bundle',
      text: 'Choose a data bundle:',
      buttonText: 'View Bundles',
      sections,
    };
  }

  async handleBundleSelection(user, state, bundleCode) {
    const bundles = state.flow_data.bundles || [];
    const bundle = bundles.find((b) => b.code === bundleCode);

    if (!bundle) {
      return { type: 'text', text: 'Invalid selection. Please select a bundle from the list.' };
    }

    await this.updateFlowData(state, 'bundle', bundle);
    await this.setAwaitingInput(state, 'CONFIRMATION', this.steps.CONFIRM);

    const recipient = state.flow_data.isSelf ? 'My Number' : this.maskPhone(state.flow_data.recipient);

    return {
      type: 'confirmation',
      text: `*Confirm Data Purchase*\n\n` +
        `Bundle: ${bundle.name}\n` +
        `Recipient: ${recipient}\n` +
        `Price: ${this.formatAmount(bundle.price)}\n` +
        `Validity: ${bundle.validity}\n\n` +
        `Confirm?`,
    };
  }

  async handleConfirmation(user, state, message) {
    if (!isConfirmedYes(message)) {
      return this.completeFlow('Purchase cancelled.');
    }

    const flowData = state.flow_data;
    const reference = generateReference('DAT');

    await this.createTransaction(user, 'DATA_BUNDLE', {
      reference,
      amount: flowData.bundle.price,
      recipientPhone: flowData.recipient,
      productCode: flowData.bundle.code,
      description: `${flowData.bundle.name} purchase`,
    });

    const result = await this.marisAPI.purchaseDataBundle(
      user.maris_account_id,
      flowData.recipient,
      flowData.bundle.code,
      flowData.bundle.price
    );

    if (result.success) {
      await this.updateTransaction(reference, 'COMPLETED', { maris_reference: result.marisReference });
      return this.completeFlow(
        `*Purchase Successful*\n\n${flowData.bundle.name} activated.\n\nRef: ${reference}\nBalance: ${this.formatAmount(result.newBalance)}`
      );
    } else {
      await this.updateTransaction(reference, 'FAILED', { failure_reason: result.error });
      return this.completeFlow(`*Purchase Failed*\n\n${result.error || 'Please try again.'}`);
    }
  }
}

module.exports = DataBundleFlow;
