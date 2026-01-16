/**
 * MTC Maris WhatsApp Chatbot - Configuration
 * Centralizes all configuration settings
 */

require('dotenv').config();

const config = {
  // Application Settings
  app: {
    name: process.env.APP_NAME || 'MTC Maris WhatsApp Bot',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    url: process.env.APP_URL || 'http://localhost:3000',
  },

  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'mtc_maris_chatbot',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    dialect: 'postgres',
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000,
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // WhatsApp Business API Configuration
  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    appSecret: process.env.WHATSAPP_APP_SECRET,
  },

  // MTC Maris Core API Configuration
  maris: {
    apiUrl: process.env.MARIS_API_URL || 'http://localhost:3001/api/maris',
    apiKey: process.env.MARIS_API_KEY,
    apiSecret: process.env.MARIS_API_SECRET,
    timeout: 30000, // 30 seconds
  },

  // SMS Gateway Configuration
  sms: {
    gatewayUrl: process.env.SMS_GATEWAY_URL,
    apiKey: process.env.SMS_API_KEY,
    senderId: process.env.SMS_SENDER_ID || 'MTC-Maris',
  },

  // Security Settings
  security: {
    jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    encryptionKey: process.env.ENCRYPTION_KEY || 'default-32-char-key-change-prod!',
    sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES, 10) || 5,
    maxPinAttempts: parseInt(process.env.MAX_PIN_ATTEMPTS, 10) || 3,
    otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs',
  },

  // Admin Dashboard
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'changeme',
  },

  // Chatbot Menu Options
  menu: {
    mainMenu: [
      { id: '1', label: 'Buy Airtime', action: 'BUY_AIRTIME' },
      { id: '2', label: 'Buy Data Bundle', action: 'BUY_DATA' },
      { id: '3', label: 'Send Money', action: 'SEND_MONEY' },
      { id: '4', label: 'Pay Bill', action: 'PAY_BILL' },
      { id: '5', label: 'Check Balance', action: 'CHECK_BALANCE' },
      { id: '6', label: 'Transaction History', action: 'TRANSACTION_HISTORY' },
      { id: '7', label: 'Instant Loan', action: 'INSTANT_LOAN' },
      { id: '8', label: 'Savings', action: 'SAVINGS' },
      { id: '9', label: 'Insurance', action: 'INSURANCE' },
      { id: '0', label: 'Help & Support', action: 'HELP' },
    ],
    billPaymentOptions: [
      { id: '1', label: 'Electricity (Prepaid)', biller: 'ELECTRICITY' },
      { id: '2', label: 'Water', biller: 'WATER' },
      { id: '3', label: 'Multichoice/DStv', biller: 'MULTICHOICE' },
      { id: '4', label: 'Olusheno', biller: 'OLUSHENO' },
      { id: '5', label: 'NamWater', biller: 'NAMWATER' },
      { id: '6', label: 'COW', biller: 'COW' },
    ],
    dataBundles: [
      { id: '1', label: 'Wizza Bazza', type: 'WIZZA_BAZZA' },
      { id: '2', label: 'Mega Data', type: 'MEGA_DATA' },
      { id: '3', label: 'Monthly Bundle', type: 'MONTHLY' },
      { id: '4', label: 'Weekly Bundle', type: 'WEEKLY' },
      { id: '5', label: 'Daily Bundle', type: 'DAILY' },
    ],
    insuranceOptions: [
      { id: '1', label: 'Life Cover', type: 'LIFE_COVER' },
      { id: '2', label: 'Health Insurance', type: 'HEALTH' },
      { id: '3', label: 'Legal Cover', type: 'LEGAL' },
    ],
  },
};

// Validate required configuration
const validateConfig = () => {
  const requiredInProduction = [
    'whatsapp.phoneNumberId',
    'whatsapp.accessToken',
    'whatsapp.webhookVerifyToken',
    'security.jwtSecret',
    'security.encryptionKey',
  ];

  if (config.app.env === 'production') {
    requiredInProduction.forEach((path) => {
      const value = path.split('.').reduce((obj, key) => obj?.[key], config);
      if (!value || value.includes('default')) {
        console.warn(`Warning: ${path} should be configured for production`);
      }
    });
  }
};

validateConfig();

module.exports = config;
