/**
 * WhatsApp Webhook Handler
 * Processes incoming webhook events from WhatsApp Cloud API
 */

const config = require('../config');
const logger = require('../utils/logger');
const whatsappClient = require('./client');
const { parseWebhookPayload } = require('./messageParser');
const ConversationEngine = require('../conversations/engine');

class WebhookHandler {
  constructor() {
    this.conversationEngine = new ConversationEngine();
  }

  /**
   * Handle webhook verification (GET request)
   * Required by Meta for webhook setup
   */
  handleVerification(query) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === config.whatsapp.webhookVerifyToken) {
      logger.info('Webhook verification successful');
      return { success: true, challenge };
    }

    logger.warn('Webhook verification failed', { mode, tokenMatch: token === config.whatsapp.webhookVerifyToken });
    return { success: false };
  }

  /**
   * Handle incoming webhook events (POST request)
   * @param {Object} body - Webhook payload
   * @param {string} signature - X-Hub-Signature-256 header
   * @param {string} rawBody - Raw request body for signature verification
   */
  async handleIncoming(body, signature, rawBody) {
    try {
      // DEBUG: Log raw webhook payload
      logger.info('Webhook raw payload', {
        body: JSON.stringify(body).substring(0, 500),
        messageFrom: body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from
      });

      // Verify signature in production
      if (config.app.env === 'production' && config.whatsapp.appSecret) {
        const isValid = whatsappClient.verifyWebhookSignature(signature, rawBody);
        if (!isValid) {
          logger.warn('Invalid webhook signature');
          return { success: false, error: 'Invalid signature' };
        }
      }

      // Parse the webhook payload
      const parsed = parseWebhookPayload(body);

      if (!parsed) {
        logger.debug('No actionable message in webhook');
        return { success: true, message: 'No action required' };
      }

      // Handle status updates separately
      if (parsed.isStatusUpdate) {
        return this.handleStatusUpdate(parsed);
      }

      // Mark message as read
      await whatsappClient.markAsRead(parsed.messageId);

      // Process the message through conversation engine
      const response = await this.conversationEngine.processMessage(parsed);

      if (response) {
        // Send response back to user
        await this.sendResponse(parsed.from, response);
      }

      return { success: true };
    } catch (error) {
      logger.error('Error processing webhook', { error: error.message, stack: error.stack });
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle message status updates
   * @param {Object} status - Parsed status update
   */
  handleStatusUpdate(status) {
    logger.debug('Message status update', {
      messageId: status.messageId,
      status: status.status,
    });

    // Handle failed messages
    if (status.status === 'failed' && status.error) {
      logger.error('Message delivery failed', {
        messageId: status.messageId,
        error: status.error,
      });
    }

    return { success: true, type: 'status_update' };
  }

  /**
   * Send response to user based on response type
   * @param {string} to - Recipient phone number
   * @param {Object} response - Response object from conversation engine
   */
  async sendResponse(to, response) {
    try {
      switch (response.type) {
        case 'text':
          await whatsappClient.sendTextMessage(to, response.text);
          break;

        case 'menu':
          await whatsappClient.sendMainMenu(to, response.greeting);
          break;

        case 'buttons':
          await whatsappClient.sendButtonMessage(
            to,
            response.text,
            response.buttons,
            response.header,
            response.footer
          );
          break;

        case 'list':
          await whatsappClient.sendListMessage(
            to,
            response.text,
            response.buttonText || 'Select',
            response.sections,
            response.header,
            response.footer
          );
          break;

        case 'confirmation':
          await whatsappClient.sendConfirmation(to, response.text);
          break;

        case 'multiple':
          // Send multiple messages sequentially
          for (const msg of response.messages) {
            await this.sendResponse(to, msg);
            // Small delay between messages
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          break;

        default:
          logger.warn('Unknown response type', { type: response.type });
          await whatsappClient.sendTextMessage(to, response.text || 'An error occurred');
      }
    } catch (error) {
      logger.error('Failed to send response', { to, error: error.message });
      throw error;
    }
  }
}

module.exports = WebhookHandler;
