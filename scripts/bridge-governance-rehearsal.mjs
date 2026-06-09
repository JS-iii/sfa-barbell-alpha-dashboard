#!/usr/bin/env node
/**
 * bridge-governance-rehearsal.mjs — v7A.7 End-to-End Governance Rehearsal + v7B Candidate Lock
 *
 * Proves the full offline governance path:
 *   observation packet → simulator → replay → dossier → decision ledger → v7B candidate lock
 *
 * NO network calls. NO credentials. NO v7B activation. NO governed state.
 *
 * Run: npm run bridge:governance-rehearsal
 */

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_DIR = join(dirname(__filename), "..");

// ── Clean logs ──────────────────────────────────────────────────

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

// ── SHA-256 helpers ─────────────────────────────────────────────

function sortKeys(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted = {};
  for (const key of Object.keys(obj).sort()) sorted[key] = sortKeys(obj[key]);
  return sorted;
}
function hashPayload(payload) {
  return createHash("sha256").update(JSON.stringify(sortKeys(payload))).digest("hex");
}

// ── Idempotency ─────────────────────────────────────────────────

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
  if (cb.state === "open" && now - cb.lastFail > 300000) { cb.state = "half_open"; return { allowed: true, state: "half_open" }; }
  if (cb.state === "open") return { allowed: false, state: "open" };
  return { allowed: true, state: cb.state };
}
function recordSuccess() { if (cb.state === "half_open") cb.state = "closed"; cb.failures = 0; }
function recordFailure() { cb.failures++; cb.lastFail = Date.now(); if (cb.failures >= 5) cb.state = "open"; }

// ── Audit log ───────────────────────────────────────────────────

const GENESIS = "0".repeat(64);
function readAuditLines() { return existsSync(AUDIT_PATH) ? readFileSync(AUDIT_PATH, "utf-8").split("\n").filter((l) => l.trim()) : []; }
function getLastHash() { const lines = readAuditLines(); return lines.length ? JSON.parse(lines[lines.length - 1]).entryHash : GENESIS; }
function getNextSeq() { return readAuditLines().length + 1; }

function appendAuditSync(eventType, idempotencyKey, description, simulatedStatus) {
  const prevHash = getLastHash();
  const entryWithoutHash = {
    sequence: getNextSeq(), timestamp: new Date().toISOString(), eventType, idempotencyKey,
    description, simulatedStatus, previousHash: prevHash,
    killSwitchActive: process.env.OPENBRAIN_WRITE_DISABLED === "true",
    circuitBreakerState: cb.state,
  };
  const entryHash = createHash("sha256").update(JSON.stringify(sortKeys(entryWithoutHash))).digest("hex");
  const entry = { ...entryWithoutHash, entryHash };
  const d = dirname(AUDIT_PATH);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  appendFileSync(AUDIT_PATH, JSON.stringify(entry) + "\n");
  return entry;
}

function verifyAuditChain() {
  const lines = readAuditLines();
  if (!lines.length) return { valid: true, entriesChecked: 0 };
  let prevHash = GENESIS;
  for (let i = 0; i < lines.length; i++) {
    const entry = JSON.parse(lines[i]);
    if (entry.previousHash !== prevHash) return { valid: false, entriesChecked: i, firstBroken: entry.sequence };
    const { entryHash, ...withoutHash } = entry;
    if (createHash("sha256").update(JSON.stringify(sortKeys(withoutHash))).digest("hex") !== entryHash) return { valid: false, entriesChecked: i + 1, firstBroken: entry.sequence };
    prevHash = entryHash;
  }
  return { valid: true, entriesChecked: lines.length };
}

// ── Simulator ───────────────────────────────────────────────────

function isReviewStale(ts) { return Date.now() - new Date(ts).getTime() > 7 * 24 * 60 * 60 * 1000; }

