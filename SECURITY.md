# Security Guide

## Overview

This onboarding agent handles user PII (names, emails, phone numbers) and connects to external services (Claude API, CRM, webhooks). Security is enforced at every layer.

---

## Security Architecture

### 1. HTTP Security Headers (Helmet)

Helmet is applied globally and configures:

| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | `default-src 'self'` | Prevents XSS via inline injection |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` | Forces HTTPS |
| X-Content-Type-Options | `nosniff` | Prevents MIME-type sniffing |
| X-Frame-Options | Controlled via `frame-ancestors` | Prevents clickjacking |
| X-XSS-Protection | Enabled | Legacy XSS filter |
| Referrer-Policy | `no-referrer` | Prevents referrer leakage |

CSP `script-src` and `style-src` allow `'unsafe-inline'` because the chat UI uses inline styles and scripts. For tighter CSP, move styles/scripts to separate files.

### 2. Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/chat` | 30 requests | 1 minute |
| All routes (global) | 100 requests | 1 minute |

Configurable via `RATE_LIMIT_CHAT` and `RATE_LIMIT_GLOBAL` env vars.

Rate limiting uses client IP as the key. Behind a reverse proxy, ensure `trust proxy` is configured correctly.

### 3. Input Validation

All chat input is validated before reaching the Claude agent:

- **Message**: Required string, max 2,000 characters, control characters stripped
- **Session ID**: Must match UUID v4 format (`/^[a-f0-9-]{36}$/`)
- **Request body size**: Limited to 16KB

Validation happens in `src/security/validate.js`.

### 4. SQL Injection Prevention

All database queries use parameterized statements (`$1`, `$2`) via the `pg` library. No string interpolation is used in SQL.

### 5. XSS Prevention

- Server: Helmet CSP headers prevent inline script injection
- Client: All message rendering uses `textContent` (never `innerHTML`)
- Client: Role values are validated against a whitelist before use in class names
- External links use `rel="noopener noreferrer"`

### 6. Webhook Security

Downstream webhook payloads are signed with HMAC-SHA256 when `WEBHOOK_SECRET` is configured:

```
X-Signature-256: sha256=<hex-signature>
```

Receiving services should verify this signature using `src/security/webhook.js#verifySignature()`.

### 7. Session Security

- Sessions are validated before accepting messages
- Closed sessions reject new messages
- Conversation length is capped at `MAX_CONVERSATION_TURNS` (default: 50)
- Session IDs must be valid UUID v4 format

### 8. CORS

- `ALLOWED_ORIGINS` restricts which domains can call the API
- Methods restricted to `GET` and `POST`
- Only `Content-Type` header allowed

### 9. Environment Validation

At startup, the server validates:
- Required env vars exist (`ANTHROPIC_API_KEY`, `DATABASE_URL`)
- API key format looks correct
- Database URL is a valid PostgreSQL connection string
- Warnings for missing optional security vars

---

## Secret Management

| Secret | Where | Rotation |
|--------|-------|----------|
| `ANTHROPIC_API_KEY` | `.env` / Railway vars | Rotate via Anthropic console |
| `DATABASE_URL` | `.env` / Railway vars | Update connection string |
| `HUBSPOT_API_KEY` | `.env` / Railway vars | Rotate via HubSpot |
| `WEBHOOK_SECRET` | `.env` / Railway vars | Coordinate with receiver |

**Never commit `.env` files.** The `.gitignore` excludes them.

---

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set `ALLOWED_ORIGINS` to your actual domains (no wildcards)
- [ ] Set `WEBHOOK_SECRET` for signed webhooks
- [ ] Enable SSL on the PostgreSQL connection (automatic when `NODE_ENV=production`)
- [ ] Configure a reverse proxy (Railway/nginx) with `trust proxy`
- [ ] Set up UptimeRobot on `/api/health`
- [ ] Review rate limits for your expected traffic
- [ ] Ensure `.env` is not in version control

---

## Reporting Vulnerabilities

Contact chase@blokblokstudio.com with details of any security issues.
