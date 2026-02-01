#!/bin/bash

# WhatsApp Server Docker Deployment Script
# Usage: ./deploy.sh

set -e  # Exit on error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Load deployment configuration
if [ ! -f ".env.deploy" ]; then
    log_error ".env.deploy file not found!"
    echo ""
    echo "Please create .env.deploy with the following variables:"
    echo "  DEPLOY_USER=your-username"
    echo "  DEPLOY_HOST=your-server-ip"
    echo "  DEPLOY_PORT=22"
    echo "  REMOTE_PATH=/path/to/wa-server"
    echo "  CONTAINER_NAME=wa-server"
    echo ""
    exit 1
fi

log_info "Loading deployment configuration from .env.deploy..."
export $(cat .env.deploy | grep -v '^#' | grep -v '^$' | xargs)

# Validate required variables
if [ -z "$DEPLOY_USER" ] || [ -z "$DEPLOY_HOST" ] || [ -z "$REMOTE_PATH" ]; then
    log_error "Missing required configuration in .env.deploy"
    echo "Required: DEPLOY_USER, DEPLOY_HOST, REMOTE_PATH"
    exit 1
fi

# Build SSH connection string
DEPLOY_PORT=${DEPLOY_PORT:-22}
SSH_OPTS="-p $DEPLOY_PORT"
SCP_OPTS="-P $DEPLOY_PORT"  # scp uses uppercase -P for port
if [ -n "$SSH_KEY_PATH" ]; then
    SSH_OPTS="$SSH_OPTS -i $SSH_KEY_PATH"
    SCP_OPTS="$SCP_OPTS -i $SSH_KEY_PATH"
fi
SERVER="$DEPLOY_USER@$DEPLOY_HOST"

# Set defaults
CONTAINER_NAME=${CONTAINER_NAME:-wa-server}
IMAGE_NAME=${IMAGE_NAME:-wa-server}
BACKUP_BEFORE_DEPLOY=${BACKUP_BEFORE_DEPLOY:-no}

log_info "Starting deployment to $SERVER..."
echo ""
log_info "Configuration:"
echo "  User:      $DEPLOY_USER"
echo "  Host:      $DEPLOY_HOST"
echo "  Port:      $DEPLOY_PORT"
echo "  Path:      $REMOTE_PATH"
echo "  Container: $CONTAINER_NAME"
echo ""

# Check .env file exists
if [ ! -f ".env" ]; then
    log_error ".env file not found! Please create it before deploying."
    exit 1
fi

# Step 1: Create deployment package
log_step "1/5 Creating deployment package..."
tar -czf wa-server-deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='sessions/*' \
    --exclude='logs/*' \
    --exclude='*.log' \
    --exclude='.git' \
    --exclude='.env.deploy' \
    --exclude='wa-server-deploy.tar.gz' \
    .

log_info "Package created: wa-server-deploy.tar.gz ($(du -h wa-server-deploy.tar.gz | cut -f1))"

# Step 2: Copy to server
log_step "2/5 Copying files to server..."
scp $SCP_OPTS wa-server-deploy.tar.gz $SERVER:/tmp/
log_info "Files copied successfully"

# Step 3: Deploy on server
log_step "3/5 Deploying on server..."
ssh $SSH_OPTS $SERVER bash << ENDSSH
set -e

echo "[INFO] Creating directory structure..."
mkdir -p $REMOTE_PATH
cd $REMOTE_PATH

# Backup if requested
if [ "$BACKUP_BEFORE_DEPLOY" = "yes" ]; then
    echo "[INFO] Creating backup..."
    if [ -d "sessions" ]; then
        tar -czf sessions-backup-\$(date +%Y%m%d-%H%M%S).tar.gz sessions/ 2>/dev/null || true
        echo "[INFO] Backup created"
    fi
fi

echo "[INFO] Extracting files..."
tar -xzf /tmp/wa-server-deploy.tar.gz --no-same-owner --no-same-permissions 2>/dev/null || tar -xzf /tmp/wa-server-deploy.tar.gz
rm /tmp/wa-server-deploy.tar.gz

echo "[INFO] Creating necessary directories..."
mkdir -p sessions logs

echo "[INFO] Setting permissions..."
chmod +x deploy.sh 2>/dev/null || true

