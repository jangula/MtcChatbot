/**
 * WhatsApp Message Parser
 * Parses incoming webhook payloads into standardized format
 */

const logger = require('../utils/logger');
const { normalizePhoneNumber } = require('../utils/encryption');

/**
 * Message types supported
 */
const MESSAGE_TYPES = {
  TEXT: 'text',
  BUTTON: 'button',
  LIST_REPLY: 'list_reply',
  IMAGE: 'image',
  DOCUMENT: 'document',
  LOCATION: 'location',
  INTERACTIVE: 'interactive',
  UNKNOWN: 'unknown',
};

/**
 * Parse incoming webhook payload
 * @param {Object} webhookPayload - Raw webhook payload from WhatsApp
 * @returns {Object|null} Parsed message data
 */
const parseWebhookPayload = (webhookPayload) => {
  try {
    // Extract the entry
    const entry = webhookPayload.entry?.[0];
    if (!entry) return null;

    // Extract changes
    const changes = entry.changes?.[0];
    if (!changes || changes.field !== 'messages') return null;

    const value = changes.value;

    // Check if it's a status update (delivery receipts)
    if (value.statuses) {
      return parseStatusUpdate(value.statuses[0]);
    }

    // Extract message
    const message = value.messages?.[0];
    if (!message) return null;

    // Extract contact info
    const contact = value.contacts?.[0];

    // Build parsed message object
    const parsed = {
      type: MESSAGE_TYPES.UNKNOWN,
      messageId: message.id,
      timestamp: new Date(parseInt(message.timestamp) * 1000),
      from: normalizePhoneNumber(message.from),
      rawFrom: message.from,
      contactName: contact?.profile?.name || null,
      waId: contact?.wa_id || message.from,
      isForwarded: message.context?.forwarded || false,
      replyToMessageId: message.context?.id || null,
    };

    // Parse based on message type
    switch (message.type) {
      case 'text':
        parsed.type = MESSAGE_TYPES.TEXT;
        parsed.text = message.text.body;
        parsed.content = message.text.body.trim();
        break;

      case 'interactive':
        if (message.interactive.type === 'button_reply') {
          parsed.type = MESSAGE_TYPES.BUTTON;
          parsed.buttonId = message.interactive.button_reply.id;
          parsed.buttonTitle = message.interactive.button_reply.title;
          parsed.content = message.interactive.button_reply.id;
        } else if (message.interactive.type === 'list_reply') {
          parsed.type = MESSAGE_TYPES.LIST_REPLY;
          parsed.listId = message.interactive.list_reply.id;
          parsed.listTitle = message.interactive.list_reply.title;
          parsed.listDescription = message.interactive.list_reply.description;
          parsed.content = message.interactive.list_reply.id;
        }
        break;

      case 'button':
        parsed.type = MESSAGE_TYPES.BUTTON;
        parsed.buttonText = message.button.text;
        parsed.buttonPayload = message.button.payload;
        parsed.content = message.button.payload || message.button.text;
        break;

      case 'image':
        parsed.type = MESSAGE_TYPES.IMAGE;
        parsed.imageId = message.image.id;
        parsed.mimeType = message.image.mime_type;
        parsed.caption = message.image.caption;
        parsed.content = message.image.caption || '[Image]';
        break;

      case 'document':
        parsed.type = MESSAGE_TYPES.DOCUMENT;
        parsed.documentId = message.document.id;
        parsed.filename = message.document.filename;
        parsed.mimeType = message.document.mime_type;
        parsed.content = message.document.filename || '[Document]';
        break;

      case 'location':
        parsed.type = MESSAGE_TYPES.LOCATION;
        parsed.latitude = message.location.latitude;
        parsed.longitude = message.location.longitude;
        parsed.locationName = message.location.name;
        parsed.locationAddress = message.location.address;
        parsed.content = '[Location]';
        break;

      default:
        parsed.type = MESSAGE_TYPES.UNKNOWN;
        parsed.rawType = message.type;
        parsed.content = `[Unsupported: ${message.type}]`;
    }

    logger.logWhatsAppMessage(parsed.from, parsed.type, 'incoming');

    return parsed;
  } catch (error) {
    logger.error('Failed to parse webhook payload', { error: error.message });
    return null;
  }
};

/**
 * Parse status update (delivery receipts)
 * @param {Object} status - Status object
 */
const parseStatusUpdate = (status) => {
  return {
    isStatusUpdate: true,
    messageId: status.id,
    status: status.status, // sent, delivered, read, failed
    timestamp: new Date(parseInt(status.timestamp) * 1000),
    recipientId: status.recipient_id,
    conversationId: status.conversation?.id,
    error: status.errors?.[0],
  };
};

/**
 * Check if message is a menu selection
 * @param {Object} parsed - Parsed message
 */
const isMenuSelection = (parsed) => {
  return parsed.type === MESSAGE_TYPES.LIST_REPLY ||
         (parsed.type === MESSAGE_TYPES.TEXT && /^[0-9]$/.test(parsed.content));
};

/**
 * Check if message is a confirmation response
 * @param {Object} parsed - Parsed message
 */
const isConfirmation = (parsed) => {
  if (parsed.type === MESSAGE_TYPES.BUTTON) {
    return ['CONFIRM_YES', 'CONFIRM_NO'].includes(parsed.buttonId);
  }
  if (parsed.type === MESSAGE_TYPES.TEXT) {
    const lower = parsed.content.toLowerCase();
    return ['yes', 'no', 'y', 'n', '1', '2'].includes(lower);
  }
  return false;
};

/**
 * Check if user confirmed (yes)
 * @param {Object} parsed - Parsed message
 */
const isConfirmedYes = (parsed) => {
  if (parsed.type === MESSAGE_TYPES.BUTTON) {
    return parsed.buttonId === 'CONFIRM_YES';
  }
  if (parsed.type === MESSAGE_TYPES.TEXT) {
    const lower = parsed.content.toLowerCase();
    return ['yes', 'y', '1'].includes(lower);
  }
  return false;
};

/**
 * Check if message is a command
 * @param {Object} parsed - Parsed message
 */
const isCommand = (parsed) => {
  if (parsed.type !== MESSAGE_TYPES.TEXT) return false;
  const commands = ['help', 'menu', 'cancel', 'exit', 'back', 'start', 'hi', 'hello'];
  return commands.includes(parsed.content.toLowerCase());
};

/**
 * Extract numeric value from message
 * @param {string} content - Message content
 */
const extractAmount = (content) => {
  const match = content.match(/[\d,]+\.?\d*/);
  if (match) {
    return parseFloat(match[0].replace(/,/g, ''));
  }
  return null;
};

/**
 * Extract phone number from message
 * @param {string} content - Message content
 */
const extractPhoneNumber = (content) => {
  const cleaned = content.replace(/[\s\-\(\)]/g, '');
  const match = cleaned.match(/(?:264|0)?(?:81|85)\d{7}/);
  return match ? normalizePhoneNumber(match[0]) : null;
};

module.exports = {
  MESSAGE_TYPES,
  parseWebhookPayload,
  parseStatusUpdate,
  isMenuSelection,
  isConfirmation,
  isConfirmedYes,
  isCommand,
  extractAmount,
  extractPhoneNumber,
};
