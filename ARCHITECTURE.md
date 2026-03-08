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
│   Validator  │   │  GET  /api/config                    │
└──────────────┘   │  GET  /api/health                    │
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
     ┌──────────────┐     ┌──────────────┐
     │  CRM Adapter │────▶│  Downstream  │
     │  (HubSpot/   │     │  Webhook     │
     │   webhook)   │     │  (HMAC)      │
     └──────────────┘     └──────────────┘
```

## Request Flow

1. **User sends message** via the chat widget
2. **Server validates** input (length, format, sanitization)
3. **Rate limiter** checks request count
4. **Session check** — is this session still active?
5. **Conversation history** loaded from PostgreSQL
6. **Agent engine** calls Claude API with system prompt + tools + history
7. **Claude responds** with either text or a tool call
8. **Tool dispatch** — `submit_lead`, `log_disqualified`, or `escalate_to_human`
9. **CRM adapter** creates contact / logs event
10. **Webhook fires** (HMAC-signed) to downstream services
11. **Response sent** back to client with `{ sessionId, reply, done }`

## Configuration-Driven Design

The entire agent behavior is driven by `config/client.js`:

| Config Section | Drives |
|---------------|--------|
| `brand` | UI header, page title |
| `agent` | System prompt persona |
| `qualification` | Qualification rules in system prompt |
| `intake.fields` | `submit_lead` tool schema + prompt field list |
| `faq` | Knowledge base in system prompt |
| `tone` | Style constraints in system prompt |
| `successMessage` | Post-submission response |
| `webhookUrl` | Downstream integration target |

## CRM Adapter Pattern

All adapters must export:

```javascript
module.exports = {
  createContact(data)     // → { contactId } or { logged: true }
  logDisqualified(data)   // → void
}
```

The CRM index (`src/crm/index.js`) handles webhook dispatch and team notifications on top of the adapter.

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
  status     TEXT DEFAULT 'active',   -- active | qualified | disqualified | complete
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Indexed on `status` for active session queries.