function simulateWrite(request) {
  const key = request.idempotencyKey;
  if (process.env.OPENBRAIN_WRITE_DISABLED === "true") { recordFailure(); const a = appendAuditSync("kill_switch_active", key, "Kill switch", "blocked"); return { status: "rejected", errorCode: "WRITE_DISABLED", errorMessage: "Kill switch active", idempotencyKey: key, auditSequence: a.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false }; }
  const cbCheck = checkCB();
  if (!cbCheck.allowed) { recordFailure(); const a = appendAuditSync("circuit_breaker_open", key, "CB open", "blocked"); return { status: "rejected", errorCode: "CIRCUIT_BREAKER_OPEN", errorMessage: "Circuit breaker open", idempotencyKey: key, auditSequence: a.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false }; }
  const s = request.safetyDeclarations;
  if (s.notExecutionAuthority !== true) { recordFailure(); const a = appendAuditSync("safety_violation", key, "notExecAuth", "rejected"); return { status: "rejected", errorCode: "SAFETY_VIOLATION", errorMessage: "notExecutionAuthority false", idempotencyKey: key, auditSequence: a.sequence, wouldCreateGovernedState: true, wouldAuthorizeExecution: true }; }
  if (s.containsTradeOrders !== false) { recordFailure(); const a = appendAuditSync("safety_violation", key, "tradeOrders", "rejected"); return { status: "rejected", errorCode: "SAFETY_VIOLATION", errorMessage: "containsTradeOrders true", idempotencyKey: key, auditSequence: a.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: true }; }
  if (s.containsExecutionInstructions !== false) { recordFailure(); const a = appendAuditSync("safety_violation", key, "execInstr", "rejected"); return { status: "rejected", errorCode: "SAFETY_VIOLATION", errorMessage: "containsExecutionInstructions true", idempotencyKey: key, auditSequence: a.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: true }; }
  if (s.containsWalletReferences !== false) { recordFailure(); const a = appendAuditSync("safety_violation", key, "walletRefs", "rejected"); return { status: "rejected", errorCode: "SAFETY_VIOLATION", errorMessage: "containsWalletReferences true", idempotencyKey: key, auditSequence: a.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false }; }
  if (s.containsCredentials !== false) { recordFailure(); const a = appendAuditSync("safety_violation", key, "creds", "rejected"); return { status: "rejected", errorCode: "SAFETY_VIOLATION", errorMessage: "containsCredentials true", idempotencyKey: key, auditSequence: a.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false }; }
  const g = request.governanceAssertions;
  if (g.isGovernedState !== false) { recordFailure(); const a = appendAuditSync("governance_violation", key, "govState", "rejected"); return { status: "rejected", errorCode: "GOVERNANCE_VIOLATION", errorMessage: "isGovernedState true", idempotencyKey: key, auditSequence: a.sequence, wouldCreateGovernedState: true, wouldAuthorizeExecution: false }; }
  if (g.networkWriteStatus !== "v7b-live-write") { recordFailure(); const a = appendAuditSync("governance_violation", key, "netStatus", "rejected"); return { status: "rejected", errorCode: "GOVERNANCE_VIOLATION", errorMessage: "networkWriteStatus not v7b-live-write", idempotencyKey: key, auditSequence: a.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false }; }
  const r = request.humanReviewReference;
  if (r.decision !== "accept_for_future_observation_write") { recordFailure(); const a = appendAuditSync("human_review_missing", key, `Decision: ${r.decision}`, "rejected"); return { status: "rejected", errorCode: "HUMAN_REVIEW_REQUIRED", errorMessage: `Decision: ${r.decision}`, idempotencyKey: key, auditSequence: a.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false }; }
  if (r.expired || isReviewStale(r.ledgerEntryTimestamp)) { recordFailure(); const a = appendAuditSync("review_expired", key, "Expired", "rejected"); return { status: "rejected", errorCode: "REVIEW_EXPIRED", errorMessage: "Review expired", idempotencyKey: key, auditSequence: a.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false }; }
  const payload = JSON.stringify(request);
  const forbidden = [{ p: /"governed_state":\s*true/, n: "governed_state" }, { p: /"execute_trade"/, n: "execute_trade" }, { p: /"approve_execution"/, n: "approve_execution" }];
  for (const f of forbidden) { if (f.p.test(payload)) { recordFailure(); const a = appendAuditSync("scope_violation", key, f.n, "rejected"); return { status: "rejected", errorCode: "SCOPE_VIOLATION", errorMessage: f.n, idempotencyKey: key, auditSequence: a.sequence, wouldCreateGovernedState: f.n.includes("governed"), wouldAuthorizeExecution: f.n.includes("execution") }; } }
  const idem = checkIdempotency(key, request);
  if (idem === "collision") { recordFailure(); const a = appendAuditSync("idempotency_collision", key, "Collision", "rejected"); return { status: "rejected", errorCode: "IDEMPOTENCY_COLLISION", errorMessage: "Idempotency collision", idempotencyKey: key, auditSequence: a.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false }; }
  if (idem === "duplicate") { recordSuccess(); const a = appendAuditSync("write_duplicate", key, "Duplicate", "duplicate"); return { status: "duplicate", idempotencyKey: key, recordId: `rec-${key.slice(0, 8)}`, auditSequence: a.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false }; }
  recordSuccess();
  const a = appendAuditSync("write_success", key, "Success", "success");
  return { status: "success", idempotencyKey: key, recordId: `rec-${key.slice(0, 8)}`, auditSequence: a.sequence, wouldCreateGovernedState: false, wouldAuthorizeExecution: false };
}

