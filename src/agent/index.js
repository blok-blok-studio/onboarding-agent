// src/agent/index.js
// Core agent engine. Never edit per client.

const Anthropic = require("@anthropic-ai/sdk");
const { buildSystemPrompt } = require("./prompts");
const { buildTools } = require("./tools");
const { submitLead, logDisqualified, escalateToHuman } = require("../crm");
const clientConfig = require("../../config/client");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Send a message and get a response.
 * Handles tool calls automatically.
 *
 * @param {Array}  messages  - Full conversation history [{role, content}]
 * @param {string} sessionId - For logging
 * @returns {{ reply: string, toolCalled: string|null, done: boolean }}
 */
async function chat(messages, sessionId) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: buildSystemPrompt(),
    tools: buildTools(),
    messages
  });

  // ── Tool use ───────────────────────────────────────────────
  if (response.stop_reason === "tool_use") {
    const toolBlock = response.content.find(b => b.type === "tool_use");
    const { name: toolName, input: toolInput } = toolBlock;

    console.log(`[${sessionId}] Tool: ${toolName}`, toolInput);

    let reply;

    switch (toolName) {
      case "submit_lead": {
        await submitLead(toolInput);
        reply = clientConfig.successMessage;
        break;
      }
      case "log_disqualified": {
        await logDisqualified(toolInput);
        reply = clientConfig.qualification?.disqualifyMessage ||
          "Thank you for your interest. Unfortunately you don't meet our current criteria.";
        break;
      }
      case "escalate_to_human": {
        await escalateToHuman(toolInput);
        reply = `Great question — I want to make sure you get an accurate answer. I've flagged this for our team and someone will follow up with you${toolInput.email ? ` at ${toolInput.email}` : ""} shortly.`;
        break;
      }
      default:
        reply = "Something went wrong. Please try again.";
    }

    const done = ["submit_lead", "log_disqualified"].includes(toolName);
    return { reply, toolCalled: toolName, done };
  }

  // ── Normal text response ───────────────────────────────────
  const reply = response.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("\n");

  return { reply, toolCalled: null, done: false };
}

module.exports = { chat };
