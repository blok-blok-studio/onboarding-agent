# Client Setup Guide

Every time you clone this repo for a new client, follow these steps in order.
Total time: ~10 minutes.

---

## Step 1: Clone and Install

```bash
git clone <your-repo-url> [client-name]-onboarding
cd [client-name]-onboarding
npm install
```

---

## Step 2: Set Up API Keys (.env)

```bash
cp .env.example .env
```

Open `.env` and fill in these **required** keys:

### Anthropic (LLM brain)
Get your key from [console.anthropic.com](https://console.anthropic.com):

```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
```

Uses Claude Haiku by default (fast + cheap, ideal for chat).

### PostgreSQL (session storage)
Any PostgreSQL database works — Railway, Neon, Supabase, or self-hosted:

```env
DATABASE_URL=postgresql://user:password@host:5432/onboarding
```

If you don't have a database yet, the agent falls back to in-memory storage (fine for demos, not for production).

### Security

```env
WEBHOOK_SECRET=your-random-secret
ALLOWED_ORIGINS=https://yourclient.com,https://www.yourclient.com
```

Generate a webhook secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Optional: CRM

```env
CRM_ADAPTER=hubspot
HUBSPOT_API_KEY=your-hubspot-private-app-token
```

Options: `hubspot`, `salesforce`, `pipedrive`, `zoho`, `airtable`, `webhook-only`

Or create your own: copy `src/crm/adapters/_template.js`.

### Optional: Email Automations

```env
EMAIL_ADAPTER=resend
RESEND_API_KEY=re_...
NOTIFICATION_EMAIL=team@yourclient.com
NOTIFICATION_FROM_EMAIL=agent@yourclient.com
```

Options: `resend`, `sendgrid`, `mailgun`, `smtp`

Or create your own: copy `src/notifications/adapters/_template.js`.

### Optional: Notifications

```env
SLACK_NOTIFICATION_WEBHOOK=https://hooks.slack.com/services/T.../B.../xxx
```

---

## Step 3: Edit `config/client.js`

This is the **only file you edit per client**. Everything else is the engine.

### Brand (required)

```javascript
brand: {
  name: "Acme Dental",
  tagline: "Modern dentistry for the whole family",
  primaryColor: "#2563eb",
},
```

### Agent Persona (required)

```javascript
agent: {
  name: "Sarah",
  role: "Patient Coordinator",
  greeting: "Hi there! I'm Sarah, a patient coordinator here at Acme Dental. How can I help you today?",
},
```

### Company Info (required)

```javascript
companyInfo: `
  ABOUT THE COMPANY:
  Acme Dental is a modern dental practice serving families in the Austin area.

  SERVICES:
  Cleanings: $150 (45 min). Fillings: $200. Crowns: $800.
  Emergency visits: $300. Teeth whitening: $500.

  HOW IT WORKS:
  First visit is a free consultation.
  ...
`,
```

Write this like you're briefing a new hire. The more detail, the fewer escalations.

### Intake Fields (required)

```javascript
intake: {
  fields: [
    { key: "name",      label: "full name",        required: true  },
    { key: "email",     label: "email address",     required: true  },
    { key: "phone",     label: "phone number",      required: false },
    { key: "challenge", label: "what they need",    required: true  },
  ],
},
```

Add or remove fields as needed. The agent collects them conversationally.

### FAQ (required)

```javascript
faq: `
  Q: How much does a cleaning cost?
  A: Cleanings are $150 and take about 45 minutes.

  Q: Do you accept insurance?
  A: We accept most major dental insurance plans.
`,
```

### Qualification (optional)

Set `enabled: false` if you don't need to qualify leads. Most clients keep it on.

### Email Templates (optional)

Customize the confirmation email sent to leads and the notification email sent to your team. Uses `{{field}}` placeholders.

### Tone (optional)

Adjust the agent's personality. Default is casual and human.

---

## Step 4: Test Locally

```bash
npm run dev    # http://localhost:3000
```

Open the browser and chat with the agent. Verify:
- Agent greets with the configured persona
- Agent knows the company info and FAQ
- Agent collects all required intake fields conversationally
- Agent sounds human (no markdown, no AI phrases)
- Submit flow works (check console for CRM logs)

---

## Step 5: Deploy

### Option A: Railway (recommended)

```bash
railway login && railway init
# Add PostgreSQL plugin in Railway dashboard
# Set all env vars in Railway dashboard
railway up
```

### Option B: Docker

```bash
docker build -t onboarding-agent .
docker run -d -p 3000:3000 --env-file .env onboarding-agent
```

### Option C: VPS + PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

### Option D: Vercel (serverless)

Already configured via `vercel.json`. Note: uses in-memory sessions unless `DATABASE_URL` is set.

```bash
vercel --prod
```

### After deployment

1. Set `ALLOWED_ORIGINS` to the client's domain
2. Set `NODE_ENV=production`
3. Verify via `/api/health`
4. Share the URL or embed via iframe
5. Monitor with UptimeRobot on `/api/health`

---

## Step 6: Embed on Client's Site

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

### Direct Link

Share the deployment URL in emails, LinkedIn, etc.

---

## Files You Edit Per Client

| File | What | Time |
|------|------|------|
| `.env` | API keys, CRM, email provider, security | 2 min |
| `config/client.js` | Brand, persona, company info, intake fields, FAQ, tone | 5 min |

## Files You DON'T Touch

| File | Why |
|------|-----|
| `src/*` | Engine code — same for every client |
| `SECURITY.md` | Security reference — same for everyone |
| `DEPLOYMENT.md` | Deployment guide — same for everyone |

---

## Claude Code Handoff Prompt

When handing this project off to Claude Code for a client deployment, use this prompt:

```
You are configuring an AI onboarding agent for [CLIENT NAME].

This is a production onboarding agent backbone built on:
- Anthropic Claude Haiku (LLM brain)
- Node.js + Express
- PostgreSQL (session storage)
- Pluggable CRM adapters (HubSpot, Salesforce, Pipedrive, etc.)
- Pluggable email adapters (Resend, SendGrid, Mailgun, SMTP)

The codebase is ready. Your job is to configure it for this specific client.

FILES TO EDIT:
1. .env — Set ANTHROPIC_API_KEY, DATABASE_URL, CRM_ADAPTER, EMAIL_ADAPTER, and security vars
2. config/client.js — Set brand, agent persona, companyInfo, intake fields, FAQ, tone, email templates

FILES TO NOT TOUCH:
- src/* (engine code, same for every client)

CLIENT INFO:
- Company: [NAME]
- Industry: [INDUSTRY]
- Services: [LIST SERVICES AND PRICES]
- Agent name: [PREFERRED NAME]
- Agent personality: [DESCRIBE DESIRED TONE]
- Required intake fields: [LIST WHAT TO COLLECT]
- CRM: [CRM NAME OR "webhook-only"]
- Email provider: [resend/sendgrid/mailgun/smtp OR "none"]
- Special instructions: [ANY UNIQUE REQUIREMENTS]

AFTER CONFIGURATION:
1. Start with `npm run dev` and test the chat flow
2. Verify the agent knows the company info
3. Verify all required fields are collected before submission
4. Deploy and set ALLOWED_ORIGINS
```

---

## Troubleshooting

### Agent says "Something went wrong"
- Check `ANTHROPIC_API_KEY` is valid
- Check server logs for API errors
- Verify the Anthropic SDK is up to date (`npm ls @anthropic-ai/sdk`)

### Agent doesn't know the company info
- Check `companyInfo` section in `config/client.js`
- Make sure it's detailed enough — write it like a day-one briefing

### Agent sounds too robotic
- Check `tone` section in `config/client.js`
- Remove any formal language and make it casual
- The prompt already bans markdown and AI phrases

### Lead submission fails
- Check CRM adapter logs in console
- Verify CRM API key is valid
- Check `CRM_ADAPTER` env var matches an adapter in `src/crm/adapters/`
- Failed submissions are queued for retry automatically

### Emails not sending
- Check `EMAIL_ADAPTER` and the provider's API key
- Verify `NOTIFICATION_EMAIL` and `NOTIFICATION_FROM_EMAIL` are set
- Check console for `[Email]` log lines

### Widget doesn't load on client's site
- Check `ALLOWED_ORIGINS` includes the client's domain
- Verify the widget script URL is correct
- Check browser console for CORS errors
