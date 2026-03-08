// src/notifications/adapters/_template.js
//
// ─────────────────────────────────────────────────────────────
//  Email Adapter Template
//  Copy this file to create a custom email adapter for any provider.
//
//  1. Copy this file: cp _template.js your-provider.js
//  2. Implement the sendEmail function below
//  3. Set EMAIL_ADAPTER=your-provider in your .env
//  4. That's it — the engine handles templates and orchestration
//
//  REQUIRED EXPORTS:
//    sendEmail({ to, from, subject, text })
//      — Send a single email. Return true on success, false on failure.
//      — Should NEVER throw. Log errors internally and return false.
//
//  OPTIONAL EXPORTS:
//    testConnection()
//      — Health check. Return { connected: true } or { connected: false, reason: "..." }.
//
//  ENV VARS:
//    Set whatever API keys your provider needs. The adapter reads
//    them directly from process.env.
// ─────────────────────────────────────────────────────────────

/**
 * Send a single email via your provider.
 *
 * @param {Object} opts
 * @param {string} opts.to      — Recipient email
 * @param {string} opts.from    — Sender email (from config)
 * @param {string} opts.subject — Rendered subject line
 * @param {string} opts.text    — Rendered plain-text body
 * @returns {Promise<boolean>}  — true if sent, false if failed
 */
async function sendEmail({ to, from, subject, text }) {
  // TODO: Implement your email provider API call here.
  //
  // Example:
  //   const res = await fetch("https://api.your-provider.com/send", {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //       "Authorization": `Bearer ${process.env.YOUR_EMAIL_API_KEY}`,
  //     },
  //     body: JSON.stringify({ from, to, subject, text }),
  //   });
  //
  //   if (!res.ok) {
  //     console.error(`[Email] Provider error: ${res.status}`);
  //     return false;
  //   }
  //   return true;

  console.error("[Email] Adapter not implemented — copy _template.js and fill in sendEmail().");
  return false;
}

/**
 * Optional: Test email provider connectivity.
 *
 * @returns {Promise<{ connected: boolean, reason?: string }>}
 */
async function testConnection() {
  return { connected: false, reason: "Adapter not implemented" };
}

module.exports = { sendEmail, testConnection };
