const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDatabase } = require('./server/db/init');
const { protectSensitiveFiles } = require('./server/middleware/protectEnv');
const contactRoutes = require('./server/routes/contactRoutes');
const adminRoutes = require('./server/routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy for accurate IP in rate limiters
app.set('trust proxy', 1);

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Start Server and initialize Database
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

startServer();
