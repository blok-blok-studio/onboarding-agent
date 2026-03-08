// src/security/validate.js
// Input validation and sanitization utilities.

const validator = require("validator");

const MAX_MESSAGE_LENGTH = 2000;
const MAX_SESSION_ID_LENGTH = 64;
const SESSION_ID_PATTERN = /^[a-f0-9-]{36}$/; // UUID v4 format

/**
 * Validate and sanitize incoming chat request body.
 * Returns { valid, error, sanitized } where sanitized contains clean data.
 */
function validateChatInput(body) {
  const { message, sessionId } = body || {};

  // Message is required and must be a non-empty string
  if (!message || typeof message !== "string") {
    return { valid: false, error: "message is required and must be a string" };
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "message cannot be empty" };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `message cannot exceed ${MAX_MESSAGE_LENGTH} characters` };
  }

  // Sanitize — strip control characters but preserve normal whitespace
  const sanitizedMessage = stripControlChars(trimmed);

  // Validate sessionId if provided
  if (sessionId !== undefined && sessionId !== null) {
    if (typeof sessionId !== "string") {
      return { valid: false, error: "sessionId must be a string" };
    }
    if (sessionId.length > MAX_SESSION_ID_LENGTH) {
      return { valid: false, error: "invalid sessionId" };
    }
    if (!SESSION_ID_PATTERN.test(sessionId)) {
      return { valid: false, error: "invalid sessionId format" };
    }
  }

  return {
    valid: true,
    sanitized: {
      message: sanitizedMessage,
      sessionId: sessionId || null,
    },
  };
}

/**
 * Validate email format.
 */
function isValidEmail(email) {
  return typeof email === "string" && validator.isEmail(email);
}

/**
 * Validate URL format.
 */
function isValidUrl(url) {
  return typeof url === "string" && validator.isURL(url, {
    protocols: ["http", "https"],
    require_protocol: true,
  });
}

/**
 * Strip control characters (except newline, tab) from input.
 */
function stripControlChars(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

module.exports = { validateChatInput, isValidEmail, isValidUrl, stripControlChars };
