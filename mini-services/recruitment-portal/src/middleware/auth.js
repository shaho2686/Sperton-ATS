const jwt = require('jsonwebtoken');
const { dbGet, dbRun, dbAll } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'sperton-jwt-secret-key-2026';

/**
 * API Key Authentication Middleware
 * Accepts authentication via:
 * 1. Authorization: Bearer <jwt_token>
 * 2. x-api-key: <api_key>
 */
function authMiddleware(req, res, next) {
  // Skip auth for login endpoint
  if (req.path === '/api/auth/login' || req.path === '/api/auth/register') {
    return next();
  }

  // Try JWT token first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = { id: decoded.id, username: decoded.username, role: decoded.role };
      return next();
    } catch (err) {
      // Token invalid — fall through to API key check
    }
  }

  // Try API key
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    const user = dbGet('SELECT id, username, role, full_name FROM users WHERE api_key = ?', [apiKey]);
    if (user) {
      req.user = user;
      return next();
    }
  }

  // Try query parameter (for simple testing)
  const queryKey = req.query.api_key;
  if (queryKey) {
    const user = dbGet('SELECT id, username, role, full_name FROM users WHERE api_key = ?', [queryKey]);
    if (user) {
      req.user = user;
      return next();
    }
  }

  return res.status(401).json({
    success: false,
    error: 'Authentication required. Provide a valid JWT token (Bearer) or API key (x-api-key header).'
  });
}

/**
 * Admin-only middleware — must be used after authMiddleware
 */
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required.' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly };
