// src/utils/fetch.js
// Shared fetch wrapper with timeout for all external API calls.

const DEFAULT_TIMEOUT_MS = 15000; // 15 seconds

/**
 * fetch() with an AbortController timeout.
 * Prevents hanging requests from blocking the agent.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} timeoutMs — default 15s
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Mask an email for safe logging: "user@example.com" → "u***@e***.com"
 */
function maskEmail(email) {
  if (!email || typeof email !== "string") return "[no email]";
  const parts = email.split("@");
  if (parts.length !== 2) return "[invalid]";
  const [local, domain] = parts;
  const domParts = domain.split(".");
  const tld = domParts.pop();
  return `${local[0]}***@${domParts[0]?.[0] || ""}***.${tld}`;
}

/**
 * Basic email format validation.
 */
function isValidEmailFormat(email) {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

module.exports = { fetchWithTimeout, maskEmail, isValidEmailFormat };
