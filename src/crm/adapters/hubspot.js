// src/crm/adapters/hubspot.js
// HubSpot implementation of the CRM adapter interface.
// All adapters must export: createContact(), logDisqualified()

const BASE = process.env.HUBSPOT_API_URL || "https://api.hubapi.com";

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`
  };
}

/**
 * Create or update a contact and log a note.
 * Throws on failure so the caller knows the CRM write failed.
 */
async function createContact(data) {
  if (!process.env.HUBSPOT_API_KEY) {
    console.warn("[HubSpot] No API key — skipping CRM write");
    return { skipped: true };
  }

  // Build properties from whatever fields were collected
  const properties = {
    hs_lead_status: "NEW",
    ...flattenForHubspot(data)
  };

  // Split name into first/last if present
  if (data.name) {
    const parts = data.name.trim().split(/\s+/);
    properties.firstname = parts[0];
    properties.lastname = parts.slice(1).join(" ") || "";
  }

  // Create contact
  const res = await fetch(`${BASE}/crm/v3/objects/contacts`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ properties })
  });

  const body = await res.json();

  if (!res.ok) {
    // If contact already exists (409 conflict), try to find and update
    if (res.status === 409 && data.email) {
      return await updateExistingContact(data);
    }
    const errMsg = body.message || JSON.stringify(body);
    console.error(`[HubSpot] Contact creation failed (${res.status}): ${errMsg}`);
    throw new Error(`HubSpot API error: ${errMsg}`);
  }

  const contactId = body.id;
  console.log(`[HubSpot] Contact created: ${data.email || "no email"}, id: ${contactId}`);

  // Log a note with intake data
  if (contactId) {
    await createNote(contactId, data);
  }

  return { contactId };
}

/**
 * Update an existing contact by email (for 409 conflict resolution).
 */
async function updateExistingContact(data) {
  const searchRes = await fetch(`${BASE}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      filterGroups: [{
        filters: [{
          propertyName: "email",
          operator: "EQ",
          value: data.email
        }]
      }]
    })
  });

  const searchBody = await searchRes.json();
  if (!searchRes.ok || !searchBody.results?.length) {
    console.error("[HubSpot] Could not find existing contact for update");
    throw new Error("Contact exists but could not be found for update");
  }

  const contactId = searchBody.results[0].id;
  const properties = flattenForHubspot(data);

  const updateRes = await fetch(`${BASE}/crm/v3/objects/contacts/${contactId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ properties })
  });

  if (!updateRes.ok) {
    const errBody = await updateRes.json();
    console.error(`[HubSpot] Contact update failed: ${errBody.message || JSON.stringify(errBody)}`);
    throw new Error(`HubSpot update error: ${errBody.message}`);
  }

  console.log(`[HubSpot] Contact updated: ${data.email}, id: ${contactId}`);
  await createNote(contactId, data);
  return { contactId, updated: true };
}

/**
 * Create a note associated with a contact.
 */
async function createNote(contactId, data) {
  const noteBody = Object.entries(data)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const res = await fetch(`${BASE}/crm/v3/objects/notes`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      properties: {
        hs_note_body: `Submitted via AI onboarding agent:\n\n${noteBody}`,
        hs_timestamp: Date.now()
      },
      associations: [{
        to: { id: contactId },
        types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }]
      }]
    })
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error(`[HubSpot] Note creation failed: ${errBody.message || res.status}`);
    // Don't throw — note failure shouldn't fail the whole submission
  }
}

/**
 * Log a disqualified prospect.
 */
async function logDisqualified(data) {
  if (!process.env.HUBSPOT_API_KEY) return;

  const properties = {
    hs_lead_status: "UNQUALIFIED",
    hs_content_membership_notes: `Disqualified via AI agent. Reason: ${data.reason || "Not specified"}`
  };

  if (data.email) properties.email = data.email;
  if (data.name) {
    const parts = data.name.trim().split(/\s+/);
    properties.firstname = parts[0];
    properties.lastname = parts.slice(1).join(" ") || "";
  }

  // Only create contact if we have an email
  if (!data.email) {
    console.log("[HubSpot] No email for disqualified lead — logging locally only");
    return;
  }

  const res = await fetch(`${BASE}/crm/v3/objects/contacts`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ properties })
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error(`[HubSpot] Disqualify log failed (${res.status}): ${errBody.message || "unknown"}`);
    // Don't throw — disqualification logging is best-effort
  }
}

/**
 * Map generic field keys to HubSpot property names.
 */
function flattenForHubspot(data) {
  const map = {
    email:      "email",
    phone:      "phone",
    company:    "company",
    role:       "jobtitle",
    challenge:  "hs_content_membership_notes",
    timeline:   "hs_buying_role",
    notes:      "description",
    how_found:  "hs_analytics_source",
  };

  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (value == null || value === "") continue;
    if (key === "name") continue; // handled separately (first/last split)
    const hsKey = map[key] || key;
    out[hsKey] = String(value);
  }
  return out;
}

/**
 * Test the HubSpot API connection. Used by health checks.
 */
async function testConnection() {
  if (!process.env.HUBSPOT_API_KEY) return { connected: false, reason: "No API key" };

  try {
    const res = await fetch(`${BASE}/crm/v3/objects/contacts?limit=1`, {
      headers: headers()
    });
    if (res.ok) return { connected: true };
    return { connected: false, reason: `HTTP ${res.status}` };
  } catch (err) {
    return { connected: false, reason: err.message };
  }
}

module.exports = { createContact, logDisqualified, testConnection };
