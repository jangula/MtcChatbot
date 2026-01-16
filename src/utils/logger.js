/**
 * Winston Logger Configuration
 * Provides structured logging with file and console outputs
 */

const winston = require('winston');
const path = require('path');
const config = require('../config');

// Custom format for logs
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

// Create transports array
const transports = [
  // Console output
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      customFormat
    ),
  }),
];

// Add file transports in non-test environments
if (config.app.env !== 'test') {
  transports.push(
    // Error log file
    new winston.transports.File({
      filename: path.join(config.logging.filePath, 'error.log'),
      level: 'error',
      format: customFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(config.logging.filePath, 'combined.log'),
      format: customFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: customFormat,
  transports,
  exitOnError: false,
});

// Add request logging helper
logger.logRequest = (req, message = 'Incoming request') => {
  logger.info(message, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
};

// Add WhatsApp message logging (sanitized)
logger.logWhatsAppMessage = (from, messageType, direction = 'incoming') => {
  logger.info(`WhatsApp ${direction} message`, {
    from: from.substring(0, 6) + '****', // Mask phone number
    type: messageType,
    direction,
  });
};

// Add transaction logging (sanitized)
logger.logTransaction = (type, status, reference) => {
  logger.info('Transaction processed', {
    type,
    status,
    reference,
  });
};

module.exports = logger;
