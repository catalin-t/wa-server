import winston from 'winston';
import { config } from '../config/config.js';
import TransportStream from 'winston-transport';
import logManager from './logManager.js';

// Custom transport for real-time log streaming
class BroadcastTransport extends TransportStream {
  constructor(opts) {
    super(opts);
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // Broadcast to connected clients
    logManager.broadcast({
      level: info.level,
      message: info.message,
      timestamp: info.timestamp,
      service: info.service,
      ...info
    });

    callback();
  }
}

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'wa-server' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: 'error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'combined.log'
    }),
    new BroadcastTransport()
  ]
});

export default logger;