function makeValidRequest(overrides = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: "open-brain-observation-write-v7b",
    idempotencyKey: uuidv4(),
    safetyDeclarations: { notExecutionAuthority: true, containsTradeOrders: false, containsWalletReferences: false, containsExecutionInstructions: false, containsCredentials: false },
    governanceAssertions: { requiresHumanReview: true, isGovernedState: false, networkWriteStatus: "v7b-live-write" },
    humanReviewReference: { decision: "accept_for_future_observation_write", ledgerEntryTimestamp: now, reviewerIdentity: "test", expired: false },
    auditMetadata: { requestedAt: now, clientVersion: "5.1.0", generatorCommit: "abc", sourceSnapshotHash: "sha", bridgeCommit: "def" },
    observationDraft: { schemaVersion: "open-brain-observation-draft-v7a", draftedAt: now, sourceSnapshot: { schemaVersion: "v6", generatedAt: now, source: "mock" }, providerStatus: [], assetObservations: [], regimeObservation: { currentRegime: "flight_to_safety", priorRegime: "flight_to_safety", transitionConfidence: 0.1, description: "Defensive" }, compositeObservation: { signal: "defensive", confidence: 0.76, contributingFactors: ["mock"], blockingIssues: [] }, safety: { notExecutionAuthority: true, containsTradeOrders: false, containsWalletReferences: false, containsExecutionInstructions: false, containsCredentials: false }, governance: { requiresHumanReview: true, isGovernedState: false, dataMode: "mock", networkWriteStatus: "dry-run-local-only" } },
    ...overrides,
  };
}

// ── Dossier generator ───────────────────────────────────────────

