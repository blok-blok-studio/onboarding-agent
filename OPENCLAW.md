# OpenClaw Deployment Guide

Run the onboarding agent 24/7 with full OS access via [OpenClaw](https://openclaw.ai).

---

## What OpenClaw Gives You

| Feature | Description |
|---------|-------------|
| **24/7 Operation** | Daemon mode keeps the agent running continuously |
| **Multi-Channel** | WhatsApp, Telegram, Discord, Slack, Signal, iMessage |
| **Full OS Access** | File system, shell commands, background processes |
| **Persistent Memory** | Agent remembers context across conversations |
| **Heartbeat Tasks** | Proactive health checks and reporting every 30 min |
| **Session Isolation** | Each user/channel gets a separate conversation |

---

## Quick Start

### 1. Install OpenClaw

```bash
npm install -g openclaw
```

Requires Node.js 22+.

### 2. Run Setup

```bash
cd onboarding-agent
chmod +x openclaw/setup.sh
./openclaw/setup.sh
```

This copies all workspace files (SOUL.md, HEARTBEAT.md, skills, etc.) to `~/.openclaw/`.

### 3. Configure API Keys

```bash
nano ~/.openclaw/.env     # OpenClaw env (channel tokens)
nano .env                  # Express server env (Anthropic, DB, CRM)
```

### 4. Configure Client

Edit `config/client.js` with your client's brand, persona, qualification rules, intake fields, and FAQ.

### 5. Start the Express Server

```bash
npm start &
```

This runs the web-based onboarding widget on port 3000.

### 6. Start OpenClaw (24/7)

```bash
openclaw onboard --install-daemon
```

This installs OpenClaw as a system daemon (launchd on macOS, systemd on Linux) that starts on boot and runs continuously.

### 7. Verify

```bash
openclaw doctor           # Check for config issues
openclaw gateway status   # Confirm daemon is running
curl localhost:3000/api/health  # Check Express server
```

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    OpenClaw (24/7)                     │
│                                                       │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌────────┐ │
│  │WhatsApp │  │Telegram  │  │Discord  │  │ Slack  │ │
│  └────┬────┘  └────┬─────┘  └────┬────┘  └───┬────┘ │
│       │             │             │            │      │
│       └─────────────┴──────┬──────┴────────────┘      │
│                            │                          │
│                    ┌───────▼────────┐                  │
│                    │  SOUL.md       │                  │
│                    │  Onboarding    │                  │
│                    │  Skill         │                  │
│                    └───────┬────────┘                  │
│                            │                          │
│                    ┌───────▼────────┐                  │
│                    │  Express API   │──── Web Widget   │
│                    │  (port 3000)   │                  │
│                    └───────┬────────┘                  │
│                            │                          │
│              ┌─────────────┼─────────────┐            │
│              ▼             ▼             ▼            │
│         ┌────────┐   ┌─────────┐   ┌─────────┐      │
│         │Claude  │   │HubSpot  │   │Webhook  │      │
│         │  API   │   │  CRM    │   │(HMAC)   │      │
│         └────────┘   └─────────┘   └─────────┘      │
└──────────────────────────────────────────────────────┘
```

---

## Connecting Channels

Edit `~/.openclaw/openclaw.json` and uncomment the channels you want.

### WhatsApp

```json5
"whatsapp": {
  "dmPolicy": "open",
  "allowFrom": ["*"],
  "groupPolicy": "mention",
  "textChunkLimit": 4000
}
```

Then run `openclaw onboard` and follow the WhatsApp QR pairing flow.

### Telegram

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Add the token to `~/.openclaw/.env`:
   ```
   TELEGRAM_BOT_TOKEN=your-token
   ```
3. Configure in `openclaw.json`:
   ```json5
   "telegram": {
     "botToken": "${TELEGRAM_BOT_TOKEN}",
     "dmPolicy": "open",
     "groupPolicy": "mention"
   }
   ```

### Discord

1. Create a bot at [Discord Developer Portal](https://discord.com/developers)
2. Add tokens to `~/.openclaw/.env`
3. Configure in `openclaw.json`:
   ```json5
   "discord": {
     "botToken": "${DISCORD_BOT_TOKEN}",
     "applicationId": "${DISCORD_APP_ID}"
   }
   ```

### Slack

1. Create a Slack app at [api.slack.com](https://api.slack.com/apps)
2. Enable Socket Mode and Events
3. Add tokens to `~/.openclaw/.env`
4. Configure in `openclaw.json`:
   ```json5
   "slack": {
     "botToken": "${SLACK_BOT_TOKEN}",
     "appToken": "${SLACK_APP_TOKEN}",
     "signingSecret": "${SLACK_SIGNING_SECRET}"
   }
   ```

---

## Workspace Files

| File | Purpose |
|------|---------|
| `SOUL.md` | Agent personality, onboarding flow, rules |
| `IDENTITY.md` | Display name, greeting style |
| `TOOLS.md` | Available capabilities |
| `HEARTBEAT.md` | Proactive tasks (health checks, reporting) |
| `USER.md` | Operator context and preferences |
| `MEMORY.md` | Persistent memory index |
| `skills/onboarding/SKILL.md` | Core onboarding skill with CRM integration |

---

## Heartbeat Tasks

Every 30 minutes, the agent automatically:

1. Checks if the Express server is healthy
2. Reviews abandoned sessions (24h+ inactive)
3. Verifies CRM connectivity
4. Updates lead submission counts

Daily at 6 AM, it generates a summary of onboarding activity.

---

## Session Management

| Setting | Value | Purpose |
|---------|-------|---------|
| `scope` | `per-sender` | Each user gets their own session |
| `dmScope` | `per-channel-peer` | WhatsApp user != Telegram user |
| `reset` | `idle` | Sessions reset after 120 min idle |

This prevents information leakage between users and channels.

---

## Troubleshooting

```bash
# Check OpenClaw status
openclaw gateway status

# View logs
openclaw gateway --verbose

# Check Express server
curl -s http://localhost:3000/api/health | jq

# Validate config
openclaw doctor

# Reset a channel session
# Send /reset in the chat

# View injected context
# Send /context list in the chat
```
