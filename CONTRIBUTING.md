# Contributing

## Getting Started

```bash
git clone <repo-url>
cd onboarding-agent
cp .env.example .env   # fill in your keys
npm install
npm run dev            # http://localhost:3000
```

## Project Rules

### What to edit per client
- `config/client.js` — brand, persona, companyInfo, qualification, intake fields, FAQ, guardrails, tone
- `.env` — API keys, CRM adapter, email adapter, notification settings

### What NOT to edit per client
- `src/agent/` — engine logic (prompts, tools, chat loop)
- `src/security/` — security middleware and validation
- `src/api/server.js` — server routes and middleware
- `src/db/sessions.js` — database layer
- `src/crm/` — CRM adapter interface (adapters are swapped via env var)
- `src/notifications/` — email adapter interface (adapters are swapped via env var)

## Adding a CRM Adapter

1. Copy `src/crm/adapters/_template.js` to `src/crm/adapters/your-crm.js`
2. Implement `createContact(data)` and `logDisqualified(data)`
3. Set `CRM_ADAPTER=your-crm` in `.env`

```javascript
// src/crm/adapters/your-crm.js
async function createContact(data) {
  // data contains all intake fields collected by the agent
  // Return { contactId } or similar
}

async function logDisqualified(data) {
  // data contains { name?, email?, reason }
}

module.exports = { createContact, logDisqualified };
```

## Adding an Email Adapter

1. Copy `src/notifications/adapters/_template.js` to `src/notifications/adapters/your-provider.js`
2. Implement `sendEmail({ to, from, subject, text })` returning boolean
3. Set `EMAIL_ADAPTER=your-provider` in `.env`

```javascript
// src/notifications/adapters/your-provider.js
async function sendEmail({ to, from, subject, text }) {
  // Send the email via your provider's API
  // Return true on success, false on failure
}

module.exports = { sendEmail };
```

## Adding Intake Fields

Edit `config/client.js`:

```javascript
intake: {
  fields: [
    { key: "name",     label: "full name",      required: true  },
    { key: "email",    label: "email address",   required: true  },
    { key: "company",  label: "company name",    required: true  },
    { key: "budget",   label: "budget range",    required: false },
  ],
},
```

The agent tools and prompt automatically update from this config.

## Security Guidelines

- All user input must go through `src/security/validate.js`
- Never use string interpolation in SQL queries
- Never use `innerHTML` in the UI — always `textContent`
- Never log sensitive data (API keys, passwords, full PII)
- Add new env vars to both `.env.example` and `src/security/env.js`
- Adapter names are sanitized to prevent path traversal — only `[a-z0-9-]` allowed

## Code Style

- No TypeScript (keeping it simple for white-label handoff)
- CommonJS `require()` (not ES modules)
- Descriptive console.log tags: `[DB]`, `[CRM]`, `[Email]`, `[Security]`, `[Webhook]`

## Testing

```bash
npm test    # Runs smoke tests via Node.js built-in test runner
```

Tests live in `tests/`. Add new test files as `tests/your-feature.test.js`.

## Commit Messages

Use conventional format:
```
feat: add Salesforce CRM adapter
fix: validate session ID before DB lookup
security: add rate limiting to chat endpoint
docs: update deployment guide for Docker
```
