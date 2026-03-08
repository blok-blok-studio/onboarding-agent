#!/bin/bash
# ─────────────────────────────────────────────────────────────
# OpenClaw Setup Script — Onboarding Agent
# by Blok Blok Studio
#
# This script sets up the onboarding agent to run 24/7 on
# OpenClaw with full OS access and multi-channel support.
# ─────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"

echo "╔══════════════════════════════════════════════════════╗"
echo "║  Onboarding Agent — OpenClaw Setup                   ║"
echo "║  by Blok Blok Studio                                 ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Check prerequisites ────────────────────────────────────
check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo "ERROR: $1 is not installed."
    echo "  $2"
    exit 1
  fi
}

check_command "node" "Install Node.js 22+: https://nodejs.org"
check_command "npm" "Install npm (comes with Node.js)"

# Check Node version
NODE_VERSION=$(node -v | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
  echo "WARNING: Node.js v22+ is recommended for OpenClaw. You have v$(node -v)"
fi

# Check for OpenClaw
if ! command -v openclaw &> /dev/null; then
  echo "OpenClaw is not installed. Installing..."
  npm install -g openclaw
  echo "OpenClaw installed."
fi

echo "✓ Prerequisites OK"
echo ""

# ── Install project dependencies ───────────────────────────
echo "Installing project dependencies..."
cd "$PROJECT_DIR"
npm install
echo "✓ Dependencies installed"
echo ""

# ── Set up OpenClaw workspace ──────────────────────────────
echo "Setting up OpenClaw workspace..."

# Create OpenClaw home if it doesn't exist
mkdir -p "$OPENCLAW_HOME"

# Copy config
if [ ! -f "$OPENCLAW_HOME/openclaw.json" ]; then
  cp "$SCRIPT_DIR/openclaw.json" "$OPENCLAW_HOME/openclaw.json"
  echo "  Copied openclaw.json → $OPENCLAW_HOME/"
else
  echo "  openclaw.json already exists — skipping (check for updates manually)"
fi

# Copy workspace files
mkdir -p "$OPENCLAW_HOME/workspace/skills/onboarding"
mkdir -p "$OPENCLAW_HOME/workspace/memory"

for file in SOUL.md IDENTITY.md HEARTBEAT.md TOOLS.md USER.md MEMORY.md; do
  if [ -f "$SCRIPT_DIR/workspace/$file" ]; then
    cp "$SCRIPT_DIR/workspace/$file" "$OPENCLAW_HOME/workspace/$file"
    echo "  Copied $file → workspace/"
  fi
done

# Copy skill
cp "$SCRIPT_DIR/workspace/skills/onboarding/SKILL.md" \
   "$OPENCLAW_HOME/workspace/skills/onboarding/SKILL.md"
echo "  Copied onboarding skill → workspace/skills/"

# Copy memory template
cp "$SCRIPT_DIR/workspace/memory/daily-stats.md" \
   "$OPENCLAW_HOME/workspace/memory/daily-stats.md" 2>/dev/null || true

echo "✓ Workspace configured"
echo ""

# ── Environment variables ──────────────────────────────────
if [ ! -f "$OPENCLAW_HOME/.env" ]; then
  cp "$SCRIPT_DIR/.env.example" "$OPENCLAW_HOME/.env"
  echo "Created $OPENCLAW_HOME/.env — EDIT THIS FILE with your API keys!"
else
  echo ".env already exists at $OPENCLAW_HOME/.env"
fi

if [ ! -f "$PROJECT_DIR/.env" ]; then
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  echo "Created $PROJECT_DIR/.env — EDIT THIS FILE with your API keys!"
else
  echo ".env already exists at $PROJECT_DIR/.env"
fi
echo ""

# ── Update workspace path in config ────────────────────────
# Point the workspace to the OpenClaw home directory
echo "Updating workspace path in openclaw.json..."
if command -v python3 &> /dev/null; then
  python3 -c "
import json, os
config_path = os.path.join('$OPENCLAW_HOME', 'openclaw.json')
with open(config_path) as f:
    # Strip comments for JSON parsing
    lines = f.readlines()
    clean = ''.join(l for l in lines if not l.strip().startswith('//'))
    config = json.loads(clean)
config['agent']['workspace'] = '$OPENCLAW_HOME/workspace'
with open(config_path, 'w') as f:
    json.dump(config, f, indent=2)
print('  Updated workspace path to $OPENCLAW_HOME/workspace')
" 2>/dev/null || echo "  Could not auto-update workspace path — edit openclaw.json manually"
else
  echo "  Python3 not found — edit workspace path in openclaw.json manually"
fi
echo ""

# ── Summary ────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Setup Complete!                                     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "  1. Edit your API keys:"
echo "     nano $OPENCLAW_HOME/.env"
echo "     nano $PROJECT_DIR/.env"
echo ""
echo "  2. Configure your client:"
echo "     nano $PROJECT_DIR/config/client.js"
echo ""
echo "  3. Start the Express web server:"
echo "     cd $PROJECT_DIR && npm start"
echo ""
echo "  4. Start OpenClaw (24/7 daemon):"
echo "     openclaw onboard --install-daemon"
echo ""
echo "  5. Or run OpenClaw interactively:"
echo "     openclaw gateway"
echo ""
echo "  6. Connect channels (WhatsApp, Telegram, etc.):"
echo "     Edit $OPENCLAW_HOME/openclaw.json"
echo "     Uncomment and configure channel sections"
echo ""
echo "  7. Verify setup:"
echo "     openclaw doctor"
echo ""
echo "Documentation: $PROJECT_DIR/README.md"
echo "Security guide: $PROJECT_DIR/SECURITY.md"
echo ""
