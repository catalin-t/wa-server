import rateLimit from 'express-rate-limit';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Maximum 1 message per second allowed.',
      retryAfter: config.rateLimit.windowMs / 1000
    });
  }
});

export default rateLimiter;