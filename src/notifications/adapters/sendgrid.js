// src/notifications/adapters/sendgrid.js
// Email adapter for SendGrid (https://sendgrid.com)
//
// Required env: SENDGRID_API_KEY

const { fetchWithTimeout, maskEmail } = require("../../utils/fetch");

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";

async function sendEmail({ to, from, subject, text }) {
  if (!SENDGRID_API_KEY) {
    console.warn("[Email:SendGrid] SENDGRID_API_KEY not set — skipping");
    return false;
  }

  try {
    const res = await fetchWithTimeout(SENDGRID_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject,
        content: [{ type: "text/plain", value: text }],
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      console.error(`[Email:SendGrid] Error (${res.status}): ${err}`);
      return false;
    }

    console.log(`[Email:SendGrid] Sent to ${maskEmail(to)}: "${subject}"`);
    return true;
  } catch (err) {
    console.error("[Email:SendGrid] Send failed:", err.message);
    return false;
  }
}

async function testConnection() {
  if (!SENDGRID_API_KEY) {
    return { connected: false, reason: "SENDGRID_API_KEY not set" };
  }
  return { connected: true };
}

module.exports = { sendEmail, testConnection };
