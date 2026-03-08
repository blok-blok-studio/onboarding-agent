# Deployment Guide

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Anthropic API key

---

## Railway (Recommended)

### 1. Install CLI and Initialize

```bash
npm install -g @railway/cli
railway login
railway init
```

### 2. Provision a Database

```bash
railway add --plugin postgresql
```

Railway automatically sets `DATABASE_URL`.

### 3. Set Environment Variables

```bash
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set HUBSPOT_API_KEY=your-token
railway variables set NOTIFICATION_EMAIL=team@yourcompany.com
railway variables set DOWNSTREAM_WEBHOOK_URL=https://your-next-agent.railway.app/webhook/lead
railway variables set WEBHOOK_SECRET=$(openssl rand -hex 32)
railway variables set ALLOWED_ORIGINS=https://yourclient.com
railway variables set NODE_ENV=production
```

### 4. Deploy

```bash
railway up
```

Railway handles process management, auto-restart, and zero-downtime deploys.

### 5. Monitoring

Add a free [UptimeRobot](https://uptimerobot.com) monitor on `/api/health`.

---

## Docker

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 3000
USER node
CMD ["node", "src/api/server.js"]
```

### Build and Run

```bash
docker build -t onboarding-agent .
docker run -d \
  --name onboarding-agent \
  -p 3000:3000 \
  --env-file .env \
  onboarding-agent
```

---

## Manual (VPS / Cloud VM)

### 1. Clone and Install

```bash
git clone <repo-url>
cd onboarding-agent
npm ci --only=production
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Set Up PostgreSQL

```bash
createdb onboarding
# Update DATABASE_URL in .env
```

### 4. Run with Process Manager

```bash
npm install -g pm2
pm2 start src/api/server.js --name onboarding-agent
pm2 save
pm2 startup
```

### 5. Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl;
    server_name onboarding.yourclient.com;

    ssl_certificate     /etc/letsencrypt/live/onboarding.yourclient.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/onboarding.yourclient.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Embedding

### iframe

```html
<iframe
  src="https://your-deployment.railway.app"
  width="100%"
  height="700"
  frameborder="0"
  style="border-radius:12px;"
></iframe>
```

### Direct Link

Share the deployment URL directly in emails, LinkedIn, etc.

---

## New Client Deployment Checklist

1. Edit `config/client.js` — brand, persona, qualification, intake fields, FAQ
2. Set `.env` — API keys, CRM token, notification email
3. Choose CRM adapter in `src/crm/index.js`
4. Deploy
5. Set `ALLOWED_ORIGINS` to the client's domain
6. Share the URL or embed via iframe
7. Monitor via `/api/health` + UptimeRobot
