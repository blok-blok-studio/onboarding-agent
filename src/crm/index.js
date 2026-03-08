// src/crm/index.js
// Generic CRM adapter. All agent logic calls these functions.
// Swap the implementation below without touching anything else.
//
// Current implementation: HubSpot
// To switch CRM: change the require() below to your adapter.

const adapter = require("./adapters/hubspot");
// const adapter = require("./adapters/salesforce");
// const adapter = require("./adapters/airtable");
// const adapter = require("./adapters/webhook-only");

const clientConfig = require("../../config/client");
const { signPayload } = require("../security/webhook");

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
    const res = await fetch(url, { method: "POST", headers: hdrs, body });

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
 * Supports: Slack webhook, email (Resend), or console fallback.
 */
async function notifyTeam(subject, body) {
  const email = clientConfig.notifications?.notifyEmail;
  const slackWebhook = process.env.SLACK_NOTIFICATION_WEBHOOK;

  // Slack webhook (if configured)
  if (slackWebhook) {
    await sendSlackNotification(slackWebhook, subject, body);
    return;
  }

  // Email via Resend (if RESEND_API_KEY is set)
  if (process.env.RESEND_API_KEY && email) {
    await sendEmailNotification(email, subject, body);
    return;
  }

  // Fallback: console log
  if (email) {
    console.log(`[Notify] → ${email} | ${subject}\n${body}`);
  }
}

async function sendSlackNotification(webhookUrl, subject, body) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `*${subject}*\n${body}`
    })
  });

  if (!res.ok) {
    throw new Error(`Slack webhook returned ${res.status}`);
  }

  console.log(`[Notify] Slack notification sent: ${subject}`);
}

async function sendEmailNotification(to, subject, body) {
  const fromEmail = process.env.NOTIFICATION_FROM_EMAIL || "agent@blokblokstudio.com";
  const brandName = clientConfig.brand?.name || "Onboarding Agent";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: `${brandName} Agent <${fromEmail}>`,
      to: [to],
      subject: `[${brandName}] ${subject}`,
      text: body,
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Resend API error: ${err.message || res.status}`);
  }

  console.log(`[Notify] Email sent to ${to}: ${subject}`);
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
