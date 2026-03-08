// src/crm/adapters/salesforce.js
// Salesforce CRM adapter.
//
// Required env vars:
//   SALESFORCE_INSTANCE_URL  — e.g. https://yourorg.my.salesforce.com
//   SALESFORCE_ACCESS_TOKEN  — OAuth2 Bearer token
//
// Salesforce uses the REST API to create Lead objects.
// Docs: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/

const INSTANCE_URL = process.env.SALESFORCE_INSTANCE_URL;
const API_VERSION = process.env.SALESFORCE_API_VERSION || "v59.0";

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.SALESFORCE_ACCESS_TOKEN}`,
  };
}

function baseUrl() {
  return `${INSTANCE_URL}/services/data/${API_VERSION}`;
}

/**
 * Create a Lead in Salesforce.
 */
async function createContact(data) {
  if (!process.env.SALESFORCE_ACCESS_TOKEN || !INSTANCE_URL) {
    console.warn("[Salesforce] No credentials — skipping CRM write");
    return { skipped: true };
  }

  const nameParts = (data.name || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || firstName || "Unknown";

  const lead = {
    FirstName: firstName,
    LastName: lastName,
    Email: data.email || undefined,
    Phone: data.phone || undefined,
    Company: data.company || "Unknown",
    Title: data.role || undefined,
    Description: buildDescription(data),
    LeadSource: data.how_found || "AI Onboarding Agent",
    Status: "New",
  };

  // Remove undefined fields
  for (const key of Object.keys(lead)) {
    if (lead[key] === undefined) delete lead[key];
  }

  const res = await fetch(`${baseUrl()}/sobjects/Lead`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(lead),
  });

  const body = await res.json();

  if (!res.ok) {
    // Duplicate detected — try to find and update
    if (body[0]?.errorCode === "DUPLICATES_DETECTED" && data.email) {
      return await updateExistingLead(data);
    }
    const errMsg = body[0]?.message || JSON.stringify(body);
    console.error(`[Salesforce] Lead creation failed (${res.status}): ${errMsg}`);
    throw new Error(`Salesforce API error: ${errMsg}`);
  }

  const leadId = body.id;
  console.log(`[Salesforce] Lead created: ${data.email || "no email"}, id: ${leadId}`);
  return { contactId: leadId };
}

/**
 * Update an existing Lead found by email.
 */
async function updateExistingLead(data) {
  const query = encodeURIComponent(`SELECT Id FROM Lead WHERE Email = '${data.email}' LIMIT 1`);
  const searchRes = await fetch(`${baseUrl()}/query/?q=${query}`, {
    headers: headers(),
  });

  const searchBody = await searchRes.json();
  if (!searchRes.ok || !searchBody.records?.length) {
    console.error("[Salesforce] Could not find existing lead for update");
    throw new Error("Lead exists but could not be found for update");
  }

  const leadId = searchBody.records[0].Id;

  const updateRes = await fetch(`${baseUrl()}/sobjects/Lead/${leadId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({
      Description: buildDescription(data),
      Title: data.role || undefined,
      Phone: data.phone || undefined,
    }),
  });

  if (!updateRes.ok && updateRes.status !== 204) {
    const errBody = await updateRes.json().catch(() => ({}));
    throw new Error(`Salesforce update error: ${errBody[0]?.message || updateRes.status}`);
  }

  console.log(`[Salesforce] Lead updated: ${data.email}, id: ${leadId}`);
  return { contactId: leadId, updated: true };
}

/**
 * Log a disqualified prospect as a Lead with Unqualified status.
 */
async function logDisqualified(data) {
  if (!process.env.SALESFORCE_ACCESS_TOKEN || !INSTANCE_URL) return;

  if (!data.email) {
    console.log("[Salesforce] No email for disqualified lead — logging locally only");
    return;
  }

  const nameParts = (data.name || "Unknown").trim().split(/\s+/);

  const res = await fetch(`${baseUrl()}/sobjects/Lead`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      FirstName: nameParts[0],
      LastName: nameParts.slice(1).join(" ") || nameParts[0],
      Email: data.email,
      Company: "Unknown",
      Status: "Unqualified",
      Description: `Disqualified via AI agent. Reason: ${data.reason || "Not specified"}`,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error(`[Salesforce] Disqualify log failed: ${errBody[0]?.message || res.status}`);
  }
}

/**
 * Test Salesforce connectivity.
 */
async function testConnection() {
  if (!process.env.SALESFORCE_ACCESS_TOKEN || !INSTANCE_URL) {
    return { connected: false, reason: "No credentials configured" };
  }

  try {
    const res = await fetch(`${baseUrl()}/limits`, { headers: headers() });
    if (res.ok) return { connected: true };
    return { connected: false, reason: `HTTP ${res.status}` };
  } catch (err) {
    return { connected: false, reason: err.message };
  }
}

function buildDescription(data) {
  return Object.entries(data)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

module.exports = { createContact, logDisqualified, testConnection };
