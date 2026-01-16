/**
 * Encryption Utility
 * Handles data encryption/decryption using AES-256
 * Compliant with RFP security requirements
 */

const CryptoJS = require('crypto-js');
const crypto = require('crypto');
const config = require('../config');

const ENCRYPTION_KEY = config.security.encryptionKey;

/**
 * Encrypt sensitive data using AES-256
 * @param {string} data - Plain text to encrypt
 * @returns {string} - Encrypted data as base64 string
 */
const encrypt = (data) => {
  if (!data) return null;
  try {
    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(data),
      ENCRYPTION_KEY
    ).toString();
    return encrypted;
  } catch (error) {
    throw new Error('Encryption failed');
  }
};

/**
 * Decrypt data
 * @param {string} encryptedData - Encrypted data
 * @returns {string} - Decrypted plain text
 */
const decrypt = (encryptedData) => {
  if (!encryptedData) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decrypted);
  } catch (error) {
    throw new Error('Decryption failed');
  }
};

/**
 * Hash data using SHA-256 (one-way)
 * @param {string} data - Data to hash
 * @returns {string} - Hashed data
 */
const hash = (data) => {
  return CryptoJS.SHA256(data).toString();
};

/**
 * Generate secure random OTP
 * @param {number} length - OTP length (default 6)
 * @returns {string} - Generated OTP
 */
const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[randomBytes[i] % 10];
  }
  return otp;
};

/**
 * Generate unique reference number
 * @param {string} prefix - Prefix for reference (e.g., 'TXN', 'OTP')
 * @returns {string} - Generated reference
 */
const generateReference = (prefix = 'TXN') => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

/**
 * Mask sensitive data for logging
 * @param {string} data - Data to mask
 * @param {number} visibleChars - Number of visible characters at start
 * @returns {string} - Masked data
 */
const maskData = (data, visibleChars = 4) => {
  if (!data || data.length <= visibleChars) return '****';
  return data.substring(0, visibleChars) + '*'.repeat(data.length - visibleChars);
};

/**
 * Mask phone number for display
 * @param {string} phoneNumber - Phone number to mask
 * @returns {string} - Masked phone number (e.g., 081****1234)
 */
const maskPhoneNumber = (phoneNumber) => {
  if (!phoneNumber || phoneNumber.length < 10) return '****';
  const cleaned = phoneNumber.replace(/\D/g, '');
  return cleaned.substring(0, 3) + '****' + cleaned.slice(-4);
};

/**
 * Validate Namibian phone number format
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} - Whether phone number is valid
 */
const isValidNamibianPhone = (phoneNumber) => {
  // Namibian mobile numbers: 081, 085 prefixes, 10 digits total
  const cleaned = phoneNumber.replace(/\D/g, '');
  const namibianPattern = /^(264|0)?(81|85)\d{7}$/;
  return namibianPattern.test(cleaned);
};

/**
 * Normalize phone number to international format
 * @param {string} phoneNumber - Phone number
 * @returns {string} - Normalized phone number (264XXXXXXXXX)
 */
const normalizePhoneNumber = (phoneNumber) => {
  let cleaned = phoneNumber.replace(/\D/g, '');

  // Remove leading zeros
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Add Namibia country code if not present
  if (!cleaned.startsWith('264')) {
    cleaned = '264' + cleaned;
  }

  return cleaned;
};

module.exports = {
  encrypt,
  decrypt,
  hash,
  generateOTP,
  generateReference,
  maskData,
  maskPhoneNumber,
  isValidNamibianPhone,
  normalizePhoneNumber,
};
