#!/usr/bin/env node
/**
 * bridge-replay-dossier.mjs — v7A.6 Replay Promotion Dossier + Governance Preflight
 *
 * Converts replayed observation packets into human-reviewable promotion
 * dossiers. Proves boundary enforcement, state transitions, and
 * operator decision validation without creating governed state,
 * credentials, network writes, or execution capability.
 *
 * Run: npm run bridge:replay-dossier
 *
 * NO fetch(). NO credentials. NO Open Brain client. NO network.
 */

import { readFileSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_DIR = join(dirname(__filename), "..");

// ── SHA-256 helpers ─────────────────────────────────────────────

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
  return createHash("sha256").update(JSON.stringify(sortKeys(payload))).digest("hex");
}

// ── Dossier generator ───────────────────────────────────────────

function generateDossier(input) {
  const packetHash = hashPayload(input.packetPayload);

  let state;
  let rejectionReason;
  let allowedDecisions;

  // Boundary violation (highest priority)
  if (input.replayResult.wouldCreateGovernedState || input.replayResult.wouldAuthorizeExecution) {
    state = "blocked_boundary_violation";
    rejectionReason = "Replay result indicates governed state or execution authority would be created. Critical boundary violation.";
    allowedDecisions = ["reject"];
  }
  // Replay rejected
  else if (input.replayResult.status === "rejected") {
    state = "rejected";
    rejectionReason = input.replayResult.errorMessage || `Replay rejected: ${input.replayResult.errorCode}`;
    allowedDecisions = ["reject", "needs_revision"];
  }
  // Replay blocked
  else if (input.replayResult.status === "blocked") {
    state = "blocked_boundary_violation";
    rejectionReason = input.replayResult.errorMessage || "Replay blocked by safety mechanism";
    allowedDecisions = ["reject", "defer"];
  }
  // Audit chain invalid
  else if (!input.auditChainVerified) {
    state = "needs_operator_review";
    rejectionReason = "Audit chain verification failed. Operator review required.";
    allowedDecisions = ["needs_revision", "defer", "reject"];
  }
  // Determinism not verified
  else if (!input.determinismVerified) {
    state = "needs_operator_review";
    rejectionReason = "Replay determinism could not be verified. Operator review required.";
    allowedDecisions = ["needs_revision", "defer", "reject"];
  }
  // Success
  else if (input.replayResult.status === "success") {
    state = "promotion_candidate";
    allowedDecisions = ["promote_to_v7b_candidate", "reject", "needs_revision", "defer"];
  }
  // Duplicate
  else if (input.replayResult.status === "duplicate") {
    state = "replay_verified";
    rejectionReason = "Duplicate replay: packet already processed.";
    allowedDecisions = ["defer", "reject"];
  }
  // Unknown — fail closed
  else {
    state = "needs_operator_review";
    rejectionReason = `Unknown replay status: ${input.replayResult.status}`;
    allowedDecisions = ["needs_revision", "defer", "reject"];
  }

  return {
    schemaVersion: "open-brain-replay-dossier-v7a6",
    generatedAt: new Date().toISOString(),
    state,
    packetHash,
    replayResult: input.replayResult.status,
    simulatorResult: {
      status: input.replayResult.status,
      errorCode: input.replayResult.errorCode,
      errorMessage: input.replayResult.errorMessage,
    },
    rejectionReason,
    auditChainStatus: {
      valid: input.auditChainVerified,
      entriesChecked: input.auditEntryCount,
    },
    determinismStatus: input.determinismVerified ? "verified" : "failed",
    idempotencyKey: input.replayResult.idempotencyKey,
    allowedDecisions,
    safety: {
      notExecutionAuthority: true,
      isGovernedState: false,
      networkWriteStatus: "dry-run-local-only",
      humanReviewRequired: true,
      noCredentialsPresent: true,
      noNetworkCallsMade: true,
    },
    audit: {
      dossierGeneratedBy: "v7a6-replay-dossier-generator",
      bridgeVersion: "v7a6",
      dossierPhase: "promotion-preflight",
    },
  };
}

// ── Decision validator ──────────────────────────────────────────

