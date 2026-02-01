import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class WhatsAppService {
  constructor() {
    this.socket = null;
    this.qr = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxReconnectAttempts = parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '2'); // Reduced from 5
    this.baseRetryDelay = parseInt(process.env.BASE_RETRY_DELAY_MS || '60000'); // 1 minute default
    this.lastConnectionAttempt = null;
    this.cooldownPeriod = parseInt(process.env.COOLDOWN_PERIOD_MS || '300000'); // 5 minutes default
    this.sessionPath = path.join(process.cwd(), config.whatsapp.sessionFolder);
  }

  async initialize() {
    try {
      // Check cooldown period
      if (this.lastConnectionAttempt) {
        const timeSinceLastAttempt = Date.now() - this.lastConnectionAttempt;
        if (timeSinceLastAttempt < this.cooldownPeriod) {
          const waitTime = Math.ceil((this.cooldownPeriod - timeSinceLastAttempt) / 1000);
          logger.warn(`In cooldown period. Wait ${waitTime}s before trying to connect again.`);
          logger.info(`Cooldown ends at: ${new Date(this.lastConnectionAttempt + this.cooldownPeriod).toISOString()}`);
          return; // Don't attempt connection during cooldown
        }
      }

      logger.info('Initializing WhatsApp connection...');
      this.lastConnectionAttempt = Date.now();
      await this.connect();
    } catch (error) {
      logger.error('Failed to initialize WhatsApp service:', error);
      throw error;
    }
  }

  async connect() {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);

      // Configure Baileys logger to capture all output
      const pino = (await import('pino')).default;
      const baileysPino = pino({ level: 'debug' });

      this.socket = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Enable terminal QR for debugging
        logger: baileysPino,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        qrTimeout: 60000,
        browser: ['Chrome (Linux)', '', ''],
        connectTimeoutMs: 60000,
        retryRequestDelayMs: 5000,
      });

      // Handle connection updates
      this.socket.ev.on('connection.update', async (update) => {
        await this.handleConnectionUpdate(update);
      });

      // Handle credentials update
      this.socket.ev.on('creds.update', saveCreds);

      // Handle messages
      this.socket.ev.on('messages.upsert', async (message) => {
        logger.info('Received message:', message);
      });

    } catch (error) {
      logger.error('Connection error:', error);
      throw error;
    }
  }

  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.qr = qr;
      logger.info('QR Code received. Use /qr endpoint to get it.');

      // Generate QR code for console
      try {
        const qrString = await qrcode.toString(qr, { type: 'terminal', small: true });
        console.log('\n=== Scan this QR code with WhatsApp ===\n');
        console.log(qrString);
        console.log('\n=== Or get it from http://localhost:3000/qr ===\n');
      } catch (error) {
        logger.error('Failed to generate QR code:', error);
      }
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
        : true;

      this.isConnected = false;
      // Don't clear QR immediately - keep it available for 2 minutes
      // This allows users to scan even if connection is unstable
      setTimeout(() => {
        if (!this.isConnected) {
          this.qr = null;
          logger.info('QR code expired');
        }
      }, 120000); // 2 minutes

      const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
      const errorCode = lastDisconnect?.error?.output?.statusCode;
      const errorPayload = lastDisconnect?.error?.output?.payload;

      // Log full error details for debugging
      logger.error('Connection closed with error', {
        reason: errorMessage,
        statusCode: errorCode,
        payload: errorPayload,
        errorType: lastDisconnect?.error?.constructor?.name,
        shouldReconnect,
        fullError: JSON.stringify(lastDisconnect?.error, Object.getOwnPropertyNames(lastDisconnect?.error || {}))
      });

      if (shouldReconnect && this.connectionAttempts < this.maxReconnectAttempts) {
        this.connectionAttempts++;
        // Much longer delays: 1min, 2min, etc.
        const delay = this.baseRetryDelay * this.connectionAttempts;
        const delayMinutes = Math.round(delay / 60000);
        logger.info(`Reconnecting in ${delayMinutes} minute(s)... (Attempt ${this.connectionAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
      } else if (this.connectionAttempts >= this.maxReconnectAttempts) {
        const cooldownMinutes = Math.round(this.cooldownPeriod / 60000);
        logger.error(`Max reconnection attempts reached. Server will enter ${cooldownMinutes}-minute cooldown.`);
        logger.error(`Please check your internet connection or wait before restarting.`);
        this.lastConnectionAttempt = Date.now();
      }
    }

    if (connection === 'open') {
      this.isConnected = true;
      this.qr = null;
      this.connectionAttempts = 0;
      logger.info('WhatsApp connected successfully!');
    }
  }

  async sendMessage(phoneNumber, message) {
    if (!this.isConnected) {
      throw new Error('WhatsApp is not connected. Please scan the QR code first.');
    }

    try {
      // Format phone number (remove any non-digit characters and add @s.whatsapp.net)
      const formattedNumber = phoneNumber.replace(/\D/g, '') + '@s.whatsapp.net';

      logger.info(`Sending message to ${formattedNumber}`);

      const result = await this.socket.sendMessage(formattedNumber, {
        text: message
      });

      logger.info('Message sent successfully', {
        to: formattedNumber,
        messageId: result.key.id
      });

      return {
        success: true,
        messageId: result.key.id,
        to: formattedNumber
      };
    } catch (error) {
      logger.error('Failed to send message:', error);
      throw error;
    }
  }

  async getQRCode() {
    if (!this.qr) {
      return null;
    }

    try {
      const qrDataURL = await qrcode.toDataURL(this.qr);
      return qrDataURL;
    } catch (error) {
      logger.error('Failed to generate QR code data URL:', error);
      throw error;
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      hasQR: !!this.qr,
      connectionAttempts: this.connectionAttempts
    };
  }

  async disconnect() {
    if (this.socket) {
      this.socket.end();
      this.socket = null;
      this.isConnected = false;
      this.qr = null;
      logger.info('WhatsApp disconnected');
    }
  }

  async resetConnection() {
    logger.info('Resetting WhatsApp connection...');

    // Reset all state variables
    this.connectionAttempts = 0;
    this.lastConnectionAttempt = null;
    this.qr = null;
    this.isConnected = false;

    // Disconnect existing socket if any
    if (this.socket) {
      this.socket.end();
      this.socket = null;
    }

    logger.info('Connection state reset. Ready for new connection.');
  }

  async forceConnect() {
    logger.info('Forcing new connection...');

    // Reset connection state first
    await this.resetConnection();

    // Start fresh connection
    await this.connect();

    logger.info('Force connect initiated.');
  }

  async clearSession() {
    logger.info('Clearing session data...');

    // Disconnect first
    await this.disconnect();

    // Reset all state
    this.connectionAttempts = 0;
    this.lastConnectionAttempt = null;
    this.qr = null;
    this.isConnected = false;

    // Delete all files in session folder except .gitkeep
    try {
      const files = await fs.readdir(this.sessionPath);
      for (const file of files) {
        if (file !== '.gitkeep') {
          const filePath = path.join(this.sessionPath, file);
          await fs.rm(filePath, { recursive: true, force: true });
          logger.info(`Deleted session file: ${file}`);
        }
      }
      logger.info('Session data cleared successfully');

      // Auto-start new connection to generate QR code
      logger.info('Starting fresh connection...');
      await this.connect();

      return { success: true, deletedFiles: files.filter(f => f !== '.gitkeep') };
    } catch (error) {
      logger.error('Failed to clear session data:', error);
      throw error;
    }
  }

  getDetailedStatus() {
    const now = Date.now();
    const cooldownRemaining = this.lastConnectionAttempt
      ? Math.max(0, this.cooldownPeriod - (now - this.lastConnectionAttempt))
      : 0;

    return {
      isConnected: this.isConnected,
      hasQR: !!this.qr,
      connectionAttempts: this.connectionAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      inCooldown: cooldownRemaining > 0,
      cooldownRemaining: Math.ceil(cooldownRemaining / 1000), // seconds
      cooldownEndsAt: this.lastConnectionAttempt
        ? new Date(this.lastConnectionAttempt + this.cooldownPeriod).toISOString()
        : null,
      hasSocket: !!this.socket
    };
  }
}

// Export singleton instance
const whatsappService = new WhatsAppService();
export default whatsappService;