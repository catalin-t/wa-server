import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class LogManager {
  constructor() {
    this.clients = new Set();
    this.logBuffer = [];
    this.maxBufferSize = 100;
  }

  // Add a client for real-time log streaming
  addClient(res) {
    this.clients.add(res);

    // Send buffered logs to new client
    this.logBuffer.forEach(log => {
      try {
        res.write(`data: ${JSON.stringify(log)}\n\n`);
      } catch (error) {
        // Client might have disconnected
      }
    });
  }

  // Remove a client
  removeClient(res) {
    this.clients.delete(res);
  }

  // Broadcast a log to all connected clients
  broadcast(log) {
    // Add to buffer
    this.logBuffer.push(log);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Send to all connected clients
    const data = `data: ${JSON.stringify(log)}\n\n`;
    this.clients.forEach(client => {
      try {
        client.write(data);
      } catch (error) {
        // Client disconnected, remove it
        this.clients.delete(client);
      }
    });
  }

  // Get recent logs from file
  async getRecentLogs(count = 50) {
    const logFile = path.join(process.cwd(), 'combined.log');

    try {
      const data = await fs.promises.readFile(logFile, 'utf8');
      const lines = data.trim().split('\n').filter(line => line);
      const recentLines = lines.slice(-count);

      return recentLines.map(line => {
        try {
          return JSON.parse(line);
        } catch (error) {
          return { level: 'info', message: line, timestamp: new Date().toISOString() };
        }
      });
    } catch (error) {
      return [];
    }
  }

  // Get buffered logs
  getBufferedLogs() {
    return this.logBuffer;
  }
}

// Export singleton instance
const logManager = new LogManager();
export default logManager;
