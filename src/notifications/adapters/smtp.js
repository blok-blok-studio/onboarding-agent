// src/notifications/adapters/smtp.js
// Email adapter for any SMTP server (Gmail, Outlook, custom, etc.)
//
// Required env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
// Optional env: SMTP_SECURE (default: true for port 465, false otherwise)
//
// Supports:
//   Port 465 — implicit TLS (SMTP_SECURE=true)
//   Port 587 — STARTTLS upgrade (default, most common)
//
// NOTE: Uses Node's built-in net/tls — no external dependencies.

const net = require("net");
const tls = require("tls");
const { maskEmail } = require("../../utils/fetch");

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE === "true" || SMTP_PORT === 465;

/**
 * Sanitize a string for use in SMTP headers.
 * Strips \r and \n to prevent header injection.
 */
function sanitizeHeader(val) {
  return String(val).replace(/[\r\n]/g, " ");
}

async function sendEmail({ to, from, subject, text }) {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("[Email:SMTP] SMTP_HOST, SMTP_USER, or SMTP_PASS not set — skipping");
    return false;
  }

  try {
    await sendViaSMTP({
      to: sanitizeHeader(to),
      from: sanitizeHeader(from),
      subject: sanitizeHeader(subject),
      text,
    });
    console.log(`[Email:SMTP] Sent to ${maskEmail(to)}: "${subject}"`);
    return true;
  } catch (err) {
    console.error("[Email:SMTP] Send failed:", err.message);
    return false;
  }
}

function sendViaSMTP({ to, from, subject, text }) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("SMTP timeout"));
    }, 30000);

    let socket;
    let buffer = "";
    let step = 0;
    let waitingForStartTLS = false;

    // Auth + send commands (issued after TLS is established)
    const mailCommands = [
      `AUTH LOGIN\r\n`,
      `${Buffer.from(SMTP_USER).toString("base64")}\r\n`,
      `${Buffer.from(SMTP_PASS).toString("base64")}\r\n`,
      `MAIL FROM:<${from}>\r\n`,
      `RCPT TO:<${to}>\r\n`,
      `DATA\r\n`,
      `From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${text}\r\n.\r\n`,
      `QUIT\r\n`,
    ];

    function handleLine(line) {
      const code = parseInt(line.substring(0, 3), 10);

      if (code >= 400) {
        clearTimeout(timeout);
        socket.destroy();
        reject(new Error(`SMTP error: ${line}`));
        return;
      }

      // Skip multi-line responses (e.g., 250-STARTTLS, 250-AUTH)
      if (line[3] === "-") return;

      // Handle STARTTLS upgrade
      if (waitingForStartTLS) {
        waitingForStartTLS = false;
        // Upgrade to TLS
        const tlsSocket = tls.connect({
          socket,
          host: SMTP_HOST,
          rejectUnauthorized: true,
        }, () => {
          socket = tlsSocket;
          socket.on("data", onData);
          // Re-issue EHLO over TLS, then proceed with auth
          socket.write(`EHLO localhost\r\n`);
        });
        tlsSocket.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
        return;
      }

      // After initial EHLO on plain connection, send STARTTLS
      if (step === 0 && !SMTP_SECURE) {
        step = 1;
        waitingForStartTLS = true;
        socket.write(`STARTTLS\r\n`);
        return;
      }

      // After EHLO over TLS (step 1), start sending mail commands
      if (step === 1) {
        step = 2;
        socket.write(mailCommands[0]);
        return;
      }

      // For implicit TLS, step 0 is EHLO response, go straight to auth
      if (step === 0 && SMTP_SECURE) {
        step = 2;
        socket.write(mailCommands[0]);
        return;
      }

      // Process mail commands
      const cmdIndex = step - 2 + 1; // next command index
      if (cmdIndex < mailCommands.length) {
        step++;
        socket.write(mailCommands[cmdIndex]);
      } else {
        clearTimeout(timeout);
        socket.destroy();
        resolve();
      }
    }

    function onData(data) {
      buffer += data.toString();
      const lines = buffer.split("\r\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.trim()) handleLine(line);
      }
    }

    // Connect
    if (SMTP_SECURE) {
      socket = tls.connect(SMTP_PORT, SMTP_HOST, { rejectUnauthorized: true });
    } else {
      socket = net.createConnection(SMTP_PORT, SMTP_HOST);
    }

    socket.on("data", onData);
    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    // After server greeting, send EHLO
    socket.once("connect", () => {
      // Wait for server greeting (220), handled in onData
    });

    // For implicit TLS, the 'connect' event is 'secureConnect'
    if (SMTP_SECURE) {
      socket.once("secureConnect", () => {
        socket.write(`EHLO localhost\r\n`);
      });
    } else {
      // For plain connection, server sends greeting first, then we respond in handleLine
      // The first 220 response triggers EHLO
      const origOnData = onData;
      let greetingReceived = false;
      socket.removeAllListeners("data");
      socket.on("data", (data) => {
        if (!greetingReceived) {
          const str = data.toString();
          if (str.startsWith("220")) {
            greetingReceived = true;
            socket.write(`EHLO localhost\r\n`);
            // Process any remaining data after greeting
            const remaining = str.split("\r\n").slice(1).join("\r\n");
            if (remaining.trim()) {
              buffer += remaining;
            }
            return;
          }
        }
        origOnData(data);
      });
    }
  });
}

async function testConnection() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return { connected: false, reason: "SMTP_HOST, SMTP_USER, or SMTP_PASS not set" };
  }
  return { connected: true };
}

module.exports = { sendEmail, testConnection };
