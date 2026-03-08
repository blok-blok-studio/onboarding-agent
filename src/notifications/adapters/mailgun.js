// src/notifications/adapters/mailgun.js
// Email adapter for Mailgun (https://mailgun.com)
//
// Required env: MAILGUN_API_KEY, MAILGUN_DOMAIN

const { fetchWithTimeout, maskEmail } = require("../../utils/fetch");

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const MAILGUN_REGION = process.env.MAILGUN_REGION || "us"; // "us" or "eu"
const BASE_URL = MAILGUN_REGION === "eu"
  ? "https://api.eu.mailgun.net/v3"
  : "https://api.mailgun.net/v3";

async function sendEmail({ to, from, subject, text }) {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    console.warn("[Email:Mailgun] MAILGUN_API_KEY or MAILGUN_DOMAIN not set — skipping");
    return false;
  }

  try {
    const formData = new URLSearchParams();
    formData.append("from", from);
    formData.append("to", to);
    formData.append("subject", subject);
    formData.append("text", text);

    const res = await fetchWithTimeout(`${BASE_URL}/${MAILGUN_DOMAIN}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64")}`,
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      console.error(`[Email:Mailgun] Error (${res.status}): ${err}`);
      return false;
    }

    console.log(`[Email:Mailgun] Sent to ${maskEmail(to)}: "${subject}"`);
    return true;
  } catch (err) {
    console.error("[Email:Mailgun] Send failed:", err.message);
    return false;
  }
}

async function testConnection() {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    return { connected: false, reason: "MAILGUN_API_KEY or MAILGUN_DOMAIN not set" };
  }
  return { connected: true };
}

module.exports = { sendEmail, testConnection };
