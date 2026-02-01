import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Generate or retrieve API token
let apiToken = process.env.API_TOKEN;

if (!apiToken) {
  // Generate new token
  apiToken = uuidv4();

  // Save to .env file if not exists
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    if (!envContent.includes('API_TOKEN=')) {
      fs.appendFileSync(envPath, `\n# Generated API Token\nAPI_TOKEN=${apiToken}\n`);
      console.log('Generated new API token and saved to .env file');
    }
  } else {
    // Create .env file with token
    const defaultEnv = `# Server Configuration
PORT=3000
NODE_ENV=production

# API Authentication (Auto-generated - keep this secret!)
API_TOKEN=${apiToken}

# WhatsApp Configuration
SESSION_FOLDER=./sessions

# Rate Limiting
RATE_LIMIT_WINDOW_MS=1000
RATE_LIMIT_MAX_REQUESTS=1

# Logging
LOG_LEVEL=info
`;
    fs.writeFileSync(envPath, defaultEnv);
    console.log('Created .env file with generated API token');
  }
}

export const config = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },
  auth: {
    apiToken: apiToken,
  },
  whatsapp: {
    sessionFolder: process.env.SESSION_FOLDER || './sessions',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '1000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1'),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;