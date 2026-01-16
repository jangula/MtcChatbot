/**
 * Insurance Flow
 */

const BaseFlow = require('./baseFlow');
const config = require('../../config');

class InsuranceFlow extends BaseFlow {
  constructor() {
    super('INSURANCE');
    this.insuranceOptions = config.menu.insuranceOptions;
  }

  async start(user, state, session) {
    const sections = [{
      title: 'Insurance Products',
      rows: this.insuranceOptions.map((opt) => ({
        id: opt.type,
        title: opt.label,
        description: `Learn about ${opt.label}`,
      })),
    }];

    return {
      type: 'list',
      header: 'MTC Maris Insurance',
      text: 'Protect yourself and your loved ones with MTC Maris Insurance.\n\nSelect a product to learn more:',
      buttonText: 'View Products',
      sections,
    };
  }

  async process(user, state, message, session) {
    const { listId, content } = message;
    const selection = listId || content?.toUpperCase();

    const descriptions = {
      LIFE_COVER: 'Life Cover provides financial protection for your family in case of death or disability. Premiums start from NAD 20/month.',
      HEALTH: 'Health Insurance covers medical expenses including hospital stays, doctor visits, and medication. Plans from NAD 50/month.',
      LEGAL: 'Legal Cover provides access to legal assistance and covers legal fees. Starting from NAD 30/month.',
    };

    // Map number inputs to insurance types
    const numberMap = { '1': 'LIFE_COVER', '2': 'HEALTH', '3': 'LEGAL' };
    const insuranceType = numberMap[selection] || selection;

    if (insuranceType && descriptions[insuranceType]) {
      return this.completeFlow(
        `*${this.insuranceOptions.find((o) => o.type === insuranceType)?.label}*\n\n${descriptions[insuranceType]}\n\nTo subscribe, visit any MTC shop or call 100.`
      );
    }

    return this.start(user, state, session);
  }
}

module.exports = InsuranceFlow;