echo "[INFO] Deployment files extracted"
ENDSSH

log_info "Files deployed successfully"

# Step 4: Build and start container
log_step "4/5 Building and starting Docker container..."
ssh $SSH_OPTS $SERVER bash << ENDSSH
set -e
cd $REMOTE_PATH

# Detect docker-compose command (new vs old)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "[ERROR] Neither 'docker compose' nor 'docker-compose' found!"
    echo "[ERROR] Please install Docker Compose on the server"
    exit 1
fi

echo "[INFO] Using: \$DOCKER_COMPOSE"

echo "[INFO] Stopping existing container..."
\$DOCKER_COMPOSE down 2>/dev/null || echo "[INFO] No existing container to stop"

echo "[INFO] Removing old images and build cache..."
docker rmi wa-server-wa-server 2>/dev/null || true
docker builder prune -f

echo "[INFO] Building new image (forced clean build)..."
if ! \$DOCKER_COMPOSE build --no-cache --pull; then
    echo "[WARN] Build failed, this might be a temporary Docker Hub issue"
    echo "[INFO] Trying to use existing image if available..."
    if docker images | grep -q wa-server; then
        echo "[INFO] Using existing wa-server image"
    else
        echo "[ERROR] No cached image available. Docker Hub might be down."
        echo "[ERROR] Please retry in a few minutes or check https://status.docker.com/"
        exit 1
    fi
fi

echo "[INFO] Starting container..."
\$DOCKER_COMPOSE up -d

echo "[INFO] Waiting for container to start..."
sleep 5

ENDSSH

log_info "Container started successfully"

# Step 5: Verify deployment
log_step "5/5 Verifying deployment..."
ssh $SSH_OPTS $SERVER bash << ENDSSH
cd $REMOTE_PATH

# Detect docker-compose command (new vs old)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker compose"
fi

echo "[INFO] Container status:"
\$DOCKER_COMPOSE ps

echo ""
echo "[INFO] Recent logs:"
\$DOCKER_COMPOSE logs --tail=15

echo ""
echo "[INFO] Health check:"
sleep 2
docker inspect --format='{{.State.Health.Status}}' $CONTAINER_NAME 2>/dev/null || echo "No health status available yet"

ENDSSH

# Cleanup
log_info "Cleaning up local deployment package..."
rm wa-server-deploy.tar.gz

# Get API token from server's .env file
log_info "Retrieving API token from server..."
API_TOKEN=$(ssh $SSH_OPTS $SERVER "grep '^API_TOKEN=' $REMOTE_PATH/.env 2>/dev/null | cut -d'=' -f2" || echo "")

echo ""
echo "============================================"
log_info "🎉 Deployment completed successfully!"
echo "============================================"
echo ""
log_info "Access your services:"
echo "  📊 Dashboard:  http://$DEPLOY_HOST:8910/"
echo "  🔌 API:        http://$DEPLOY_HOST:8910/api"
echo "  📱 QR Code:    http://$DEPLOY_HOST:8910/api/qr"
echo ""

if [ -n "$API_TOKEN" ]; then
  log_info "🔑 API Token (for dashboard login):"
  echo "  $API_TOKEN"
  echo ""
else
  log_warn "Could not retrieve API token from server"
  echo "  Check: ssh $SSH_OPTS $SERVER 'cat $REMOTE_PATH/.env | grep API_TOKEN'"
  echo ""
fi

log_info "Useful commands:"
echo "  View logs:     ssh $SSH_OPTS $SERVER 'cd $REMOTE_PATH && docker compose logs -f'"
echo "  Stop server:   ssh $SSH_OPTS $SERVER 'cd $REMOTE_PATH && docker compose down'"
echo "  Restart:       ssh $SSH_OPTS $SERVER 'cd $REMOTE_PATH && docker compose restart'"
echo "  Status:        ssh $SSH_OPTS $SERVER 'cd $REMOTE_PATH && docker compose ps'"
echo ""
log_warn "Next steps:"
echo "  1. Ensure firewall allows port 8910"
echo "  2. Open dashboard and enter API token shown above"
echo "  3. Click 'Reset' then 'Connect' to get QR code"
echo ""
