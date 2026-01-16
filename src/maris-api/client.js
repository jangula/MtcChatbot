/**
 * MTC Maris API Client
 * Interfaces with MTC Maris core banking/wallet system
 * In development mode, uses mock responses
 */

const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { generateReference, encrypt, decrypt } = require('../utils/encryption');

class MarisAPI {
  constructor() {
    this.baseUrl = config.maris.apiUrl;
    this.apiKey = config.maris.apiKey;
    this.apiSecret = config.maris.apiSecret;
    this.timeout = config.maris.timeout;
    this.useMock = config.app.env === 'development' || !this.apiKey;

    if (!this.useMock) {
      this.client = axios.create({
        baseURL: this.baseUrl,
        timeout: this.timeout,
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });
    }

    // Mock data store
    this.mockAccounts = new Map();
    this.mockTransactions = [];
    this.initializeMockData();
  }

  /**
   * Initialize mock data for development
   */
  initializeMockData() {
    // Sample mock accounts
    const sampleAccounts = [
      {
        accountId: 'MARIS001',
        phoneNumber: '264811234567',
        firstName: 'John',
        lastName: 'Doe',
        balance: 5000.00,
        pin: '12345',
        status: 'ACTIVE',
        tier: 'STANDARD',
        loanEligible: true,
        loanLimit: 2000,
        savingsBalance: 500,
      },
      {
        accountId: 'MARIS002',
        phoneNumber: '264815551234',
        firstName: 'Jane',
        lastName: 'Smith',
        balance: 12500.00,
        pin: '54321',
        status: 'ACTIVE',
        tier: 'PREMIUM',
        loanEligible: true,
        loanLimit: 5000,
        savingsBalance: 2000,
      },
    ];

    sampleAccounts.forEach((acc) => {
      this.mockAccounts.set(acc.phoneNumber, acc);
    });
  }

