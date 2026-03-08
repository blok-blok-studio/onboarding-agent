# Onboarding Agent — Backbone
### by Blok Blok Studio

A white-label, reusable AI onboarding agent. Configure once per client. Never touch the engine.

---

## How It Works

```
config/client.js       <- THE ONLY FILE YOU EDIT PER CLIENT
src/agent/             <- Engine — never touch
src/crm/               <- CRM adapters — swap as needed
src/db/                <- Session storage (PostgreSQL)
src/api/               <- Express server (hardened)
src/security/          <- Security middleware, validation, HMAC signing
src/ui/                <- Chat widget (XSS-safe)
openclaw/              <- OpenClaw 24/7 config (SOUL, skills, heartbeat)
```

The entire agent — persona, qualification rules, intake fields, FAQ, and tone — is driven by `config/client.js`. The engine reads it at runtime.

---

## Quick Start

```bash
git clone <repo>
cd onboarding-agent
npm install
cp .env.example .env    # fill in your keys
npm run dev             # visit http://localhost:3000
```

---

## New Client Deployment Checklist

1. **Fill in `config/client.js`** — brand, agent persona, qualification, intake fields, FAQ
2. **Set `.env`** — API keys, CRM token, notification email, webhook secret
3. **Choose CRM adapter** in `src/crm/index.js`:
   - `hubspot` (default)
   - `webhook-only` (no CRM yet)
   - add your own in `src/crm/adapters/`
4. **Deploy** — see [DEPLOYMENT.md](DEPLOYMENT.md) for full instructions
5. **Share the URL** or embed via iframe

---

## Security

This agent is built with production security in mind:

- **Helmet** — HTTP security headers (CSP, HSTS, X-Content-Type-Options)
- **Rate limiting** — 30 req/min on chat, 100 req/min global
- **Input validation** — message length, format, control character stripping
- **SQL injection protection** — parameterized queries only
- **XSS prevention** — CSP headers + `textContent` rendering (never `innerHTML`)
- **HMAC webhook signing** — downstream payloads signed with SHA-256
- **Session security** — UUID validation, closed-session rejection, turn limits
- **Environment validation** — crashes on missing required vars at startup
- **CORS lockdown** — restricted to `ALLOWED_ORIGINS`

See [SECURITY.md](SECURITY.md) for the full security guide.

---

## 24/7 Operation with OpenClaw

Run the agent around the clock across **all messaging channels** using [OpenClaw](https://openclaw.ai):

```bash
./openclaw/setup.sh              # Configure workspace
openclaw onboard --install-daemon # Start 24/7 daemon
```

Supports WhatsApp, Telegram, Discord, Slack, Signal, iMessage, and the web widget simultaneously. See [OPENCLAW.md](OPENCLAW.md) for the full setup guide.

---

## Documentation

| Document | Description |
|----------|-------------|
| [CLAUDE.md](CLAUDE.md) | Project overview for AI assistants |
| [OPENCLAW.md](OPENCLAW.md) | OpenClaw 24/7 deployment + multi-channel setup |
| [SECURITY.md](SECURITY.md) | Security architecture and production checklist |
| [API.md](API.md) | API reference for all endpoints |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Railway, Docker, and VPS deployment guides |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design and request flow |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development guidelines and adapter patterns |

---

## Project Structure

```
onboarding-agent/
├── config/
│   └── client.js              <- Edit this per client
├── src/
│   ├── agent/
│   │   ├── index.js           <- Claude API loop + tool dispatch
│   │   ├── prompts.js         <- Builds system prompt from config
│   │   └── tools.js           <- Builds tool definitions from config
│   ├── api/
│   │   └── server.js          <- Express: /api/chat, /api/config, /api/health
│   ├── crm/
│   │   ├── index.js           <- Generic interface (submitLead, etc.)
│   │   └── adapters/
│   │       ├── hubspot.js     <- HubSpot implementation
│   │       └── webhook-only.js <- No CRM fallback
│   ├── db/
│   │   └── sessions.js        <- Postgres conversation storage
│   ├── security/
│   │   ├── middleware.js      <- Helmet, rate limiting, HPP
│   │   ├── validate.js        <- Input validation & sanitization
│   │   ├── env.js             <- Startup environment validation
│   │   └── webhook.js         <- HMAC-SHA256 signing & verification
│   └── ui/
│       └── index.html         <- Chat widget (pulls branding from /api/config)
├── openclaw/
│   ├── openclaw.json          <- OpenClaw daemon configuration
│   ├── setup.sh               <- One-command OpenClaw setup
│   ├── .env.example           <- Channel tokens and API keys
│   └── workspace/
│       ├── SOUL.md            <- Agent persona and onboarding flow
│       ├── IDENTITY.md        <- Display name and greeting
│       ├── HEARTBEAT.md       <- Proactive health checks (every 30 min)
│       ├── TOOLS.md           <- Capability declarations
│       ├── USER.md            <- Operator context
│       ├── MEMORY.md          <- Persistent memory index
│       └── skills/
│           └── onboarding/
│               └── SKILL.md   <- Core onboarding skill
├── .env.example
├── .gitignore
└── README.md
```

---

## Downstream Integration (Phase 2 Agent)

When a lead is submitted, the agent fires a signed `POST` to `DOWNSTREAM_WEBHOOK_URL`:

```json
{
  "lead": { "...all intake fields..." },
  "crmResult": { "contactId": "12345" }
}
```

The payload includes an `X-Signature-256` header (HMAC-SHA256) when `WEBHOOK_SECRET` is configured. See [API.md](API.md) for verification instructions.

---

## Embedding

```html
<iframe
  src="https://your-deployment.railway.app"
  width="100%"
  height="700"
  frameborder="0"
  style="border-radius:12px;"
></iframe>
```

Or share the URL directly in emails, LinkedIn, etc.

---

MIT License -- see [LICENSE](LICENSE) for details.

Built by [Blok Blok Studio](https://blokblokstudio.com) — chase@blokblokstudio.com