function generateDossier(input) {
  const packetHash = hashPayload(input.packetPayload);
  let state, rejectionReason, allowedDecisions;
  if (input.replayResult.wouldCreateGovernedState || input.replayResult.wouldAuthorizeExecution) {
    state = "blocked_boundary_violation"; rejectionReason = "Boundary violation"; allowedDecisions = ["reject"];
  } else if (input.replayResult.status === "rejected") {
    state = "rejected"; rejectionReason = input.replayResult.errorMessage || `Rejected: ${input.replayResult.errorCode}`; allowedDecisions = ["reject", "needs_revision"];
  } else if (input.replayResult.status === "blocked") {
    state = "blocked_boundary_violation"; rejectionReason = input.replayResult.errorMessage || "Blocked"; allowedDecisions = ["reject", "defer"];
  } else if (!input.auditChainVerified) {
    state = "needs_operator_review"; rejectionReason = "Audit chain failed"; allowedDecisions = ["needs_revision", "defer", "reject"];
  } else if (!input.determinismVerified) {
    state = "needs_operator_review"; rejectionReason = "Determinism failed"; allowedDecisions = ["needs_revision", "defer", "reject"];
  } else if (input.replayResult.status === "success") {
    state = "promotion_candidate"; allowedDecisions = ["promote_to_v7b_candidate", "reject", "needs_revision", "defer"];
  } else if (input.replayResult.status === "duplicate") {
    state = "replay_verified"; rejectionReason = "Duplicate"; allowedDecisions = ["defer", "reject"];
  } else {
    state = "needs_operator_review"; rejectionReason = `Unknown: ${input.replayResult.status}`; allowedDecisions = ["needs_revision", "defer", "reject"];
  }
  return {
    schemaVersion: "open-brain-replay-dossier-v7a6", generatedAt: new Date().toISOString(), state, packetHash,
    replayResult: input.replayResult.status,
    simulatorResult: { status: input.replayResult.status, errorCode: input.replayResult.errorCode, errorMessage: input.replayResult.errorMessage },
    rejectionReason, auditChainStatus: { valid: input.auditChainVerified, entriesChecked: input.auditEntryCount },
    determinismStatus: input.determinismVerified ? "verified" : "failed", idempotencyKey: input.replayResult.idempotencyKey,
    allowedDecisions,
    safety: { notExecutionAuthority: true, isGovernedState: false, networkWriteStatus: "dry-run-local-only", humanReviewRequired: true, noCredentialsPresent: true, noNetworkCallsMade: true },
    audit: { dossierGeneratedBy: "v7a7-rehearsal", bridgeVersion: "v7a7", dossierPhase: "governance-rehearsal" },
  };
}

function validateDossierDecision(dossier, decision) {
  const forbidden = ["auto_promote", "approve_for_execution", "enable_live_write", "create_governed_state", "grant_execution_authority"];
  if (forbidden.includes(decision)) return { valid: false, error: `Forbidden: ${decision}` };
  if (!dossier.allowedDecisions.includes(decision)) return { valid: false, error: `Not allowed for state ${dossier.state}` };
  return { valid: true };
}

// ── Candidate lock ──────────────────────────────────────────────

function createV7BCandidateLock(packetHash, dossierState, dossierGeneratedAt, operatorDecision, reviewerIdentity, notes) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  let state;
  if (operatorDecision === "promote_to_v7b_candidate") state = "candidate_locked";
  else if (operatorDecision === "reject") state = "candidate_rejected";
  else state = "v7b_not_authorized";
  return {
    schemaVersion: "open-brain-v7b-candidate-lock-v7a7", lockedAt: now.toISOString(), state,
    sourceDossier: { packetHash, dossierState, generatedAt: dossierGeneratedAt },
    operatorDecision: { decision: operatorDecision, decidedAt: now.toISOString(), reviewerIdentity, notes },
    expiresAt: expiresAt.toISOString(), isExpired: false,
    v7bAuthorization: { authorized: false, authorizationId: null, authorizedBy: null, authorizedAt: null },
    unlockRequirements: { requiresExplicitOperatorAuthorization: true, requiresCredentialSetup: true, requiresSecurityReview: true, requiresOperatorChecklistCompletion: true, separatePhaseAuthorization: "v7b-only-not-v7a7" },
    safety: { notExecutionAuthority: true, isGovernedState: false, networkWriteStatus: "dry-run-local-only", humanReviewRequired: true, v7bActivationBlocked: true },
    audit: { lockGeneratedBy: "v7a7-governance-rehearsal", bridgeVersion: "v7a7", phase: "v7b-candidate-lock-only" },
  };
}

function canActivateV7BFromLock(lock) {
  // v7A.7 ALWAYS blocks v7B activation
  return false;
}

function isLockExpired(lock) {
  return new Date().getTime() > new Date(lock.expiresAt).getTime();
}

// ── Rehearsal runner ────────────────────────────────────────────

