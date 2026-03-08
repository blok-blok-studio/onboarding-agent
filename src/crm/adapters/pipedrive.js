// src/crm/adapters/pipedrive.js
// Pipedrive CRM adapter.
//
// Required env vars:
//   PIPEDRIVE_API_TOKEN   — API token from Settings > Personal Preferences > API
//   PIPEDRIVE_DOMAIN      — Your Pipedrive subdomain (e.g. "yourcompany" for yourcompany.pipedrive.com)
//
// Docs: https://developers.pipedrive.com/docs/api/v1

const { fetchWithTimeout, maskEmail } = require("../../utils/fetch");

const DOMAIN = process.env.PIPEDRIVE_DOMAIN;

function baseUrl() {
  return `https://${DOMAIN}.pipedrive.com/api/v1`;
}

function authParam() {
  return `api_token=${process.env.PIPEDRIVE_API_TOKEN}`;
}

/**
 * Create a Person + Deal in Pipedrive.
 */
async function createContact(data) {
  if (!process.env.PIPEDRIVE_API_TOKEN || !DOMAIN) {
    console.warn("[Pipedrive] No credentials — skipping CRM write");
    return { skipped: true };
  }

  // Step 1: Create or find Person
  const person = {
    name: data.name || "Unknown",
    email: data.email ? [{ value: data.email, primary: true }] : undefined,
    phone: data.phone ? [{ value: data.phone, primary: true }] : undefined,
  };

  const personRes = await fetchWithTimeout(`${baseUrl()}/persons?${authParam()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(person),
  });

  const personBody = await personRes.json();

  if (!personRes.ok || !personBody.success) {
    const errMsg = personBody.error || JSON.stringify(personBody);
    console.error(`[Pipedrive] Person creation failed: ${errMsg}`);
    throw new Error(`Pipedrive API error: ${errMsg}`);
  }

  const personId = personBody.data.id;
  console.log(`[Pipedrive] Person created: ${maskEmail(data.email)}, id: ${personId}`);

  // Step 2: Create a Deal linked to the Person
  const deal = {
    title: `${data.name || "New Lead"} — AI Onboarding`,
    person_id: personId,
    stage_id: parseInt(process.env.PIPEDRIVE_STAGE_ID || "1", 10),
  };

  const dealRes = await fetchWithTimeout(`${baseUrl()}/deals?${authParam()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(deal),
  });

  const dealBody = await dealRes.json();

  if (!dealRes.ok || !dealBody.success) {
    console.error(`[Pipedrive] Deal creation failed: ${dealBody.error || "unknown"}`);
    // Don't throw — person was created, deal is secondary
  }

  // Step 3: Add a note with intake details
  if (personId) {
    const noteContent = Object.entries(data)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `<b>${k}:</b> ${v}`)
      .join("<br>");

    await fetchWithTimeout(`${baseUrl()}/notes?${authParam()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `<p>Submitted via AI onboarding agent:</p><p>${noteContent}</p>`,
        person_id: personId,
        deal_id: dealBody?.data?.id || undefined,
      }),
    }).catch(err => console.error("[Pipedrive] Note creation failed:", err.message));
  }

  return { contactId: String(personId) };
}

/**
 * Log a disqualified prospect.
 */
async function logDisqualified(data) {
  if (!process.env.PIPEDRIVE_API_TOKEN || !DOMAIN) return;

  if (!data.email && !data.name) {
    console.log("[Pipedrive] No identifiers for disqualified lead — logging locally only");
    return;
  }

  const person = {
    name: data.name || "Unknown (Disqualified)",
    email: data.email ? [{ value: data.email, primary: true }] : undefined,
  };

  const res = await fetchWithTimeout(`${baseUrl()}/persons?${authParam()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(person),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error(`[Pipedrive] Disqualify log failed: ${errBody.error || res.status}`);
  }
}

/**
 * Test Pipedrive connectivity.
 */
async function testConnection() {
  if (!process.env.PIPEDRIVE_API_TOKEN || !DOMAIN) {
    return { connected: false, reason: "No credentials configured" };
  }

  try {
    const res = await fetchWithTimeout(`${baseUrl()}/users/me?${authParam()}`, {}, 10000);
    const body = await res.json();
    if (res.ok && body.success) return { connected: true };
    return { connected: false, reason: `API error: ${body.error || res.status}` };
  } catch (err) {
    return { connected: false, reason: err.message };
  }
}

module.exports = { createContact, logDisqualified, testConnection };
