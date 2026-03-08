# Heartbeat — Proactive Tasks

Run these checks every heartbeat cycle (default: every 30 minutes).

## Checklist

- [ ] **Health check**: Verify the Express web server is running by hitting `http://localhost:3000/api/health`. If it's down, restart it with `cd /path/to/onboarding-agent && npm start &`
- [ ] **Session cleanup**: Check for any sessions that have been active for more than 24 hours without updates — these are likely abandoned. Log them for review.
- [ ] **CRM connectivity**: If HubSpot is configured, verify the API key is still valid by checking for recent errors in the server logs.
- [ ] **Memory update**: If any new leads were submitted since the last heartbeat, note the count in memory for daily reporting.

## Daily Summary (6 AM)

At the start of each day:
- Summarize the previous day's onboarding activity (leads submitted, disqualified, escalated)
- Note any recurring issues or patterns
- Update `memory/daily-stats.md` with the summary

If nothing needs attention, reply `HEARTBEAT_OK`.