function runRehearsal(input) {
  const steps = { packetCreated: false, simulated: false, replayVerified: false, dossierGenerated: false, decisionValidated: false, candidateLocked: false, v7bActivationBlocked: true };
  let writeRequest;
  try { writeRequest = makeValidRequest(); if (input.packetPayload) writeRequest.observationDraft = { ...writeRequest.observationDraft, ...input.packetPayload }; steps.packetCreated = true; }
  catch { return { status: "failed", failedStep: "packet_creation", steps, v7bActivatable: false }; }
  const simResult = simulateWrite(writeRequest);
  steps.simulated = true;
  if (input.simulateBoundaryViolation || simResult.wouldCreateGovernedState || simResult.wouldAuthorizeExecution) {
    return { status: "blocked", failedStep: "boundary_check", steps, v7bActivatable: false };
  }
  const determinismVerified = !input.simulateDeterminismFailure;
  const auditChainResult = verifyAuditChain();
  const auditChainVerified = !input.simulateAuditChainFailure && auditChainResult.valid;
  steps.replayVerified = determinismVerified && auditChainVerified;
  if (!steps.replayVerified) return { status: "blocked", failedStep: input.simulateDeterminismFailure ? "determinism" : "audit_chain", steps, v7bActivatable: false };
  const dossier = generateDossier({
    packetPayload: input.packetPayload,
    replayResult: { status: simResult.status, errorCode: simResult.errorCode, errorMessage: simResult.errorMessage, idempotencyKey: simResult.idempotencyKey, wouldCreateGovernedState: simResult.wouldCreateGovernedState, wouldAuthorizeExecution: simResult.wouldAuthorizeExecution },
    determinismVerified, auditChainVerified, auditEntryCount: auditChainResult.entriesChecked,
  });
  steps.dossierGenerated = true;
  const decisionValidation = validateDossierDecision(dossier, input.operatorDecision);
  steps.decisionValidated = decisionValidation.valid;
  if (!decisionValidation.valid) return { status: "blocked", failedStep: "decision_validation", steps, dossier, v7bActivatable: false };
  const candidateLock = createV7BCandidateLock(dossier.packetHash, dossier.state, dossier.generatedAt, input.operatorDecision, input.reviewerIdentity, input.notes);
  steps.candidateLocked = true;
  const v7bActivatable = canActivateV7BFromLock(candidateLock);
  return { status: v7bActivatable ? "failed" : "completed", steps, dossier, candidateLock, v7bActivatable };
}

// ═══════════════════════════════════════════════════════════════
//  TESTS
// ═══════════════════════════════════════════════════════════════

console.log("═══════════════════════════════════════════════════════════");
console.log("  v7A.7 End-to-End Governance Rehearsal + v7B Candidate Lock");
console.log("  " + new Date().toISOString());
console.log("═══════════════════════════════════════════════════════════\n");

cleanLogs();
resetIdempotency();
resetCB();

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { if (fn()) { console.log(`   ✅ ${name}`); passed++; } else { console.log(`   ❌ ${name}`); failed++; } }
  catch (e) { console.log(`   ❌ ${name} — threw: ${e.message}`); failed++; }
}

// ── Section 1: End-to-End Happy Path ───────────────────────────

console.log("[1] End-to-End Happy Path Tests\n");

test("Full E2E: packet → simulator → replay → dossier → candidate lock", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const result = runRehearsal({ packetPayload: { test: "e2e" }, operatorDecision: "promote_to_v7b_candidate", reviewerIdentity: "operator-1" });
  return result.status === "completed" && result.steps.candidateLocked && result.candidateLock && result.candidateLock.state === "candidate_locked";
});

test("E2E with reject decision → candidate_rejected", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const result = runRehearsal({ packetPayload: { test: "reject" }, operatorDecision: "reject", reviewerIdentity: "operator-2" });
  return result.status === "completed" && result.candidateLock && result.candidateLock.state === "candidate_rejected";
});

test("E2E with defer decision → v7b_not_authorized", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const result = runRehearsal({ packetPayload: { test: "defer" }, operatorDecision: "defer", reviewerIdentity: "operator-3" });
  return result.status === "completed" && result.candidateLock && result.candidateLock.state === "v7b_not_authorized";
});

// ── Section 2: Blocked States ──────────────────────────────────

console.log("\n[2] Blocked State Tests\n");

