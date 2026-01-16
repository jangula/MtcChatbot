/**
 * Conversation State Model
 * Tracks the current state of user's chatbot conversation
 */

module.exports = (sequelize, DataTypes) => {
  const ConversationState = sequelize.define('ConversationState', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    current_flow: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Current conversation flow (e.g., BUY_AIRTIME, SEND_MONEY)',
    },
    current_step: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Current step within the flow',
    },
    flow_data: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Temporary data collected during flow',
    },
    pending_action: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Action awaiting user input',
    },
    awaiting_input: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Type of input expected (e.g., PHONE, AMOUNT, PIN)',
    },
    menu_context: {
      type: DataTypes.STRING(50),
      defaultValue: 'MAIN',
      comment: 'Current menu context',
    },
    last_message_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Last WhatsApp message ID',
    },
    last_user_input: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    last_bot_response: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    error_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Consecutive error count',
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'conversation_states',
    indexes: [
      { fields: ['user_id'], unique: true },
      { fields: ['current_flow'] },
      { fields: ['updated_at'] },
    ],
  });

  // Instance methods
  ConversationState.prototype.reset = function() {
    this.current_flow = null;
    this.current_step = null;
    this.flow_data = {};
    this.pending_action = null;
    this.awaiting_input = null;
    this.menu_context = 'MAIN';
    this.error_count = 0;
  };

  ConversationState.prototype.setFlow = function(flow, step = 'START') {
    this.current_flow = flow;
    this.current_step = step;
    this.flow_data = {};
    this.error_count = 0;
  };

  ConversationState.prototype.updateFlowData = function(key, value) {
    this.flow_data = { ...this.flow_data, [key]: value };
  };

  return ConversationState;
};
