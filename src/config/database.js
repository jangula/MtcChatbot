/**
 * Database Configuration and Connection
 * Uses Sequelize ORM with PostgreSQL
 */

const { Sequelize } = require('sequelize');
const config = require('./index');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
  config.database.name,
  config.database.user,
  config.database.password,
  {
    host: config.database.host,
    port: config.database.port,
    dialect: config.database.dialect,
    logging: config.database.logging,
    pool: config.database.pool,
    dialectOptions: config.database.ssl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true,
    },
  }
);

/**
 * Test database connection
 */
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    return false;
  }
};

/**
 * Sync database models
 * @param {boolean} force - Drop tables before recreating (use with caution)
 */
const syncDatabase = async (force = false) => {
  try {
    if (force) {
      // Force recreate all tables (drops existing data)
      await sequelize.sync({ force: true });
    } else {
      // Just create tables if they don't exist (safe for production)
      await sequelize.sync({ force: false });
    }
    logger.info('Database synchronized successfully');
    return true;
  } catch (error) {
    logger.error('Database synchronization failed:', error);
    // Don't fail startup if tables already exist
    return false;
  }
};

module.exports = {
  sequelize,
  testConnection,
  syncDatabase,
};