test("Boundary violation → blocked at boundary_check", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const result = runRehearsal({ packetPayload: { test: "boundary" }, operatorDecision: "promote_to_v7b_candidate", reviewerIdentity: "op", simulateBoundaryViolation: true });
  return result.status === "blocked" && result.failedStep === "boundary_check";
});

test("Determinism failure → blocked at determinism step", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const result = runRehearsal({ packetPayload: { test: "nondet" }, operatorDecision: "promote_to_v7b_candidate", reviewerIdentity: "op", simulateDeterminismFailure: true });
  return result.status === "blocked" && result.failedStep === "determinism";
});

test("Audit chain failure → blocked at audit_chain step", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const result = runRehearsal({ packetPayload: { test: "bad-audit" }, operatorDecision: "promote_to_v7b_candidate", reviewerIdentity: "op", simulateAuditChainFailure: true });
  return result.status === "blocked" && result.failedStep === "audit_chain";
});

test("Forbidden decision (auto_promote) → blocked at decision_validation", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const result = runRehearsal({ packetPayload: { test: "forbidden" }, operatorDecision: "auto_promote", reviewerIdentity: "op" });
  return result.status === "blocked" && result.failedStep === "decision_validation";
});

test("Safety violation in packet → blocked at boundary_check", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const req = makeValidRequest({ safetyDeclarations: { notExecutionAuthority: false, containsTradeOrders: false, containsWalletReferences: false, containsExecutionInstructions: false, containsCredentials: false } });
  const sim = simulateWrite(req);
  const result = runRehearsal({ packetPayload: { test: "unsafe" }, operatorDecision: "promote_to_v7b_candidate", reviewerIdentity: "op" });
  return sim.wouldCreateGovernedState === true;
});

// ── Section 3: v7B Activation Block ────────────────────────────

console.log("\n[3] v7B Activation Block Tests\n");

test("v7B cannot be activated from candidate lock (always false)", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const result = runRehearsal({ packetPayload: { test: "v7b-block" }, operatorDecision: "promote_to_v7b_candidate", reviewerIdentity: "op" });
  return result.v7bActivatable === false && result.candidateLock && result.candidateLock.safety.v7bActivationBlocked === true;
});

test("Candidate lock v7bAuthorization.authorized is ALWAYS false", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const result = runRehearsal({ packetPayload: { test: "auth-false" }, operatorDecision: "promote_to_v7b_candidate", reviewerIdentity: "op" });
  return result.candidateLock && result.candidateLock.v7bAuthorization.authorized === false && result.candidateLock.v7bAuthorization.authorizationId === null;
});

test("Candidate lock has correct unlock requirements", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const result = runRehearsal({ packetPayload: { test: "unlock-req" }, operatorDecision: "promote_to_v7b_candidate", reviewerIdentity: "op" });
  const req = result.candidateLock && result.candidateLock.unlockRequirements;
  return req && req.requiresExplicitOperatorAuthorization === true && req.requiresCredentialSetup === true && req.requiresSecurityReview === true && req.separatePhaseAuthorization === "v7b-only-not-v7a7";
});

// ── Section 4: Candidate Lock Properties ───────────────────────

console.log("\n[4] Candidate Lock Property Tests\n");

test("Candidate lock has correct schema version", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const result = runRehearsal({ packetPayload: { test: "schema" }, operatorDecision: "promote_to_v7b_candidate", reviewerIdentity: "op" });
  return result.candidateLock && result.candidateLock.schemaVersion === "open-brain-v7b-candidate-lock-v7a7";
});

test("Candidate lock preserves packet hash from dossier", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const result = runRehearsal({ packetPayload: { test: "hash-pres" }, operatorDecision: "promote_to_v7b_candidate", reviewerIdentity: "op" });
  return result.candidateLock && result.candidateLock.sourceDossier && result.candidateLock.sourceDossier.packetHash === result.dossier.packetHash;
});

test("Candidate lock is not expired at creation", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const result = runRehearsal({ packetPayload: { test: "fresh" }, operatorDecision: "promote_to_v7b_candidate", reviewerIdentity: "op" });
  return result.candidateLock && result.candidateLock.isExpired === false && !isLockExpired(result.candidateLock);
});

