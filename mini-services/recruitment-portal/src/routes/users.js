const express = require('express');
const { dbAll, dbGet, dbRun } = require('../config/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/users
 * List portal users (no password fields). Admin only.
 */
router.get('/', authMiddleware, adminOnly, (req, res) => {
  try {
    const users = dbAll(
      `SELECT id, username, role, full_name, created_at
       FROM users
       ORDER BY full_name COLLATE NOCASE, username COLLATE NOCASE`
    );
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('List users error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch users.' });
  }
});

/**
 * PUT /api/users/:id
 * Update a user. Admin only.
 */
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const { id } = req.params;
  const { fullName, username, role } = req.body;

  if (!fullName || !username) {
    return res.status(400).json({ success: false, error: 'Full name and username are required.' });
  }

  // Check if user exists
  const existingUser = dbGet('SELECT id FROM users WHERE id = ?', [id]);
  if (!existingUser) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  // Check if username is taken by another user
  const usernameTaken = dbGet('SELECT id FROM users WHERE username = ? AND id != ?', [username, id]);
  if (usernameTaken) {
    return res.status(409).json({ success: false, error: 'Username already exists.' });
  }

  const userRole = role === 'admin' ? 'admin' : 'recruiter';

  try {
    dbRun(
      `UPDATE users SET full_name = ?, username = ?, role = ?, updated_at = datetime('now') WHERE id = ?`,
      [fullName, username, userRole, id]
    );
    res.json({ success: true, message: 'User updated successfully.' });
  } catch (err) {
    console.error('Update user error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update user.' });
  }
});

/**
 * DELETE /api/users/:id
 * Delete a user. Admin only. Cannot delete self.
 */
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const { id } = req.params;

  if (id == req.user.id) {
    return res.status(400).json({ success: false, error: 'Cannot delete your own account.' });
  }

  // Check if user exists
  const existingUser = dbGet('SELECT id FROM users WHERE id = ?', [id]);
  if (!existingUser) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  try {
    dbRun('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err) {
    console.error('Delete user error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete user.' });
  }
});

module.exports = router;
