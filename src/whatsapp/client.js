/**
 * WhatsApp Business API Client
 * Handles all communication with Meta's WhatsApp Cloud API
 */

const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

class WhatsAppClient {
  constructor() {
    this.apiUrl = config.whatsapp.apiUrl;
    this.phoneNumberId = config.whatsapp.phoneNumberId;
    this.accessToken = config.whatsapp.accessToken;

    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Request/Response interceptors for logging
    this.client.interceptors.request.use(
      (request) => {
        logger.debug('WhatsApp API Request', {
          method: request.method,
          url: request.url,
        });
        return request;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('WhatsApp API Response', {
          status: response.status,
        });
        return response;
      },
      (error) => {
        logger.error('WhatsApp API Error', {
          status: error.response?.status,
          message: error.response?.data?.error?.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Send a text message
   * @param {string} to - Recipient phone number
   * @param {string} text - Message text
   * @param {boolean} previewUrl - Enable URL preview
   */
  async sendTextMessage(to, text, previewUrl = false) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: previewUrl,
        body: text,
      },
    };

    return this._sendMessage(payload);
  }

  /**
   * Send an interactive button message
   * @param {string} to - Recipient phone number
   * @param {string} bodyText - Message body
   * @param {Array} buttons - Array of button objects {id, title}
   * @param {string} headerText - Optional header
   * @param {string} footerText - Optional footer
   */
  async sendButtonMessage(to, bodyText, buttons, headerText = null, footerText = null) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.slice(0, 3).map((btn) => ({
            type: 'reply',
            reply: {
              id: btn.id,
              title: btn.title.substring(0, 20),
            },
          })),
        },
      },
    };

    if (headerText) {
      payload.interactive.header = { type: 'text', text: headerText };
    }
    if (footerText) {
      payload.interactive.footer = { text: footerText };
    }

    return this._sendMessage(payload);
  }

  /**
   * Send an interactive list message
   * @param {string} to - Recipient phone number
   * @param {string} bodyText - Message body
   * @param {string} buttonText - Button text to open list
   * @param {Array} sections - Array of section objects with items
   * @param {string} headerText - Optional header
   * @param {string} footerText - Optional footer
   */
  async sendListMessage(to, bodyText, buttonText, sections, headerText = null, footerText = null) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: buttonText.substring(0, 20),
          sections: sections.map((section) => ({
            title: section.title?.substring(0, 24) || 'Options',
            rows: section.rows.slice(0, 10).map((row) => ({
              id: row.id,
              title: row.title.substring(0, 24),
              description: row.description?.substring(0, 72),
            })),
          })),
        },
      },
    };

    if (headerText) {
      payload.interactive.header = { type: 'text', text: headerText };
    }
    if (footerText) {
      payload.interactive.footer = { text: footerText };
    }

    return this._sendMessage(payload);
  }

  /**
   * Send main menu as list
   * @param {string} to - Recipient phone number
   * @param {string} greeting - Greeting message
   */
  async sendMainMenu(to, greeting = 'Welcome to MTC Maris!') {
    const sections = [
      {
        title: 'Services',
        rows: [
          { id: 'BUY_AIRTIME', title: 'Buy Airtime', description: 'Purchase airtime for self or others' },
          { id: 'BUY_DATA', title: 'Buy Data Bundle', description: 'Purchase data bundles' },
          { id: 'SEND_MONEY', title: 'Send Money', description: 'Transfer to another wallet' },
          { id: 'PAY_BILL', title: 'Pay Bill', description: 'Pay utilities and services' },
          { id: 'PAY_MERCHANT', title: 'Pay Merchant', description: 'Pay at merchant locations' },
        ],
      },
      {
        title: 'Account',
        rows: [
          { id: 'CHECK_BALANCE', title: 'Check Balance', description: 'View wallet balance' },
          { id: 'TRANSACTION_HISTORY', title: 'History', description: 'View recent transactions' },
          { id: 'INSTANT_LOAN', title: 'Instant Loan', description: 'Apply for a loan' },
          { id: 'SAVINGS', title: 'Savings', description: 'Manage savings pocket' },
          { id: 'INSURANCE', title: 'Insurance', description: 'Insurance products' },
        ],
      },
    ];

    return this.sendListMessage(
      to,
      `${greeting}\n\nChoose a service from the menu below:`,
      'View Menu',
      sections,
      'MTC Maris',
      'Reply HELP for assistance'
    );
  }

  /**
   * Send confirmation message with Yes/No buttons
   * @param {string} to - Recipient phone number
   * @param {string} message - Confirmation message
   */
  async sendConfirmation(to, message) {
    return this.sendButtonMessage(
      to,
      message,
      [
        { id: 'CONFIRM_YES', title: 'Yes, Confirm' },
        { id: 'CONFIRM_NO', title: 'No, Cancel' },
      ],
      'Confirm Transaction'
    );
  }

  /**
   * Send template message
   * @param {string} to - Recipient phone number
   * @param {string} templateName - Template name
   * @param {string} languageCode - Language code
   * @param {Array} components - Template components
   */
  async sendTemplateMessage(to, templateName, languageCode = 'en', components = []) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    };

    return this._sendMessage(payload);
  }

  /**
   * Mark message as read
   * @param {string} messageId - WhatsApp message ID
   */
  async markAsRead(messageId) {
    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };

    try {
      await this.client.post(`/${this.phoneNumberId}/messages`, payload);
      return true;
    } catch (error) {
      logger.error('Failed to mark message as read', { messageId, error: error.message });
      return false;
    }
  }

  /**
   * Internal method to send messages
   */
  async _sendMessage(payload) {
    try {
      const response = await this.client.post(
        `/${this.phoneNumberId}/messages`,
        payload
      );

      logger.logWhatsAppMessage(payload.to, payload.type, 'outgoing');

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        data: response.data,
      };
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      logger.error('Failed to send WhatsApp message', {
        to: payload.to?.substring(0, 6) + '****',
        type: payload.type,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Verify webhook signature
   * @param {string} signature - X-Hub-Signature-256 header
   * @param {string} body - Raw request body
   */
  verifyWebhookSignature(signature, body) {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', config.whatsapp.appSecret)
      .update(body)
      .digest('hex');

    return signature === `sha256=${expectedSignature}`;
  }
}

module.exports = new WhatsAppClient();
