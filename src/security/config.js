// src/security/config.js
// Validates client config at startup to catch misconfigurations early.

/**
 * Validate the client configuration object.
 * Throws if critical fields are missing or malformed.
 */
function validateConfig(config) {
  const errors = [];

  // Brand
  if (!config.brand?.name?.trim()) {
    errors.push("brand.name is required");
  }

  // Agent
  if (!config.agent?.name?.trim()) {
    errors.push("agent.name is required");
  }
  if (!config.agent?.role?.trim()) {
    errors.push("agent.role is required");
  }
  if (!config.agent?.greeting?.trim()) {
    errors.push("agent.greeting is required");
  }

  // Intake fields
  if (!Array.isArray(config.intake?.fields) || config.intake.fields.length === 0) {
    errors.push("intake.fields must be a non-empty array");
  } else {
    const keys = new Set();
    for (const field of config.intake.fields) {
      if (!field.key || !field.label) {
        errors.push(`intake field missing key or label: ${JSON.stringify(field)}`);
      }
      if (keys.has(field.key)) {
        errors.push(`duplicate intake field key: "${field.key}"`);
      }
      keys.add(field.key);
    }

    // Must have at least one required field
    const hasRequired = config.intake.fields.some(f => f.required);
    if (!hasRequired) {
      errors.push("intake.fields must have at least one required field");
    }
  }

  // Success message
  if (!config.successMessage?.trim()) {
    errors.push("successMessage is required");
  }

  // Primary color format (if provided)
  if (config.brand?.primaryColor && !/^#[0-9a-fA-F]{3,8}$/.test(config.brand.primaryColor)) {
    errors.push(`brand.primaryColor is not a valid hex color: "${config.brand.primaryColor}"`);
  }

  // Webhook URL format (if provided)
  if (config.webhookUrl && !/^https?:\/\/.+/.test(config.webhookUrl)) {
    errors.push(`webhookUrl is not a valid URL: "${config.webhookUrl}"`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid client configuration:\n  - ${errors.join("\n  - ")}\n` +
      `Check config/client.js and fix the issues above.`
    );
  }

  console.log("[Config] Client configuration validated");
}

module.exports = { validateConfig };
