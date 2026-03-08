// src/db/sessions.js
// Session storage with Postgres — parameterized queries throughout.

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
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

  console.log("[DB] Ready");
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

module.exports = { initDb, getSession, getMessages, appendMessage, closeSession };
