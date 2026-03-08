// src/crm/adapters/airtable.js
// Airtable adapter — great for teams who use Airtable as a lightweight CRM.
//
// Required env vars:
//   AIRTABLE_API_KEY   — Personal access token (pat_...)
//   AIRTABLE_BASE_ID   — Base ID (starts with "app")
//   AIRTABLE_TABLE     — Table name (default: "Leads")
//
// Docs: https://airtable.com/developers/web/api/introduction

const { fetchWithTimeout, maskEmail } = require("../../utils/fetch");

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE = process.env.AIRTABLE_TABLE || "Leads";

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
  };
}

function baseUrl() {
  return `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`;
}

/**
 * Create a record in Airtable.
 *
 * Default field mapping assumes columns: Name, Email, Phone, Company,
 * Role, Challenge, Timeline, Budget, How Found, Status, Notes.
 * Customize the fieldMap below to match your table columns.
 */
async function createContact(data) {
  if (!process.env.AIRTABLE_API_KEY || !BASE_ID) {
    console.warn("[Airtable] No credentials — skipping CRM write");
    return { skipped: true };
  }

  // Map agent field keys → Airtable column names.
  // Edit this to match YOUR Airtable table columns.
  const fieldMap = {
    name:       "Name",
    email:      "Email",
    phone:      "Phone",
    company:    "Company",
    role:       "Role",
    challenge:  "Challenge",
    timeline:   "Timeline",
    budget:     "Budget",
    how_found:  "How Found",
  };

  const fields = { Status: "New" };
  for (const [key, value] of Object.entries(data)) {
    if (value == null || value === "") continue;
    const col = fieldMap[key] || key;
    fields[col] = String(value);
  }

  const res = await fetchWithTimeout(baseUrl(), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ records: [{ fields }] }),
  });

  const body = await res.json();

  if (!res.ok) {
    const errMsg = body.error?.message || JSON.stringify(body);
    console.error(`[Airtable] Record creation failed (${res.status}): ${errMsg}`);
    throw new Error(`Airtable API error: ${errMsg}`);
  }

  const recordId = body.records?.[0]?.id;
  console.log(`[Airtable] Record created: ${maskEmail(data.email)}, id: ${recordId}`);
  return { contactId: recordId };
}

/**
 * Log a disqualified prospect.
 */
async function logDisqualified(data) {
  if (!process.env.AIRTABLE_API_KEY || !BASE_ID) return;

  const fields = {
    Status: "Disqualified",
    Notes: `Disqualified via AI agent. Reason: ${data.reason || "Not specified"}`,
  };

  if (data.name) fields.Name = data.name;
  if (data.email) fields.Email = data.email;

  const res = await fetchWithTimeout(baseUrl(), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ records: [{ fields }] }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error(`[Airtable] Disqualify log failed: ${errBody.error?.message || res.status}`);
  }
}

/**
 * Test Airtable connectivity.
 */
async function testConnection() {
  if (!process.env.AIRTABLE_API_KEY || !BASE_ID) {
    return { connected: false, reason: "No credentials configured" };
  }

  try {
    const res = await fetchWithTimeout(`${baseUrl()}?maxRecords=1`, { headers: headers() }, 10000);
    if (res.ok) return { connected: true };
    return { connected: false, reason: `HTTP ${res.status}` };
  } catch (err) {
    return { connected: false, reason: err.message };
  }
}

module.exports = { createContact, logDisqualified, testConnection };
