# WhatsApp Notification Server

A Node.js backend server that connects to WhatsApp as a linked device and sends notifications via webhook endpoints. Built with Express and Baileys library.

## Features

- WhatsApp Web connection using QR code authentication
- Persistent sessions (survives server restarts)
- RESTful API for sending messages
- Rate limiting (1 message per second)
- API token authentication
- Docker support
- Comprehensive logging
- Automatic reconnection on disconnection
- Health check endpoint

## Prerequisites

- Node.js 18+ (for local development)
- Docker (optional, for containerized deployment)
- WhatsApp account

## Installation

### Local Development

1. Clone the repository:
```bash
cd wa-server
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env` or let the server create it automatically
   - The API token will be auto-generated on first run if not set
   - To generate a new token manually: `npm run generate-token`

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

### Docker Deployment

1. Build the Docker image:
```bash
docker build -t wa-server .
```

2. Run with Docker:
```bash
docker run -d \
  --name wa-server \
  -p 3000:3000 \
  -v $(pwd)/sessions:/app/sessions \
  -e API_TOKEN=your-secure-api-token-here \
  wa-server
```

Or use Docker Compose:
```bash
docker-compose up -d
```

## Initial Setup - API Token

When you first start the server:
1. If no API token is set in `.env`, one will be auto-generated
2. The generated token will be displayed in the console and saved to `.env`
3. Use `npm run generate-token` to create a new token at any time

**Keep your API token secure!** It provides full access to send messages through your WhatsApp account.

## Initial Setup - Connecting WhatsApp

1. Start the server
2. Open your browser and navigate to: `http://localhost:3000/api/qr`
3. Scan the QR code with WhatsApp on your phone:
   - Open WhatsApp
   - Go to Settings → Linked Devices
   - Click "Link a Device"
   - Scan the QR code

4. Once connected, the session will be saved and persist across restarts

## API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication

All protected endpoints require an API token. Include it in your requests using one of these methods:

1. **Authorization Header** (Recommended):
```
Authorization: Bearer YOUR_API_TOKEN
```

2. **X-API-Token Header**:
```
X-API-Token: YOUR_API_TOKEN
```

3. **Query Parameter**:
```
?token=YOUR_API_TOKEN
```

### Endpoints

#### 1. Send Message
**POST** `/api/message`

Send a WhatsApp notification message.

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_API_TOKEN
```

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "message": "Your notification message here"
}
```

**Response (201 - Success):**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "success": true,
    "messageId": "3EB0C767D097251006A4",
    "to": "1234567890@s.whatsapp.net"
  }
}
```

**Rate Limit:** 1 message per second

#### 2. Get QR Code
**GET** `/api/qr`

Display QR code for WhatsApp connection (no authentication required).

**Response:** HTML page with QR code

#### 3. Connection Status
**GET** `/api/status`

Check WhatsApp connection status.

**Headers:**
```
Authorization: Bearer YOUR_API_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isConnected": true,
    "hasQR": false,
    "connectionAttempts": 0
  }
}
```

#### 4. Health Check
**GET** `/api/health`

Server health check (no authentication required).

**Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2024-01-10T12:00:00.000Z"
}
```

## Usage Examples

### cURL
```bash
# Send a message
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "phoneNumber": "+1234567890",
    "message": "Hello from WhatsApp API!"
  }'

# Check status
curl http://localhost:3000/api/status \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

### JavaScript (Fetch API)
```javascript
// Send a message
const sendMessage = async () => {
  const response = await fetch('http://localhost:3000/api/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_API_TOKEN'
    },
    body: JSON.stringify({
      phoneNumber: '+1234567890',
      message: 'Hello from WhatsApp API!'
    })
  });

  const data = await response.json();
  console.log(data);
};
```

### Python
```python
import requests

# Send a message
url = 'http://localhost:3000/api/message'
headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_TOKEN'
}
data = {
    'phoneNumber': '+1234567890',
    'message': 'Hello from WhatsApp API!'
}

response = requests.post(url, json=data, headers=headers)
print(response.json())
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `API_TOKEN` | Auto-generated | API authentication token (generated on first run if not set) |
| `SESSION_FOLDER` | ./sessions | WhatsApp session storage path |
| `RATE_LIMIT_WINDOW_MS` | 1000 | Rate limit window in milliseconds |
| `RATE_LIMIT_MAX_REQUESTS` | 1 | Maximum requests per window |
| `LOG_LEVEL` | info | Logging level (error, warn, info, debug) |
| `NODE_ENV` | production | Environment (development/production) |

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 201 | Message sent successfully |
| 400 | Bad request (missing/invalid parameters) |
| 401 | Unauthorized (invalid/missing API token) |
| 404 | Endpoint not found |
| 429 | Too many requests (rate limit exceeded) |
| 500 | Internal server error |
| 503 | Service unavailable (WhatsApp not connected) |

## Logs

The server generates three log files:
- `combined.log` - All logs
- `error.log` - Error logs only
- Console output - Formatted logs for development

## Phone Number Format

Phone numbers should be in international format without special characters:
- ✅ Correct: `+1234567890` or `1234567890`
- ❌ Incorrect: `(123) 456-7890` or `123-456-7890`

The server will automatically clean and format the number.

## Troubleshooting

### QR Code Not Appearing
- Check server logs for errors
- Ensure port 3000 is not blocked
- Try restarting the server

### Message Not Sending
- Verify WhatsApp is connected (check `/api/status`)
- Ensure phone number is in correct format
- Check rate limiting (1 msg/second)
- Verify the recipient has WhatsApp

### Session Lost After Restart
- Check the `sessions` folder has write permissions
- Ensure volume is properly mounted in Docker
- Verify session files are being created

### Connection Keeps Dropping
- Check internet connectivity
- Ensure the phone with WhatsApp stays online
- Review logs for specific error messages

## Security Considerations

1. **API Token**: Keep your API token secret and rotate it regularly
2. **HTTPS**: Use HTTPS in production (put behind a reverse proxy like Nginx)
3. **Firewall**: Restrict access to the API endpoints
4. **Rate Limiting**: Adjust rate limits based on your needs
5. **Logging**: Monitor logs for suspicious activity

## Project Structure

```
wa-server/
├── src/
│   ├── config/
│   │   └── config.js         # Configuration management
│   ├── middleware/
│   │   ├── auth.js          # API authentication
│   │   └── rateLimiter.js   # Rate limiting
│   ├── routes/
│   │   └── messageRoutes.js # API endpoints
│   ├── services/
│   │   └── whatsappService.js # WhatsApp/Baileys integration
│   ├── utils/
│   │   └── logger.js        # Winston logger setup
│   └── index.js             # Main application entry
├── scripts/
│   └── generate-token.js   # Token generation utility
├── sessions/                # WhatsApp session storage
├── .env                     # Environment variables (auto-created)
├── .env.example            # Environment template
├── .dockerignore           # Docker ignore file
├── .gitignore              # Git ignore file
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose configuration
├── package.json            # Node.js dependencies
└── README.md               # Documentation

```

## License

MIT

## Author

ctamas@zerobias.com

## Support

For issues or questions, please create an issue in the repository.