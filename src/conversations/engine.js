/**
 * Conversation Engine
 * Core state machine that manages all user conversation flows
 */

const logger = require('../utils/logger');
const { User, Session, ConversationState, AuditLog } = require('../models');
const { isCommand, isMenuSelection, MESSAGE_TYPES } = require('../whatsapp/messageParser');
const config = require('../config');
const SessionManager = require('../services/sessionManager');
const AuthService = require('../services/authService');

// Import flow handlers
const AirtimeFlow = require('./flows/airtimeFlow');
const DataBundleFlow = require('./flows/dataBundleFlow');
const SendMoneyFlow = require('./flows/sendMoneyFlow');
const BillPaymentFlow = require('./flows/billPaymentFlow');
const BalanceFlow = require('./flows/balanceFlow');
const HistoryFlow = require('./flows/historyFlow');
const LoanFlow = require('./flows/loanFlow');
const SavingsFlow = require('./flows/savingsFlow');
const InsuranceFlow = require('./flows/insuranceFlow');
const RegistrationFlow = require('./flows/registrationFlow');

class ConversationEngine {
  constructor() {
    this.sessionManager = new SessionManager();
    this.authService = new AuthService();

    // Initialize flow handlers
    this.flows = {
      BUY_AIRTIME: new AirtimeFlow(),
      BUY_DATA: new DataBundleFlow(),
      SEND_MONEY: new SendMoneyFlow(),
      PAY_BILL: new BillPaymentFlow(),
      PAY_MERCHANT: new BillPaymentFlow(), // Reuse bill payment flow
      CHECK_BALANCE: new BalanceFlow(),
      TRANSACTION_HISTORY: new HistoryFlow(),
      INSTANT_LOAN: new LoanFlow(),
      SAVINGS: new SavingsFlow(),
      INSURANCE: new InsuranceFlow(),
      REGISTRATION: new RegistrationFlow(),
    };
  }

  /**
   * Main entry point for processing messages
   * @param {Object} message - Parsed message from WhatsApp
   * @returns {Object} Response to send back
   */
  async processMessage(message) {
    const { from, content, type } = message;

    try {
      // Get or create user
      const user = await this.getOrCreateUser(from, message);

      // Get conversation state
      const state = await this.getConversationState(user.id);

      // Check for global commands first
      if (this.isGlobalCommand(content)) {
        return this.handleGlobalCommand(content, user, state);
      }

      // Check if user needs to register
      if (!user.is_registered) {
        return this.handleUnregisteredUser(user, state, message);
      }

      // Check if user needs authentication
      const session = await this.sessionManager.getActiveSession(user.id);
      if (!session || !session.is_authenticated) {
        // If user selected a flow, save it as pending action before auth
        if (this.isFlowSelection(content)) {
          await state.update({ pending_action: content });
        }
        return this.handleAuthentication(user, state, message, session);
      }

      // Update session activity
      await this.sessionManager.updateActivity(session.id);

      // Check for pending action after authentication
      if (state.pending_action && !state.current_flow) {
        const pendingAction = state.pending_action;
        await state.update({ pending_action: null });
        return this.startFlow(user, state, pendingAction, session);
      }

      // Process based on current flow or start new one
      if (state.current_flow) {
        return this.continueFlow(user, state, message, session);
      }

      // No active flow - check for menu selection or show menu
      if (this.isFlowSelection(content)) {
        return this.startFlow(user, state, content, session);
      }

      // Default: show main menu
      return this.showMainMenu(user);
    } catch (error) {
      logger.error('Conversation engine error', {
        from,
        error: error.message,
        stack: error.stack,
      });

      return {
        type: 'text',
        text: 'Sorry, something went wrong. Please try again or type MENU to start over.',
      };
    }
  }

  /**
   * Get or create user from phone number
   */
  async getOrCreateUser(phoneNumber, message) {
    let user = await User.findOne({ where: { phone_number: phoneNumber } });

    if (!user) {
      user = await User.create({
        phone_number: phoneNumber,
        whatsapp_id: message.waId,
        first_name: message.contactName?.split(' ')[0],
        last_name: message.contactName?.split(' ').slice(1).join(' '),
        is_registered: false,
        is_verified: false,
      });

      logger.info('New user created', { userId: user.id, phone: phoneNumber.substring(0, 6) + '****' });
    }

    // Update last activity
    await user.update({ last_activity: new Date() });

    return user;
  }

