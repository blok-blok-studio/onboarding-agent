// src/notifications/email.js
// Pluggable email automation engine.
// Set EMAIL_ADAPTER env var to switch providers without changing code.
//
// Supported adapters: resend, sendgrid, mailgun, smtp
// Custom adapters: create src/notifications/adapters/your-provider.js (see _template.js)
//
// Templates and orchestration live here. The adapter just sends.

const clientConfig = require("../../config/client");
const { maskEmail } = require("../utils/fetch");

// ── Load email adapter ────────────────────────────────────────

const ADAPTER_NAME = (process.env.EMAIL_ADAPTER || "resend").toLowerCase().trim();
const VALID_ADAPTERS = ["resend", "sendgrid", "mailgun", "smtp"];

let adapter;
try {
  adapter = require(`./adapters/${ADAPTER_NAME}`);
} catch (err) {
  console.warn(`[Email] Could not load adapter "${ADAPTER_NAME}": ${err.message}`);
  console.warn(`[Email] Valid adapters: ${VALID_ADAPTERS.join(", ")}`);
  console.warn(`[Email] Or create a custom adapter at src/notifications/adapters/${ADAPTER_NAME}.js`);
  console.warn("[Email] Email automations disabled.");
  adapter = null;
}

if (adapter) {
  if (typeof adapter.sendEmail !== "function") {
    console.error(`[Email] Adapter "${ADAPTER_NAME}" is missing required method: sendEmail()`);
    console.error(`[Email] See src/notifications/adapters/_template.js for the required interface.`);
    adapter = null;
  } else {
    console.log(`[Email] Adapter loaded: ${ADAPTER_NAME}`);
  }
}

// ── Template rendering ────────────────────────────────────────

/**
 * Replace {{field}} placeholders with lead data values.
 * Also handles simple {{#if field}}...{{/if}} blocks.
 */
function renderTemplate(template, data) {
  if (!template) return "";

  // Handle {{#if field}}content{{/if}} blocks
  let result = template.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, content) => {
      const val = data[key];
      return val && String(val).trim() ? content.replace(/\{\{(\w+)\}\}/g, (__, k) => data[k] || "") : "";
    }
  );

  // Replace remaining {{field}} placeholders
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || "");

  // Clean up empty lines from removed if-blocks
  result = result.replace(/\n{3,}/g, "\n\n").trim();

  return result;
}

// ── Send via adapter ──────────────────────────────────────────

/**
 * Send a single email through the configured adapter.
 * Returns true on success, false on failure (never throws).
 */
async function sendEmail({ to, from, subject, text }) {
  if (!adapter) {
    console.warn("[Email] No adapter loaded — skipping email");
    return false;
  }

  try {
    return await adapter.sendEmail({ to, from, subject, text });
  } catch (err) {
    console.error("[Email] Adapter error:", err.message);
    return false;
  }
}

// ── Orchestration ─────────────────────────────────────────────

/**
 * Send all configured email automations for a new lead.
 * Called after a successful submit_lead.
 */
async function sendLeadEmails(leadData) {
  const emails = clientConfig.emails;
  if (!emails || !adapter) return;

  const from = emails.from || "onboarding@example.com";
  const results = [];

  // 1. Confirmation email to the lead
  if (emails.leadConfirmation?.enabled && leadData.email) {
    const conf = emails.leadConfirmation;
    results.push(
      sendEmail({
        to: leadData.email,
        from,
        subject: renderTemplate(conf.subject, leadData),
        text: renderTemplate(conf.body, leadData),
      })
    );
  }

  // 2. Notification email to the team
  if (emails.teamNotification?.enabled && emails.teamNotification.to) {
    const notif = emails.teamNotification;
    results.push(
      sendEmail({
        to: notif.to,
        from,
        subject: renderTemplate(notif.subject, leadData),
        text: renderTemplate(notif.body, leadData),
      })
    );
  }

  await Promise.allSettled(results);
}

module.exports = { sendLeadEmails, sendEmail, renderTemplate };
