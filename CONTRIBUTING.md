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
- `config/client.js` — brand, persona, qualification, intake fields, FAQ, tone
- `.env` — API keys, CRM token, notification email
- `src/crm/index.js` — swap CRM adapter require

### What NOT to edit per client
- `src/agent/` — engine logic (prompts, tools, chat loop)
- `src/security/` — security middleware and validation
- `src/api/server.js` — server routes and middleware
- `src/db/sessions.js` — database layer

## Adding a CRM Adapter

1. Create `src/crm/adapters/your-crm.js`
2. Export `createContact(data)` and `logDisqualified(data)`
3. Update the require in `src/crm/index.js`

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

## Code Style

- No TypeScript (keeping it simple for white-label handoff)
- CommonJS `require()` (not ES modules)
- Descriptive console.log tags: `[DB]`, `[CRM]`, `[Security]`, `[Webhook]`

## Commit Messages

Use conventional format:
```
feat: add Salesforce CRM adapter
fix: validate session ID before DB lookup
security: add rate limiting to chat endpoint
docs: update deployment guide for Docker
```
