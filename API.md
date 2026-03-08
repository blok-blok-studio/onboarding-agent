# API Reference

Base URL: `http://localhost:3000` (development) or your deployment URL.

---

## POST /api/chat

Send a message and receive the agent's response.

### Request

```json
{
  "message": "Hi, I'd like to get started",
  "sessionId": "optional-uuid-v4"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | User message (max 2,000 chars) |
| `sessionId` | string | No | UUID v4 session ID. Omit to start a new conversation. |

### Response (200)

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "reply": "Hi! I'm Alex, an onboarding assistant. How can I help?",
  "done": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Session ID (use for subsequent messages) |
| `reply` | string | Agent's response text |
| `done` | boolean | `true` when the conversation is complete (lead submitted or disqualified) |

### Error Responses

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{ "error": "message is required and must be a string" }` | Missing or invalid message |
| 400 | `{ "error": "invalid sessionId format" }` | Session ID not UUID v4 |
| 400 | `{ "error": "This conversation has ended." }` | Session already closed |
| 400 | `{ "error": "Conversation limit reached..." }` | Too many turns |
| 429 | `{ "error": "Too many requests..." }` | Rate limit exceeded |
| 429 | `{ "error": "Please wait a moment..." }` | Per-session rate limit (2s) |
| 500 | `{ "error": "Something went wrong..." }` | Internal error |

### Rate Limit

30 requests per minute per IP (configurable via `RATE_LIMIT_CHAT`).

Rate limit headers are included in responses:
- `RateLimit-Limit`
- `RateLimit-Remaining`
- `RateLimit-Reset`

---

## POST /api/start

Start a new session and receive the agent greeting without making a Claude API call.

### Request

No body required.

### Response (200)

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "reply": "Hi there! I'm Sarah, a patient coordinator...",
  "done": false
}
```

The greeting comes from `config/client.js` `agent.greeting`.

---

## GET /api/config

Returns public branding info for the chat UI. No authentication required.

### Response (200)

```json
{
  "brandName": "Your Company Name",
  "brandTagline": "A short description",
  "agentName": "Alex",
  "agentRole": "Onboarding Specialist",
  "primaryColor": "#2563eb"
}
```

---

## GET /api/health

Health check endpoint for monitoring. Returns DB connectivity status.

### Response (200)

```json
{
  "status": "ok",
  "db": "connected",
  "ts": "2026-03-08T20:00:00.000Z"
}
```

### Response (503) — Degraded

```json
{
  "status": "degraded",
  "db": "disconnected",
  "ts": "2026-03-08T20:00:00.000Z"
}
```

No sensitive information is exposed.

---

## Downstream Webhook

When a lead is submitted and `DOWNSTREAM_WEBHOOK_URL` is configured, the server fires a POST with retry (3 attempts, exponential backoff):

### Payload

```json
{
  "lead": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "555-0123",
    "notes": "Interested in the enterprise plan"
  },
  "crmResult": {
    "contactId": "12345"
  }
}
```

### Headers

| Header | Value | Present When |
|--------|-------|-------------|
| `Content-Type` | `application/json` | Always |
| `X-Signature-256` | `sha256=<hex>` | `WEBHOOK_SECRET` is set |

### Verifying the Signature

```javascript
const crypto = require("crypto");

function verify(payload, signature, secret) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");
  const sig = signature.replace("sha256=", "");
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(sig, "hex")
  );
}
```
