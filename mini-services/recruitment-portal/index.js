const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
// const path = require('path'); // Already declared above
const { initDatabase, dbGet, dbAll, dbRun, dbExec } = require('./src/config/database');

// Routes
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const candidateRoutes = require('./src/routes/candidates');
const aiRoutes = require('./src/routes/ai');

// Middleware
const { authMiddleware, adminOnly } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;  // Use root server on 3000, do not start this standalone

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const user = req.user ? ` [${req.user.username}]` : '';
    console.log(`${req.method} ${req.path}${user} → ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ── Static Files ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ──────────────────────────────────────────────────────────────
// Health check (no auth)
app.get('/api/health', (req, res) => {
  try {
    const row = dbGet('SELECT COUNT(*) as count FROM candidates');
    const candidateCount = row ? row.count : 0;
    res.json({
      success: true,
      service: 'Sperton Recruitment Portal',
      version: '1.0.0',
      candidates: candidateCount,
      uptime: process.uptime()
    });
  } catch (e) {
    res.json({ success: true, service: 'Sperton Recruitment Portal', version: '1.0.0', uptime: process.uptime() });
  }
});

// Auth routes (login is public, /me requires auth)
app.use('/api/auth', authRoutes);
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = dbGet('SELECT id, username, role, full_name, created_at FROM users WHERE id = ?', [req.user.id]);
  res.json({ success: true, user });
});

// Users (admin list)
app.use('/api/users', userRoutes);

// Candidate routes (authenticated)
app.use('/api/candidates', authMiddleware, candidateRoutes);

// AI routes (authenticated)
app.use('/api/ai', authMiddleware, aiRoutes);

// Dashboard stats (authenticated)
app.get('/api/stats', authMiddleware, (req, res) => {
  try {
    const totalCandidates = dbGet('SELECT COUNT(*) as count FROM candidates').count;
    const statusBreakdown = dbAll('SELECT status, COUNT(*) as count FROM candidates GROUP BY status');
    const topScored = dbAll('SELECT id, full_name, current_title, overall_score FROM candidates ORDER BY overall_score DESC LIMIT 5');
    const recentCandidates = dbAll('SELECT id, full_name, current_title, status, created_at FROM candidates ORDER BY created_at DESC LIMIT 5');
    const marketBreakdown = dbAll('SELECT market, COUNT(*) as count FROM candidates WHERE market IS NOT NULL GROUP BY market');

    res.json({
      success: true,
      stats: {
        totalCandidates,
        statusBreakdown,
        topScored,
        recentCandidates,
        marketBreakdown
      }
    });
  } catch (error) {
    console.error('Stats error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch stats.' });
  }
});

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Error Handling ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error.' });
});

// ── Start Server ────────────────────────────────────────────────────────────
async function start() {
  await initDatabase();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on: http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

module.exports = app;
