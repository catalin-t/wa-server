#!/usr/bin/env node

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Generate new token
const newToken = uuidv4();

console.log('\n===================================');
console.log('WhatsApp Server - Token Generator');
console.log('===================================\n');

// Check if .env file exists
const envPath = path.join(dirname(__dirname), '.env');

if (fs.existsSync(envPath)) {
  // Read current .env content
  let envContent = fs.readFileSync(envPath, 'utf8');

  // Check if API_TOKEN already exists
  if (envContent.includes('API_TOKEN=')) {
    // Replace existing token
    envContent = envContent.replace(/API_TOKEN=.*/g, `API_TOKEN=${newToken}`);
    console.log('✓ Replaced existing API token in .env file');
  } else {
    // Add new token
    envContent += `\n# Generated API Token\nAPI_TOKEN=${newToken}\n`;
    console.log('✓ Added new API token to .env file');
  }

  // Write updated content
  fs.writeFileSync(envPath, envContent);
} else {
  // Create new .env file
  const defaultEnv = `# Server Configuration
PORT=3000
NODE_ENV=production

# API Authentication (Auto-generated - keep this secret!)
API_TOKEN=${newToken}

# WhatsApp Configuration
SESSION_FOLDER=./sessions

# Rate Limiting
RATE_LIMIT_WINDOW_MS=1000
RATE_LIMIT_MAX_REQUESTS=1

# Logging
LOG_LEVEL=info
`;
  fs.writeFileSync(envPath, defaultEnv);
  console.log('✓ Created new .env file with API token');
}

console.log('\nYour new API token is:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  ${newToken}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('⚠️  IMPORTANT: Keep this token secret!');
console.log('⚠️  This token has been saved to your .env file\n');
console.log('Use this token in your API requests:');
console.log(`  Authorization: Bearer ${newToken}`);
console.log('\n===================================\n');