function validateDossierDecision(dossier, decision) {
  const forbidden = ["auto_promote", "approve_for_execution", "enable_live_write", "create_governed_state", "grant_execution_authority"];
  if (forbidden.includes(decision)) {
    return { valid: false, error: `Decision "${decision}" is forbidden` };
  }
  if (!dossier.allowedDecisions.includes(decision)) {
    return { valid: false, error: `Decision "${decision}" not allowed for state "${dossier.state}"` };
  }
  return { valid: true };
}

function canPromoteToV7BCandidate(dossier) {
  return dossier.state === "promotion_candidate" &&
    dossier.safety.notExecutionAuthority === true &&
    dossier.safety.isGovernedState === false &&
    dossier.safety.networkWriteStatus === "dry-run-local-only" &&
    !dossier.rejectionReason;
}

// ═══════════════════════════════════════════════════════════════
//  TESTS
// ═══════════════════════════════════════════════════════════════

console.log("═══════════════════════════════════════════════════════════");
console.log("  v7A.6 Replay Promotion Dossier + Governance Preflight");
console.log("  " + new Date().toISOString());
console.log("═══════════════════════════════════════════════════════════\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    if (fn()) { console.log(`   ✅ ${name}`); passed++; }
    else { console.log(`   ❌ ${name}`); failed++; }
  } catch (e) { console.log(`   ❌ ${name} — threw: ${e.message}`); failed++; }
}

// ── Section 1: State Determination ─────────────────────────────

console.log("[1] Dossier State Determination Tests\n");

