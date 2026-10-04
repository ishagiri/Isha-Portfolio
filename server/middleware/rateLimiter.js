const rateLimit = require('express-rate-limit');

// Limit contact form requests to prevent spam / automated floods
const contactRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 submissions per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many messages submitted from this IP. Please wait 15 minutes before trying again.',
  },
});

// Stricter rate limit for login attempts to prevent brute-force attacks
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
});

module.exports = {
  contactRateLimiter,
  loginRateLimiter,
};
