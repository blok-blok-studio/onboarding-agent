# Agent Memory

## Deployment Info
- Agent type: Onboarding specialist
- Engine: Express + Claude API
- CRM: HubSpot (configurable)
- Web server port: 3000

## Operational Notes
- Sessions are stored in PostgreSQL
- Each channel conversation is isolated (per-channel-peer)
- Idle sessions reset after 120 minutes
- Heartbeat runs every 30 minutes

## Daily Stats
See `memory/daily-stats.md` for historical data.
