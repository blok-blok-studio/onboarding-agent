# Tools & Capabilities

## Available Tools

### Onboarding Skill
The primary skill for handling the onboarding workflow. Manages:
- Lead qualification against configured criteria
- Conversational intake of required fields
- Lead submission to CRM (HubSpot or webhook)
- Human escalation when needed
- Downstream webhook notifications

### File System Access
- Read configuration files (`config/client.js`)
- Read and update session data
- Write to memory files for persistent context

### Shell Execution
- Start/restart the Express web server
- Run health checks on the API
- Execute CRM-related scripts

## Not Available
- Browser automation (disabled — not needed for onboarding)
- Canvas/UI tools (disabled)
- Web search (available but rarely needed for onboarding)

## API Endpoints (Web Server)

When the Express server is running:
- `POST /api/chat` — Handle web-based onboarding conversations
- `GET /api/config` — Serve branding info to the chat widget
- `GET /api/health` — Health check for monitoring
