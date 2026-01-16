#!/usr/bin/env node

/**
 * CLI Test Script for MTC Maris Chatbot
 * Simulates WhatsApp conversations locally
 */

const readline = require('readline');
require('dotenv').config();

// Override WhatsApp client to capture messages instead of sending
const responses = [];
const mockWhatsAppClient = {
  sendTextMessage: async (to, text) => {
    responses.push({ type: 'text', text });
    return { success: true, messageId: 'mock_' + Date.now() };
  },
  sendButtonMessage: async (to, text, buttons, header, footer) => {
    responses.push({ type: 'buttons', text, buttons, header, footer });
    return { success: true, messageId: 'mock_' + Date.now() };
  },
  sendListMessage: async (to, text, buttonText, sections, header, footer) => {
    responses.push({ type: 'list', text, sections, header, footer });
    return { success: true, messageId: 'mock_' + Date.now() };
  },
  sendMainMenu: async (to, greeting) => {
    responses.push({ type: 'menu', greeting });
    return { success: true, messageId: 'mock_' + Date.now() };
  },
  sendConfirmation: async (to, text) => {
    responses.push({ type: 'confirmation', text });
    return { success: true, messageId: 'mock_' + Date.now() };
  },
  markAsRead: async () => true,
};

// Mock the WhatsApp client module
require.cache[require.resolve('../src/whatsapp/client')] = {
  exports: mockWhatsAppClient,
};

const ConversationEngine = require('../src/conversations/engine');
const { testConnection, syncDatabase } = require('../src/config/database');

const testPhone = '264811234567';
let engine;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function printResponse(resp) {
  console.log('\n┌─────────────────────────────────────────────────');
  console.log('│ 🤖 MTC Maris Bot:');
  console.log('├─────────────────────────────────────────────────');

  if (resp.type === 'text') {
    console.log('│ ' + resp.text.split('\n').join('\n│ '));
  } else if (resp.type === 'buttons') {
    if (resp.header) console.log('│ [' + resp.header + ']');
    console.log('│ ' + resp.text.split('\n').join('\n│ '));
    console.log('│');
    resp.buttons.forEach((btn, i) => {
      console.log(`│ [${i + 1}] ${btn.title}`);
    });
  } else if (resp.type === 'list') {
    if (resp.header) console.log('│ [' + resp.header + ']');
    console.log('│ ' + resp.text.split('\n').join('\n│ '));
    console.log('│');
    resp.sections.forEach((section) => {
      console.log('│ --- ' + (section.title || 'Options') + ' ---');
      section.rows.forEach((row, i) => {
        console.log(`│ [${row.id}] ${row.title}`);
        if (row.description) console.log(`│     ${row.description}`);
      });
    });
  } else if (resp.type === 'menu') {
    console.log('│ ' + (resp.greeting || 'Welcome!'));
    console.log('│');
    console.log('│ --- Main Menu ---');
    console.log('│ [1] Buy Airtime');
    console.log('│ [2] Buy Data Bundle');
    console.log('│ [3] Send Money');
    console.log('│ [4] Pay Bill');
    console.log('│ [5] Pay Merchant');
    console.log('│ [6] Check Balance');
    console.log('│ [7] Transaction History');
    console.log('│ [8] Instant Loan');
    console.log('│ [9] Savings');
    console.log('│ [0] Insurance');
  } else if (resp.type === 'confirmation') {
    console.log('│ ' + resp.text.split('\n').join('\n│ '));
    console.log('│');
    console.log('│ [1] Yes, Confirm');
    console.log('│ [2] No, Cancel');
  } else if (resp.type === 'multiple') {
    resp.messages.forEach((msg) => printResponse(msg));
    return;
  }

  console.log('└─────────────────────────────────────────────────\n');
}

async function processMessage(text) {
  responses.length = 0; // Clear previous responses

  const message = {
    type: 'text',
    messageId: 'test_' + Date.now(),
    timestamp: new Date(),
    from: testPhone,
    rawFrom: testPhone,
    contactName: 'Test User',
    waId: testPhone,
    content: text,
    text: text,
  };

  const result = await engine.processMessage(message);

  if (result) {
    printResponse(result);
  }
}

async function main() {
  console.log('╔═════════════════════════════════════════════════╗');
  console.log('║   MTC Maris WhatsApp Chatbot - CLI Test Mode    ║');
  console.log('╚═════════════════════════════════════════════════╝');
  console.log();

  // Initialize database
  console.log('Connecting to database...');
  const connected = await testConnection();
  if (!connected) {
    console.error('Failed to connect to database');
    process.exit(1);
  }

  await syncDatabase(false);
  console.log('Database ready.\n');

  // Initialize conversation engine
  engine = new ConversationEngine();

  console.log('Test phone: ' + testPhone);
  console.log('Type messages to interact with the bot.');
  console.log('Commands: MENU, HELP, CANCEL, EXIT (to quit)\n');
  console.log('─────────────────────────────────────────────────\n');

  // Start with a greeting
  await processMessage('Hi');

  const prompt = () => {
    rl.question('You: ', async (input) => {
      const text = input.trim();

      if (text.toLowerCase() === 'exit' || text.toLowerCase() === 'quit') {
        console.log('\nGoodbye!');
        rl.close();
        process.exit(0);
      }

      if (text) {
        await processMessage(text);
      }

      prompt();
    });
  };

  prompt();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
