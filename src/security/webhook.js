// src/security/webhook.js
// HMAC signing for downstream webhook calls.

const crypto = require("crypto");

/**
 * Generate an HMAC-SHA256 signature for a payload.
 * @param {string} payload - JSON string body
 * @param {string} secret  - Shared secret
 * @returns {string} hex signature
 */
function signPayload(payload, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");
}

/**
 * Verify an HMAC-SHA256 signature using timing-safe comparison.
 * @param {string} payload   - JSON string body
 * @param {string} signature - Received signature
 * @param {string} secret    - Shared secret
 * @returns {boolean}
 */
function verifySignature(payload, signature, secret) {
  const expected = signPayload(payload, secret);
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex")
  );
}

module.exports = { signPayload, verifySignature };