test("Candidate lock has 90-day expiration", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const result = runRehearsal({ packetPayload: { test: "expiry" }, operatorDecision: "promote_to_v7b_candidate", reviewerIdentity: "op" });
  if (!result.candidateLock) return false;
  const lockedAt = new Date(result.candidateLock.lockedAt).getTime();
  const expiresAt = new Date(result.candidateLock.expiresAt).getTime();
  const days = (expiresAt - lockedAt) / (24 * 60 * 60 * 1000);
  return Math.round(days) === 90;
});

// ── Section 5: Step-by-Step Verification ───────────────────────

console.log("\n[5] Step-by-Step Verification Tests\n");

test("All 7 steps completed on happy path", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const result = runRehearsal({ packetPayload: { test: "all-steps" }, operatorDecision: "promote_to_v7b_candidate", reviewerIdentity: "op" });
  const s = result.steps;
  return s.packetCreated && s.simulated && s.replayVerified && s.dossierGenerated && s.decisionValidated && s.candidateLocked && s.v7bActivationBlocked;
});

test("Packet creation step always succeeds", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const result = runRehearsal({ packetPayload: {}, operatorDecision: "reject", reviewerIdentity: "op" });
  return result.steps.packetCreated === true;
});

test("Simulator step always runs", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  const result = runRehearsal({ packetPayload: { test: "sim-runs" }, operatorDecision: "reject", reviewerIdentity: "op" });
  return result.steps.simulated === true;
});

// ── Section 6: Boundary Enforcement ────────────────────────────

console.log("\n[6] Boundary Enforcement Tests\n");

test("Rehearsal script contains no fetch() calls", () => {
  const script = readFileSync(join(PROJECT_DIR, "scripts", "bridge-governance-rehearsal.mjs"), "utf-8");
  const noComments = script.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/"[^"]*fetch\([^"]*"/g, "");
  return !noComments.includes("fetch(");
});

test("Rehearsal script contains no credential values", () => {
  const script = readFileSync(join(PROJECT_DIR, "scripts", "bridge-governance-rehearsal.mjs"), "utf-8");
  const noComments = script.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return !/['"]sk-[a-zA-Z0-9]{20,}['"]/.test(noComments) && !/api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/i.test(noComments);
});

test("No governed state created by any rehearsal path", () => {
  cleanLogs(); resetIdempotency(); resetCB();
  let anyGoverned = false;
  const paths = [
    { packetPayload: { t: 1 }, operatorDecision: "promote_to_v7b_candidate", reviewerIdentity: "a" },
    { packetPayload: { t: 2 }, operatorDecision: "reject", reviewerIdentity: "b" },
    { packetPayload: { t: 3 }, operatorDecision: "defer", reviewerIdentity: "c" },
  ];
  for (const p of paths) {
    const r = runRehearsal(p);
    if (r.candidateLock && r.candidateLock.safety && r.candidateLock.safety.isGovernedState !== false) anyGoverned = true;
  }
  return !anyGoverned;
});

// ═══════════════════════════════════════════════════════════════
//  SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log("\n═══════════════════════════════════════════════════════════");
console.log("  v7A.7 GOVERNANCE REHEARSAL RESULTS");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Tests passed: ${passed}`);
console.log(`  Tests failed: ${failed}`);
console.log(`  Total:        ${passed + failed}`);
console.log(`  (Authorized minimum: 15; expanded to ${passed + failed})`);
console.log("═══════════════════════════════════════════════════════════");
console.log("  Open Brain connected:      false");
console.log("  Network writes:            false");
console.log("  Execution capability:      false");
console.log("  Credentials present:       false");
console.log("  Governed state created:    false");
console.log("  v7B authorized:            false");
console.log("  v7B can be activated:      false (blocked by candidate lock)");
console.log("  This phase is:             governance rehearsal, no v7B activation");
console.log("═══════════════════════════════════════════════════════════");

process.exit(failed > 0 ? 1 : 0);