  /**
   * Get or create conversation state
   */
  async getConversationState(userId) {
    let state = await ConversationState.findOne({ where: { user_id: userId } });

    if (!state) {
      state = await ConversationState.create({
        user_id: userId,
        menu_context: 'MAIN',
      });
    }

    return state;
  }

  /**
   * Check if input is a global command
   */
  isGlobalCommand(content) {
    const commands = ['menu', 'help', 'cancel', 'exit', 'back', 'start', 'hi', 'hello', '00', '#'];
    return commands.includes(content?.toLowerCase?.());
  }

  /**
   * Handle global commands
   */
  async handleGlobalCommand(command, user, state) {
    const cmd = command.toLowerCase();

    switch (cmd) {
      case 'hi':
      case 'hello':
      case 'start':
        await state.reset();
        await state.save();
        return this.showWelcomeWithMenu(user);

      case 'menu':
      case '00':
        await state.reset();
        await state.save();
        return this.showMainMenu(user);

      case 'help':
        return {
          type: 'text',
          text: `*MTC Maris Help*\n\n` +
            `Available commands:\n` +
            `• MENU - Show main menu\n` +
            `• CANCEL - Cancel current operation\n` +
            `• HELP - Show this help message\n\n` +
            `For assistance, call MTC customer care at 100 or visit mtc.com.na`,
        };

      case 'cancel':
      case 'exit':
      case 'back':
      case '#':
        if (state.current_flow) {
          await state.reset();
          await state.save();
          return {
            type: 'multiple',
            messages: [
              { type: 'text', text: 'Operation cancelled.' },
              { type: 'text', text: this.getMenuText() },
            ],
          };
        }
        return this.showMainMenu(user);

      default:
        return this.showMainMenu(user);
    }
  }

  /**
   * Handle unregistered user
   */
  async handleUnregisteredUser(user, state, message) {
    // Check if already in registration flow
    if (state.current_flow === 'REGISTRATION') {
      return this.flows.REGISTRATION.process(user, state, message);
    }

    // Start registration or prompt
    const content = message.content?.toLowerCase();

    if (content === 'register' || content === '1' || state.awaiting_input === 'REGISTRATION_CHOICE') {
      await state.setFlow('REGISTRATION');
      await state.save();
      return this.flows.REGISTRATION.process(user, state, message);
    }

    return {
      type: 'buttons',
      header: 'Welcome to MTC Maris',
      text: `Hi! It looks like you don't have an MTC Maris account yet.\n\nWould you like to register now?`,
      buttons: [
        { id: 'REGISTER', title: 'Register Now' },
        { id: 'LEARN_MORE', title: 'Learn More' },
      ],
    };
  }

  /**
   * Handle authentication flow
   */
  async handleAuthentication(user, state, message, existingSession) {
    // Check if awaiting PIN
    if (state.awaiting_input === 'PIN') {
      const result = await this.authService.verifyPin(user, message.content, state);

      // If PIN verified and there's a pending action, start that flow
      if (result.type === 'menu' && state.pending_action) {
        const pendingAction = state.pending_action;
        await state.update({ pending_action: null });
        const session = await this.sessionManager.getActiveSession(user.id);

        // Return welcome message followed by flow start
        const flowResponse = await this.startFlow(user, state, pendingAction, session);
        return {
          type: 'multiple',
          messages: [
            { type: 'text', text: `Welcome ${user.first_name || 'back'}! ✓` },
            flowResponse
          ]
        };
      }

      return result;
    }

    // Check if user is blocked
    if (user.is_blocked) {
      const blockExpiry = user.blocked_until ? new Date(user.blocked_until) : null;
      if (blockExpiry && blockExpiry > new Date()) {
        return {
          type: 'text',
          text: `Your account is temporarily locked due to security reasons.\nPlease try again after ${blockExpiry.toLocaleTimeString()}.`,
        };
      }
      // Unblock if time expired
      await user.update({ is_blocked: false, blocked_reason: null, blocked_until: null });
    }

    // Prompt for PIN
    await state.update({ awaiting_input: 'PIN' });
    return {
      type: 'text',
      text: `Welcome back to MTC Maris!\n\nPlease enter your 5-digit wallet PIN to continue:`,
    };
  }

