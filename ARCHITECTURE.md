# Architecture

## System Overview

```
                                ┌─────────────────┐
                                │   Chat Widget    │
                                │  (src/ui/)       │
                                └────────┬────────┘
                                         │ HTTP
                                         ▼
┌──────────────┐   ┌──────────────────────────────────────┐
│   Helmet     │   │         Express Server               │
│   Rate Limit │──▶│         (src/api/server.js)           │
│   HPP        │   │                                      │
│   CORS       │   │  POST /api/chat                      │
│   Validator  │   │  POST /api/start                     │
└──────────────┘   │  GET  /api/config                    │
                   │  GET  /api/health                    │
                   └──────────┬───────────────────────────┘
                              │
              ┌───────────────┼───────────────────┐
              ▼               ▼                   ▼
     ┌────────────┐  ┌───────────────┐   ┌──────────────┐
     │   Agent    │  │   Sessions    │   │   Security   │
     │  Engine    │  │   (Postgres)  │   │  Middleware   │
     │            │  │               │   │              │
     │ - prompts  │  │ - getMessages │   │ - validate   │
     │ - tools    │  │ - appendMsg   │   │ - rate limit │
     │ - chat()   │  │ - closeSession│   │ - HMAC sign  │
     └─────┬──────┘  └───────────────┘   └──────────────┘
           │
           ▼
     ┌─────────────┐
     │  Claude API  │
     │  (Anthropic)  │
     └─────┬────────┘
           │ tool_use
           ▼
     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
     │  CRM Adapter │────▶│  Downstream  │     │    Email     │
     │  (pluggable) │     │  Webhook     │     │   Adapter    │
     │              │     │  (HMAC)      │     │  (pluggable) │
     └──────────────┘     └──────────────┘     └──────────────┘
```

## Request Flow

1. **User sends message** via the chat widget or API
2. **Server validates** input (length, format, sanitization)
3. **Rate limiter** checks request count (per-IP and per-session)
4. **Session check** — is this session still active?
5. **Conversation history** loaded from PostgreSQL (or in-memory)
6. **Agent engine** calls Claude API with system prompt + tools + history
7. **Claude responds** with either text or a tool call
8. **Tool dispatch** — `submit_lead`, `log_disqualified`, or `escalate_to_human`
9. **CRM adapter** creates contact / logs event
10. **Email adapter** sends lead confirmation + team notification
11. **Webhook fires** (HMAC-signed) to downstream services
12. **Response sent** back to client with `{ sessionId, reply, done }`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat` | Send a message, get agent response |
| `POST` | `/api/start` | Start a session, get greeting (no API call) |
| `GET` | `/api/config` | Public branding info for the UI |
| `GET` | `/api/health` | Health check (DB connectivity) |

## Configuration-Driven Design

The entire agent behavior is driven by `config/client.js`:

| Config Section | Drives |
|---------------|--------|
| `brand` | UI header, page title, widget branding |
| `agent` | System prompt persona, greeting |
| `companyInfo` | Knowledge base in system prompt |
| `qualification` | Qualification rules in system prompt |
| `intake.fields` | `submit_lead` tool schema + prompt field list |
| `faq` | FAQ knowledge in system prompt |
| `guardrails` | Off-topic handling rules |
| `tone` | Style constraints in system prompt |
| `emails` | Lead confirmation + team notification templates |
| `successMessage` | Post-submission response |
| `webhookUrl` | Downstream integration target |

## Adapter Pattern

### CRM Adapters

All CRM adapters must export:

```javascript
module.exports = {
  createContact(data)     // → { contactId } or { logged: true }
  logDisqualified(data)   // → void
}
```

Set `CRM_ADAPTER` env var to switch: `hubspot`, `salesforce`, `pipedrive`, `zoho`, `airtable`, `webhook-only`.

### Email Adapters

All email adapters must export:

```javascript
module.exports = {
  sendEmail({ to, from, subject, text })  // → boolean (true = sent)
}
```

Set `EMAIL_ADAPTER` env var to switch: `resend`, `sendgrid`, `mailgun`, `smtp`.

### Creating Custom Adapters

Copy `src/crm/adapters/_template.js` or `src/notifications/adapters/_template.js` and implement the interface.

## CRM Notification Flow

When a lead is submitted, `src/crm/index.js` orchestrates:
1. CRM adapter writes the contact
2. Downstream webhook fires (with retry + exponential backoff)
3. Team notification sent via Slack webhook, email adapter, or console fallback

## Background Workers

On persistent servers (not Vercel), the server runs:
- **Session cleanup** — removes sessions older than `SESSION_TTL_DAYS` (default 30) every hour
- **CRM retry** — retries failed lead submissions every 5 minutes (max 5 attempts with backoff)

## Security Layers

```
Request → Rate Limit → CORS → Helmet → Body Size → Input Validation → Session Check → Agent → Response
```

Each layer can reject the request independently. See SECURITY.md for details.

## Database Schema

```sql
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,        -- UUID v4
  messages   JSONB DEFAULT '[]',      -- Full conversation history
  status     TEXT DEFAULT 'active',   -- active | qualified | disqualified | escalated | complete
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Indexed on `status` for active session queries. Falls back to an in-memory Map when `DATABASE_URL` is not set.
