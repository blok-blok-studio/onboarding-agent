# Onboarding Agent — CLAUDE.md

## Project Overview
White-label AI onboarding agent by Blok Blok Studio. Configurable per-client via `config/client.js`. The engine in `src/` is never edited per client.

## Tech Stack
- **Runtime**: Node.js 20+ / Express
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`)
- **Database**: PostgreSQL (`pg`) — optional, falls back to in-memory
- **CRM**: Pluggable adapters (HubSpot, Salesforce, Pipedrive, Zoho, Airtable, webhook-only)
- **Email**: Pluggable adapters (Resend, SendGrid, Mailgun, SMTP)
- **Security**: helmet, express-rate-limit, hpp, validator

## Project Structure
```
config/client.js              ← ONLY file edited per client deployment
src/agent/index.js             ← Claude API conversation loop + tool dispatch
src/agent/prompts.js           ← Builds system prompt from config
src/agent/tools.js             ← Builds tool definitions from config
src/api/server.js              ← Express server: /api/chat, /api/start, /api/config, /api/health
src/crm/index.js               ← CRM adapter interface (calls adapter + webhook + notifications)
src/crm/adapters/              ← Swappable CRM implementations
  hubspot.js                   ← HubSpot adapter
  salesforce.js                ← Salesforce adapter
  pipedrive.js                 ← Pipedrive adapter
  zoho.js                      ← Zoho adapter
  airtable.js                  ← Airtable adapter
  webhook-only.js              ← No CRM fallback
  _template.js                 ← Template for custom adapters
src/notifications/email.js     ← Email orchestrator (template rendering + adapter loading)
src/notifications/adapters/    ← Swappable email implementations
  resend.js                    ← Resend adapter
  sendgrid.js                  ← SendGrid adapter
  mailgun.js                   ← Mailgun adapter
  smtp.js                      ← SMTP adapter (STARTTLS + implicit TLS)
  _template.js                 ← Template for custom adapters
src/db/sessions.js             ← PostgreSQL session storage (with in-memory fallback)
src/security/middleware.js     ← Security middleware (helmet, rate limiting, hpp)
src/security/validate.js       ← Input validation and sanitization
src/security/env.js            ← Environment variable validation
src/security/config.js         ← Client config validation
src/security/webhook.js        ← HMAC signing for downstream webhooks
src/ui/index.html              ← Chat widget (fetches branding from /api/config)
src/ui/widget.js               ← Embeddable chat widget script
src/utils/fetch.js             ← fetchWithTimeout + maskEmail utility
tests/smoke.test.js            ← Smoke tests (config, security, modules)
scripts/setup.sh               ← New client setup script
scripts/start-production.sh    ← PM2 production start script
```

## Key Commands
```bash
npm install          # Install dependencies
npm run dev          # Start with nodemon (hot reload)
npm start            # Production start
npm test             # Run smoke tests
npm run setup        # New client setup wizard
```

## Architecture Rules
- **config/client.js** drives everything: persona, qualification, intake fields, FAQ, tone
- **src/agent/** reads config at runtime — never hardcode client-specific logic
- **CRM adapters** must export `createContact(data)` and `logDisqualified(data)`
- **Email adapters** must export `sendEmail({ to, from, subject, text })` returning boolean
- All DB queries use parameterized statements (no string interpolation)
- Input validation happens in `src/security/validate.js` before reaching the agent
- Adapter names are sanitized with `/^[a-z0-9-]+$/` to prevent path traversal

## Security Conventions
- All user input validated and sanitized before processing
- Rate limiting on chat endpoint (30 req/min default)
- Helmet for HTTP security headers (CSP, HSTS, etc.)
- Downstream webhooks signed with HMAC-SHA256 when WEBHOOK_SECRET is set
- Environment variables validated at startup — missing required vars = crash
- Session status checked before accepting messages (prevents closed-session abuse)
- Conversation length capped at MAX_CONVERSATION_TURNS (default 50)
- No sensitive data in /api/health response
- CORS restricted to ALLOWED_ORIGINS (no wildcard in production)
- SMTP headers sanitized to prevent injection

## Environment Variables
Required: `ANTHROPIC_API_KEY`
Optional: `DATABASE_URL` (falls back to in-memory store)
See `.env.example` for all options.

## Testing
```bash
npm test    # Runs Node.js built-in test runner on tests/
```

## Deployment
Railway recommended. See DEPLOYMENT.md for full instructions (Railway, Docker, VPS + PM2, Vercel).
