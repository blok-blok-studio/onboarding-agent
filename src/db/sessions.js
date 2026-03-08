// src/db/sessions.js
// Session storage with Postgres — parameterized queries throughout.

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

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      messages   JSONB NOT NULL DEFAULT '[]',
      status     TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
  `).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);
  `).catch(() => {});

  // Failed submissions queue — retries CRM writes that failed
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
}

/**
 * Check database connectivity. Returns true if healthy.
 */
async function checkDb() {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

/**
 * Close the connection pool. Call on shutdown.
 */
async function closePool() {
  await pool.end();
  console.log("[DB] Pool closed");
}

async function getSession(sessionId) {
  const { rows } = await pool.query(
    "SELECT id, status, created_at, updated_at FROM sessions WHERE id = $1",
    [sessionId]
  );
  return rows[0] || null;
}

async function getMessages(sessionId) {
  const { rows } = await pool.query(
    "SELECT messages FROM sessions WHERE id = $1",
    [sessionId]
  );
  return rows[0]?.messages || [];
}

async function appendMessage(sessionId, message) {
  await pool.query(`
    INSERT INTO sessions (id, messages, updated_at)
    VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE
    SET messages  = sessions.messages || $2::jsonb,
        updated_at = NOW()
  `, [sessionId, JSON.stringify([message])]);
}

async function closeSession(sessionId, status = "complete") {
  await pool.query(
    "UPDATE sessions SET status = $1, updated_at = NOW() WHERE id = $2",
    [status, sessionId]
  );
}

/**
 * Delete sessions older than the given number of days.
 * Returns the number of deleted rows.
 */
async function cleanupOldSessions(ttlDays = 30) {
  const result = await pool.query(
    "DELETE FROM sessions WHERE updated_at < NOW() - INTERVAL '1 day' * $1",
    [ttlDays]
  );
  const count = result.rowCount;
  if (count > 0) {
    console.log(`[Cleanup] Deleted ${count} sessions older than ${ttlDays} days`);
  }
  return count;
}

// ── Failed submissions queue ─────────────────────────────────

/**
 * Queue a failed CRM submission for retry.
 */
async function queueFailedSubmission(sessionId, leadData, error) {
  await pool.query(`
    INSERT INTO failed_submissions (session_id, lead_data, error)
    VALUES ($1, $2, $3)
  `, [sessionId, JSON.stringify(leadData), String(error)]);
  console.log(`[Queue] Failed submission queued for session ${sessionId}`);
}

/**
 * Get pending failed submissions ready for retry.
 */
async function getPendingRetries(limit = 10) {
  const { rows } = await pool.query(`
    SELECT id, session_id, lead_data, attempts
    FROM failed_submissions
    WHERE resolved_at IS NULL AND next_retry <= NOW()
    ORDER BY next_retry ASC
    LIMIT $1
  `, [limit]);
  return rows;
}

/**
 * Mark a failed submission as resolved (successfully retried).
 */
async function resolveSubmission(id) {
  await pool.query(
    "UPDATE failed_submissions SET resolved_at = NOW() WHERE id = $1",
    [id]
  );
}

/**
 * Increment attempt counter and set next retry with exponential backoff.
 * Gives up after 5 attempts.
 */
async function incrementRetryAttempt(id, attempts) {
  if (attempts >= 5) {
    await pool.query(
      "UPDATE failed_submissions SET resolved_at = NOW(), error = error || ' [GAVE UP after 5 attempts]' WHERE id = $1",
      [id]
    );
    return;
  }

  const backoffMinutes = Math.pow(2, attempts) * 5; // 10, 20, 40, 80 min
  await pool.query(`
    UPDATE failed_submissions
    SET attempts = $1, next_retry = NOW() + INTERVAL '1 minute' * $2
    WHERE id = $3
  `, [attempts + 1, backoffMinutes, id]);
}

module.exports = {
  initDb, checkDb, closePool,
  getSession, getMessages, appendMessage, closeSession, cleanupOldSessions,
  queueFailedSubmission, getPendingRetries, resolveSubmission, incrementRetryAttempt,
};
