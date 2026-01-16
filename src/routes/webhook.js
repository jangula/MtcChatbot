/**
 * WhatsApp Webhook Routes
 * Handles incoming webhooks from Meta
 */

const express = require('express');
const router = express.Router();
const WebhookHandler = require('../whatsapp/webhookHandler');
const logger = require('../utils/logger');

const webhookHandler = new WebhookHandler();

/**
 * GET /webhook - Webhook verification
 * Meta sends this to verify webhook URL during setup
 */
router.get('/', (req, res) => {
  const result = webhookHandler.handleVerification(req.query);

  if (result.success) {
    res.status(200).send(result.challenge);
  } else {
    res.status(403).send('Verification failed');
  }
});

/**
 * POST /webhook - Incoming messages and events
 * Meta sends message notifications here
 */
router.post('/', async (req, res) => {
  // Acknowledge receipt immediately (Meta requires quick response)
  res.status(200).send('OK');

  try {
    // Parse raw body for signature verification
    const rawBody = req.body.toString('utf8');
    const body = JSON.parse(rawBody);
    const signature = req.headers['x-hub-signature-256'];

    // Process webhook asynchronously
    webhookHandler.handleIncoming(body, signature, rawBody);
  } catch (error) {
    logger.error('Webhook processing error', { error: error.message });
  }
});

module.exports = router;
