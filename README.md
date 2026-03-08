# Onboarding Agent — Backbone
### by Blok Blok Studio

A white-label, reusable AI onboarding agent. Configure once per client. Never touch the engine.

---

## How It Works

```
config/client.js               <- THE ONLY FILE YOU EDIT PER CLIENT
src/agent/                     <- Engine — never touch
src/crm/adapters/              <- CRM adapters (HubSpot, Salesforce, Pipedrive, Zoho, Airtable)
src/notifications/adapters/    <- Email adapters (Resend, SendGrid, Mailgun, SMTP)
src/db/                        <- Session storage (PostgreSQL or in-memory)
src/api/                       <- Express server (hardened)
src/security/                  <- Security middleware, validation, HMAC signing
src/ui/                        <- Chat widget + embeddable script (XSS-safe)
openclaw/                      <- OpenClaw 24/7 config (SOUL, skills, heartbeat)
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

## New Client Deployment

1. **Fill in `config/client.js`** — brand, agent persona, companyInfo, qualification, intake fields, FAQ, guardrails, tone
2. **Set `.env`** — API keys, CRM adapter, email adapter, notification settings
3. **Test** — `npm run dev` and chat with the agent
4. **Deploy** — see [DEPLOYMENT.md](DEPLOYMENT.md) for full instructions
5. **Embed** — floating widget, iframe, or direct link

See [CLIENT-SETUP.md](CLIENT-SETUP.md) for the full step-by-step guide.

---

## Adapters

### CRM (set `CRM_ADAPTER` env var)
`hubspot` | `salesforce` | `pipedrive` | `zoho` | `airtable` | `webhook-only`

### Email (set `EMAIL_ADAPTER` env var)
`resend` | `sendgrid` | `mailgun` | `smtp`

Create your own: copy `src/crm/adapters/_template.js` or `src/notifications/adapters/_template.js`.

---

## Security

This agent is built with production security in mind:

- **Helmet** — HTTP security headers (CSP, HSTS, X-Content-Type-Options)
- **Rate limiting** — 30 req/min on chat, 100 req/min global, 2s per-session cooldown
- **Input validation** — message length, format, control character stripping
- **SQL injection protection** — parameterized queries only
- **XSS prevention** — CSP headers + `textContent` rendering (never `innerHTML`)
- **HMAC webhook signing** — downstream payloads signed with SHA-256
- **Session security** — UUID validation, closed-session rejection, turn limits
- **Environment validation** — crashes on missing required vars at startup
- **CORS lockdown** — restricted to `ALLOWED_ORIGINS`
- **Path traversal prevention** — adapter names sanitized before dynamic require

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
| [CLIENT-SETUP.md](CLIENT-SETUP.md) | Step-by-step client onboarding guide |
| [BOOTSTRAP.md](BOOTSTRAP.md) | First-run checklist |
| [SECURITY.md](SECURITY.md) | Security architecture and production checklist |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Railway, Docker, Vercel, and VPS deployment guides |
| [API.md](API.md) | API reference for all endpoints |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design and request flow |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development guidelines and adapter patterns |
| [OPENCLAW.md](OPENCLAW.md) | OpenClaw 24/7 deployment + multi-channel setup |
| [CLAUDE.md](CLAUDE.md) | Project overview for AI assistants |

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
│   │   └── server.js          <- Express: /api/chat, /api/start, /api/config, /api/health
│   ├── crm/
│   │   ├── index.js           <- Generic interface (submitLead, notifications)
│   │   └── adapters/
│   │       ├── hubspot.js     <- HubSpot adapter
│   │       ├── salesforce.js  <- Salesforce adapter
│   │       ├── pipedrive.js   <- Pipedrive adapter
│   │       ├── zoho.js        <- Zoho adapter
│   │       ├── airtable.js    <- Airtable adapter
│   │       ├── webhook-only.js <- No CRM fallback
│   │       └── _template.js   <- Template for custom adapters
│   ├── notifications/
│   │   ├── email.js           <- Email orchestrator + template rendering
│   │   └── adapters/
│   │       ├── resend.js      <- Resend adapter
│   │       ├── sendgrid.js    <- SendGrid adapter
│   │       ├── mailgun.js     <- Mailgun adapter
│   │       ├── smtp.js        <- SMTP adapter (STARTTLS + TLS)
│   │       └── _template.js   <- Template for custom adapters
│   ├── db/
│   │   └── sessions.js        <- Postgres session storage (in-memory fallback)
│   ├── security/
│   │   ├── middleware.js      <- Helmet, rate limiting, HPP
│   │   ├── validate.js        <- Input validation & sanitization
│   │   ├── env.js             <- Startup environment validation
│   │   ├── config.js          <- Client config validation
│   │   └── webhook.js         <- HMAC-SHA256 signing & verification
│   ├── ui/
│   │   ├── index.html         <- Chat widget (pulls branding from /api/config)
│   │   └── widget.js          <- Embeddable floating widget script
│   └── utils/
│       └── fetch.js           <- fetchWithTimeout + maskEmail utility
├── tests/
│   └── smoke.test.js          <- Smoke tests (config, security, modules)
├── scripts/
│   ├── setup.sh               <- New client setup script
│   └── start-production.sh    <- PM2 production start
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
├── Dockerfile                 <- Multi-stage build (non-root, health check)
├── .dockerignore
├── Procfile                   <- Heroku/Railway process declaration
├── railway.json               <- Railway deployment config
├── vercel.json                <- Vercel serverless config
├── ecosystem.config.cjs       <- PM2 production config
├── .env.example
├── .editorconfig
├── .nvmrc
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

### Floating Widget (recommended)

```html
<script
  src="https://your-deployment.com/widget.js"
  data-url="https://your-deployment.com"
  defer
></script>
```

### iframe

```html
<iframe
  src="https://your-deployment.com"
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
