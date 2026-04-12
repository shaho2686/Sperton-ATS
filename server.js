const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const { createServer } = require('http');

const { initDatabase, dbGet, dbAll } = require('./mini-services/recruitment-portal/src/config/database');
const authRoutes = require('./mini-services/recruitment-portal/src/routes/auth');
const userRoutes = require('./mini-services/recruitment-portal/src/routes/users');
const candidateRoutes = require('./mini-services/recruitment-portal/src/routes/candidates');
const aiRoutes = require('./mini-services/recruitment-portal/src/routes/ai');
const { authMiddleware } = require('./mini-services/recruitment-portal/src/middleware/auth');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

app.use('/api/auth', authRoutes);

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = dbGet('SELECT id, username, role, full_name, avatar, created_at FROM users WHERE id = ?', [req.user.id]);
  res.json({ success: true, user });
});

app.use('/api/users', userRoutes);
app.use('/api/candidates', authMiddleware, candidateRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);

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

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '.next', 'standalone', 'public')));

function initFallbackRoutes() {
  app.all('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'Not found - Next.js integration pending' });
    } else {
      res.status(404).json({ error: 'API route not found' });
    }
  });
}

async function start() {
  try {
    await initDatabase();
    console.log('✓ Database initialized');

    initFallbackRoutes();

    const server = createServer(app);
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✓ Sperton Portal running on: http://localhost:${PORT}`);
      console.log(`✓ Backend API: http://localhost:${PORT}/api`);
      console.log(`✓ Portal: http://localhost:${PORT}/portal`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
