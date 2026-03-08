// src/db/sessions.js
// Session storage — Postgres in production, in-memory for demos.
// Automatically falls back to in-memory when DATABASE_URL is not set.

const USE_MEMORY = !process.env.DATABASE_URL;

// ─────────────────────────────────────────────────────────────────
// In-memory store (for demos / Vercel without a DB)
// ─────────────────────────────────────────────────────────────────
const mem = {
  sessions: new Map(),   // id → { id, messages, status, created_at, updated_at }
  failures: [],          // { id, session_id, lead_data, error, attempts, next_retry, resolved_at }
  nextFailId: 1,
};

const memoryStore = {
  async initDb() { console.log("[DB] In-memory store ready (no DATABASE_URL)"); },
  async checkDb() { return true; },
  async closePool() {},

  async getSession(id) {
    const s = mem.sessions.get(id);
    return s ? { id: s.id, status: s.status, created_at: s.created_at, updated_at: s.updated_at } : null;
  },

  async getMessages(id) {
    return mem.sessions.get(id)?.messages || [];
  },

  async appendMessage(id, message) {
    if (!mem.sessions.has(id)) {
      mem.sessions.set(id, { id, messages: [], status: "active", created_at: new Date(), updated_at: new Date() });
    }
    const s = mem.sessions.get(id);
    s.messages.push(message);
    s.updated_at = new Date();
  },

  async closeSession(id, status = "complete") {
    const s = mem.sessions.get(id);
    if (s) { s.status = status; s.updated_at = new Date(); }
  },

  async cleanupOldSessions(ttlDays = 30) {
    const cutoff = Date.now() - ttlDays * 86400000;
    let count = 0;
    for (const [id, s] of mem.sessions) {
      if (s.updated_at.getTime() < cutoff) { mem.sessions.delete(id); count++; }
    }
    return count;
  },

  async queueFailedSubmission(sessionId, leadData, error) {
    mem.failures.push({
      id: mem.nextFailId++, session_id: sessionId,
      lead_data: leadData, error: String(error),
      attempts: 1, next_retry: new Date(Date.now() + 300000), resolved_at: null,
    });
  },

  async getPendingRetries(limit = 10) {
    const now = Date.now();
    return mem.failures
      .filter(f => !f.resolved_at && new Date(f.next_retry).getTime() <= now)
      .slice(0, limit);
  },

  async resolveSubmission(id) {
    const f = mem.failures.find(f => f.id === id);
    if (f) f.resolved_at = new Date();
  },

  async incrementRetryAttempt(id, attempts) {
    const f = mem.failures.find(f => f.id === id);
    if (!f) return;
    if (attempts >= 5) { f.resolved_at = new Date(); return; }
    f.attempts = attempts + 1;
    f.next_retry = new Date(Date.now() + Math.pow(2, attempts) * 5 * 60000);
  },
};

// ─────────────────────────────────────────────────────────────────
// Postgres store (production)
// ─────────────────────────────────────────────────────────────────
let pgStore;

if (!USE_MEMORY) {
  const { Pool } = require("pg");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DB_POOL_MAX || "10", 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: true }
      : undefined,
  });

  pgStore = {
    async initDb() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id         TEXT PRIMARY KEY,
          messages   JSONB NOT NULL DEFAULT '[]',
          status     TEXT NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);`).catch(() => {});
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);`).catch(() => {});

      await pool.query(`
        CREATE TABLE IF NOT EXISTS failed_submissions (
          id          SERIAL PRIMARY KEY,
          session_id  TEXT NOT NULL,
          lead_data   JSONB NOT NULL,
          error       TEXT,
          attempts    INT NOT NULL DEFAULT 1,
          next_retry  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes',
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          resolved_at TIMESTAMPTZ
        );
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_failed_submissions_retry
        ON failed_submissions(next_retry) WHERE resolved_at IS NULL;
      `).catch(() => {});

      console.log("[DB] Ready");
    },

    async checkDb() {
      try { await pool.query("SELECT 1"); return true; } catch { return false; }
    },

    async closePool() {
      await pool.end();
      console.log("[DB] Pool closed");
    },

    async getSession(sessionId) {
      const { rows } = await pool.query(
        "SELECT id, status, created_at, updated_at FROM sessions WHERE id = $1",
        [sessionId]
      );
      return rows[0] || null;
    },

    async getMessages(sessionId) {
      const { rows } = await pool.query(
        "SELECT messages FROM sessions WHERE id = $1",
        [sessionId]
      );
      return rows[0]?.messages || [];
    },

    async appendMessage(sessionId, message) {
      await pool.query(`
        INSERT INTO sessions (id, messages, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE
        SET messages  = sessions.messages || $2::jsonb,
            updated_at = NOW()
      `, [sessionId, JSON.stringify([message])]);
    },

    async closeSession(sessionId, status = "complete") {
      await pool.query(
        "UPDATE sessions SET status = $1, updated_at = NOW() WHERE id = $2",
        [status, sessionId]
      );
    },

    async cleanupOldSessions(ttlDays = 30) {
      const result = await pool.query(
        "DELETE FROM sessions WHERE updated_at < NOW() - INTERVAL '1 day' * $1",
        [ttlDays]
      );
      const count = result.rowCount;
      if (count > 0) console.log(`[Cleanup] Deleted ${count} sessions older than ${ttlDays} days`);
      return count;
    },

    async queueFailedSubmission(sessionId, leadData, error) {
      await pool.query(`
        INSERT INTO failed_submissions (session_id, lead_data, error)
        VALUES ($1, $2, $3)
      `, [sessionId, JSON.stringify(leadData), String(error)]);
      console.log(`[Queue] Failed submission queued for session ${sessionId}`);
    },

    async getPendingRetries(limit = 10) {
      const { rows } = await pool.query(`
        SELECT id, session_id, lead_data, attempts
        FROM failed_submissions
        WHERE resolved_at IS NULL AND next_retry <= NOW()
        ORDER BY next_retry ASC
        LIMIT $1
      `, [limit]);
      return rows;
    },

    async resolveSubmission(id) {
      await pool.query(
        "UPDATE failed_submissions SET resolved_at = NOW() WHERE id = $1",
        [id]
      );
    },

    async incrementRetryAttempt(id, attempts) {
      if (attempts >= 5) {
        await pool.query(
          "UPDATE failed_submissions SET resolved_at = NOW(), error = error || ' [GAVE UP after 5 attempts]' WHERE id = $1",
          [id]
        );
        return;
      }
      const backoffMinutes = Math.pow(2, attempts) * 5;
      await pool.query(`
        UPDATE failed_submissions
        SET attempts = $1, next_retry = NOW() + INTERVAL '1 minute' * $2
        WHERE id = $3
      `, [attempts + 1, backoffMinutes, id]);
    },
  };
}

// ── Export the active store ──────────────────────────────────────
const store = USE_MEMORY ? memoryStore : pgStore;

module.exports = {
  initDb: store.initDb,
  checkDb: store.checkDb,
  closePool: store.closePool,
  getSession: store.getSession,
  getMessages: store.getMessages,
  appendMessage: store.appendMessage,
  closeSession: store.closeSession,
  cleanupOldSessions: store.cleanupOldSessions,
  queueFailedSubmission: store.queueFailedSubmission,
  getPendingRetries: store.getPendingRetries,
  resolveSubmission: store.resolveSubmission,
  incrementRetryAttempt: store.incrementRetryAttempt,
};
