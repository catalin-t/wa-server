import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from './config/config.js';
import logger from './utils/logger.js';
import whatsappService from './services/whatsappService.js';
import messageRoutes from './routes/messageRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(process.cwd(), 'public')));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Routes
app.use('/api', messageRoutes);

// Root endpoint - redirect to dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard.html');
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'WhatsApp Notification Server',
    version: '1.0.0',
    endpoints: {
      'GET /api/health': 'Health check',
      'GET /api/qr': 'Get QR code for WhatsApp connection',
      'GET /api/status': 'Get connection status (requires auth)',
      'GET /api/logs': 'Get recent logs (requires auth)',
      'GET /api/logs/stream': 'Real-time log stream (requires auth)',
      'POST /api/message': 'Send WhatsApp message (requires auth)',
      'POST /api/connect': 'Force connection (requires auth)',
      'POST /api/disconnect': 'Disconnect (requires auth)',
      'POST /api/reset': 'Reset connection state (requires auth)'
    },
    dashboard: '/dashboard.html',
    documentation: 'See README.md for detailed usage'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.path} not found`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    details: config.server.env === 'development' ? err.message : undefined
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await whatsappService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await whatsappService.disconnect();
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    // Initialize WhatsApp service
    logger.info('Starting WhatsApp service...');
    await whatsappService.initialize();

    // Start Express server
    const server = app.listen(config.server.port, '0.0.0.0', () => {
      // Show masked token (first 8 and last 4 characters)
      const token = config.auth.apiToken;
      const maskedToken = token.length > 12
        ? `${token.substring(0, 8)}...${token.substring(token.length - 4)}`
        : '***hidden***';

      logger.info(`Server is running on port ${config.server.port}`);
      logger.info(`Environment: ${config.server.env}`);
      logger.info(`API Token: ${maskedToken}`);
      logger.info('');
      logger.info('=== Quick Start ===');
      logger.info(`1. Open http://localhost:${config.server.port}/ for the Dashboard`);
      logger.info(`2. Or http://localhost:${config.server.port}/api/qr to scan QR code`);
      logger.info(`3. Check .env file for your full API token`);
      logger.info('4. Use dashboard to monitor and control connection');
      logger.info('==================');
    });

    // Handle server errors
    server.on('error', (error) => {
      logger.error('Server error:', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();