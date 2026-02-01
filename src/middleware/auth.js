import { config } from '../config/config.js';
import logger from '../utils/logger.js';

export const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.replace('Bearer ', '') ||
                req.headers['x-api-token'] ||
                req.query.token;

  if (!token) {
    logger.warn('Unauthorized request - no token provided', {
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API token is required'
    });
  }

  if (token !== config.auth.apiToken) {
    logger.warn('Unauthorized request - invalid token', {
      ip: req.ip,
      path: req.path,
      token: token.substring(0, 8) + '...'
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API token'
    });
  }

  next();
};

export default authMiddleware;