  /**
   * Check if phone number has registered Maris account
   * @param {string} phoneNumber - Normalized phone number
   */
  async checkAccount(phoneNumber) {
    if (this.useMock) {
      const account = this.mockAccounts.get(phoneNumber);
      return {
        exists: !!account,
        accountId: account?.accountId,
        status: account?.status || 'NOT_FOUND',
      };
    }

    try {
      const response = await this.client.post('/accounts/check', { phoneNumber });
      return response.data;
    } catch (error) {
      logger.error('Maris API: Check account failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Verify user PIN
   * @param {string} accountId - Maris account ID
   * @param {string} pin - User PIN
   */
  async verifyPin(accountId, pin) {
    if (this.useMock) {
      // Find account by ID
      for (const [, account] of this.mockAccounts) {
        if (account.accountId === accountId) {
          return account.pin === pin;
        }
      }
      // For development, accept any 5-digit PIN for unmatched accounts
      return /^\d{5}$/.test(pin);
    }

    try {
      const response = await this.client.post('/auth/verify-pin', {
        accountId,
        pin: encrypt(pin), // Encrypt PIN before sending
      });
      return response.data.valid;
    } catch (error) {
      logger.error('Maris API: PIN verification failed', { error: error.message });
      return false;
    }
  }

  /**
   * Get account balance
   * @param {string} accountId - Maris account ID
   */
  async getBalance(accountId) {
    if (this.useMock) {
      for (const [, account] of this.mockAccounts) {
        if (account.accountId === accountId) {
          return {
            success: true,
            balance: account.balance,
            currency: 'NAD',
            availableBalance: account.balance,
            savingsBalance: account.savingsBalance || 0,
          };
        }
      }
      // Return mock balance for unknown accounts
      return {
        success: true,
        balance: 1500.00,
        currency: 'NAD',
        availableBalance: 1500.00,
        savingsBalance: 0,
      };
    }

    try {
      const response = await this.client.get(`/accounts/${accountId}/balance`);
      return response.data;
    } catch (error) {
      logger.error('Maris API: Get balance failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get transaction history
   * @param {string} accountId - Maris account ID
   * @param {number} limit - Number of transactions
   */
  async getTransactionHistory(accountId, limit = 10) {
    if (this.useMock) {
      // Return mock transaction history
      return {
        success: true,
        transactions: [
          {
            reference: 'TXN001',
            type: 'AIRTIME_SELF',
            amount: 50.00,
            date: new Date(Date.now() - 86400000).toISOString(),
            status: 'COMPLETED',
            description: 'Airtime purchase',
          },
          {
            reference: 'TXN002',
            type: 'P2P_TRANSFER',
            amount: -200.00,
            date: new Date(Date.now() - 172800000).toISOString(),
            status: 'COMPLETED',
            description: 'Transfer to 081****5678',
          },
          {
            reference: 'TXN003',
            type: 'BILL_PAYMENT',
            amount: -350.00,
            date: new Date(Date.now() - 259200000).toISOString(),
            status: 'COMPLETED',
            description: 'Electricity payment',
          },
        ],
      };
    }

    try {
      const response = await this.client.get(`/accounts/${accountId}/transactions`, {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      logger.error('Maris API: Get history failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Purchase airtime
   * @param {string} accountId - Maris account ID
   * @param {string} recipient - Recipient phone number
   * @param {number} amount - Amount in NAD
   */
  async purchaseAirtime(accountId, recipient, amount) {
    const reference = generateReference('AIR');

    if (this.useMock) {
      logger.info('MOCK: Airtime purchase', { accountId, recipient, amount, reference });
      return {
        success: true,
        reference,
        marisReference: `MR${Date.now()}`,
        message: 'Airtime purchased successfully',
        newBalance: 1450.00,
      };
    }

    try {
      const response = await this.client.post('/transactions/airtime', {
        accountId,
        recipient,
        amount,
        reference,
      });
      return response.data;
    } catch (error) {
      logger.error('Maris API: Airtime purchase failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Purchase data bundle
   * @param {string} accountId - Maris account ID
   * @param {string} recipient - Recipient phone number
   * @param {string} bundleCode - Bundle product code
   * @param {number} amount - Amount in NAD
   */
  async purchaseDataBundle(accountId, recipient, bundleCode, amount) {
    const reference = generateReference('DAT');

    if (this.useMock) {
      logger.info('MOCK: Data bundle purchase', { accountId, recipient, bundleCode, amount, reference });
      return {
        success: true,
        reference,
        marisReference: `MR${Date.now()}`,
        message: 'Data bundle purchased successfully',
        bundleName: 'Wizza Bazza 1GB',
        newBalance: 1400.00,
      };
    }

    try {
      const response = await this.client.post('/transactions/data-bundle', {
        accountId,
        recipient,
        bundleCode,
        amount,
        reference,
      });
      return response.data;
    } catch (error) {
      logger.error('Maris API: Data purchase failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Transfer money to another wallet (P2P)
   * @param {string} accountId - Sender account ID
   * @param {string} recipientPhone - Recipient phone number
   * @param {number} amount - Amount in NAD
   */
  async transferMoney(accountId, recipientPhone, amount) {
    const reference = generateReference('P2P');

    if (this.useMock) {
      logger.info('MOCK: P2P transfer', { accountId, recipientPhone, amount, reference });
      return {
        success: true,
        reference,
        marisReference: `MR${Date.now()}`,
        message: 'Transfer successful',
        recipientName: 'Jane S.',
        fee: 0,
        newBalance: 1300.00,
      };
    }

    try {
      const response = await this.client.post('/transactions/transfer', {
        accountId,
        recipientPhone,
        amount,
        reference,
      });
      return response.data;
    } catch (error) {
      logger.error('Maris API: Transfer failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Pay a bill
   * @param {string} accountId - Maris account ID
   * @param {string} billerCode - Biller code
   * @param {string} customerAccount - Customer's account at biller
   * @param {number} amount - Amount in NAD
   */
  async payBill(accountId, billerCode, customerAccount, amount) {
    const reference = generateReference('BIL');

    if (this.useMock) {
      logger.info('MOCK: Bill payment', { accountId, billerCode, customerAccount, amount, reference });
      return {
        success: true,
        reference,
        marisReference: `MR${Date.now()}`,
        message: 'Bill payment successful',
        billerName: this.getBillerName(billerCode),
        token: billerCode === 'ELECTRICITY' ? '1234-5678-9012-3456' : null,
        newBalance: 1150.00,
      };
    }

    try {
      const response = await this.client.post('/transactions/bill-payment', {
        accountId,
        billerCode,
        customerAccount,
        amount,
        reference,
      });
      return response.data;
    } catch (error) {
      logger.error('Maris API: Bill payment failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Apply for instant loan
   * @param {string} accountId - Maris account ID
   * @param {number} amount - Loan amount
   */
  async applyLoan(accountId, amount) {
    const reference = generateReference('LON');

    if (this.useMock) {
      logger.info('MOCK: Loan application', { accountId, amount, reference });
      return {
        success: true,
        reference,
        marisReference: `MR${Date.now()}`,
        message: 'Loan approved and disbursed',
        approvedAmount: amount,
        interest: amount * 0.1,
        totalRepayment: amount * 1.1,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        newBalance: 2500.00,
      };
    }

    try {
      const response = await this.client.post('/loans/apply', {
        accountId,
        amount,
        reference,
      });
      return response.data;
    } catch (error) {
      logger.error('Maris API: Loan application failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Check loan eligibility
   * @param {string} accountId - Maris account ID
   */
  async checkLoanEligibility(accountId) {
    if (this.useMock) {
      return {
        success: true,
        eligible: true,
        maxAmount: 2000,
        interestRate: 10,
        currentLoan: null,
      };
    }

    try {
      const response = await this.client.get(`/loans/eligibility/${accountId}`);
      return response.data;
    } catch (error) {
      logger.error('Maris API: Loan eligibility check failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Register new account
   * @param {Object} userData - User registration data
   */
  async registerAccount(userData) {
    const accountId = `MARIS${Date.now()}`;

    if (this.useMock) {
      logger.info('MOCK: Account registration', { phoneNumber: userData.phoneNumber });

      // Add to mock accounts
      this.mockAccounts.set(userData.phoneNumber, {
        accountId,
        phoneNumber: userData.phoneNumber,
        firstName: userData.firstName,
        lastName: userData.lastName,
        balance: 0,
        pin: userData.pin,
        status: 'ACTIVE',
        tier: 'BASIC',
        loanEligible: false,
        loanLimit: 0,
        savingsBalance: 0,
      });

      return {
        success: true,
        accountId,
        message: 'Account created successfully',
      };
    }

    try {
      const response = await this.client.post('/accounts/register', userData);
      return response.data;
    } catch (error) {
      logger.error('Maris API: Registration failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get available data bundles
   */
  async getDataBundles() {
    if (this.useMock) {
      return {
        success: true,
        bundles: [
          { code: 'WB_500MB', name: 'Wizza Bazza 500MB', price: 25, validity: '24 hours' },
          { code: 'WB_1GB', name: 'Wizza Bazza 1GB', price: 45, validity: '24 hours' },
          { code: 'WB_2GB', name: 'Wizza Bazza 2GB', price: 75, validity: '3 days' },
          { code: 'MD_5GB', name: 'Mega Data 5GB', price: 150, validity: '30 days' },
          { code: 'MD_10GB', name: 'Mega Data 10GB', price: 250, validity: '30 days' },
          { code: 'MD_20GB', name: 'Mega Data 20GB', price: 400, validity: '30 days' },
        ],
      };
    }

    try {
      const response = await this.client.get('/products/data-bundles');
      return response.data;
    } catch (error) {
      logger.error('Maris API: Get bundles failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Helper to get biller name
   */
  getBillerName(code) {
    const billers = {
      ELECTRICITY: 'NamPower Prepaid',
      WATER: 'City of Windhoek Water',
      MULTICHOICE: 'MultiChoice/DStv',
      OLUSHENO: 'Olusheno',
      NAMWATER: 'NamWater',
      COW: 'City of Windhoek',
    };
    return billers[code] || code;
  }
}

module.exports = MarisAPI;
