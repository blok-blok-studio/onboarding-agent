// src/crm/index.js
// Generic CRM adapter. All agent logic calls these functions.
// Set CRM_ADAPTER env var to switch between adapters without changing code.
//
// Supported adapters: hubspot, salesforce, pipedrive, zoho, airtable, webhook-only
// Custom adapters: create src/crm/adapters/your-crm.js (see _template.js)

const ADAPTER_NAME = (process.env.CRM_ADAPTER || "webhook-only").toLowerCase().trim();
const VALID_ADAPTERS = ["hubspot", "salesforce", "pipedrive", "zoho", "airtable", "webhook-only"];

// Sanitize adapter name to prevent path traversal
if (!/^[a-z0-9-]+$/.test(ADAPTER_NAME)) {
  console.error(`[CRM] Invalid adapter name: "${ADAPTER_NAME}" — only alphanumeric and hyphens allowed`);
  process.exit(1);
}

if (!VALID_ADAPTERS.includes(ADAPTER_NAME)) {
  // Allow custom adapters — just try to require the file
  console.warn(`[CRM] Custom adapter: "${ADAPTER_NAME}" — loading from ./adapters/${ADAPTER_NAME}`);
}

let adapter;
try {
  adapter = require(`./adapters/${ADAPTER_NAME}`);
} catch (err) {
  console.error(`[CRM] Failed to load adapter "${ADAPTER_NAME}": ${err.message}`);
  console.error(`[CRM] Valid adapters: ${VALID_ADAPTERS.join(", ")}`);
  console.error(`[CRM] Or create a custom adapter at src/crm/adapters/${ADAPTER_NAME}.js`);
  process.exit(1);
}

// Validate adapter interface
const REQUIRED_METHODS = ["createContact", "logDisqualified"];
for (const method of REQUIRED_METHODS) {
  if (typeof adapter[method] !== "function") {
    console.error(`[CRM] Adapter "${ADAPTER_NAME}" is missing required method: ${method}()`);
    console.error(`[CRM] See src/crm/adapters/_template.js for the required interface.`);
    process.exit(1);
  }
}

console.log(`[CRM] Adapter loaded: ${ADAPTER_NAME}`);

const clientConfig = require("../../config/client");
const { signPayload } = require("../security/webhook");
const { fetchWithTimeout, maskEmail } = require("../utils/fetch");

const WEBHOOK_MAX_RETRIES = 3;
const WEBHOOK_RETRY_DELAY_MS = 2000;

/**
 * Submit a qualified lead.
 * Throws if CRM write fails so the agent can tell the user.
 */
async function submitLead(data) {
  // CRM write — let errors propagate so agent knows it failed
  const result = await adapter.createContact(data);

  // Fire downstream webhook (async with retry — don't block the user)
  if (clientConfig.webhookUrl) {
    fireWebhookWithRetry(clientConfig.webhookUrl, { lead: data, crmResult: result })
      .catch(err => console.error("[Webhook] All retries failed:", err.message));
  }

  // Notify team (async — don't block)
  notifyTeam("New Lead Submitted", formatLeadNotification(data, result))
    .catch(err => console.error("[Notify] Error:", err.message));

  return result;
}

/**
 * Log a disqualified prospect.
 */
async function logDisqualified(data) {
  try {
    await adapter.logDisqualified(data);
  } catch (err) {
    console.error("[CRM] logDisqualified error:", err.message);
  }

  notifyTeam("Lead Disqualified", formatDisqualifyNotification(data))
    .catch(err => console.error("[Notify] Error:", err.message));
}

/**
 * Flag a prospect for human follow-up.
 */
async function escalateToHuman(data) {
  await notifyTeam("Escalation Required", formatEscalationNotification(data));
}

// ── Webhook with retry ─────────────────────────────────────────

async function fireWebhookWithRetry(url, payload, attempt = 0) {
  const body = JSON.stringify(payload);
  const hdrs = { "Content-Type": "application/json" };

  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    hdrs["X-Signature-256"] = `sha256=${signPayload(body, secret)}`;
  }

  try {
    const res = await fetchWithTimeout(url, { method: "POST", headers: hdrs, body });

    if (!res.ok) {
      throw new Error(`Webhook returned ${res.status}`);
    }

    console.log(`[Webhook] Delivered to ${url}`);
  } catch (err) {
    if (attempt < WEBHOOK_MAX_RETRIES - 1) {
      const delay = WEBHOOK_RETRY_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[Webhook] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await sleep(delay);
      return fireWebhookWithRetry(url, payload, attempt + 1);
    }
    throw err;
  }
}

// ── Notifications ──────────────────────────────────────────────

/**
 * Send a team notification via configured provider.
 * Supports: Slack webhook, pluggable email adapter, or console fallback.
 */
async function notifyTeam(subject, body) {
  const email = process.env.NOTIFICATION_EMAIL;
  const slackWebhook = process.env.SLACK_NOTIFICATION_WEBHOOK;

  // Slack webhook (if configured)
  if (slackWebhook) {
    await sendSlackNotification(slackWebhook, subject, body);
    return;
  }

  // Email via pluggable adapter
  if (email) {
    try {
      const { sendEmail } = require("../notifications/email");
      const from = process.env.NOTIFICATION_FROM_EMAIL || clientConfig.emails?.from || "agent@blokblokstudio.com";
      const brandName = clientConfig.brand?.name || "Onboarding Agent";
      const sent = await sendEmail({
        to: email,
        from,
        subject: `[${brandName}] ${subject}`,
        text: body,
      });
      if (sent) return;
    } catch (err) {
      console.error("[Notify] Email adapter error:", err.message);
    }
  }

  // Fallback: console log
  console.log(`[Notify] ${subject} (console fallback)`);
}

async function sendSlackNotification(webhookUrl, subject, body) {
  const res = await fetchWithTimeout(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `*${subject}*\n${body}`
    })
  });

  if (!res.ok) {
    throw new Error(`Slack webhook returned ${res.status}`);
  }

  console.log("[Notify] Slack notification sent");
}

// ── Notification formatters ────────────────────────────────────

function formatLeadNotification(data, crmResult) {
  const lines = [
    `A new lead has been submitted via the onboarding agent.`,
    ``,
  ];

  for (const [key, value] of Object.entries(data)) {
    if (value) lines.push(`${key}: ${value}`);
  }

  if (crmResult?.contactId) {
    lines.push(``, `CRM Contact ID: ${crmResult.contactId}`);
  }
  if (crmResult?.skipped) {
    lines.push(``, `Note: CRM write was skipped (no API key configured)`);
  }

  return lines.join("\n");
}

function formatDisqualifyNotification(data) {
  return [
    `A prospect was disqualified by the onboarding agent.`,
    ``,
    `Reason: ${data.reason || "Not specified"}`,
    data.name ? `Name: ${data.name}` : null,
    data.email ? `Email: ${data.email}` : null,
  ].filter(Boolean).join("\n");
}

function formatEscalationNotification(data) {
  return [
    `A prospect has requested to speak with a human.`,
    ``,
    `Question: ${data.question || "Not specified"}`,
    data.name ? `Name: ${data.name}` : null,
    data.email ? `Email: ${data.email}` : null,
    ``,
    `Please follow up as soon as possible.`,
  ].filter(Boolean).join("\n");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { submitLead, logDisqualified, escalateToHuman };
