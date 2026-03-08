// src/crm/adapters/webhook-only.js
// Minimal adapter for clients who don't have a CRM yet.
// Just logs locally and fires the downstream webhook via the CRM index.

async function createContact(data) {
  console.log("[CRM: webhook-only] Lead:", data);
  return { skipped: true };
}

async function logDisqualified(data) {
  console.log("[CRM: webhook-only] Disqualified:", data);
}

async function testConnection() {
  return { connected: true, reason: "webhook-only adapter (no CRM)" };
}

module.exports = { createContact, logDisqualified, testConnection };
