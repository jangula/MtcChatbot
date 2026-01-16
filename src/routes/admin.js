/**
 * Admin Routes
 * Basic admin dashboard API endpoints
 */

const express = require('express');
const router = express.Router();
const config = require('../config');
const { User, Transaction, Session, AuditLog } = require('../models');
const SessionManager = require('../services/sessionManager');
const logger = require('../utils/logger');

// Basic auth middleware
const basicAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  if (username === config.admin.username && password === config.admin.password) {
    next();
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
};

// Apply auth to all admin routes
router.use(basicAuth);

/**
 * GET /admin/stats - Dashboard statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      todayTransactions,
      totalTransactions,
      sessionStats,
    ] = await Promise.all([
      User.count(),
      User.count({ where: { is_active: true, is_registered: true } }),
      Transaction.count({ where: { created_at: { [Op.gte]: today } } }),
      Transaction.count(),
      new SessionManager().getSessionStats(),
    ]);

    res.json({
      users: { total: totalUsers, active: activeUsers },
      transactions: { today: todayTransactions, total: totalTransactions },
      sessions: sessionStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Admin stats error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /admin/users - List users
 */
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await User.findAndCountAll({
      attributes: ['id', 'phone_number', 'first_name', 'last_name', 'is_registered', 'is_active', 'created_at', 'last_activity'],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    res.json({
      users: rows.map((u) => ({
        ...u.toJSON(),
        phone_number: u.phone_number.substring(0, 6) + '****',
      })),
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    logger.error('Admin users error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /admin/transactions - List transactions
 */
router.get('/transactions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { type, status } = req.query;

    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const { count, rows } = await Transaction.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    res.json({
      transactions: rows,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    logger.error('Admin transactions error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/**
 * GET /admin/audit-logs - View audit logs
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const { category, severity } = req.query;

    const where = {};
    if (category) where.category = category;
    if (severity) where.severity = severity;

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    res.json({
      logs: rows,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    logger.error('Admin audit logs error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * POST /admin/broadcast - Send broadcast message (future feature)
 */
router.post('/broadcast', async (req, res) => {
  res.status(501).json({ message: 'Broadcast feature coming soon' });
});

module.exports = router;
