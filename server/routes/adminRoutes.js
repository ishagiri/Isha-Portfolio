const express = require('express');
const router = express.Router();
const {
  login,
  logout,
  getMessages,
  getMessageById,
  updateReadStatus,
  deleteMessage,
  getStats,
} = require('../controllers/adminController');
const { authenticateAdmin } = require('../middleware/auth');
const { loginRateLimiter } = require('../middleware/rateLimiter');

// Public auth endpoints
router.post('/login', loginRateLimiter, login);
router.post('/logout', logout);

// Protected admin endpoints (require valid JWT)
router.get('/stats', authenticateAdmin, getStats);
router.get('/messages', authenticateAdmin, getMessages);
router.get('/messages/:id', authenticateAdmin, getMessageById);
router.patch('/messages/:id/read', authenticateAdmin, updateReadStatus);
router.delete('/messages/:id', authenticateAdmin, deleteMessage);

module.exports = router;
