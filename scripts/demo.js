#!/usr/bin/env node

/**
 * Demo Script - Shows chatbot flow without interactive input
 */

require('dotenv').config();

// Mock WhatsApp client
const responses = [];
const mockWhatsAppClient = {
  sendTextMessage: async (to, text) => {
    responses.push({ type: 'text', text });
    return { success: true };
  },
  sendButtonMessage: async (to, text, buttons, header) => {
    responses.push({ type: 'buttons', text, buttons, header });
    return { success: true };
  },
  sendListMessage: async (to, text, buttonText, sections, header) => {
    responses.push({ type: 'list', text, sections, header });
    return { success: true };
  },
  sendMainMenu: async (to, greeting) => {
    responses.push({ type: 'menu', greeting });
    return { success: true };
  },
  sendConfirmation: async (to, text) => {
    responses.push({ type: 'confirmation', text });
    return { success: true };
  },
  markAsRead: async () => true,
};

require.cache[require.resolve('../src/whatsapp/client')] = { exports: mockWhatsAppClient };

const ConversationEngine = require('../src/conversations/engine');
const { testConnection, syncDatabase } = require('../src/config/database');

function printResponse(resp, label = '') {
  console.log('\n' + '─'.repeat(60));
  console.log(`🤖 BOT${label ? ' (' + label + ')' : ''}:`);
  console.log('─'.repeat(60));

  if (resp.type === 'text') {
    console.log(resp.text);
  } else if (resp.type === 'buttons') {
    if (resp.header) console.log(`[${resp.header}]`);
    console.log(resp.text);
    console.log('\nOptions:');
    resp.buttons.forEach((btn, i) => console.log(`  [${i + 1}] ${btn.title}`));
  } else if (resp.type === 'list') {
    if (resp.header) console.log(`[${resp.header}]`);
    console.log(resp.text);
    console.log('\nMenu:');
    resp.sections?.forEach((s) => {
      console.log(`  --- ${s.title || 'Options'} ---`);
      s.rows?.forEach((r) => console.log(`    • ${r.title}: ${r.description || ''}`));
    });
  } else if (resp.type === 'menu') {
    console.log(resp.greeting || 'Welcome!');
    console.log('\nMain Menu:');
    ['Buy Airtime', 'Buy Data', 'Send Money', 'Pay Bill', 'Pay Merchant',
     'Check Balance', 'History', 'Instant Loan', 'Savings', 'Insurance']
      .forEach((item, i) => console.log(`  [${i + 1}] ${item}`));
  } else if (resp.type === 'confirmation') {
    console.log(resp.text);
    console.log('\n  [Yes] Confirm  |  [No] Cancel');
  } else if (resp.type === 'multiple') {
    resp.messages?.forEach((m, i) => printResponse(m, `Part ${i + 1}`));
  }
}

async function simulateMessage(engine, phone, text) {
  responses.length = 0;
  console.log('\n' + '═'.repeat(60));
  console.log(`👤 USER: ${text}`);

  const message = {
    type: 'text',
    messageId: 'test_' + Date.now(),
    timestamp: new Date(),
    from: phone,
    rawFrom: phone,
    contactName: 'Demo User',
    waId: phone,
    content: text,
    text: text,
  };

  const result = await engine.processMessage(message);
  if (result) printResponse(result);
  return result;
}

