// src/agent/index.js
// Core agent engine. Never edit per client.

const Anthropic = require("@anthropic-ai/sdk");
const { buildSystemPrompt } = require("./prompts");
const { buildTools } = require("./tools");
const { submitLead, logDisqualified, escalateToHuman } = require("../crm");
const clientConfig = require("../../config/client");
const { isValidEmailFormat } = require("../utils/fetch");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const CLAUDE_TIMEOUT_MS = 60000; // 60s max per API call

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
    const { id: toolUseId, name: toolName, input: toolInput } = toolBlock;

    console.log(`[${sessionId}] Tool: ${toolName}`);

    let toolResult;
    let reply;
    let done = false;

    try {
      switch (toolName) {
        case "submit_lead": {
          // Validate required fields before CRM submit
          const validationError = validateLeadData(toolInput);
          if (validationError) {
            toolResult = { error: validationError };
            break;
          }

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
          break;
        }
        default: {
          toolResult = { error: `Unknown tool: ${toolName}` };
          break;
        }
      }
    } catch (err) {
      console.error(`[${sessionId}] Tool error (${toolName}):`, err.message);

      if (toolName === "submit_lead") {
        // Queue for background retry
        try {
          const { queueFailedSubmission } = require("../db/sessions");
          await queueFailedSubmission(sessionId, toolInput, err.message);
        } catch (queueErr) {
          console.error(`[${sessionId}] Failed to queue retry:`, queueErr.message);
        }

        toolResult = { error: "Submission failed. The team has been notified." };
        reply = "I'm sorry — there was a technical issue submitting your information. " +
          "Our team has been notified and will reach out to you directly. " +
          "I apologize for the inconvenience.";
        done = false;

        // Fire webhook even on failure
        fireFailureWebhook(toolInput, err.message);

        return { reply, toolCalled: toolName, done };
      }

      toolResult = { error: "Tool execution failed. Please try again." };
    }

    if (reply) {
      return { reply, toolCalled: toolName, done };
    }

    // For escalation, validation errors, and unknowns — let Claude respond
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
 * Validate lead data before submitting to CRM.
 * Returns error string if invalid, null if OK.
 */
function validateLeadData(data) {
  const requiredFields = (clientConfig.intake?.fields || [])
    .filter(f => f.required)
    .map(f => f.key);

  const missing = requiredFields.filter(key => !data[key] || String(data[key]).trim() === "");
  if (missing.length > 0) {
    return `Missing required fields: ${missing.join(", ")}. Please collect this information before submitting.`;
  }

  if (data.email && !isValidEmailFormat(data.email)) {
    return `Invalid email format: "${data.email}". Please ask for a valid email address.`;
  }

  return null;
}

/**
 * Fire webhook on CRM failure so downstream systems know.
 */
function fireFailureWebhook(leadData, errorMsg) {
  if (!clientConfig.webhookUrl) return;

  const { fetchWithTimeout } = require("../utils/fetch");
  const { signPayload } = require("../security/webhook");

  const body = JSON.stringify({
    event: "submission_failed",
    lead: leadData,
    error: errorMsg,
    ts: new Date().toISOString(),
  });

  const hdrs = { "Content-Type": "application/json" };
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    hdrs["X-Signature-256"] = `sha256=${signPayload(body, secret)}`;
  }

  fetchWithTimeout(clientConfig.webhookUrl, { method: "POST", headers: hdrs, body })
    .catch(err => console.error("[Webhook] Failure notification failed:", err.message));
}

/**
 * Call the Claude API with retry logic and timeout.
 */
async function callClaude(messages, sessionId, attempt = 0) {
  try {
    const apiCall = anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(),
      tools: buildTools(),
      messages,
    });

    const result = await Promise.race([
      apiCall,
      sleep(CLAUDE_TIMEOUT_MS).then(() => {
        throw new Error(`Claude API timed out after ${CLAUDE_TIMEOUT_MS / 1000}s`);
      }),
    ]);

    return result;
  } catch (err) {
    const status = err.status || err.statusCode;
    const isRetryable = status === 429 || status === 529 || (status && status >= 500);

    if (isRetryable && attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[${sessionId}] Claude API error (${status}), retrying in ${delay}ms...`);
      await sleep(delay);
      return callClaude(messages, sessionId, attempt + 1);
    }

    console.error(`[${sessionId}] Claude API failed after ${attempt + 1} attempts:`, err.message);
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
