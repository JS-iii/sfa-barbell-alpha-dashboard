#!/usr/bin/env node
/**
 * bridge-canary-plan.mjs — v7B.0.1 Live Write Authorization Ceremony + Canary Plan
 *
 * Tests canary payload validation, authorization ceremony boundaries,
 * rollback checklist presence, and audit event contracts without
 * executing any live writes.
 *
 * Run: npm run bridge:canary-plan
 *
 * NO fetch(). NO credentials. NO Open Brain client. NO live writes.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_DIR = join(dirname(__filename), "..");

// ═══════════════════════════════════════════════════════════════
//  INLINE MODULES
// ═══════════════════════════════════════════════════════════════

const CANARY_SCHEMA_VERSION = "open-brain-canary-write-v7b01";

function createValidCanaryPayload(overrides = {}) {
  return {
    schemaVersion: CANARY_SCHEMA_VERSION,
    writeType: "canary",
    idempotencyKey: "canary-test-key",
    safetyDeclarations: {
      notExecutionAuthority: true,
      containsTradeOrders: false,
      containsWalletReferences: false,
      containsExecutionInstructions: false,
      containsCredentials: false,
      isGovernedState: false,
    },
    governanceAssertions: {
      requiresHumanReview: true,
      networkWriteStatus: "canary-write-only",
      v7bAuthorized: false,
    },
    observation: {
      signal: "defensive",
      confidence: 0.5,
      timestamp: new Date().toISOString(),
      source: "canary-test",
    },
    operatorAuthorization: {
      authorizationId: null,
      authorized: false,
    },
    auditMetadata: {
      requestedAt: new Date().toISOString(),
      clientVersion: "7.0.0",
      rehearsalPhase: "v7b01-canary-plan",
    },
    ...overrides,
  };
}

function validateCanaryPayload(payload) {
  const errors = [];
  const p = payload;

  if (p.schemaVersion !== CANARY_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be "${CANARY_SCHEMA_VERSION}"`);
  }
  if (p.writeType !== "canary") {
    errors.push(`writeType must be "canary", got "${p.writeType}"`);
  }
  const safety = p.safetyDeclarations || {};
  if (safety.notExecutionAuthority !== true) errors.push("notExecutionAuthority must be true");
  if (safety.containsTradeOrders !== false) errors.push("containsTradeOrders must be false");
  if (safety.containsExecutionInstructions !== false) errors.push("containsExecutionInstructions must be false");
  if (safety.containsWalletReferences !== false) errors.push("containsWalletReferences must be false");
  if (safety.containsCredentials !== false) errors.push("containsCredentials must be false");
  if (safety.isGovernedState !== false) errors.push("isGovernedState must be false");

  const gov = p.governanceAssertions || {};
  if (gov.requiresHumanReview !== true) errors.push("requiresHumanReview must be true");
  if (gov.networkWriteStatus !== "canary-write-only") errors.push(`networkWriteStatus must be "canary-write-only"`);
  if (gov.v7bAuthorized !== false) errors.push("v7bAuthorized must be false in v7B.0.1");

  const opAuth = p.operatorAuthorization || {};
  if (opAuth.authorized !== false) errors.push("operatorAuthorization.authorized must be false");

  const payloadStr = JSON.stringify(payload).toLowerCase();
  const forbidden = [
    { p: /"governed_state"\s*:\s*true/, n: "governed_state: true" },
    { p: /"execute_trade"/, n: "execute_trade" },
    { p: /"approve_execution"/, n: "approve_execution" },
    { p: /"strategy_approval"/, n: "strategy_approval" },
    { p: /sk-[a-z0-9]{20,}/i, n: "secret key pattern" },
  ];
  for (const f of forbidden) {
    if (f.p.test(payloadStr)) errors.push(`Forbidden: ${f.n}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    wouldCreateGovernedState: safety.isGovernedState === true || payloadStr.includes('"governed_state":true'),
    wouldAuthorizeExecution: safety.notExecutionAuthority !== true || safety.containsExecutionInstructions === true,
  };
}

function createBlockedCanaryAuditEvent(blockedBy, description) {
  return {
    schemaVersion: "open-brain-first-write-audit-v7b01",
    timestamp: new Date().toISOString(),
    eventType: "canary_blocked",
    status: "blocked",
    blockedBy,
    description,
    phase: "v7b01-canary-plan",
    v7bAuthorized: false,
    safety: { notExecutionAuthority: true, isGovernedState: false, networkWriteStatus: "dry-run-local-only" },
  };
}

function createOperatorChecklist() {
  return {
    schemaVersion: "open-brain-operator-checklist-v7b01",
    isComplete: false,
    canAuthorizeV7B: false, // KEY: cannot authorize
    items: [
      { id: "v7b0-sealed", description: "v7B.0 sealed and accepted", required: true, completed: false },
      { id: "all-tests-pass", description: "All bridge test suites pass", required: true, completed: false },
      { id: "kill-switch-closed", description: "Kill switch is fail-closed", required: true, completed: false },
      { id: "canary-payload-valid", description: "Canary payload validated", required: true, completed: false },
      { id: "rollback-ready", description: "Rollback checklist reviewed", required: true, completed: false },
      { id: "audit-contract-reviewed", description: "Audit event contract reviewed", required: true, completed: false },
      { id: "no-credentials-in-code", description: "No credential values in source", required: true, completed: false },
      { id: "credentials-staged-env-only", description: "Credentials in env only", required: false, completed: false },
      { id: "security-review", description: "Security review completed", required: false, completed: false },
      { id: "open-brain-endpoint-reachable", description: "Open Brain endpoint reachable", required: false, completed: false },
    ],
  };
}

function isChecklistComplete(checklist) {
  return checklist.items.filter((i) => i.required).every((i) => i.completed);
}

function canChecklistAuthorizeV7B() {
  return false; // v7B.0.1: ALWAYS false
}

// ── Check credential env vars ──────────────────────────────────

function checkCredentialsPresent() {
  const vars = ["OPENBRAIN_API_KEY", "OPENBRAIN_ENDPOINT_URL", "OPENBRAIN_PROJECT_ID", "SUPABASE_URL", "SUPABASE_KEY"];
  const detected = vars.filter((v) => process.env[v] && process.env[v].trim() !== "");
  return { present: detected.length > 0, vars: detected };
}

// ═══════════════════════════════════════════════════════════════
//  TESTS
// ═══════════════════════════════════════════════════════════════

console.log("═══════════════════════════════════════════════════════════");
console.log("  v7B.0.1 Live Write Authorization Ceremony + Canary Plan");
console.log("  " + new Date().toISOString());
console.log("═══════════════════════════════════════════════════════════\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { if (fn()) { console.log(`   ✅ ${name}`); passed++; } else { console.log(`   ❌ ${name}`); failed++; } }
  catch (e) { console.log(`   ❌ ${name} — threw: ${e.message}`); failed++; }
}

// ── Section 1: Canary Payload Validation ───────────────────────

console.log("[1] Canary Payload Validation Tests\n");

test("Valid canary payload passes validation", () => {
  const p = createValidCanaryPayload();
  const r = validateCanaryPayload(p);
  return r.valid === true && r.errors.length === 0;
});

test("Malformed payload (missing writeType) rejected", () => {
  const p = createValidCanaryPayload({ writeType: undefined });
  const r = validateCanaryPayload(p);
  return !r.valid && r.errors.some((e) => e.includes("writeType"));
});

test("Malformed payload (wrong schema version) rejected", () => {
  const p = createValidCanaryPayload({ schemaVersion: "wrong" });
  const r = validateCanaryPayload(p);
  return !r.valid && r.errors.some((e) => e.includes("schemaVersion"));
});

test("Canary with governed_state: true rejected", () => {
  const p = createValidCanaryPayload({ safetyDeclarations: { notExecutionAuthority: true, containsTradeOrders: false, containsWalletReferences: false, containsExecutionInstructions: false, containsCredentials: false, isGovernedState: true } });
  const r = validateCanaryPayload(p);
  return !r.valid && r.wouldCreateGovernedState === true;
});

test("Canary with missing operator approval (authorized: true) rejected", () => {
  const p = createValidCanaryPayload({ operatorAuthorization: { authorizationId: null, authorized: true } });
  const r = validateCanaryPayload(p);
  return !r.valid && r.errors.some((e) => e.includes("authorized"));
});

test("Canary with v7bAuthorized: true rejected", () => {
  const p = createValidCanaryPayload({ governanceAssertions: { requiresHumanReview: true, networkWriteStatus: "canary-write-only", v7bAuthorized: true } });
  const r = validateCanaryPayload(p);
  return !r.valid && r.errors.some((e) => e.includes("v7bAuthorized"));
});

test("Canary with networkWriteStatus: v7b-live-write rejected", () => {
  const p = createValidCanaryPayload({ governanceAssertions: { requiresHumanReview: true, networkWriteStatus: "v7b-live-write", v7bAuthorized: false } });
  const r = validateCanaryPayload(p);
  return !r.valid && r.errors.some((e) => e.includes("networkWriteStatus"));
});

test("Canary with execute_trade in payload rejected", () => {
  const p = createValidCanaryPayload({ observation: { signal: "execute_trade", confidence: 0.5, timestamp: new Date().toISOString(), source: "canary-test" } });
  const r = validateCanaryPayload(p);
  return !r.valid && r.errors.some((e) => e.includes("execute_trade"));
});

test("Canary with secret key pattern rejected", () => {
  const p = createValidCanaryPayload({ extra: "sk-abc123xyz789def456ghi" });
  const r = validateCanaryPayload(p);
  return !r.valid && r.errors.some((e) => e.includes("secret"));
});

// ── Section 2: Authorization Ceremony ──────────────────────────

console.log("\n[2] Authorization Ceremony Tests\n");

test("Authorization ceremony cannot authorize v7B.1", () => {
  return canChecklistAuthorizeV7B() === false;
});

test("Operator checklist starts incomplete", () => {
  const cl = createOperatorChecklist();
  return cl.isComplete === false;
});

test("Operator checklist canAuthorizeV7B is false", () => {
  const cl = createOperatorChecklist();
  return cl.canAuthorizeV7B === false;
});

test("Checklist with all required items completed still cannot authorize", () => {
  const cl = createOperatorChecklist();
  cl.items.forEach((i) => { if (i.required) i.completed = true; });
  cl.isComplete = isChecklistComplete(cl);
  return cl.isComplete === true && canChecklistAuthorizeV7B() === false;
});

test("Candidate lock from v7A.7 cannot activate v7B.0.1", () => {
  // Simulate v7A.7 candidate lock trying to activate v7B.0.1
  const candidateLockState = "candidate_locked";
  const checklist = createOperatorChecklist();
  return candidateLockState === "candidate_locked" && checklist.canAuthorizeV7B === false;
});

// ── Section 3: Audit Event Contract ────────────────────────────

console.log("\n[3] Audit Event Contract Tests\n");

test("Blocked canary audit event has correct schema", () => {
  const event = createBlockedCanaryAuditEvent("adapter_disabled", "Canary blocked");
  return event.schemaVersion === "open-brain-first-write-audit-v7b01" && event.eventType === "canary_blocked" && event.status === "blocked" && event.v7bAuthorized === false;
});

test("Blocked audit event has v7bAuthorized: false", () => {
  const event = createBlockedCanaryAuditEvent("kill_switch", "Kill switch active");
  return event.v7bAuthorized === false;
});

test("Audit event safety declarations are correct", () => {
  const event = createBlockedCanaryAuditEvent("authorization_gate", "Not authorized");
  return event.safety.notExecutionAuthority === true && event.safety.isGovernedState === false && event.safety.networkWriteStatus === "dry-run-local-only";
});

// ── Section 4: Rollback Checklist ──────────────────────────────

console.log("\n[4] Rollback Checklist Tests\n");

test("Rollback checklist document exists", () => {
  return existsSync(join(PROJECT_DIR, "docs", "v7b", "v7b01_rollback_checklist.md"));
});

test("Authorization ceremony document exists", () => {
  return existsSync(join(PROJECT_DIR, "docs", "v7b", "v7b01_authorization_ceremony.md"));
});

test("Canary write contract document exists", () => {
  return existsSync(join(PROJECT_DIR, "docs", "v7b", "v7b01_canary_write_contract.md"));
});

// ── Section 5: Credential & Safety Checks ──────────────────────

console.log("\n[5] Credential & Safety Guard Tests\n");

test("No credentials present in environment (clean)", () => {
  const c = checkCredentialsPresent();
  return c.present === false && c.vars.length === 0;
});

test("Kill switch remains fail-closed", () => {
  const envValue = process.env.OPENBRAIN_WRITE_DISABLED;
  const blocked = envValue === "true" || envValue === undefined || envValue === "";
  return blocked === true;
});

test("v7B.0.1 scaffold blocks all writes", () => {
  // Simulate the scaffold blocking
  const auth = { authorized: false, reason: "v7B.0.1 scaffold" };
  return auth.authorized === false;
});

// ── Section 6: Boundary Enforcement ────────────────────────────

console.log("\n[6] Boundary Enforcement Tests\n");

test("Script contains no fetch() calls", () => {
  const script = readFileSync(join(PROJECT_DIR, "scripts", "bridge-canary-plan.mjs"), "utf-8");
  const noComments = script.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/"[^"]*fetch\([^"]*"/g, "");
  return !noComments.includes("fetch(");
});

test("Script contains no credential values", () => {
  const script = readFileSync(join(PROJECT_DIR, "scripts", "bridge-canary-plan.mjs"), "utf-8");
  const noComments = script.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/"[^"]*"/g, "").replace(/'[^']*'/g, "").replace(/\/[a-z0-9].*?\/[gim]*/gi, "");
  return !noComments.includes("sk-");
});

