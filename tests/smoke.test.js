// tests/smoke.test.js
// Basic smoke tests — validates config, env, and module loading.
// Run with: npm test

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("Config", () => {
  it("loads config/client.js without errors", () => {
    const config = require("../config/client");
    assert.ok(config.brand, "brand section missing");
    assert.ok(config.brand.name, "brand.name missing");
    assert.ok(config.agent, "agent section missing");
    assert.ok(config.agent.name, "agent.name missing");
    assert.ok(config.agent.greeting, "agent.greeting missing");
  });

  it("has required intake fields", () => {
    const config = require("../config/client");
    assert.ok(config.intake, "intake section missing");
    assert.ok(Array.isArray(config.intake.fields), "intake.fields must be an array");
    assert.ok(config.intake.fields.length > 0, "intake.fields must have at least one field");

    for (const field of config.intake.fields) {
      assert.ok(field.key, "each field must have a key");
      assert.ok(field.label, "each field must have a label");
    }
  });
});

describe("Security", () => {
  it("loads env validation module", () => {
    const { validateEnv } = require("../src/security/env");
    assert.ok(typeof validateEnv === "function");
  });

  it("loads input validation module", () => {
    const { validateChatInput } = require("../src/security/validate");
    assert.ok(typeof validateChatInput === "function");
  });

  it("rejects empty message", () => {
    const { validateChatInput } = require("../src/security/validate");
    const result = validateChatInput({ message: "" });
    assert.strictEqual(result.valid, false);
  });

  it("rejects missing message", () => {
    const { validateChatInput } = require("../src/security/validate");
    const result = validateChatInput({});
    assert.strictEqual(result.valid, false);
  });

  it("accepts valid message", () => {
    const { validateChatInput } = require("../src/security/validate");
    const result = validateChatInput({ message: "Hello, I need help" });
    assert.strictEqual(result.valid, true);
    assert.ok(result.sanitized.message);
  });
});

describe("CRM", () => {
  it("loads CRM adapter without errors", () => {
    const crm = require("../src/crm");
    assert.ok(typeof crm.submitLead === "function");
    assert.ok(typeof crm.logDisqualified === "function");
    assert.ok(typeof crm.escalateToHuman === "function");
  });
});

describe("Email", () => {
  it("loads email module without errors", () => {
    const email = require("../src/notifications/email");
    assert.ok(typeof email.sendEmail === "function");
    assert.ok(typeof email.sendLeadEmails === "function");
    assert.ok(typeof email.renderTemplate === "function");
  });

  it("renders templates correctly", () => {
    const { renderTemplate } = require("../src/notifications/email");

    const result = renderTemplate("Hello {{name}}, welcome to {{company}}!", {
      name: "Jane",
      company: "Acme",
    });
    assert.strictEqual(result, "Hello Jane, welcome to Acme!");
  });

  it("handles conditional blocks in templates", () => {
    const { renderTemplate } = require("../src/notifications/email");

    const template = "Hi {{name}}{{#if phone}}, call us at {{phone}}{{/if}}.";

    const withPhone = renderTemplate(template, { name: "Jane", phone: "555-0123" });
    assert.ok(withPhone.includes("555-0123"));

    const withoutPhone = renderTemplate(template, { name: "Jane" });
    assert.ok(!withoutPhone.includes("call us at"));
  });
});

describe("Agent", () => {
  it("loads prompts module", () => {
    const { buildSystemPrompt } = require("../src/agent/prompts");
    assert.ok(typeof buildSystemPrompt === "function");
  });

  it("loads tools module", () => {
    const { buildTools } = require("../src/agent/tools");
    assert.ok(typeof buildTools === "function");
  });

  it("builds tools from config", () => {
    const { buildTools } = require("../src/agent/tools");
    const tools = buildTools();
    assert.ok(Array.isArray(tools));
    assert.ok(tools.length > 0);

    const toolNames = tools.map(t => t.name);
    assert.ok(toolNames.includes("submit_lead"), "submit_lead tool missing");
  });
});

describe("Webhook", () => {
  it("loads webhook signing module", () => {
    const { signPayload } = require("../src/security/webhook");
    assert.ok(typeof signPayload === "function");
  });

  it("produces consistent signatures", () => {
    const { signPayload } = require("../src/security/webhook");
    const sig1 = signPayload("test-payload", "test-secret");
    const sig2 = signPayload("test-payload", "test-secret");
    assert.strictEqual(sig1, sig2);
  });

  it("produces different signatures for different payloads", () => {
    const { signPayload } = require("../src/security/webhook");
    const sig1 = signPayload("payload-1", "secret");
    const sig2 = signPayload("payload-2", "secret");
    assert.notStrictEqual(sig1, sig2);
  });
});
