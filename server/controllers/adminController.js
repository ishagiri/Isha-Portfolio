const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/connection');
const { isDatabaseReady } = require('../db/init');
const { JWT_SECRET } = require('../middleware/auth');
const { inMemoryMessages } = require('./contactController');
require('dotenv').config();

/**
 * POST /api/admin/login
 * Authenticates admin and returns JWT
 */
async function login(req, res) {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/Email and password are required.',
      });
    }

    const cleanUser = String(username).trim();
    const cleanPass = String(password);

    let adminFound = null;

    if (isDatabaseReady()) {
      try {
        const rows = await query(
          'SELECT id, username, email, password_hash FROM admins WHERE username = ? OR email = ? LIMIT 1',
          [cleanUser, cleanUser]
        );
        if (rows && rows.length > 0) {
          adminFound = rows[0];
        }
      } catch (dbErr) {
        console.error('[Admin Login DB Error]:', dbErr.message);
      }
    }

    // If database check found an admin, verify hash
    if (adminFound) {
      const match = await bcrypt.compare(cleanPass, adminFound.password_hash);
      if (!match) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials. Please verify username and password.',
        });
      }

      // Generate JWT
      const token = jwt.sign(
        { id: adminFound.id, username: adminFound.username, email: adminFound.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(200).json({
        success: true,
        message: 'Login successful.',
        token,
        user: {
          id: adminFound.id,
          username: adminFound.username,
          email: adminFound.email,
        },
      });
    }

    // Fallback authentication with environment credentials if DB not yet seeded or offline
    const envUser = process.env.ADMIN_USERNAME || 'admin';
    const envEmail = process.env.ADMIN_EMAIL;
    const envPass = process.env.ADMIN_PASSWORD;

    if (envPass && (cleanUser === envUser || (envEmail && cleanUser === envEmail)) && cleanPass === envPass) {
      const token = jwt.sign(
        { id: 1, username: envUser, email: envEmail || 'admin@portfolio.local' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(200).json({
        success: true,
        message: 'Login successful (environment authenticated).',
        token,
        user: {
          id: 1,
          username: envUser,
          email: envEmail,
        },
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid credentials. Please verify username and password.',
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during authentication.',
    });
  }
}

/**
 * POST /api/admin/logout
 */
function logout(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
}

/**
 * GET /api/admin/messages
 * Retrieves all messages with unread count
 */
async function getMessages(req, res) {
  try {
    let messages = [];

    if (isDatabaseReady()) {
      messages = await query(
        'SELECT id, name, email, message, is_read, created_at FROM messages ORDER BY created_at DESC'
      );
    } else {
      messages = [...inMemoryMessages];
    }

    const unreadCount = messages.filter(m => !m.is_read).length;

    return res.status(200).json({
      success: true,
      count: messages.length,
      unreadCount,
      messages,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages from database.',
    });
  }
}

/**
 * GET /api/admin/messages/:id
 * Retrieves a single message by ID
 */
async function getMessageById(req, res) {
  try {
    const messageId = parseInt(req.params.id, 10);
    if (!messageId) {
      return res.status(400).json({ success: false, message: 'Invalid message ID.' });
    }

    let message = null;

    if (isDatabaseReady()) {
      const rows = await query('SELECT * FROM messages WHERE id = ? LIMIT 1', [messageId]);
      if (rows && rows.length > 0) message = rows[0];
    } else {
      message = inMemoryMessages.find(m => m.id === messageId);
    }

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    return res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('Error fetching message details:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve message.' });
  }
}

/**
 * PATCH /api/admin/messages/:id/read
 * Updates read status of a message
 */
async function updateReadStatus(req, res) {
  try {
    const messageId = parseInt(req.params.id, 10);
    if (!messageId) {
      return res.status(400).json({ success: false, message: 'Invalid message ID.' });
    }

    // Default to read (1) if not explicitly provided
    const isRead = typeof req.body.is_read !== 'undefined' ? (req.body.is_read ? 1 : 0) : 1;

    if (isDatabaseReady()) {
      const result = await query('UPDATE messages SET is_read = ? WHERE id = ?', [isRead, messageId]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Message not found.' });
      }
    } else {
      const msg = inMemoryMessages.find(m => m.id === messageId);
      if (!msg) {
        return res.status(404).json({ success: false, message: 'Message not found.' });
      }
      msg.is_read = isRead;
    }

    return res.status(200).json({
      success: true,
      message: `Message marked as ${isRead ? 'read' : 'unread'}.`,
      is_read: isRead,
    });
  } catch (error) {
    console.error('Error updating read status:', error);
    return res.status(500).json({ success: false, message: 'Failed to update message status.' });
  }
}

/**
 * DELETE /api/admin/messages/:id
 * Deletes a message by ID
 */
async function deleteMessage(req, res) {
  try {
    const messageId = parseInt(req.params.id, 10);
    if (!messageId) {
      return res.status(400).json({ success: false, message: 'Invalid message ID.' });
    }

    if (isDatabaseReady()) {
      const result = await query('DELETE FROM messages WHERE id = ?', [messageId]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Message not found.' });
      }
    } else {
      const index = inMemoryMessages.findIndex(m => m.id === messageId);
      if (index === -1) {
        return res.status(404).json({ success: false, message: 'Message not found.' });
      }
      inMemoryMessages.splice(index, 1);
    }

    return res.status(200).json({
      success: true,
      message: 'Message deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete message.' });
  }
}

/**
 * GET /api/admin/stats
 * Overview numbers for the dashboard
 */
async function getStats(req, res) {
  try {
    let total = 0;
    let unread = 0;

    if (isDatabaseReady()) {
      const totalRows = await query('SELECT COUNT(*) as total FROM messages');
      const unreadRows = await query('SELECT COUNT(*) as unread FROM messages WHERE is_read = 0');
      total = totalRows[0].total;
      unread = unreadRows[0].unread;
    } else {
      total = inMemoryMessages.length;
      unread = inMemoryMessages.filter(m => !m.is_read).length;
    }

    return res.status(200).json({
      success: true,
      stats: {
        total,
        unread,
        read: total - unread,
      },
    });
  } catch (error) {
    console.error('Error retrieving stats:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve stats.' });
  }
}

module.exports = {
  login,
  logout,
  getMessages,
  getMessageById,
  updateReadStatus,
  deleteMessage,
  getStats,
};