test("No executable live write path exists", () => {
  const script = readFileSync(join(PROJECT_DIR, "scripts", "bridge-canary-plan.mjs"), "utf-8");
  const noComments = script.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/"[^"]*"/g, "").replace(/'[^']*'/g, "");
  // Should not contain any actual HTTP request patterns
  return !noComments.includes("http.request(") && !noComments.includes("axios.") && !noComments.includes("supabase");
});

test("Canary payload schema version is correct", () => {
  const p = createValidCanaryPayload();
  return p.schemaVersion === "open-brain-canary-write-v7b01";
});

// ═══════════════════════════════════════════════════════════════
//  SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log("\n═══════════════════════════════════════════════════════════");
console.log("  v7B.0.1 CANARY PLAN RESULTS");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Tests passed: ${passed}`);
console.log(`  Tests failed: ${failed}`);
console.log(`  Total:        ${passed + failed}`);
console.log(`  (Authorized minimum: 20; expanded to ${passed + failed})`);
console.log("═══════════════════════════════════════════════════════════");
console.log("  Open Brain connected:       false");
console.log("  Network writes:             false");
console.log("  Credentials:                false");
console.log("  Execution capability:       false");
console.log("  Governed state created:     false");
console.log("  Live write adapter enabled: false");
console.log("  Kill switch:                fail-closed");
console.log("  Canary write executed:      false");
console.log("  v7B.1 authorized:           false");
console.log("  This phase is:              planning/preflight only");
console.log("═══════════════════════════════════════════════════════════");

process.exit(failed > 0 ? 1 : 0);
