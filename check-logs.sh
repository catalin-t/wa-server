#!/bin/bash

# Quick script to check logs on remote server
# Usage: ./check-logs.sh [lines]

LINES=${1:-50}

# Load deployment config
if [ -f ".env.deploy" ]; then
    export $(cat .env.deploy | grep -v '^#' | grep -v '^$' | xargs)
fi

DEPLOY_PORT=${DEPLOY_PORT:-22}
SERVER="$DEPLOY_USER@$DEPLOY_HOST"

echo "Fetching last $LINES log lines from $SERVER..."
echo "================================================"
echo ""

ssh -p $DEPLOY_PORT $SERVER << EOF
cd $REMOTE_PATH
docker compose logs --tail=$LINES
EOF
