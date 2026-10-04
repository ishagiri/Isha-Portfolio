const { pool, query } = require('../db/connection');
const { isDatabaseReady } = require('../db/init');

// Temporary in-memory storage fallback if MySQL is disconnected
const inMemoryMessages = [];
let fallbackIdCounter = 1;

/**
 * Standard RFC 5322 compliant email validator
 */
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email.trim()) && email.length <= 254;
}

/**
 * Basic spam filter detection
 */
function isSpam(name, message) {
  const spamKeywords = ['viagra', 'casino', 'free crypto', 'buy followers', 'seo ranking guarantee'];
  const textToCheck = `${name} ${message}`.toLowerCase();
  return spamKeywords.some(keyword => textToCheck.includes(keyword));
}

/**
 * POST /api/contact
 * Handles contact message submission
 */
async function submitContact(req, res) {
  try {
    const { name, email, message } = req.body || {};
    const errors = [];

    // 1. Validate Name
    if (!name || typeof name !== 'string' || !name.trim()) {
      errors.push('Name is required.');
    } else if (name.trim().length < 2 || name.trim().length > 100) {
      errors.push('Name must be between 2 and 100 characters.');
    }

    // 2. Validate Email
    if (!email || typeof email !== 'string' || !email.trim()) {
      errors.push('Email is required.');
    } else if (!isValidEmail(email)) {
      errors.push('Please provide a valid email address.');
    }

    // 3. Validate Message
    if (!message || typeof message !== 'string' || !message.trim()) {
      errors.push('Message is required.');
    } else if (message.trim().length < 5) {
      errors.push('Message must be at least 5 characters long.');
    } else if (message.trim().length > 5000) {
      errors.push('Message cannot exceed 5000 characters.');
    }

    // Return 400 Bad Request if validation failed
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors: errors,
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanMessage = message.trim();

    // Check spam filter
    if (isSpam(cleanName, cleanMessage)) {
      return res.status(400).json({
        success: false,
        message: 'Your message was flagged as potential spam. Please revise your message.',
      });
    }

    // Save to Database with parameterized SQL query
    let savedId = null;
    if (isDatabaseReady()) {
      try {
        const sql = 'INSERT INTO messages (name, email, message, is_read, created_at) VALUES (?, ?, ?, 0, NOW())';
        const result = await query(sql, [cleanName, cleanEmail, cleanMessage]);
        savedId = result.insertId;
      } catch (dbErr) {
        console.error('[Database Error during insert]:', dbErr.message);
        // Fallback to memory
        savedId = fallbackIdCounter++;
        inMemoryMessages.unshift({
          id: savedId,
          name: cleanName,
          email: cleanEmail,
          message: cleanMessage,
          is_read: 0,
          created_at: new Date().toISOString(),
        });
      }
    } else {
      // Memory fallback if DB is still initializing or offline
      savedId = fallbackIdCounter++;
      inMemoryMessages.unshift({
        id: savedId,
        name: cleanName,
        email: cleanEmail,
        message: cleanMessage,
        is_read: 0,
        created_at: new Date().toISOString(),
      });
    }

    console.log(`[Contact Submission] Received from "${cleanName}" <${cleanEmail}>`);

    return res.status(200).json({
      success: true,
      message: `Thank you, ${cleanName}! Your message has been received successfully.`,
      id: savedId,
    });
  } catch (error) {
    console.error('Unhandled Contact API Error:', error);
    // Generic error message to never expose database or server internals to visitors
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while sending your message. Please try again later.',
    });
  }
}

module.exports = {
  submitContact,
  inMemoryMessages,
};
