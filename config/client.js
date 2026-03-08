// config/client.js
//
// ─────────────────────────────────────────────────────────────
//  BLOK BLOK STUDIO — Onboarding Agent
//  This is the ONLY file you need to edit per client deployment.
//  The engine in src/ never changes.
// ─────────────────────────────────────────────────────────────

module.exports = {

  // ── Branding ──────────────────────────────────────────────
  brand: {
    name: "Your Company Name",
    tagline: "A short description shown in the chat header",
    // primaryColor: "#000000",  // optional — used in UI
  },

  // ── Agent Persona ─────────────────────────────────────────
  agent: {
    name: "Alex",                        // the agent's name
    role: "Onboarding Specialist",       // shown to users
    greeting: "Hi! I'm Alex, an onboarding assistant for [Company]. How can I help you today?",
  },

  // ── Qualification Rules ───────────────────────────────────
  // Define what the agent needs to confirm before proceeding.
  // Set to null to skip qualification entirely.
  qualification: {
    enabled: true,
    prompt: `
      Before proceeding, confirm the user meets the following criteria:
      - [FILL IN your qualification criteria here]
      If they do not qualify, call the log_disqualified tool.
    `,
    disqualifyMessage: "Thank you for your interest. Unfortunately, you don't meet our current eligibility criteria. We'll keep your info on file.",
  },

  // ── Intake Fields ─────────────────────────────────────────
  // Fields the agent should collect conversationally.
  // The agent will gather all of these before calling submit_lead.
  intake: {
    fields: [
      { key: "name",  label: "full name",    required: true  },
      { key: "email", label: "email address", required: true  },
      { key: "phone", label: "phone number",  required: false },
      // Add or remove fields as needed:
      // { key: "company",   label: "company name",   required: false },
      // { key: "use_case",  label: "use case",        required: true  },
      // { key: "timeline",  label: "timeline",        required: false },
      // { key: "budget",    label: "budget range",    required: false },
    ],
  },

  // ── FAQ / Knowledge Base ──────────────────────────────────
  // Plain text the agent can draw from when answering questions.
  // Write it like you're briefing a new employee.
  faq: `
    [FILL IN your FAQ content here]

    Example topics:
    - What does your company do?
    - What are your pricing / terms?
    - What is the onboarding process?
    - What should the user expect next?
    - Common objections and how to handle them
  `,

  // ── Tone & Constraints ────────────────────────────────────
  tone: `
    Be professional, warm, and concise.
    Keep replies to 2-4 sentences unless explaining something complex.
    Never make promises or guarantees not covered in the FAQ.
    If asked something outside your knowledge, use the escalate_to_human tool.
  `,

  // ── Post-Submission ───────────────────────────────────────
  // What the agent says after a lead is successfully submitted.
  successMessage: "Thank you! Your information has been received. Our team will be in touch with you shortly.",

  // ── Notifications ─────────────────────────────────────────
  notifications: {
    // Email address to notify when a lead is submitted or escalated
    notifyEmail: process.env.NOTIFICATION_EMAIL || null,
  },

  // ── Webhook ───────────────────────────────────────────────
  // Optional: fire a POST to this URL when a lead is submitted.
  // Use this to trigger a downstream agent (e.g. doc pre-fill).
  webhookUrl: process.env.DOWNSTREAM_WEBHOOK_URL || null,

};
