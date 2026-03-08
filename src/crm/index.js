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

/**
 * Submit a qualified lead.
 * Fires the downstream webhook if configured (with HMAC signing).
 */
async function submitLead(data) {
  let result = {};

  try {
    result = await adapter.createContact(data);
  } catch (err) {
    console.error("[CRM] submitLead error:", err.message);
  }

  // Fire downstream webhook with HMAC signature
  if (clientConfig.webhookUrl) {
    const payload = JSON.stringify({ lead: data, crmResult: result });
    const headers = { "Content-Type": "application/json" };

    // Sign the payload if a webhook secret is configured
    const secret = process.env.WEBHOOK_SECRET;
    if (secret) {
      headers["X-Signature-256"] = `sha256=${signPayload(payload, secret)}`;
    }

    fetch(clientConfig.webhookUrl, {
      method: "POST",
      headers,
      body: payload,
    }).catch(err => console.error("[Webhook] error:", err.message));
  }

  // Notify team
  await notifyTeam("New lead submitted", data);

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
}

/**
 * Flag a prospect for human follow-up.
 */
async function escalateToHuman(data) {
  await notifyTeam("Escalation requested", data);
}

/**
 * Send a team notification.
 * Drop in SendGrid / Resend / Postmark / Slack here.
 */
async function notifyTeam(subject, data) {
  const email = clientConfig.notifications?.notifyEmail;
  if (!email) return;

  // TODO: replace with your email provider
  // Example shape for Resend:
  // await resend.emails.send({
  //   from: "agent@blokblokstudio.com",
  //   to: email,
  //   subject,
  //   text: JSON.stringify(data, null, 2)
  // });

  console.log(`[Notify] → ${email} | ${subject}`, data);
}

module.exports = { submitLead, logDisqualified, escalateToHuman };
