const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDatabase, ensureDatabaseReady } = require('./server/db/init');
const { protectSensitiveFiles } = require('./server/middleware/protectEnv');
const contactRoutes = require('./server/routes/contactRoutes');
const adminRoutes = require('./server/routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy for accurate IP in rate limiters (Vercel, Render, Heroku)
app.set('trust proxy', 1);

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Configured CORS: allows same-origin, configured domains, and Vercel preview URLs
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['https://ishagiri.github.io', 'http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Kick off database initialization for serverless cold-starts
ensureDatabaseReady().catch(err => {
  console.warn('[DB Cold-start Notice]:', err.message);
});

// Security Guard: Prevent any request from accessing .env, package.json, server/ or git files
app.use(protectSensitiveFiles);

// Mount API routes
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);

// Serve Admin Dashboard static files
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Serve root static frontend files (index.html, style.css, images, etc.)
app.use(express.static(path.join(__dirname), { dotfiles: 'ignore' }));

// Dedicated admin page routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

// Fallback route: serve main portfolio index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Central error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err.stack || err);
  res.status(500).json({
    success: false,
    message: 'An unexpected internal error occurred.',
  });
});

// Start Server and initialize Database when executed directly (node server.js)
async function startServer() {
  await initDatabase();

  app.listen(PORT, () => {
    console.log('==================================================');
    console.log(`Portfolio Server is running:`);
    console.log(`Portfolio:        http://localhost:${PORT}`);
    console.log(`Admin Dashboard:  http://localhost:${PORT}/admin`);
    console.log(`Admin Login:      http://localhost:${PORT}/admin/login`);
    console.log(`Contact API:      http://localhost:${PORT}/api/contact`);
    console.log('==================================================');
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;
