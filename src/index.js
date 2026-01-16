/**
 * MTC Maris WhatsApp Chatbot
 * Main Application Entry Point
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./utils/logger');
const { testConnection, syncDatabase } = require('./config/database');
const webhookRoutes = require('./routes/webhook');
const adminRoutes = require('./routes/admin');
const healthRoutes = require('./routes/health');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.app.env === 'production' ? config.app.url : '*',
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Body parsing - raw for webhook signature verification
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  if (req.path !== '/health') {
    logger.logRequest(req);
  }
  next();
});

// Routes
app.use('/webhook', webhookRoutes);
app.use('/admin', adminRoutes);
app.use('/', healthRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(err.status || 500).json({
    error: config.app.env === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);

  // Close server
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Close database connections
  const { sequelize } = require('./config/database');
  await sequelize.close();
  logger.info('Database connections closed');

  process.exit(0);
};

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    // Sync database models (non-blocking - tables may already exist)
    const synced = await syncDatabase(false);
    if (!synced) {
      logger.info('Database sync skipped - tables may already exist');
    }

    // Start HTTP server
    const server = app.listen(config.app.port, () => {
      logger.info(`${config.app.name} started`, {
        port: config.app.port,
        env: config.app.env,
        url: `${config.app.url}`,
      });

      logger.info('WhatsApp Webhook URL:', {
        verify: `${config.app.url}/webhook`,
        callback: `${config.app.url}/webhook`,
      });
    });

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

// Start the application
let server;
if (require.main === module) {
  startServer().then((s) => {
    server = s;
  });
}

module.exports = { app, startServer };
