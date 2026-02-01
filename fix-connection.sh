#!/bin/bash

# Fix WhatsApp connection issues
# This clears sessions and restarts the container

# Load deployment config
if [ -f ".env.deploy" ]; then
    export $(cat .env.deploy | grep -v '^#' | grep -v '^$' | xargs)
fi

DEPLOY_PORT=${DEPLOY_PORT:-22}
SSH_OPTS="-p $DEPLOY_PORT"
SERVER="$DEPLOY_USER@$DEPLOY_HOST"

echo "🔧 Fixing WhatsApp connection on $SERVER..."
echo ""

ssh $SSH_OPTS $SERVER bash << 'ENDSSH'
cd /home/cta/wa-server

echo "1. Stopping container..."
docker compose down

echo "2. Clearing ALL session data..."
sudo rm -rf sessions/*
sudo rm -rf sessions/.* 2>/dev/null || true
mkdir -p sessions

echo "3. Clearing old log files..."
sudo rm -f *.log 2>/dev/null || true

echo "4. Starting fresh container..."
docker compose up -d

echo "5. Waiting for container to start..."
sleep 5

echo "6. Showing recent logs..."
docker compose logs --tail=20

echo ""
echo "✅ Container restarted with clean sessions"
echo "⏳ Wait 10-15 seconds for WhatsApp connection to initialize"
echo "📱 Then check http://192.168.0.3:8910/api/qr for QR code"

ENDSSH

echo ""
echo "🔄 Now use the dashboard to:"
echo "   1. Click 'Connect' button"
echo "   2. Wait 10 seconds"
echo "   3. Click 'Show QR' button"
echo ""
