# Onboarding Agent — CLAUDE.md

## Project Overview
White-label AI onboarding agent by Blok Blok Studio. Configurable per-client via `config/client.js`. The engine in `src/` is never edited per client.

## Tech Stack
- **Runtime**: Node.js + Express
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`)
- **Database**: PostgreSQL (`pg`)
- **CRM**: HubSpot (swappable via adapter pattern)
- **Security**: helmet, express-rate-limit, hpp, validator

## Project Structure
```
config/client.js          ← ONLY file edited per client deployment
src/agent/index.js        ← Claude API conversation loop + tool dispatch
src/agent/prompts.js      ← Builds system prompt from config
src/agent/tools.js        ← Builds tool definitions from config
src/api/server.js         ← Express server: /api/chat, /api/config, /api/health
src/crm/index.js          ← CRM adapter interface (calls adapter + webhook)
src/crm/adapters/         ← Swappable CRM implementations
src/db/sessions.js        ← PostgreSQL session storage
src/security/middleware.js ← Security middleware (helmet, rate limiting, hpp)
src/security/validate.js  ← Input validation and sanitization
src/security/env.js       ← Environment variable validation
src/security/webhook.js   ← HMAC signing for downstream webhooks
src/ui/index.html         ← Chat widget (fetches branding from /api/config)
```

## Key Commands
```bash
npm install          # Install dependencies
npm run dev          # Start with nodemon (hot reload)
npm start            # Production start
```

## Architecture Rules
- **config/client.js** drives everything: persona, qualification, intake fields, FAQ, tone
- **src/agent/** reads config at runtime — never hardcode client-specific logic
- **CRM adapters** must export `createContact(data)` and `logDisqualified(data)`
- All DB queries use parameterized statements (no string interpolation)
- Input validation happens in `src/security/validate.js` before reaching the agent

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

## Environment Variables
Required: `ANTHROPIC_API_KEY`, `DATABASE_URL`
See `.env.example` for all options.

## Testing
No test suite yet. Manual testing via the chat UI at `http://localhost:3000`.

## Deployment
Railway recommended. See DEPLOYMENT.md for full instructions.
