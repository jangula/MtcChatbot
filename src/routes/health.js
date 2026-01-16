/**
 * Health Check Routes
 */

const express = require('express');
const router = express.Router();
const { sequelize } = require('../config/database');
const config = require('../config');

/**
 * GET /health - Basic health check
 */
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await sequelize.authenticate();

    res.json({
      status: 'healthy',
      service: config.app.name,
      version: require('../../package.json').version,
      timestamp: new Date().toISOString(),
      environment: config.app.env,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: config.app.name,
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET / - Root endpoint
 */
router.get('/', (req, res) => {
  res.json({
    service: config.app.name,
    message: 'MTC Maris WhatsApp Chatbot API',
    endpoints: {
      health: '/health',
      webhook: '/webhook',
      admin: '/admin (requires authentication)',
    },
  });
});

module.exports = router;