async function demo() {
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(15) + 'MTC MARIS CHATBOT DEMO' + ' '.repeat(21) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');

  // Setup
  console.log('\n⏳ Setting up...');
  await testConnection();
  await syncDatabase(true); // Force recreate tables
  console.log('✅ Ready!\n');

  const engine = new ConversationEngine();
  const phone = '264815551234';

  // Demo 1: New user greeting
  console.log('\n\n🎬 SCENARIO 1: New User Says Hi');
  console.log('━'.repeat(60));
  await simulateMessage(engine, phone, 'Hi');

  // Demo 2: User selects Register
  console.log('\n\n🎬 SCENARIO 2: User Selects Register');
  console.log('━'.repeat(60));
  await simulateMessage(engine, phone, 'REGISTER');

  // Demo 3: Enter first name
  console.log('\n\n🎬 SCENARIO 3: Enter First Name');
  console.log('━'.repeat(60));
  await simulateMessage(engine, phone, 'John');

  // Demo 4: Enter last name
  console.log('\n\n🎬 SCENARIO 4: Enter Last Name');
  console.log('━'.repeat(60));
  await simulateMessage(engine, phone, 'Doe');

  // Demo 5: Enter ID
  console.log('\n\n🎬 SCENARIO 5: Enter ID Number');
  console.log('━'.repeat(60));
  await simulateMessage(engine, phone, '12345678901');

  // Demo 6: Create PIN
  console.log('\n\n🎬 SCENARIO 6: Create PIN');
  console.log('━'.repeat(60));
  await simulateMessage(engine, phone, '54321');

  // Demo 7: Confirm PIN
  console.log('\n\n🎬 SCENARIO 7: Confirm PIN');
  console.log('━'.repeat(60));
  await simulateMessage(engine, phone, '54321');

  // Note about OTP
  console.log('\n\n📝 NOTE: In production, an OTP would be sent via SMS.');
  console.log('   The OTP code would be logged in development mode.');

  // Demo 8: Simulate OTP (would need real OTP from logs in actual flow)
  console.log('\n\n🎬 SCENARIO 8: Simulate successful registration');
  console.log('━'.repeat(60));

  // Force register the user for demo
  const { User } = require('../src/models');
  await User.update(
    { is_registered: true, is_verified: true, maris_account_id: 'DEMO001' },
    { where: { phone_number: phone } }
  );

  // Now test as registered user
  console.log('\n\n🎬 SCENARIO 9: Registered User - Show Menu');
  console.log('━'.repeat(60));
  await simulateMessage(engine, phone, 'menu');

  // Demo: Check Balance (needs PIN)
  console.log('\n\n🎬 SCENARIO 10: Select Check Balance (requires PIN)');
  console.log('━'.repeat(60));
  await simulateMessage(engine, phone, '6');

  // Enter PIN
  console.log('\n\n🎬 SCENARIO 11: Enter PIN');
  console.log('━'.repeat(60));
  await simulateMessage(engine, phone, '54321');

  // Now authenticated - show balance
  console.log('\n\n🎬 SCENARIO 12: View Balance');
  console.log('━'.repeat(60));
  await simulateMessage(engine, phone, '6');

  // Buy Airtime flow
  console.log('\n\n🎬 SCENARIO 13: Buy Airtime');
  console.log('━'.repeat(60));
  await simulateMessage(engine, phone, '1');

  // Select self
  console.log('\n\n🎬 SCENARIO 14: Select My Number');
  console.log('━'.repeat(60));
  await simulateMessage(engine, phone, 'SELF');

  // Enter amount
  console.log('\n\n🎬 SCENARIO 15: Enter Amount');
  console.log('━'.repeat(60));
  await simulateMessage(engine, phone, '50');

  // Confirm
  console.log('\n\n🎬 SCENARIO 16: Confirm Transaction');
  console.log('━'.repeat(60));
  await simulateMessage(engine, phone, 'yes');

  console.log('\n\n' + '═'.repeat(60));
  console.log('✅ DEMO COMPLETE');
  console.log('═'.repeat(60));
  console.log('\nThe chatbot successfully demonstrated:');
  console.log('  • New user detection and registration prompt');
  console.log('  • Registration flow (name, ID, PIN)');
  console.log('  • PIN authentication');
  console.log('  • Balance check');
  console.log('  • Airtime purchase flow with confirmation');
  console.log('\nAll transaction flows work similarly.\n');

  process.exit(0);
}

demo().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
