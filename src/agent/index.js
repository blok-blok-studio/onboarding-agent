// src/agent/index.js
// Core agent engine. Never edit per client.

const Anthropic = require("@anthropic-ai/sdk");
const { buildSystemPrompt } = require("./prompts");
const { buildTools } = require("./tools");
const { submitLead, logDisqualified, escalateToHuman } = require("../crm");
const clientConfig = require("../../config/client");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Send a message and get a response.
 * Handles tool calls with proper Claude API tool_result flow.
 * Retries on transient API errors.
 *
 * @param {Array}  messages  - Full conversation history [{role, content}]
 * @param {string} sessionId - For logging
 * @returns {{ reply: string, toolCalled: string|null, done: boolean }}
 */
async function chat(messages, sessionId) {
  const response = await callClaude(messages, sessionId);

  // ── Tool use ───────────────────────────────────────────────
  if (response.stop_reason === "tool_use") {
    const toolBlock = response.content.find(b => b.type === "tool_use");
    const textBlock = response.content.find(b => b.type === "text");
    const { id: toolUseId, name: toolName, input: toolInput } = toolBlock;

    console.log(`[${sessionId}] Tool: ${toolName}`, JSON.stringify(toolInput));

    let toolResult;
    let reply;
    let done = false;

    try {
      switch (toolName) {
        case "submit_lead": {
          const result = await submitLead(toolInput);
          toolResult = { success: true, contactId: result.contactId || null };
          reply = clientConfig.successMessage;
          done = true;
          break;
        }
        case "log_disqualified": {
          await logDisqualified(toolInput);
          toolResult = { success: true, logged: true };
          reply = clientConfig.qualification?.disqualifyMessage ||
            "Thank you for your interest. Unfortunately you don't meet our current criteria.";
          done = true;
          break;
        }
        case "escalate_to_human": {
          await escalateToHuman(toolInput);
          toolResult = { success: true, escalated: true };
          // Let Claude compose the escalation reply naturally
          break;
        }
        default: {
          toolResult = { error: `Unknown tool: ${toolName}` };
          break;
        }
      }
    } catch (err) {
      console.error(`[${sessionId}] Tool error (${toolName}):`, err.message);
      toolResult = { error: "Tool execution failed. Please try again." };
    }

    // If the tool already has a fixed reply (submit/disqualify), return it directly
    if (reply) {
      return { reply, toolCalled: toolName, done };
    }

    // For escalation and errors, send the tool result back to Claude
    // so it can compose a natural response
    const continuedMessages = [
      ...messages,
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: toolUseId,
          content: JSON.stringify(toolResult),
        }],
      },
    ];

    const followUp = await callClaude(continuedMessages, sessionId);
    reply = extractText(followUp);

    return { reply, toolCalled: toolName, done };
  }

  // ── Normal text response ───────────────────────────────────
  const reply = extractText(response);

  if (!reply) {
    return {
      reply: "I'm sorry, I didn't catch that. Could you try again?",
      toolCalled: null,
      done: false,
    };
  }

  return { reply, toolCalled: null, done: false };
}

/**
 * Call the Claude API with retry logic for transient errors.
 */
async function callClaude(messages, sessionId, attempt = 0) {
  try {
    return await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: buildSystemPrompt(),
      tools: buildTools(),
      messages,
    });
  } catch (err) {
    const isRetryable = err.status === 429 || err.status === 529 || err.status >= 500;

    if (isRetryable && attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[${sessionId}] API error (${err.status}), retrying in ${delay}ms...`);
      await sleep(delay);
      return callClaude(messages, sessionId, attempt + 1);
    }

    throw err;
  }
}

/**
 * Extract text content from a Claude response.
 */
function extractText(response) {
  return response.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("\n")
    .trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { chat };
