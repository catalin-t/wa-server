import express from 'express';
import whatsappService from '../services/whatsappService.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import logger from '../utils/logger.js';
import logManager from '../utils/logManager.js';
import { config } from '../config/config.js';

const router = express.Router();

// Send message endpoint with auth and rate limiting
router.post('/message', authMiddleware, rateLimiter, async (req, res) => {
  const { phoneNumber, message } = req.body;

  // Validate request body
  if (!phoneNumber || !message) {
    logger.warn('Invalid message request - missing fields', { body: req.body });
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Both phoneNumber and message are required'
    });
  }

  // Validate phone number format (basic validation)
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(phoneNumber.replace(/\D/g, ''))) {
    logger.warn('Invalid phone number format', { phoneNumber });
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid phone number format. Use international format (e.g., +1234567890)'
    });
  }

  try {
    const result = await whatsappService.sendMessage(phoneNumber, message);

    logger.info('Message sent successfully', {
      to: phoneNumber,
      messageId: result.messageId
    });

    // Only return 201 when message is successfully sent
    return res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: result
    });
  } catch (error) {
    logger.error('Failed to send message', {
      error: error.message,
      phoneNumber,
      stack: error.stack
    });

    // Return appropriate error status
    if (error.message.includes('not connected')) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'WhatsApp is not connected. Please scan the QR code first.'
      });
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to send message',
      details: error.message
    });
  }
});

// Get QR code endpoint (no auth required for initial setup)
router.get('/qr', async (req, res) => {
  try {
    const qrDataURL = await whatsappService.getQRCode();

    if (!qrDataURL) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No QR code available. WhatsApp might already be connected.'
      });
    }

    // Return QR code as HTML page for easy scanning
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>WhatsApp QR Code</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
            }
            h1 {
              color: #333;
              margin-bottom: 20px;
            }
            img {
              border: 2px solid #eee;
              border-radius: 5px;
              padding: 10px;
            }
            .status {
              margin-top: 20px;
              padding: 10px;
              background: #f0f0f0;
              border-radius: 5px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>WhatsApp QR Code</h1>
            <img src="${qrDataURL}" alt="QR Code" />
            <div class="status">
              <p>Scan this QR code with WhatsApp to connect</p>
              <p><small>This QR code will expire in 60 seconds</small></p>
            </div>
          </div>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error('Failed to get QR code', { error: error.message });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate QR code'
    });
  }
});

// Get connection status endpoint
router.get('/status', authMiddleware, (req, res) => {
  const status = whatsappService.getDetailedStatus();
  res.json({
    success: true,
    data: status
  });
});

// Reset connection endpoint - clears cooldown and resets state
router.post('/reset', authMiddleware, async (req, res) => {
  try {
    await whatsappService.resetConnection();
    logger.info('Connection reset requested via API');
    res.json({
      success: true,
      message: 'Connection state reset successfully. Ready for new connection.'
    });
  } catch (error) {
    logger.error('Failed to reset connection', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reset connection',
      details: error.message
    });
  }
});

// Clear session endpoint - deletes all session data and forces re-authentication
router.post('/clear-session', authMiddleware, async (req, res) => {
  try {
    const result = await whatsappService.clearSession();
    logger.info('Session cleared via API', { deletedFiles: result.deletedFiles });
    res.json({
      success: true,
      message: 'Session data cleared. You will need to scan a new QR code to reconnect.',
      data: result
    });
  } catch (error) {
    logger.error('Failed to clear session', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to clear session data',
      details: error.message
    });
  }
});

// Disconnect endpoint
router.post('/disconnect', authMiddleware, async (req, res) => {
  try {
    await whatsappService.disconnect();
    logger.info('Disconnect requested via API');
    res.json({
      success: true,
      message: 'Disconnected successfully'
    });
  } catch (error) {
    logger.error('Failed to disconnect', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to disconnect',
      details: error.message
    });
  }
});

// Force connect endpoint - resets and connects
router.post('/connect', authMiddleware, async (req, res) => {
  try {
    await whatsappService.forceConnect();
    logger.info('Force connect requested via API');
    res.json({
      success: true,
      message: 'Connection initiated. Check /qr for QR code or /status for connection state.'
    });
  } catch (error) {
    logger.error('Failed to force connect', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to initiate connection',
      details: error.message
    });
  }
});

// Get recent logs endpoint
router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 50;
    const logs = await logManager.getRecentLogs(count);
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    logger.error('Failed to get logs', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve logs'
    });
  }
});

// Real-time log streaming endpoint (Server-Sent Events)
router.get('/logs/stream', authMiddleware, (req, res) => {

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection message
  res.write('data: {"level":"info","message":"Connected to log stream","timestamp":"' + new Date().toISOString() + '"}\n\n');

  // Add client to log manager
  logManager.addClient(res);

  // Send keepalive every 30 seconds
  const keepaliveInterval = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch (error) {
      clearInterval(keepaliveInterval);
    }
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(keepaliveInterval);
    logManager.removeClient(res);
  });
});

// Webhook notification endpoint (no auth for external services like Claude hooks)
router.post('/webhook/notify', async (req, res) => {
  const { phoneNumber, message, secret } = req.body;

  // Simple secret-based auth for webhooks
  const webhookSecret = process.env.WEBHOOK_SECRET || config.auth.apiToken;
  if (secret !== webhookSecret) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid webhook secret'
    });
  }

  if (!phoneNumber || !message) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Both phoneNumber and message are required'
    });
  }

  try {
    const result = await whatsappService.sendMessage(phoneNumber, message);
    logger.info('Webhook notification sent', {
      to: phoneNumber,
      messageId: result.messageId
    });

    return res.status(200).json({
      success: true,
      message: 'Notification sent',
      data: result
    });
  } catch (error) {
    logger.error('Failed to send webhook notification', {
      error: error.message,
      phoneNumber
    });

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to send notification',
      details: error.message
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

export default router;