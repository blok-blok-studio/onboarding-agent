#!/usr/bin/env bash
# scripts/setup.sh — New client setup script
# Usage: ./scripts/setup.sh

set -euo pipefail

echo "=== Onboarding Agent — Client Setup ==="
echo ""

# 1. Install dependencies
if [ ! -d "node_modules" ]; then
  echo "[1/4] Installing dependencies..."
  npm install
else
  echo "[1/4] Dependencies already installed."
fi

# 2. Create .env from template
if [ ! -f ".env" ]; then
  echo "[2/4] Creating .env from .env.example..."
  cp .env.example .env
  echo "      >> Edit .env and fill in your API keys."
else
  echo "[2/4] .env already exists — skipping."
fi

# 3. Validate config
echo "[3/4] Validating config..."
node -e "
  require('dotenv').config();
  try {
    const config = require('./config/client');
    const checks = [
      ['brand.name', config.brand?.name],
      ['agent.name', config.agent?.name],
      ['agent.greeting', config.agent?.greeting],
    ];
    let ok = true;
    for (const [key, val] of checks) {
      if (!val) { console.error('  MISSING: ' + key); ok = false; }
      else { console.log('  OK: ' + key + ' = \"' + val + '\"'); }
    }
    if (!ok) { console.error('\n  >> Edit config/client.js before running.'); process.exit(1); }
    console.log('  Config looks good.');
  } catch (err) {
    console.error('  Config error: ' + err.message);
    process.exit(1);
  }
"

# 4. Verify env
echo "[4/4] Checking environment..."
node -e "
  require('dotenv').config();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.error('  MISSING: ANTHROPIC_API_KEY — edit .env'); process.exit(1); }
  console.log('  ANTHROPIC_API_KEY: set');
  console.log('  DATABASE_URL: ' + (process.env.DATABASE_URL ? 'set' : 'not set (using in-memory store)'));
  console.log('  CRM_ADAPTER: ' + (process.env.CRM_ADAPTER || 'webhook-only (default)'));
  console.log('  EMAIL_ADAPTER: ' + (process.env.EMAIL_ADAPTER || 'resend (default)'));
"

echo ""
echo "=== Setup complete! ==="
echo "Run 'npm run dev' to start the dev server."
