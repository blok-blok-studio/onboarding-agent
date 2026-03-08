// src/crm/adapters/zoho.js
// Zoho CRM adapter.
//
// Required env vars:
//   ZOHO_ACCESS_TOKEN  — OAuth2 access token
//   ZOHO_API_DOMAIN    — API domain (default: https://www.zohoapis.com)
//
// Docs: https://www.zoho.com/crm/developer/docs/api/v5/

const API_DOMAIN = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Zoho-oauthtoken ${process.env.ZOHO_ACCESS_TOKEN}`,
  };
}

/**
 * Create a Lead in Zoho CRM.
 */
async function createContact(data) {
  if (!process.env.ZOHO_ACCESS_TOKEN) {
    console.warn("[Zoho] No access token — skipping CRM write");
    return { skipped: true };
  }

  const nameParts = (data.name || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || firstName || "Unknown";

  const lead = {
    First_Name: firstName,
    Last_Name: lastName,
    Email: data.email || undefined,
    Phone: data.phone || undefined,
    Company: data.company || "Unknown",
    Designation: data.role || undefined,
    Description: buildDescription(data),
    Lead_Source: data.how_found || "AI Onboarding Agent",
    Lead_Status: "New",
  };

  // Remove undefined fields
  for (const key of Object.keys(lead)) {
    if (lead[key] === undefined) delete lead[key];
  }

  const res = await fetch(`${API_DOMAIN}/crm/v5/Leads`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ data: [lead] }),
  });

  const body = await res.json();

  if (!res.ok) {
    const errMsg = body.message || body.data?.[0]?.message || JSON.stringify(body);
    console.error(`[Zoho] Lead creation failed (${res.status}): ${errMsg}`);

    // Duplicate check
    if (body.data?.[0]?.code === "DUPLICATE_DATA" && data.email) {
      return await updateExistingLead(data);
    }

    throw new Error(`Zoho API error: ${errMsg}`);
  }

  const leadId = body.data?.[0]?.details?.id;
  console.log(`[Zoho] Lead created: ${data.email || "no email"}, id: ${leadId}`);

  // Add a note
  if (leadId) {
    await createNote(leadId, data);
  }

  return { contactId: leadId };
}

/**
 * Update existing lead found by email.
 */
async function updateExistingLead(data) {
  const searchRes = await fetch(
    `${API_DOMAIN}/crm/v5/Leads/search?email=${encodeURIComponent(data.email)}`,
    { headers: headers() }
  );

  const searchBody = await searchRes.json();
  if (!searchRes.ok || !searchBody.data?.length) {
    throw new Error("Lead exists but could not be found for update");
  }

  const leadId = searchBody.data[0].id;

  const updateRes = await fetch(`${API_DOMAIN}/crm/v5/Leads/${leadId}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({
      data: [{ Description: buildDescription(data) }],
    }),
  });

  if (!updateRes.ok) {
    const errBody = await updateRes.json().catch(() => ({}));
    throw new Error(`Zoho update error: ${errBody.message || updateRes.status}`);
  }

  console.log(`[Zoho] Lead updated: ${data.email}, id: ${leadId}`);
  await createNote(leadId, data);
  return { contactId: leadId, updated: true };
}

/**
 * Add a note to a lead.
 */
async function createNote(leadId, data) {
  const noteContent = Object.entries(data)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const res = await fetch(`${API_DOMAIN}/crm/v5/Notes`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      data: [{
        Note_Title: "AI Onboarding Agent Submission",
        Note_Content: `Submitted via AI onboarding agent:\n\n${noteContent}`,
        Parent_Id: leadId,
        se_module: "Leads",
      }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error(`[Zoho] Note creation failed: ${errBody.message || res.status}`);
  }
}

/**
 * Log a disqualified prospect.
 */
async function logDisqualified(data) {
  if (!process.env.ZOHO_ACCESS_TOKEN) return;

  if (!data.email) {
    console.log("[Zoho] No email for disqualified lead — logging locally only");
    return;
  }

  const nameParts = (data.name || "Unknown").trim().split(/\s+/);

  const res = await fetch(`${API_DOMAIN}/crm/v5/Leads`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      data: [{
        First_Name: nameParts[0],
        Last_Name: nameParts.slice(1).join(" ") || nameParts[0],
        Email: data.email,
        Company: "Unknown",
        Lead_Status: "Unqualified",
        Description: `Disqualified via AI agent. Reason: ${data.reason || "Not specified"}`,
      }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error(`[Zoho] Disqualify log failed: ${errBody.message || res.status}`);
  }
}

/**
 * Test Zoho CRM connectivity.
 */
async function testConnection() {
  if (!process.env.ZOHO_ACCESS_TOKEN) {
    return { connected: false, reason: "No access token configured" };
  }

  try {
    const res = await fetch(`${API_DOMAIN}/crm/v5/org`, { headers: headers() });
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
