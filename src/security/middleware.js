// src/security/middleware.js
// Centralized security middleware stack.

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");

/**
 * Chat endpoint rate limiter — prevents API abuse.
 * Allows 30 requests per minute per IP (adjustable via env).
 */
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_CHAT || "30", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment and try again." },
  keyGenerator: (req) => req.ip,
});

/**
 * Global rate limiter for all routes.
 */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_GLOBAL || "100", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests." },
});

/**
 * Apply all security middleware to the Express app.
 */
function applySecurityMiddleware(app) {
  // HTTP security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],   // inline scripts in index.html
        styleSrc: ["'self'", "'unsafe-inline'"],     // inline styles in index.html
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: getAllowedFrameAncestors(),
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // allow iframe embedding
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));

  // Prevent HTTP parameter pollution
  app.use(hpp());

  // Global rate limit
  app.use(globalLimiter);

  // Disable X-Powered-By (helmet does this, but be explicit)
  app.disable("x-powered-by");

  // Request size limit — 16KB is generous for chat messages
  app.use(require("express").json({ limit: "16kb" }));
}

/**
 * Parse ALLOWED_ORIGINS into frame-ancestors for CSP.
 */
function getAllowedFrameAncestors() {
  const origins = process.env.ALLOWED_ORIGINS;
  if (!origins || origins === "*") return ["'self'"];
  return ["'self'", ...origins.split(",").map(o => o.trim())];
}

module.exports = { applySecurityMiddleware, chatLimiter, globalLimiter };
