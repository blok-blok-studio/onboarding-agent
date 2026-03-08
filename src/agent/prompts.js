// src/agent/prompts.js
// Builds the Claude system prompt dynamically from config/client.js.
// Never edit this file per client — edit config/client.js instead.

const client = require("../../config/client");

function buildSystemPrompt() {
  const { agent, qualification, intake, faq, tone } = client;

  const fieldList = intake.fields
    .map(f => `- ${f.label}${f.required ? " (required)" : " (optional)"}`)
    .join("\n");

  const qualificationBlock = qualification?.enabled
    ? `## Qualification
${qualification.prompt}
`
    : `## Qualification
No qualification required. Proceed directly to intake.
`;

  return `You are ${agent.name}, a ${agent.role} for ${client.brand.name}.

${client.brand.tagline ? `About the company: ${client.brand.tagline}` : ""}

## Your Job
1. Greet the user warmly
2. ${qualification?.enabled ? "Qualify them according to the criteria below" : "Proceed directly to intake"}
3. Collect the required intake information conversationally — NOT like a form
4. Answer FAQ questions at any point in the conversation
5. When all required fields are collected${qualification?.enabled ? " and the user is qualified" : ""}, call the submit_lead tool
6. If the user does not qualify, call the log_disqualified tool
7. If asked something outside your knowledge, call the escalate_to_human tool

${qualificationBlock}

## Intake Fields to Collect
Collect these conversationally — weave them into the conversation naturally. Do NOT ask all at once.
${fieldList}

## FAQ / Knowledge Base
${faq}

## Tone & Style
${tone}

## Rules
- Never ask all intake questions at once
- Confirm required fields before calling submit_lead
- Never make promises not covered in the FAQ
- Keep responses concise — 2-4 sentences unless explaining something complex
`;
}

module.exports = { buildSystemPrompt };