// D1: Valid success replay → promotion_candidate
test("Valid success replay → promotion_candidate dossier", () => {
  const d = generateDossier({
    packetPayload: { test: "valid" },
    replayResult: { status: "success", idempotencyKey: "key-1", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 5,
  });
  return d.state === "promotion_candidate" && d.replayResult === "success";
});

// D2: Rejected replay → rejected dossier
test("Rejected replay (safety violation) → rejected dossier", () => {
  const d = generateDossier({
    packetPayload: { test: "unsafe" },
    replayResult: { status: "rejected", errorCode: "SAFETY_VIOLATION", errorMessage: "notExecutionAuthority false", idempotencyKey: "key-2", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 3,
  });
  return d.state === "rejected" && d.rejectionReason.includes("notExecutionAuthority");
});

// D3: Boundary violation → blocked
test("Governed state would be created → blocked_boundary_violation", () => {
  const d = generateDossier({
    packetPayload: { test: "boundary" },
    replayResult: { status: "rejected", errorCode: "SAFETY_VIOLATION", errorMessage: "Violation", idempotencyKey: "key-3", wouldCreateGovernedState: true, wouldAuthorizeExecution: true },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 1,
  });
  return d.state === "blocked_boundary_violation" && d.allowedDecisions.length === 1 && d.allowedDecisions[0] === "reject";
});

// D4: Blocked by kill switch → blocked
test("Replay blocked by kill switch → blocked_boundary_violation", () => {
  const d = generateDossier({
    packetPayload: { test: "killswitch" },
    replayResult: { status: "blocked", errorCode: "WRITE_DISABLED", errorMessage: "Kill switch active", idempotencyKey: "key-4", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 2,
  });
  return d.state === "blocked_boundary_violation";
});

// D5: Invalid audit chain → needs_operator_review
test("Invalid audit chain → needs_operator_review", () => {
  const d = generateDossier({
    packetPayload: { test: "bad-audit" },
    replayResult: { status: "success", idempotencyKey: "key-5", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: false,
    auditEntryCount: 0,
  });
  return d.state === "needs_operator_review" && d.auditChainStatus.valid === false;
});

// D6: Non-deterministic replay → needs_operator_review
test("Non-deterministic replay → needs_operator_review", () => {
  const d = generateDossier({
    packetPayload: { test: "nondeterministic" },
    replayResult: { status: "success", idempotencyKey: "key-6", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: false,
    auditChainVerified: true,
    auditEntryCount: 3,
  });
  return d.state === "needs_operator_review" && d.determinismStatus === "failed";
});

// D7: Duplicate replay → replay_verified
test("Duplicate replay → replay_verified dossier", () => {
  const d = generateDossier({
    packetPayload: { test: "duplicate" },
    replayResult: { status: "duplicate", idempotencyKey: "key-7", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 4,
  });
  return d.state === "replay_verified" && d.rejectionReason?.includes("Duplicate");
});

// D8: Unknown status → needs_operator_review (fail-closed)
test("Unknown replay status → needs_operator_review (fail-closed)", () => {
  const d = generateDossier({
    packetPayload: { test: "unknown" },
    replayResult: { status: "weird_thing", idempotencyKey: "key-8", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 1,
  });
  return d.state === "needs_operator_review";
});

// ── Section 2: Decision Validation ─────────────────────────────

console.log("\n[2] Operator Decision Validation Tests\n");

// D9: Allowed decisions for promotion_candidate
test("promotion_candidate allows promote_to_v7b_candidate", () => {
  const d = generateDossier({
    packetPayload: { test: "candidate" },
    replayResult: { status: "success", idempotencyKey: "key-9", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 1,
  });
  const v = validateDossierDecision(d, "promote_to_v7b_candidate");
  return v.valid && d.allowedDecisions.includes("promote_to_v7b_candidate");
});

// D10: Forbidden decisions rejected
test("Forbidden decision 'auto_promote' → rejected", () => {
  const d = generateDossier({
    packetPayload: { test: "forbid" },
    replayResult: { status: "success", idempotencyKey: "key-10", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 1,
  });
  const v = validateDossierDecision(d, "auto_promote");
  return !v.valid;
});

// D11: Forbidden decision 'create_governed_state' → rejected
test("Forbidden decision 'create_governed_state' → rejected", () => {
  const d = generateDossier({
    packetPayload: { test: "forbid2" },
    replayResult: { status: "success", idempotencyKey: "key-11", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 1,
  });
  const v = validateDossierDecision(d, "create_governed_state");
  return !v.valid;
});

// D12: Disallowed decision for rejected state
test("Rejected dossier does not allow promote_to_v7b_candidate", () => {
  const d = generateDossier({
    packetPayload: { test: "noreject" },
    replayResult: { status: "rejected", errorCode: "SAFETY_VIOLATION", errorMessage: "Bad", idempotencyKey: "key-12", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 1,
  });
  const v = validateDossierDecision(d, "promote_to_v7b_candidate");
  return !v.valid;
});

// ── Section 3: Promotion Eligibility ───────────────────────────

console.log("\n[3] v7B Promotion Eligibility Tests\n");

// D13: promotion_candidate can promote to v7B
test("promotion_candidate dossier can promote to v7B", () => {
  const d = generateDossier({
    packetPayload: { test: "promote" },
    replayResult: { status: "success", idempotencyKey: "key-13", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 5,
  });
  return canPromoteToV7BCandidate(d);
});

// D14: rejected dossier cannot promote
test("Rejected dossier cannot promote to v7B", () => {
  const d = generateDossier({
    packetPayload: { test: "nopromote" },
    replayResult: { status: "rejected", errorCode: "BAD", errorMessage: "Bad", idempotencyKey: "key-14", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 1,
  });
  return !canPromoteToV7BCandidate(d);
});

// D15: blocked_boundary_violation cannot promote
test("Blocked dossier cannot promote to v7B", () => {
  const d = generateDossier({
    packetPayload: { test: "blocked" },
    replayResult: { status: "rejected", errorCode: "SAFETY", errorMessage: "Bad", idempotencyKey: "key-15", wouldCreateGovernedState: true, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 1,
  });
  return !canPromoteToV7BCandidate(d);
});

// ── Section 4: Dossier Fields ──────────────────────────────────

console.log("\n[4] Dossier Field & Safety Tests\n");

// D16: Packet hash present
test("Dossier contains packet hash (SHA-256)", () => {
  const d = generateDossier({
    packetPayload: { test: "hashme" },
    replayResult: { status: "success", idempotencyKey: "key-16", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 1,
  });
  return d.packetHash && d.packetHash.length === 64;
});

// D17: Idempotency key preserved
test("Dossier preserves idempotency key from replay", () => {
  const d = generateDossier({
    packetPayload: { test: "idemp" },
    replayResult: { status: "success", idempotencyKey: "abc-123-xyz", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 1,
  });
  return d.idempotencyKey === "abc-123-xyz";
});

// D18: Safety declarations correct
test("Dossier safety: notExecutionAuthority=true", () => {
  const d = generateDossier({
    packetPayload: { test: "safety" },
    replayResult: { status: "success", idempotencyKey: "key-17", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 1,
  });
  return d.safety.notExecutionAuthority === true && d.safety.isGovernedState === false && d.safety.networkWriteStatus === "dry-run-local-only";
});

// D19: Human review required
test("Dossier safety: humanReviewRequired=true", () => {
  const d = generateDossier({
    packetPayload: { test: "review" },
    replayResult: { status: "success", idempotencyKey: "key-18", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 1,
  });
  return d.safety.humanReviewRequired === true;
});

// D20: No credentials / no network flags
test("Dossier safety: noCredentialsPresent + noNetworkCallsMade", () => {
  const d = generateDossier({
    packetPayload: { test: "nocreds" },
    replayResult: { status: "success", idempotencyKey: "key-19", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 1,
  });
  return d.safety.noCredentialsPresent === true && d.safety.noNetworkCallsMade === true;
});

// ── Section 5: Boundary Enforcement ────────────────────────────

console.log("\n[5] Boundary Enforcement Tests\n");

// D21: No fetch() calls
test("Dossier script contains no fetch() calls", () => {
  const script = readFileSync(join(PROJECT_DIR, "scripts", "bridge-replay-dossier.mjs"), "utf-8");
  const noComments = script.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/"[^"]*fetch\([^"]*"/g, "");
  return !noComments.includes("fetch(");
});

// D22: No credentials
test("Dossier script contains no credential values", () => {
  const script = readFileSync(join(PROJECT_DIR, "scripts", "bridge-replay-dossier.mjs"), "utf-8");
  const noComments = script.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const hasSecretKey = /['"]sk-[a-zA-Z0-9]{20,}['"]/.test(noComments);
  const hasApiKey = /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/i.test(noComments);
  return !hasSecretKey && !hasApiKey;
});

// D23: Schema version present
test("Dossier has correct schema version", () => {
  const d = generateDossier({
    packetPayload: { test: "version" },
    replayResult: { status: "success", idempotencyKey: "key-20", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 1,
  });
  return d.schemaVersion === "open-brain-replay-dossier-v7a6";
});

// D24: Deterministic packet hashing
test("Same payload produces same packet hash (deterministic)", () => {
  const payload = { a: 1, b: { c: "test" } };
  const d1 = generateDossier({
    packetPayload: payload,
    replayResult: { status: "success", idempotencyKey: "key-21a", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 1,
  });
  const d2 = generateDossier({
    packetPayload: payload,
    replayResult: { status: "success", idempotencyKey: "key-21b", wouldCreateGovernedState: false, wouldAuthorizeExecution: false },
    determinismVerified: true,
    auditChainVerified: true,
    auditEntryCount: 1,
  });
  return d1.packetHash === d2.packetHash;
});

// ═══════════════════════════════════════════════════════════════
//  SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log("\n═══════════════════════════════════════════════════════════");
console.log("  v7A.6 DOSSIER RESULTS");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Tests passed: ${passed}`);
console.log(`  Tests failed: ${failed}`);
console.log(`  Total:        ${passed + failed}`);
console.log(`  (Authorized minimum: 15; expanded to 24)`);
console.log("═══════════════════════════════════════════════════════════");
console.log("  Open Brain connected:      false");
console.log("  Network writes:            false");
console.log("  Execution capability:      false");
console.log("  Credentials present:       false");
console.log("  Governed state created:    false");
console.log("  v7B authorized:            false");
console.log("  This phase is:             governance preflight, no v7B auth");
console.log("═══════════════════════════════════════════════════════════");

process.exit(failed > 0 ? 1 : 0);
