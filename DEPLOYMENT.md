# Docker Deployment Guide

## Quick Start (Automated - Recommended)

### First Time Setup

1. **Create deployment configuration file**:
```bash
cp .env.deploy .env.deploy
nano .env.deploy
```

Update these values:
```bash
DEPLOY_USER=your-username          # SSH user (e.g., cta, root)
DEPLOY_HOST=your-server-ip         # Server IP or hostname
DEPLOY_PORT=22                     # SSH port (default: 22)
REMOTE_PATH=/home/cta/wa-server    # Path on server
CONTAINER_NAME=wa-server           # Docker container name
BACKUP_BEFORE_DEPLOY=yes           # Backup sessions before deploy
```

2. **Ensure .env file exists** with your application settings:
```bash
# .env should already exist with your API_TOKEN and other settings
cat .env
```

### Deploy

Just run:
```bash
./deploy.sh
```

That's it! The script will automatically:
- ✅ Load configuration from `.env.deploy`
- ✅ Validate settings
- ✅ Package your code
- ✅ Copy to server
- ✅ Backup sessions (optional)
- ✅ Stop old container
- ✅ Build new image
- ✅ Start new container
- ✅ Verify deployment
- ✅ Show you access URLs

---

## Manual Deployment (Step by Step)

### Step 1: Create Deployment Package

```bash
# On your local machine
tar -czf wa-server-deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='sessions/*' \
    --exclude='*.log' \
    --exclude='.git' \
    .
```

### Step 2: Copy to Server

```bash
scp wa-server-deploy.tar.gz user@your-server-ip:/tmp/
```

### Step 3: SSH into Server and Deploy

```bash
# SSH to server
ssh user@your-server-ip

# Extract files
cd /path/to/wa-server
tar -xzf /tmp/wa-server-deploy.tar.gz
rm /tmp/wa-server-deploy.tar.gz

# Stop existing container
docker-compose down

# Build new image
docker-compose build --no-cache

# Start container
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs --tail=20
```

---

## Docker Commands Reference

### Container Management
```bash
# Start container
docker-compose up -d

# Stop container
docker-compose down

# Restart container
docker-compose restart

# View logs
docker-compose logs -f

# View last 50 logs
docker-compose logs --tail=50

# Check status
docker-compose ps

# Execute command in container
docker-compose exec wa-server sh
```

### Rebuild After Changes
```bash
# Stop, rebuild, and start
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Cleanup
```bash
# Remove all stopped containers, networks, images
docker system prune -a

# Remove specific image
docker rmi wa-server

# Remove volumes (WARNING: deletes sessions!)
docker-compose down -v
```

---

## Configuration

### Environment Variables

The `.env` file on your server should contain:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# API Authentication
API_TOKEN=your-token-here

# WhatsApp Configuration
SESSION_FOLDER=./sessions

# Rate Limiting
RATE_LIMIT_WINDOW_MS=1000
RATE_LIMIT_MAX_REQUESTS=1

# Connection Retry Settings
MAX_RECONNECT_ATTEMPTS=2
BASE_RETRY_DELAY_MS=60000
COOLDOWN_PERIOD_MS=300000
```

### Port Configuration

The docker-compose.yml maps:
- **External Port**: 8910 (accessible from outside)
- **Internal Port**: 3000 (inside container)

To change the external port, edit `docker-compose.yml`:
```yaml
ports:
  - "YOUR_PORT:3000"  # Change YOUR_PORT
```

---

## Accessing the Dashboard

Once deployed, access your dashboard at:
```
http://your-server-ip:8910/
```

You'll be prompted for your API token (from `.env` file).

---

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs

# Check container status
docker ps -a

# Rebuild from scratch
docker-compose down
docker system prune -a
docker-compose build --no-cache
docker-compose up -d
```

### Can't access dashboard
```bash
# Check if container is running
docker-compose ps

# Check port is listening
ss -tlnp | grep 8910

# Check firewall (if applicable)
sudo ufw status
sudo ufw allow 8910
```

### Logs not showing
```bash
# Ensure log directory exists
mkdir -p logs

# Check permissions
ls -la logs/

# View container logs
docker-compose logs -f
```

### Connection keeps failing
```bash
# Check WhatsApp connection status
curl http://localhost:8910/api/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Reset connection via API
curl -X POST http://localhost:8910/api/reset \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Health Checks

The container includes automatic health checks:
```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' wa-server

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' wa-server
```

---

## Backup & Restore

### Backup Sessions
```bash
# On server
cd /path/to/wa-server
tar -czf sessions-backup-$(date +%Y%m%d).tar.gz sessions/
```

### Restore Sessions
```bash
# Stop container
docker-compose down

# Restore
tar -xzf sessions-backup-YYYYMMDD.tar.gz

# Start container
docker-compose up -d
```

---

## Updates

To deploy new changes:

1. **Using deployment script**:
```bash
./deploy.sh user@your-server-ip
```

2. **Manual**:
```bash
# Package and copy
tar -czf wa-server-deploy.tar.gz --exclude='node_modules' --exclude='sessions/*' .
scp wa-server-deploy.tar.gz user@server:/tmp/

# On server
ssh user@server
cd /path/to/wa-server
tar -xzf /tmp/wa-server-deploy.tar.gz
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## Monitoring

### Real-time Logs
```bash
docker-compose logs -f
```

### Resource Usage
```bash
docker stats wa-server
```

### Container Info
```bash
docker-compose ps
docker inspect wa-server
```

---

## Security Notes

1. **Always use HTTPS** in production (consider nginx reverse proxy)
2. **Keep API_TOKEN secure** - never commit to git
3. **Firewall rules** - only expose necessary ports
4. **Regular updates** - keep dependencies up to date
5. **Backup sessions** - regularly backup the sessions/ directory
