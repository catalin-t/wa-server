# Quick Deployment Guide

## 🚀 One-Command Deployment

Deploy your WhatsApp server to production in seconds!

## Setup (First Time Only)

### 1. Configure Deployment Settings

Edit `.env.deploy` with your server details:

```bash
nano .env.deploy
```

Required settings:
```bash
# SSH Configuration
DEPLOY_USER=cta                    # Your SSH username
DEPLOY_HOST=192.168.1.100         # Your server IP or hostname
DEPLOY_PORT=22                     # SSH port (usually 22)

# Remote Paths
REMOTE_PATH=/home/cta/wa-server   # Where to deploy on server

# Docker Configuration
CONTAINER_NAME=wa-server          # Docker container name
IMAGE_NAME=wa-server              # Docker image name

# Optional: SSH Key Path (leave empty to use default)
SSH_KEY_PATH=

# Optional: Backup before deploy
BACKUP_BEFORE_DEPLOY=yes
```

### 2. Verify Application Configuration

Make sure `.env` exists with your application settings:

```bash
cat .env
```

Should contain:
```env
PORT=3000
NODE_ENV=production
API_TOKEN=your-api-token-here
SESSION_FOLDER=./sessions
LOG_LEVEL=info
MAX_RECONNECT_ATTEMPTS=2
BASE_RETRY_DELAY_MS=60000
COOLDOWN_PERIOD_MS=300000
```

## Deploy

### Simple Command

```bash
./deploy.sh
```

### What Happens

The script will:

1. **Load Configuration** - Reads `.env.deploy` settings
2. **Validate** - Checks all required files exist
3. **Package** - Creates deployment archive (excluding node_modules, sessions, logs)
4. **Upload** - Copies files to server via SSH
5. **Backup** - Optionally backs up sessions folder
6. **Deploy** - Extracts files on server
7. **Build** - Builds fresh Docker image
8. **Start** - Launches container with docker-compose
9. **Verify** - Checks health and shows logs
10. **Report** - Shows dashboard URL and useful commands

### Output Example

```
[INFO] Loading deployment configuration from .env.deploy...
[INFO] Starting deployment to cta@192.168.1.100...

[INFO] Configuration:
  User:      cta
  Host:      192.168.1.100
  Port:      22
  Path:      /home/cta/wa-server
  Container: wa-server

[STEP] 1/5 Creating deployment package...
[INFO] Package created: wa-server-deploy.tar.gz (2.3M)

[STEP] 2/5 Copying files to server...
[INFO] Files copied successfully

[STEP] 3/5 Deploying on server...
[INFO] Files deployed successfully

[STEP] 4/5 Building and starting Docker container...
[INFO] Container started successfully

[STEP] 5/5 Verifying deployment...

============================================
[INFO] 🎉 Deployment completed successfully!
============================================

[INFO] Access your services:
  📊 Dashboard:  http://192.168.1.100:8910/
  🔌 API:        http://192.168.1.100:8910/api
  📱 QR Code:    http://192.168.1.100:8910/api/qr
```

## Post-Deployment

### Access Dashboard

Open in browser:
```
http://YOUR_SERVER_IP:8910/
```

Enter your API token from `.env` file.

### Monitor Logs

```bash
ssh cta@192.168.1.100 'cd /home/cta/wa-server && docker-compose logs -f'
```

### Check Status

```bash
ssh cta@192.168.1.100 'cd /home/cta/wa-server && docker-compose ps'
```

### Restart Container

```bash
ssh cta@192.168.1.100 'cd /home/cta/wa-server && docker-compose restart'
```

### Stop Container

```bash
ssh cta@192.168.1.100 'cd /home/cta/wa-server && docker-compose down'
```

## Troubleshooting

### Can't Connect to Server

Check SSH access:
```bash
ssh cta@192.168.1.100
```

If using custom key:
```bash
ssh -i /path/to/key cta@192.168.1.100
```

### Deployment Fails

Check script output for specific error. Common issues:

- **SSH connection failed**: Verify `DEPLOY_HOST` and `DEPLOY_USER`
- **Permission denied**: Check SSH key or password
- **Docker not found**: Install Docker on server
- **Port already in use**: Stop existing container

### Container Won't Start

SSH to server and check logs:
```bash
ssh cta@192.168.1.100
cd /home/cta/wa-server
docker-compose logs
```

Rebuild container:
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Dashboard Not Accessible

Check firewall:
```bash
sudo ufw status
sudo ufw allow 8910
```

Check container is running:
```bash
docker-compose ps
```

## Files Reference

- `.env.deploy` - Deployment configuration (server, paths, SSH)
- `.env` - Application configuration (API token, settings)
- `deploy.sh` - Automated deployment script
- `docker-compose.yml` - Docker container configuration
- `Dockerfile` - Docker image build instructions

## Security Notes

⚠️ **Important**:
- `.env.deploy` contains server credentials - **NEVER commit to git**
- `.env` contains API tokens - **NEVER commit to git**
- Both files are in `.gitignore` automatically
- Always use SSH keys instead of passwords for deployment
- Consider using a reverse proxy (nginx) with HTTPS in production

## Advanced Usage

### Custom SSH Port

```bash
# In .env.deploy
DEPLOY_PORT=2222
```

### Custom SSH Key

```bash
# In .env.deploy
SSH_KEY_PATH=/home/user/.ssh/deploy_key
```

### Disable Session Backup

```bash
# In .env.deploy
BACKUP_BEFORE_DEPLOY=no
```

### View Deployment Without Running

```bash
cat deploy.sh
```

## Need Help?

- Check `DEPLOYMENT.md` for detailed documentation
- Review Docker logs: `docker-compose logs`
- Check container health: `docker inspect wa-server`
- Test API: `curl http://localhost:8910/api/health`
