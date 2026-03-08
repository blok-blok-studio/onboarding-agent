// src/crm/adapters/hubspot.js
// HubSpot implementation of the CRM adapter interface.
// All adapters must export: createContact(), logDisqualified()

const BASE = "https://api.hubapi.com";

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`
  };
}

/**
 * Create or update a contact and log a note.
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

  const res = await fetch(`${BASE}/crm/v3/objects/contacts`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ properties })
  });

  const contact = await res.json();
  const contactId = contact.id;

  // Log a note
  if (contactId) {
    const noteBody = Object.entries(data)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    await fetch(`${BASE}/crm/v3/objects/notes`, {
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
    }).catch(err => console.error("[HubSpot] Note error:", err.message));
  }

  console.log(`[HubSpot] Contact created: ${data.email}, id: ${contactId}`);
  return { contactId };
}

/**
 * Log a disqualified prospect.
 */
async function logDisqualified(data) {
  if (!process.env.HUBSPOT_API_KEY || !data.email) return;

  await fetch(`${BASE}/crm/v3/objects/contacts`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      properties: {
        email: data.email,
        firstname: data.name || "Unknown",
        hs_lead_status: "UNQUALIFIED",
        hs_content_membership_notes: `Disqualified. Reason: ${data.reason}`
      }
    })
  }).catch(err => console.error("[HubSpot] Disqualify error:", err.message));
}

/**
 * Map generic field keys to HubSpot property names.
 * Extend this map as you add custom properties in HubSpot.
 */
function flattenForHubspot(data) {
  const map = {
    email:      "email",
    phone:      "phone",
    company:    "company",
    timeline:   "hs_buying_role",   // closest built-in
    notes:      "hs_content_membership_notes"
  };

  const out = {};
  for (const [key, value] of Object.entries(data)) {
    const hsKey = map[key] || key;   // fallback: use key as-is (custom property)
    out[hsKey] = value;
  }
  return out;
}

module.exports = { createContact, logDisqualified };
