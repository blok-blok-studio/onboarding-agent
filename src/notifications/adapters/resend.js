// src/notifications/adapters/resend.js
// Email adapter for Resend (https://resend.com)
//
// Required env: RESEND_API_KEY

const { fetchWithTimeout, maskEmail } = require("../../utils/fetch");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_URL = "https://api.resend.com/emails";

async function sendEmail({ to, from, subject, text }) {
  if (!RESEND_API_KEY) {
    console.warn("[Email:Resend] RESEND_API_KEY not set — skipping");
    return false;
  }

  try {
    const res = await fetchWithTimeout(RESEND_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      console.error(`[Email:Resend] Error (${res.status}): ${err}`);
      return false;
    }

    console.log(`[Email:Resend] Sent to ${maskEmail(to)}: "${subject}"`);
    return true;
  } catch (err) {
    console.error("[Email:Resend] Send failed:", err.message);
    return false;
  }
}

async function testConnection() {
  if (!RESEND_API_KEY) {
    return { connected: false, reason: "RESEND_API_KEY not set" };
  }
  return { connected: true };
}

module.exports = { sendEmail, testConnection };
