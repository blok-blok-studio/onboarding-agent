// src/api/server.js

require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const path    = require("path");
const { v4: uuidv4 } = require("uuid");

const { chat }           = require("../agent");
const { initDb, getMessages, appendMessage, closeSession, getSession } = require("../db/sessions");
const clientConfig        = require("../../config/client");
const { applySecurityMiddleware, chatLimiter } = require("../security/middleware");
const { validateChatInput } = require("../security/validate");
const { validateEnv }     = require("../security/env");

// ── Validate environment before anything else ──────────────────
validateEnv();

const app = express();

// ── Security middleware ────────────────────────────────────────
applySecurityMiddleware(app);

// ── CORS ───────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map(o => o.trim());
app.use(cors({
  origin: allowedOrigins?.length ? allowedOrigins : false,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  maxAge: 86400,
}));

// ── JSON body parsing (size limit enforced by security middleware)
app.use(express.json({ limit: "16kb" }));

// ── Static files ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../ui")));

// ── Max conversation turns ─────────────────────────────────────
const MAX_TURNS = parseInt(process.env.MAX_CONVERSATION_TURNS || "50", 10);

// ── POST /api/chat ─────────────────────────────────────────────
app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    // Validate input
    const { valid, error, sanitized } = validateChatInput(req.body);
    if (!valid) {
      return res.status(400).json({ error });
    }

    const { message, sessionId: existingSessionId } = sanitized;
    const sessionId = existingSessionId || uuidv4();

    // Check if session is already closed
    if (existingSessionId) {
      const session = await getSession(existingSessionId);
      if (session && session.status !== "active") {
        return res.status(400).json({ error: "This conversation has ended." });
      }
    }

    // Get history and enforce conversation length limit
    const history = await getMessages(sessionId);
    if (history.length >= MAX_TURNS * 2) {
      return res.status(400).json({
        error: "Conversation limit reached. Please start a new session."
      });
    }

    const userMsg = { role: "user", content: message };
    await appendMessage(sessionId, userMsg);

    const { reply, toolCalled, done } = await chat([...history, userMsg], sessionId);

    await appendMessage(sessionId, { role: "assistant", content: reply });

    if (done) {
      const status = toolCalled === "submit_lead" ? "qualified" : "disqualified";
      await closeSession(sessionId, status);
    }

    res.json({ sessionId, reply, done });

  } catch (err) {
    console.error("[/api/chat]", err.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// ── GET /api/config ────────────────────────────────────────────
// Public branding info for the UI — no sensitive data exposed.
app.get("/api/config", (_req, res) => {
  res.json({
    brandName:    clientConfig.brand.name,
    brandTagline: clientConfig.brand.tagline || "",
    agentName:    clientConfig.agent.name,
    agentRole:    clientConfig.agent.role,
  });
});

// ── GET /api/health ────────────────────────────────────────────
// No sensitive info leaked — just status and timestamp.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// ── 404 handler ────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ── Global error handler ───────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[Server Error]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`[${clientConfig.brand.name}] Onboarding Agent on port ${PORT}`);
    if (process.env.NODE_ENV !== "production") {
      console.log(`[Dev] http://localhost:${PORT}`);
    }
  });
}).catch(err => {
  console.error("[DB] Init failed:", err.message);
  process.exit(1);
});
