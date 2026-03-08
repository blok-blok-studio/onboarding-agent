// src/notifications/adapters/smtp.js
// Email adapter for any SMTP server (Gmail, Outlook, custom, etc.)
//
// Required env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
// Optional env: SMTP_SECURE (default: true for port 465, false otherwise)
//
// NOTE: Uses Node's built-in net/tls — no external dependencies.
// For production, consider using a dedicated provider adapter instead.

const net = require("net");
const tls = require("tls");
const { maskEmail } = require("../../utils/fetch");

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE === "true" || SMTP_PORT === 465;

async function sendEmail({ to, from, subject, text }) {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("[Email:SMTP] SMTP_HOST, SMTP_USER, or SMTP_PASS not set — skipping");
    return false;
  }

  try {
    await sendViaSMTP({ to, from, subject, text });
    console.log(`[Email:SMTP] Sent to ${maskEmail(to)}: "${subject}"`);
    return true;
  } catch (err) {
    console.error("[Email:SMTP] Send failed:", err.message);
    return false;
  }
}

function sendViaSMTP({ to, from, subject, text }) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("SMTP timeout")), 30000);

    function connect() {
      if (SMTP_SECURE) {
        return tls.connect(SMTP_PORT, SMTP_HOST, { rejectUnauthorized: true });
      }
      return net.createConnection(SMTP_PORT, SMTP_HOST);
    }

    const socket = connect();
    let buffer = "";
    let step = 0;

    const commands = [
      `EHLO localhost\r\n`,
      `AUTH LOGIN\r\n`,
      `${Buffer.from(SMTP_USER).toString("base64")}\r\n`,
      `${Buffer.from(SMTP_PASS).toString("base64")}\r\n`,
      `MAIL FROM:<${from}>\r\n`,
      `RCPT TO:<${to}>\r\n`,
      `DATA\r\n`,
      `From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${text}\r\n.\r\n`,
      `QUIT\r\n`,
    ];

    socket.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\r\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const code = parseInt(line.substring(0, 3), 10);
        if (code >= 400) {
          clearTimeout(timeout);
          socket.destroy();
          reject(new Error(`SMTP error: ${line}`));
          return;
        }

        // Multi-line responses (e.g., 250-STARTTLS)
        if (line[3] === "-") continue;

        if (step < commands.length) {
          socket.write(commands[step]);
          step++;
        } else {
          clearTimeout(timeout);
          socket.destroy();
          resolve();
        }
      }
    });

    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function testConnection() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return { connected: false, reason: "SMTP_HOST, SMTP_USER, or SMTP_PASS not set" };
  }
  return { connected: true };
}

module.exports = { sendEmail, testConnection };
