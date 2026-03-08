# Bootstrap - First Run Checklist

Complete these steps after cloning for a new client:

1. **Read the setup guide**: Open `CLIENT-SETUP.md` and follow it step by step.

2. **Verify required environment variables**:
   - `ANTHROPIC_API_KEY` (get from console.anthropic.com)
   - `DATABASE_URL` (any PostgreSQL — Railway, Neon, Supabase, or self-hosted)
   - `WEBHOOK_SECRET` (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `ALLOWED_ORIGINS` (the client's domain)

   If `DATABASE_URL` is missing, the agent uses in-memory storage (fine for demos).

3. **Configure the client**:
   Edit `config/client.js` with the client's brand, persona, company info, intake fields, and FAQ.

4. **Test locally**:
   ```bash
   npm run dev    # http://localhost:3000
   ```
   Chat with the agent. Verify:
   - Agent greets with the configured persona
   - Agent knows the company info and FAQ
   - Agent collects all required fields before submitting
   - Agent sounds human (no markdown, no lists, no AI phrases)

5. **Check health**:
   ```bash
   curl http://localhost:3000/api/health
   ```
   Should return `{"status":"ok"}`.

6. **Deploy**:
   See `CLIENT-SETUP.md` Step 5 or `DEPLOYMENT.md` for full instructions.

7. **Post-deploy verification**:
   - Set `ALLOWED_ORIGINS` to the client's domain
   - Set `NODE_ENV=production`
   - Test the live URL
   - Set up UptimeRobot on `/api/health`
   - Share the URL or embed the widget
