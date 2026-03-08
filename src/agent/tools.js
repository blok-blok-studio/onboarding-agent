// src/agent/tools.js
// Builds Claude tool definitions from config/client.js intake fields.
// Never edit per client — edit config/client.js instead.

const clientConfig = require("../../config/client");

function buildTools() {
  // Dynamically generate submit_lead schema from configured intake fields
  const intakeProperties = {};
  const requiredFields = [];

  clientConfig.intake.fields.forEach(field => {
    intakeProperties[field.key] = {
      type: "string",
      description: `The user's ${field.label}`
    };
    if (field.required) requiredFields.push(field.key);
  });

  // Always include a notes field
  intakeProperties.notes = {
    type: "string",
    description: "Any additional context from the conversation worth noting"
  };

  return [
    {
      name: "submit_lead",
      description: `Call this ONLY when all required intake fields have been confirmed${clientConfig.qualification?.enabled ? " and the user is qualified" : ""}. Required fields: ${requiredFields.join(", ")}.`,
      input_schema: {
        type: "object",
        properties: intakeProperties,
        required: requiredFields
      }
    },
    {
      name: "log_disqualified",
      description: "Call this when the user clearly does not meet the qualification criteria.",
      input_schema: {
        type: "object",
        properties: {
          name:   { type: "string", description: "User's name if provided" },
          email:  { type: "string", description: "User's email if provided" },
          reason: { type: "string", description: "Why they did not qualify" }
        },
        required: ["reason"]
      }
    },
    {
      name: "escalate_to_human",
      description: "Call this when the user asks something outside your knowledge base, or explicitly asks to speak to a person.",
      input_schema: {
        type: "object",
        properties: {
          name:     { type: "string", description: "User's name if known" },
          email:    { type: "string", description: "User's email if known" },
          question: { type: "string", description: "What the user wants to discuss with a human" }
        },
        required: ["question"]
      }
    }
  ];
}

module.exports = { buildTools };
