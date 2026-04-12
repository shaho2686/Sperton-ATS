const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { dbGet, dbRun, dbAll } = require('../config/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'sperton-jwt-secret-key-2026';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateApiKey() {
  return crypto.randomBytes(16).toString('hex');
}

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required.' });
  }

  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  const user = dbGet(
    'SELECT id, username, role, full_name, api_key, avatar FROM users WHERE username = ? AND password_hash = ?',
    [username, passwordHash]
  );

  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid credentials.' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.full_name,
      apiKey: user.api_key,
      avatar: user.avatar
    }
  });
});

router.post('/register', authMiddleware, adminOnly, (req, res) => {
  const { fullName, username, password, role } = req.body;

  if (!fullName || !username || !password) {
    return res.status(400).json({ success: false, error: 'Full name, username and password are required.' });
  }

  const existingUser = dbGet('SELECT id FROM users WHERE username = ?', [username]);
  if (existingUser) {
    return res.status(409).json({ success: false, error: 'Username already exists.' });
  }

  const passwordHash = hashPassword(password);
  const apiKey = generateApiKey();
  const userRole = role === 'admin' ? 'admin' : 'recruiter';

  try {
    dbRun(
      `INSERT INTO users (username, password_hash, api_key, role, full_name)
       VALUES (?, ?, ?, ?, ?)`,
      [username, passwordHash, apiKey, userRole, fullName]
    );

    res.json({
      success: true,
      message: `User ${username} created successfully as ${userRole}.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to create user.' });
  }
});

router.post('/avatar', authMiddleware, (req, res) => {
  const { avatar, clear } = req.body;

  if (clear === true) {
    try {
      dbRun(
        'UPDATE users SET avatar = NULL, updated_at = datetime(\'now\') WHERE id = ?',
        [req.user.id]
      );
      const user = dbGet('SELECT id, username, role, full_name, api_key, avatar FROM users WHERE id = ?', [req.user.id]);
      return res.json({
        success: true,
        message: 'Profile photo removed.',
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          fullName: user.full_name,
          apiKey: user.api_key,
          avatar: user.avatar
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Failed to remove photo.' });
    }
  }

  if (!avatar || !avatar.startsWith('data:image/')) {
    return res.status(400).json({ success: false, error: 'Invalid image data.' });
  }

  if (avatar.length > 2_500_000) {
    return res.status(400).json({ success: false, error: 'Image is too large. Use a smaller file.' });
  }

  try {
    dbRun(
      'UPDATE users SET avatar = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [avatar, req.user.id]
    );

    const user = dbGet('SELECT id, username, role, full_name, api_key, avatar FROM users WHERE id = ?', [req.user.id]);
    
    res.json({
      success: true,
      message: 'Avatar updated successfully.',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name,
        apiKey: user.api_key,
        avatar: user.avatar
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update avatar.' });
  }
});

/**
 * PUT /api/auth/profile — update display name (authenticated user)
 */
router.put('/profile', authMiddleware, (req, res) => {
  const { fullName } = req.body;
  const name = fullName != null ? String(fullName).trim() : '';
  if (!name) {
    return res.status(400).json({ success: false, error: 'Full name is required.' });
  }

  try {
    dbRun(
      'UPDATE users SET full_name = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [name, req.user.id]
    );
    const user = dbGet('SELECT id, username, role, full_name, api_key, avatar FROM users WHERE id = ?', [req.user.id]);
    res.json({
      success: true,
      message: 'Profile updated.',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name,
        apiKey: user.api_key,
        avatar: user.avatar
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update profile.' });
  }
});

/**
 * PUT /api/auth/password — change password (authenticated)
 */
router.put('/password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Current and new password are required.' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ success: false, error: 'New password must be at least 6 characters.' });
  }

  const row = dbGet('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!row) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }
  if (row.password_hash !== hashPassword(currentPassword)) {
    return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
  }

  try {
    dbRun(
      'UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [hashPassword(newPassword), req.user.id]
    );
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update password.' });
  }
});

module.exports = router;
