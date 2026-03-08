# Deployment Guide

## Prerequisites

- Node.js 20+
- PostgreSQL database (optional — falls back to in-memory store)
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
railway variables set CRM_ADAPTER=hubspot
railway variables set HUBSPOT_API_KEY=your-token
railway variables set EMAIL_ADAPTER=resend
railway variables set RESEND_API_KEY=re_...
railway variables set NOTIFICATION_EMAIL=team@yourcompany.com
railway variables set NOTIFICATION_FROM_EMAIL=agent@yourcompany.com
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

The project includes a multi-stage `Dockerfile` with non-root user and health check.

### Build and Run

```bash
docker build -t onboarding-agent .
docker run -d \
  --name onboarding-agent \
  -p 3000:3000 \
  --env-file .env \
  onboarding-agent
```

### Docker Compose (with PostgreSQL)

```yaml
version: "3.8"
services:
  agent:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - db
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: onboarding
      POSTGRES_USER: agent
      POSTGRES_PASSWORD: changeme
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

---

## VPS + PM2

### 1. Clone and Install

```bash
git clone <repo-url>
cd onboarding-agent
npm ci --omit=dev
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Start with PM2

```bash
./scripts/start-production.sh
```

Or manually:

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

The `ecosystem.config.cjs` includes memory guard (500MB), graceful shutdown, and JSON logging.

### 4. Reverse Proxy (nginx)

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

**Note:** The server sets `trust proxy` to 1, which works with a single reverse proxy (nginx/Railway). If behind multiple proxies, adjust the value accordingly.

---

## Vercel (Serverless)

Already configured via `vercel.json`. Uses in-memory sessions unless `DATABASE_URL` is set.

```bash
vercel --prod
```

**Note:** Background workers (session cleanup, CRM retry) only run on persistent servers, not on Vercel.

---

## Embedding

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

Share the deployment URL directly in emails, LinkedIn, etc.

---

## Post-Deployment Checklist

1. Set `ALLOWED_ORIGINS` to the client's domain
2. Set `NODE_ENV=production`
3. Verify via `GET /api/health` — should return `{ "status": "ok", "db": "connected" }`
4. Share the URL or embed via widget/iframe
5. Monitor with UptimeRobot on `/api/health`
