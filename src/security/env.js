// src/security/env.js
// Environment variable validation at startup.

const REQUIRED_VARS = [
  "ANTHROPIC_API_KEY",
];

const OPTIONAL_VARS = [
  // CRM
  "CRM_ADAPTER",
  "HUBSPOT_API_KEY",
  "HUBSPOT_API_URL",
  "SALESFORCE_INSTANCE_URL",
  "SALESFORCE_ACCESS_TOKEN",
  "SALESFORCE_API_VERSION",
  "PIPEDRIVE_API_TOKEN",
  "PIPEDRIVE_DOMAIN",
  "PIPEDRIVE_STAGE_ID",
  "ZOHO_ACCESS_TOKEN",
  "ZOHO_API_DOMAIN",
  "AIRTABLE_API_KEY",
  "AIRTABLE_BASE_ID",
  "AIRTABLE_TABLE",
  // Email adapter
  "EMAIL_ADAPTER",
  "RESEND_API_KEY",
  "SENDGRID_API_KEY",
  "MAILGUN_API_KEY",
  "MAILGUN_DOMAIN",
  "MAILGUN_REGION",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_SECURE",
  // Notifications
  "NOTIFICATION_EMAIL",
  "NOTIFICATION_FROM_EMAIL",
  "SLACK_NOTIFICATION_WEBHOOK",
  // Integrations
  "DOWNSTREAM_WEBHOOK_URL",
  "WEBHOOK_SECRET",
  // AI
  "CLAUDE_MODEL",
  // Database
  "DB_POOL_MAX",
  "SESSION_TTL_DAYS",
  // Server
  "PORT",
  "ALLOWED_ORIGINS",
  "RATE_LIMIT_CHAT",
  "RATE_LIMIT_GLOBAL",
  "MAX_CONVERSATION_TURNS",
  "NODE_ENV",
];

/**
 * Validate required environment variables exist and have values.
 * Throws if any are missing.
 */
function validateEnv() {
  const missing = REQUIRED_VARS.filter(key => !process.env[key]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
      `Copy .env.example to .env and fill in the values.`
    );
  }

  // Validate API key format (basic sanity check)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey.startsWith("sk-ant-")) {
    console.warn("[Security] ANTHROPIC_API_KEY does not match expected format (sk-ant-...)");
  }

  // Validate DATABASE_URL format (optional — in-memory store used when absent)
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    if (!dbUrl.startsWith("postgresql://") && !dbUrl.startsWith("postgres://")) {
      throw new Error("DATABASE_URL must be a valid PostgreSQL connection string");
    }
  } else {
    console.warn("[Security] DATABASE_URL not set — using in-memory session store (data lost on restart).");
  }

  // Warn about security-relevant missing optional vars
  if (!process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS === "*") {
    console.warn("[Security] ALLOWED_ORIGINS not set — CORS is open to all origins. Set this in production.");
  }

  if (!process.env.WEBHOOK_SECRET && process.env.DOWNSTREAM_WEBHOOK_URL) {
    console.warn("[Security] WEBHOOK_SECRET not set — downstream webhooks will not be signed. Set this for production.");
  }

  console.log("[Security] Environment validated");
}

module.exports = { validateEnv };