  /**
   * Check if input is a flow selection
   */
  isFlowSelection(content) {
    const flowIds = Object.keys(this.flows);
    const letterSelection = /^[a-jA-J]$/.test(content);
    const numberSelection = /^[0-9]$/.test(content);
    return flowIds.includes(content) || letterSelection || numberSelection;
  }

  /**
   * Start a new conversation flow
   */
  async startFlow(user, state, flowId, session) {
    // Map letter and number selections to flow IDs
    const menuMap = {
      // Letter selections (primary)
      'a': 'BUY_AIRTIME',
      'b': 'BUY_DATA',
      'c': 'SEND_MONEY',
      'd': 'PAY_BILL',
      'e': 'PAY_MERCHANT',
      'f': 'CHECK_BALANCE',
      'g': 'TRANSACTION_HISTORY',
      'h': 'INSTANT_LOAN',
      'i': 'SAVINGS',
      'j': 'INSURANCE',
      // Number selections (legacy support)
      '1': 'BUY_AIRTIME',
      '2': 'BUY_DATA',
      '3': 'SEND_MONEY',
      '4': 'PAY_BILL',
      '5': 'PAY_MERCHANT',
      '6': 'CHECK_BALANCE',
      '7': 'TRANSACTION_HISTORY',
      '8': 'INSTANT_LOAN',
      '9': 'SAVINGS',
      '0': 'INSURANCE',
    };

    const normalizedInput = flowId?.toLowerCase?.() || flowId;
    const actualFlowId = menuMap[normalizedInput] || flowId;
    const flow = this.flows[actualFlowId];

    if (!flow) {
      return {
        type: 'text',
        text: 'Invalid selection. Please choose from the menu.',
      };
    }

    // Initialize flow
    await state.setFlow(actualFlowId);
    await state.save();

    logger.info('Starting flow', { userId: user.id, flow: actualFlowId });

    // Start the flow
    const response = await flow.start(user, state, session);

    // Check if flow completed immediately (e.g., balance check)
    if (response.flowComplete) {
      await state.reset();
      await state.save();

      return {
        type: 'multiple',
        messages: [
          { type: 'text', text: response.text },
          { type: 'text', text: this.getMenuText() },
        ],
      };
    }

    return response;
  }

  /**
   * Continue an existing flow
   */
  async continueFlow(user, state, message, session) {
    const flow = this.flows[state.current_flow];

    if (!flow) {
      await state.reset();
      await state.save();
      return this.showMainMenu(user);
    }

    // Process message in current flow
    const response = await flow.process(user, state, message, session);

    // Check if flow completed
    if (response.flowComplete) {
      await state.reset();
      await state.save();

      // Return completion message plus menu option
      return {
        type: 'multiple',
        messages: [
          { type: 'text', text: response.text },
          { type: 'text', text: this.getMenuText() },
        ],
      };
    }

    return response;
  }

  /**
   * Show welcome message followed by menu
   */
  showWelcomeWithMenu(user) {
    const greeting = user.first_name
      ? `Hi ${user.first_name}! Welcome to MTC Maris.`
      : 'Hi! Welcome to MTC Maris.';

    return {
      type: 'multiple',
      messages: [
        {
          type: 'text',
          text: `${greeting}\n\nYour mobile wallet for airtime, data, payments and more.`,
        },
        {
          type: 'text',
          text: this.getMenuText(),
        },
      ],
    };
  }

  /**
   * Show main menu
   */
  showMainMenu(user) {
    return {
      type: 'text',
      text: this.getMenuText(),
    };
  }

  /**
   * Get menu text with letter options
   */
  getMenuText() {
    return `How can I help you today?\n\nChoose an option from the menu below or type your question:\n
*SERVICES*
A. Buy Airtime
B. Buy Data Bundle
C. Send Money
D. Pay Bill
E. Pay Merchant

*ACCOUNT*
F. Check Balance
G. Transaction History
H. Instant Loan
I. Savings
J. Insurance

_Reply with a letter (A-J) to select an option_
_Type HELP for assistance or MENU to see this again_`;
  }
}

module.exports = ConversationEngine;
