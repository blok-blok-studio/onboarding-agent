// src/crm/adapters/_template.js
//
// ─────────────────────────────────────────────────────────────
//  CRM Adapter Template
//  Copy this file to create a custom adapter for any CRM.
//
//  1. Copy this file: cp _template.js your-crm.js
//  2. Implement the functions below
//  3. Set CRM_ADAPTER=your-crm in your .env
//  4. That's it — no other code changes needed
//
//  REQUIRED EXPORTS:
//    createContact(data)     — Create or update a contact. Must return { contactId } or { skipped: true }.
//    logDisqualified(data)   — Log a disqualified prospect. Best-effort, should not throw.
//
//  OPTIONAL EXPORTS:
//    testConnection()        — Health check. Return { connected: true } or { connected: false, reason: "..." }.
//
//  DATA SHAPE:
//    The `data` object contains whatever fields are defined in
//    config/client.js → intake.fields. Common fields:
//      { name, email, phone, company, role, challenge, timeline, budget, how_found }
//    Plus for logDisqualified:
//      { reason, name?, email? }
// ─────────────────────────────────────────────────────────────

/**
 * Create or update a contact in your CRM.
 *
 * @param {Object} data — Lead data collected by the agent
 * @returns {Promise<{ contactId?: string, skipped?: boolean }>}
 * @throws {Error} — Throw if the CRM write fails. The agent will tell the user.
 */
async function createContact(data) {
  // TODO: Implement your CRM API call here.
  //
  // Example:
  //   const res = await fetch("https://api.your-crm.com/contacts", {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //       "Authorization": `Bearer ${process.env.YOUR_CRM_API_KEY}`,
  //     },
  //     body: JSON.stringify({
  //       name: data.name,
  //       email: data.email,
  //       phone: data.phone,
  //       company: data.company,
  //       // ... map your fields
  //     }),
  //   });
  //
  //   if (!res.ok) throw new Error(`CRM API error: ${res.status}`);
  //   const body = await res.json();
  //   return { contactId: body.id };

  throw new Error("Adapter not implemented — copy _template.js and fill in the methods.");
}

/**
 * Log a disqualified prospect. Best-effort — should not throw.
 *
 * @param {Object} data — { reason, name?, email? }
 */
async function logDisqualified(data) {
  // TODO: Implement if your CRM supports logging disqualified leads.
  // This is best-effort — swallow errors and log them.
  console.log("[CRM: template] Disqualified:", data);
}

/**
 * Optional: Test CRM connectivity for health checks.
 *
 * @returns {Promise<{ connected: boolean, reason?: string }>}
 */
async function testConnection() {
  // TODO: Implement a simple API ping to verify credentials.
  return { connected: false, reason: "Adapter not implemented" };
}

module.exports = { createContact, logDisqualified, testConnection };
