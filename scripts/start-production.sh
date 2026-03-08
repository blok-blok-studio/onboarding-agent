#!/usr/bin/env bash
# scripts/start-production.sh — Production start with PM2
# Usage: ./scripts/start-production.sh

set -euo pipefail

echo "=== Onboarding Agent — Production Start ==="

# Ensure PM2 is installed
if ! command -v pm2 &> /dev/null; then
  echo "PM2 not found. Installing globally..."
  npm install -g pm2
fi

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "Installing production dependencies..."
  npm ci --omit=dev
fi

# Ensure logs directory exists
mkdir -p logs

# Set production environment
export NODE_ENV=production

# Start or restart with PM2
if pm2 describe onboarding-agent > /dev/null 2>&1; then
  echo "Restarting existing PM2 process..."
  pm2 restart ecosystem.config.cjs
else
  echo "Starting new PM2 process..."
  pm2 start ecosystem.config.cjs
fi

# Save PM2 process list and setup startup hook
pm2 save
echo ""
echo "=== Running! ==="
echo "View logs: pm2 logs onboarding-agent"
echo "Status:    pm2 status"
echo "Stop:      pm2 stop onboarding-agent"
