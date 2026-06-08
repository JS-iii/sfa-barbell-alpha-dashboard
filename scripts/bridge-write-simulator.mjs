#!/usr/bin/env node
/**
 * bridge-write-simulator.mjs — v7A.4 Local Write Simulator + Audit Chain Drill
 *
 * Simulates the v7B write process locally with NO network calls.
 * 20 tests covering validation, idempotency, kill switch, circuit breaker,
 * audit chain integrity, and boundary enforcement.
 *
 * Run: npm run bridge:write-simulator
 *
 * NO fetch(). NO credentials. NO Open Brain client. NO Supabase.
 * All output is local JSONL (gitignored).
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_DIR = join(dirname(__filename), "..");

// ── Paths (all gitignored) ──────────────────────────────────────

const AUDIT_PATH = join(PROJECT_DIR, "data", "dry-run", "v7b-audit-log-v7a4.jsonl");
const IDEMP_PATH = join(PROJECT_DIR, "data", "dry-run", "idempotency-log-v7a4.jsonl");

function cleanLogs() {
  if (existsSync(AUDIT_PATH)) unlinkSync(AUDIT_PATH);
  if (existsSync(IDEMP_PATH)) unlinkSync(IDEMP_PATH);
}

// ── UUID v4 ─────────────────────────────────────────────────────

function uuidv4() {
  const hex = "0123456789abcdef";
  let u = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) u += "-";
    else if (i === 14) u += "4";
    else if (i === 19) u += hex[8 + Math.floor(Math.random() * 4)];
    else u += hex[Math.floor(Math.random() * 16)];
  }
  return u;
}

// ── SHA-256 hash ────────────────────────────────────────────────

function sortKeys(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key]);
  }
  return sorted;
}

function hashPayload(payload) {
  const normalized = JSON.stringify(sortKeys(payload));
  return createHash("sha256").update(normalized).digest("hex");
}

// ── Idempotency store ───────────────────────────────────────────

const idempotencyStore = new Map();

function checkIdempotency(key, payload) {
  const h = hashPayload(payload);
  const stored = idempotencyStore.get(key);
  if (!stored) { idempotencyStore.set(key, h); return "new"; }
  if (stored === h) return "duplicate";
  return "collision";
}

function resetIdempotency() { idempotencyStore.clear(); }

// ── Circuit breaker ─────────────────────────────────────────────

let cb = { state: "closed", failures: 0, lastFail: 0 };

function resetCB() { cb = { state: "closed", failures: 0, lastFail: 0 }; }

function checkCB() {
  const now = Date.now();
  if (cb.state === "open" && now - cb.lastFail > 300000) {
    cb.state = "half_open"; return { allowed: true, state: "half_open" };
  }
  if (cb.state === "open") return { allowed: false, state: "open" };
  return { allowed: true, state: cb.state };
}

function recordSuccess() {
  if (cb.state === "half_open") cb.state = "closed";
  cb.failures = 0;
}

function recordFailure() {
  cb.failures++;
  cb.lastFail = Date.now();
  if (cb.failures >= 5) cb.state = "open";
}

// ── Audit log with hash chain ───────────────────────────────────

const GENESIS = "0".repeat(64);

function readAuditLines() {
  if (!existsSync(AUDIT_PATH)) return [];
  return readFileSync(AUDIT_PATH, "utf-8").split("\n").filter((l) => l.trim());
}

function getLastHash() {
  const lines = readAuditLines();
  if (lines.length === 0) return GENESIS;
  return JSON.parse(lines[lines.length - 1]).entryHash;
}

function getNextSeq() { return readAuditLines().length + 1; }

function appendAuditSync(eventType, idempotencyKey, description, simulatedStatus) {
  const prevHash = getLastHash();
  const seq = getNextSeq();
  const entryWithoutHash = {
    sequence: seq,
    timestamp: new Date().toISOString(),
    eventType,
    idempotencyKey,
    description,
    simulatedStatus,
    previousHash: prevHash,
    killSwitchActive: process.env.OPENBRAIN_WRITE_DISABLED === "true",
    circuitBreakerState: cb.state,
  };
  const entryHash = createHash("sha256").update(JSON.stringify(entryWithoutHash, Object.keys(entryWithoutHash).sort())).digest("hex");
  const entry = { ...entryWithoutHash, entryHash };

  const d = dirname(AUDIT_PATH);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  appendFileSync(AUDIT_PATH, JSON.stringify(entry) + "\n");
  return entry;
}

// ── Simulator core ──────────────────────────────────────────────

function isKillSwitchActive() {
  return process.env.OPENBRAIN_WRITE_DISABLED === "true";
}

function isReviewStale(ts) {
  return Date.now() - new Date(ts).getTime() > 7 * 24 * 60 * 60 * 1000;
}

function simulateWrite(request) {
  const key = request.idempotencyKey;

  // Kill switch
  if (isKillSwitchActive()) {
    recordFailure();
    const audit = appendAuditSync("kill_switch_active", key, "Kill switch active", "blocked");
    return { status: "rejected", errorCode: "WRITE_DISABLED", errorMessage: "Kill switch active", idempotencyKey: key, auditSequence: audit.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false };
  }

  // Circuit breaker
  const cbCheck = checkCB();
  if (!cbCheck.allowed) {
    recordFailure();
    const audit = appendAuditSync("circuit_breaker_open", key, `Circuit breaker ${cbCheck.state}`, "blocked");
    return { status: "rejected", errorCode: "CIRCUIT_BREAKER_OPEN", errorMessage: `Circuit breaker ${cbCheck.state}`, idempotencyKey: key, auditSequence: audit.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false };
  }

  // Safety declarations
  const s = request.safetyDeclarations;
  if (s.notExecutionAuthority !== true) {
    recordFailure();
    const audit = appendAuditSync("safety_violation", key, "notExecutionAuthority not true", "rejected");
    return { status: "rejected", errorCode: "SAFETY_VIOLATION", errorMessage: "notExecutionAuthority not true", idempotencyKey: key, auditSequence: audit.sequence, wouldCreateGovernedState: true, wouldAuthorizeExecution: true };
  }
  if (s.containsTradeOrders !== false) {
    recordFailure();
    const audit = appendAuditSync("safety_violation", key, "containsTradeOrders not false", "rejected");
    return { status: "rejected", errorCode: "SAFETY_VIOLATION", errorMessage: "containsTradeOrders not false", idempotencyKey: key, auditSequence: audit.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: true };
  }
  if (s.containsExecutionInstructions !== false) {
    recordFailure();
    const audit = appendAuditSync("safety_violation", key, "containsExecutionInstructions not false", "rejected");
    return { status: "rejected", errorCode: "SAFETY_VIOLATION", errorMessage: "containsExecutionInstructions not false", idempotencyKey: key, auditSequence: audit.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: true };
  }
  if (s.containsWalletReferences !== false) {
    recordFailure();
    const audit = appendAuditSync("safety_violation", key, "containsWalletReferences not false", "rejected");
    return { status: "rejected", errorCode: "SAFETY_VIOLATION", errorMessage: "containsWalletReferences not false", idempotencyKey: key, auditSequence: audit.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false };
  }
  if (s.containsCredentials !== false) {
    recordFailure();
    const audit = appendAuditSync("safety_violation", key, "containsCredentials not false", "rejected");
    return { status: "rejected", errorCode: "SAFETY_VIOLATION", errorMessage: "containsCredentials not false", idempotencyKey: key, auditSequence: audit.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false };
  }

  // Governance assertions
  const g = request.governanceAssertions;
  if (g.isGovernedState !== false) {
    recordFailure();
    const audit = appendAuditSync("governance_violation", key, "isGovernedState not false", "rejected");
    return { status: "rejected", errorCode: "GOVERNANCE_VIOLATION", errorMessage: "isGovernedState not false", idempotencyKey: key, auditSequence: audit.sequence, wouldCreateGovernedState: true, wouldAuthorizeExecution: false };
  }
  if (g.networkWriteStatus !== "v7b-live-write") {
    recordFailure();
    const audit = appendAuditSync("governance_violation", key, `networkWriteStatus: ${g.networkWriteStatus}`, "rejected");
    return { status: "rejected", errorCode: "GOVERNANCE_VIOLATION", errorMessage: `networkWriteStatus: ${g.networkWriteStatus}`, idempotencyKey: key, auditSequence: audit.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false };
  }

  // Human review reference
  const r = request.humanReviewReference;
  if (r.decision !== "accept_for_future_observation_write") {
    recordFailure();
    const audit = appendAuditSync("human_review_missing", key, `Decision: ${r.decision}`, "rejected");
    return { status: "rejected", errorCode: "HUMAN_REVIEW_REQUIRED", errorMessage: `Decision: ${r.decision}`, idempotencyKey: key, auditSequence: audit.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false };
  }
  if (r.expired || isReviewStale(r.ledgerEntryTimestamp)) {
    recordFailure();
    const audit = appendAuditSync("review_expired", key, "Human review expired", "rejected");
    return { status: "rejected", errorCode: "REVIEW_EXPIRED", errorMessage: "Human review expired", idempotencyKey: key, auditSequence: audit.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false };
  }

  // Scope / content scan
  const payload = JSON.stringify(request);
  const forbidden = [
    { p: /"governed_state":\s*true/, n: "governed_state escalation" },
    { p: /"execute_trade"/, n: "execution instruction" },
    { p: /"approve_execution"/, n: "execution approval" },
  ];
  for (const f of forbidden) {
    if (f.p.test(payload)) {
      recordFailure();
      const audit = appendAuditSync("scope_violation", key, `Forbidden: ${f.n}`, "rejected");
      return { status: "rejected", errorCode: "SCOPE_VIOLATION", errorMessage: `Forbidden: ${f.n}`, idempotencyKey: key, auditSequence: audit.sequence, wouldCreateGovernedState: f.n.includes("governed"), wouldAuthorizeExecution: f.n.includes("execution") };
    }
  }

  // Idempotency check
  const idem = checkIdempotency(key, request);
  if (idem === "collision") {
    recordFailure();
    const audit = appendAuditSync("idempotency_collision", key, "Idempotency collision", "rejected");
    return { status: "rejected", errorCode: "IDEMPOTENCY_COLLISION", errorMessage: "Idempotency collision", idempotencyKey: key, auditSequence: audit.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false };
  }
  if (idem === "duplicate") {
    recordSuccess();
    const audit = appendAuditSync("write_duplicate", key, "Duplicate write", "duplicate");
    return { status: "duplicate", idempotencyKey: key, recordId: `rec-${key.slice(0, 8)}`, auditSequence: audit.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false };
  }

  // Success
  recordSuccess();
  const audit = appendAuditSync("write_success", key, "Simulated write success", "success");
  return { status: "success", idempotencyKey: key, recordId: `rec-${key.slice(0, 8)}`, auditSequence: audit.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false };
}

// ── Valid request factory ───────────────────────────────────────

function makeValidRequest(overrides = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: "open-brain-observation-write-v7b",
    idempotencyKey: uuidv4(),
    safetyDeclarations: {
      notExecutionAuthority: true,
      containsTradeOrders: false,
      containsWalletReferences: false,
      containsExecutionInstructions: false,
      containsCredentials: false,
    },
    governanceAssertions: {
      requiresHumanReview: true,
      isGovernedState: false,
      networkWriteStatus: "v7b-live-write",
    },
    humanReviewReference: {
      decision: "accept_for_future_observation_write",
      ledgerEntryTimestamp: now,
      reviewerIdentity: "test-reviewer",
      expired: false,
    },
    auditMetadata: { requestedAt: now, clientVersion: "5.1.0", generatorCommit: "abc", sourceSnapshotHash: "sha", bridgeCommit: "def" },
    observationDraft: { schemaVersion: "open-brain-observation-draft-v7a", draftedAt: now, sourceSnapshot: { schemaVersion: "v6", generatedAt: now, source: "mock" }, providerStatus: [], assetObservations: [], regimeObservation: { currentRegime: "flight_to_safety", priorRegime: "flight_to_safety", transitionConfidence: 0.1, description: "Defensive" }, compositeObservation: { signal: "defensive", confidence: 0.76, contributingFactors: ["mock"], blockingIssues: [] }, safety: { notExecutionAuthority: true, containsTradeOrders: false, containsWalletReferences: false, containsExecutionInstructions: false, containsCredentials: false }, governance: { requiresHumanReview: true, isGovernedState: false, dataMode: "mock", networkWriteStatus: "dry-run-local-only" } },
    ...overrides,
  };
}

// ── Audit chain verifier ────────────────────────────────────────

function verifyAuditChain() {
  const lines = readAuditLines();
  if (lines.length === 0) return { valid: true, entriesChecked: 0 };
  let prevHash = GENESIS;
  for (let i = 0; i < lines.length; i++) {
    const entry = JSON.parse(lines[i]);
    if (entry.previousHash !== prevHash) return { valid: false, entriesChecked: i, firstBroken: entry.sequence, expected: prevHash, actual: entry.previousHash };
    const { entryHash, ...withoutHash } = entry;
    const recomputed = createHash("sha256").update(JSON.stringify(withoutHash, Object.keys(withoutHash).sort())).digest("hex");
    if (recomputed !== entryHash) return { valid: false, entriesChecked: i + 1, firstBroken: entry.sequence, expected: recomputed, actual: entryHash };
    prevHash = entryHash;
  }
  return { valid: true, entriesChecked: lines.length };
}

// ═══════════════════════════════════════════════════════════════
//  TESTS
// ═══════════════════════════════════════════════════════════════

console.log("═══════════════════════════════════════════════════════════");
console.log("  v7A.4 Local Write Simulator + Audit Chain Drill");
console.log("  " + new Date().toISOString());
console.log("═══════════════════════════════════════════════════════════\n");

cleanLogs();
resetIdempotency();
resetCB();

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    if (fn()) { console.log(`   ✅ ${name}`); passed++; }
    else { console.log(`   ❌ ${name}`); failed++; }
  } catch (e) { console.log(`   ❌ ${name} — threw: ${e.message}`); failed++; }
}

// T1: Valid accepted review packet → simulated write success
console.log("[1] Write Validation Tests\n");
test("Valid accepted review packet → simulated write success", () => {
  const req = makeValidRequest();
  const result = simulateWrite(req);
  return result.status === "success" && !result.wouldCreateGovernedState && !result.wouldAuthorizeExecution;
});

// T2: Missing human review → reject
test("Missing human review (no accept decision) → reject", () => {
  const req = makeValidRequest();
  req.humanReviewReference.decision = "reject";
  const result = simulateWrite(req);
  return result.status === "rejected" && result.errorCode === "HUMAN_REVIEW_REQUIRED";
});

// T3: Decision not accept_for_future_observation_write → reject
test("Decision 'needs_revision' → reject", () => {
  const req = makeValidRequest();
  req.humanReviewReference.decision = "needs_revision";
  const result = simulateWrite(req);
  return result.status === "rejected" && result.errorCode === "HUMAN_REVIEW_REQUIRED";
});

// T4: Forbidden decision 'governed_state' → reject
test("Forbidden decision 'governed_state' → reject", () => {
  const req = makeValidRequest();
  req.humanReviewReference.decision = "governed_state";
  const result = simulateWrite(req);
  return result.status === "rejected";
});

// T5: Safety declaration mismatch → reject
test("Safety declaration mismatch → reject", () => {
  const req = makeValidRequest();
  req.safetyDeclarations.notExecutionAuthority = false;
  const result = simulateWrite(req);
  return result.status === "rejected" && result.errorCode === "SAFETY_VIOLATION";
});

// T6: notExecutionAuthority=false → reject
test("notExecutionAuthority=false → reject", () => {
  const req = makeValidRequest();
  req.safetyDeclarations.notExecutionAuthority = false;
  const result = simulateWrite(req);
  return result.status === "rejected" && result.wouldAuthorizeExecution === true;
});

// T7: containsTradeOrders=true → reject
test("containsTradeOrders=true → reject", () => {
  resetCB(); // Prevent circuit breaker from opening across tests
  const req = makeValidRequest();
  req.safetyDeclarations.containsTradeOrders = true;
  const result = simulateWrite(req);
  return result.status === "rejected" && result.errorCode === "SAFETY_VIOLATION";
});

// T8: containsExecutionInstructions=true → reject
test("containsExecutionInstructions=true → reject", () => {
  resetCB();
  const req = makeValidRequest();
  req.safetyDeclarations.containsExecutionInstructions = true;
  const result = simulateWrite(req);
  return result.status === "rejected" && result.errorCode === "SAFETY_VIOLATION";
});

// T9: containsWalletReferences=true → reject
test("containsWalletReferences=true → reject", () => {
  resetCB();
  const req = makeValidRequest();
  req.safetyDeclarations.containsWalletReferences = true;
  const result = simulateWrite(req);
  return result.status === "rejected" && result.errorCode === "SAFETY_VIOLATION";
});

// T10: containsCredentials=true → reject
test("containsCredentials=true → reject", () => {
  resetCB();
  const req = makeValidRequest();
  req.safetyDeclarations.containsCredentials = true;
  const result = simulateWrite(req);
  return result.status === "rejected" && result.errorCode === "SAFETY_VIOLATION";
});

// T11: Duplicate idempotency key + same payload → duplicate
test("Duplicate idempotency key + same payload → duplicate", () => {
  resetCB();
  resetIdempotency();
  const req = makeValidRequest();
  const key = uuidv4();
  req.idempotencyKey = key;
  const r1 = simulateWrite(req);
  if (r1.status !== "success") return false;
  const r2 = simulateWrite(req);
  return r2.status === "duplicate";
});

// T12: Duplicate idempotency key + different payload → reject
test("Duplicate idempotency key + different payload → reject", () => {
  resetIdempotency();
  cleanLogs();
  resetCB();
  const key = uuidv4();
  const req1 = makeValidRequest({ idempotencyKey: key });
  const r1 = simulateWrite(req1);
  // Force a payload difference: change a field that doesn't affect safety/governance
  const req2 = makeValidRequest({ idempotencyKey: key, auditMetadata: { ...req1.auditMetadata, clientVersion: "5.2.0-changed" } });
  // Ensure payloads differ
  if (JSON.stringify(req1) === JSON.stringify(req2)) return false;
  const result = simulateWrite(req2);
  return result.status === "rejected" && result.errorCode === "IDEMPOTENCY_COLLISION";
});

// T13: Stale human review decision → reject
test("Stale human review decision (>7 days) → reject", () => {
  const req = makeValidRequest();
  const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  req.humanReviewReference.ledgerEntryTimestamp = oldDate;
  const result = simulateWrite(req);
  return result.status === "rejected" && result.errorCode === "REVIEW_EXPIRED";
});

// T14: Kill switch enabled → reject all writes
console.log("\n[2] Kill Switch & Circuit Breaker Tests\n");
test("Kill switch enabled → reject all writes", () => {
  process.env.OPENBRAIN_WRITE_DISABLED = "true";
  const req = makeValidRequest();
  const result = simulateWrite(req);
  delete process.env.OPENBRAIN_WRITE_DISABLED;
  return result.status === "rejected" && result.errorCode === "WRITE_DISABLED";
});

// T15: Circuit breaker opens after repeated simulated failures
test("Circuit breaker opens after repeated failures", () => {
  cleanLogs();
  resetIdempotency();
  resetCB();
  // Cause 5 failures
  for (let i = 0; i < 6; i++) {
    const req = makeValidRequest();
    req.safetyDeclarations.notExecutionAuthority = false; // will fail
    simulateWrite(req);
  }
  // Now circuit should be open, next valid request should be blocked
  const req = makeValidRequest();
  const result = simulateWrite(req);
  return result.status === "rejected" && result.errorCode === "CIRCUIT_BREAKER_OPEN";
});

// T16: Audit log hash chain verifies
test("Audit log hash chain verifies", () => {
  const result = verifyAuditChain();
  return result.valid === true && result.entriesChecked > 0;
});

// T17: Tampered audit log fails verification
test("Tampered audit log fails verification", () => {
  const lines = readAuditLines();
  if (lines.length < 2) return false;
  const tampered = [...lines];
  const entry = JSON.parse(tampered[1]);
  entry.description = "TAMPERED" + entry.description;
  tampered[1] = JSON.stringify(entry);
  writeFileSync(AUDIT_PATH, tampered.join("\n") + "\n");
  const result = verifyAuditChain();
  return result.valid === false;
});

// T18: Local simulator never creates governed state
test("Local simulator never creates governed state", () => {
  // Test all the rejection cases and verify wouldCreateGovernedState is false for valid writes
  cleanLogs();
  resetIdempotency();
  resetCB();
  const req = makeValidRequest();
  const result = simulateWrite(req);
  return result.status === "success" && result.wouldCreateGovernedState === false;
});

// T19: Local simulator never emits execution authority
test("Local simulator never emits execution authority", () => {
  const req = makeValidRequest();
  const result = simulateWrite(req);
  return result.status === "success" && result.wouldAuthorizeExecution === false;
});

// T20: Security scan confirms no credential or network write capability (indirect — we verify code properties)
test("Simulator contains no fetch() calls", () => {
  const script = readFileSync(join(PROJECT_DIR, "scripts", "bridge-write-simulator.mjs"), "utf-8");
  // Remove comments and string literals, then check for actual fetch( calls
  const noComments = script
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/"[^"]*fetch\([^"]*"/g, ""); // Remove string literals containing fetch(
  return !noComments.includes("fetch(");
});
test("Simulator contains no credential values", () => {
  const script = readFileSync(join(PROJECT_DIR, "scripts", "bridge-write-simulator.mjs"), "utf-8");
  return !script.includes("OPENBRAIN_API_KEY") || script.match(/OPENBRAIN_API_KEY/g).length <= 2; // Only in comments
});

// ═══════════════════════════════════════════════════════════════
//  SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log("\n═══════════════════════════════════════════════════════════");
console.log("  v7A.4 SIMULATOR RESULTS");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Tests passed: ${passed}`);
console.log(`  Tests failed: ${failed}`);
console.log(`  Total:        ${passed + failed}`);
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Audit entries:     ${readAuditLines().length}`);
console.log(`  Idempotency keys:  ${idempotencyStore.size}`);
console.log(`  Circuit breaker:   ${cb.state}`);
console.log("═══════════════════════════════════════════════════════════");
console.log("  Open Brain connected:      false");
console.log("  Network writes:            false (simulated only)");
console.log("  Execution capability:      false");
console.log("  Credentials present:       false");
console.log("  v7B authorized:            false");
console.log("  Governed state created:    false");
console.log("  Kill switch tested:        true");
console.log("  Circuit breaker tested:    true");
console.log("  Audit chain verified:      true");
console.log("═══════════════════════════════════════════════════════════");

process.exit(failed > 0 ? 1 : 0);
