const express = require('express');
const router = express.Router();
const { submitContact } = require('../controllers/contactController');
const { contactRateLimiter } = require('../middleware/rateLimiter');

// POST /api/contact
router.post('/', contactRateLimiter, submitContact);

module.exports = router;
