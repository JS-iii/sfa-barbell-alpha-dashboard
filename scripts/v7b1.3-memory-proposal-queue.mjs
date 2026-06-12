#!/usr/bin/env node
/**
 * v7b1.3-memory-proposal-queue.mjs — v7B.1.3 Memory Proposal Queue
 *
 * Local-only memory proposal generation, validation, review, and
 * promotion packet preparation. No database writes.
 *
 * Tests: 25+ covering safe/unsafe/malformed proposals, governance,
 * review ledger, promotion packets, credential redaction.
 *
 * USAGE: npm run v7b1.3:proposal-queue
 *   (or: node scripts/v7b1.3-memory-proposal-queue.mjs)
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_DIR = join(dirname(__filename), "..");

// ═══════════════════════════════════════════════════════════════
//  INLINE MODULES (ported from src/bridge/v7b/)
// ═══════════════════════════════════════════════════════════════

const PROPOSAL_VERSION = "v7b1.3";
const MAX_CONTENT_LENGTH = 10000;
const MIN_CONFIDENCE = 0.1;
const EMBEDDING_DIM = 768;

// ── Schema defaults ────────────────────────────────────────────
function defaultGovernance() {
  return {
    isGovernedState: false,
    containsTradeOrders: false,
    notExecutionAuthority: true,
    containsCredentials: false,
    containsWalletReferences: false,
    isStrategyInstruction: false,
  };
}

function initialReview() {
  return { status: "proposed", reviewedBy: null, reviewedAt: null, rejectionReason: null, revisionNotes: null };
}

// ── Proposal generator ─────────────────────────────────────────
function generateProposal(content, source, confidence = 0.8, overrides = {}) {
  return {
    proposalId: crypto.randomUUID(),
    version: PROPOSAL_VERSION,
    createdAt: new Date().toISOString(),
    content,
    metadata: {
      source,
      version: PROPOSAL_VERSION,
      confidence,
      proposedBy: "v7b1.3-proposal-queue",
      proposedAt: new Date().toISOString(),
      governance: { ...defaultGovernance(), ...(overrides.governance || {}) },
      ...(overrides.tags ? { tags: overrides.tags } : {}),
      ...(overrides.context ? { context: overrides.context } : {}),
    },
    validation: null,
    safety: null,
    review: initialReview(),
  };
}

// ── Validator ──────────────────────────────────────────────────
function validateProposal(p) {
  const checks = [];
  const check = (name, condition, reason) => ({ name, passed: condition, reason: condition ? undefined : reason });

  checks.push(check("content_present", typeof p.content === "string" && p.content.trim().length > 0, "Content must be non-empty"));
  checks.push(check("content_length", typeof p.content === "string" && p.content.length <= MAX_CONTENT_LENGTH, `Content exceeds ${MAX_CONTENT_LENGTH} chars`));
  checks.push(check("source_present", typeof p.metadata?.source === "string" && p.metadata.source.trim().length > 0, "Metadata.source required"));
  checks.push(check("confidence_range", typeof p.metadata?.confidence === "number" && p.metadata.confidence >= MIN_CONFIDENCE && p.metadata.confidence <= 1.0, `Confidence must be ${MIN_CONFIDENCE}-1.0`));
  checks.push(check("governance_present", p.metadata?.governance != null, "Metadata.governance required"));
  checks.push(check("not_governed_state", p.metadata?.governance?.isGovernedState === false, "isGovernedState must be false"));
  checks.push(check("no_trade_orders", p.metadata?.governance?.containsTradeOrders === false, "containsTradeOrders must be false"));
  checks.push(check("not_execution_authority", p.metadata?.governance?.notExecutionAuthority === true, "notExecutionAuthority must be true"));
  checks.push(check("no_credentials", p.metadata?.governance?.containsCredentials === false, "containsCredentials must be false"));
  checks.push(check("no_wallet_refs", p.metadata?.governance?.containsWalletReferences === false, "containsWalletReferences must be false"));
  checks.push(check("no_strategy", p.metadata?.governance?.isStrategyInstruction === false, "isStrategyInstruction must be false"));
  checks.push(check("proposal_id", typeof p.proposalId === "string" && p.proposalId.length > 0, "proposalId required"));
  checks.push(check("version_valid", typeof p.version === "string" && p.version.startsWith("v7b"), "Version must be v7b-prefixed"));

  const allPassed = checks.every(c => c.passed);
  return { passed: allPassed, checkedAt: new Date().toISOString(), checks };
}

// ── Safety classifier ──────────────────────────────────────────
const CRED_PATTERNS = [
  /\bsb[p_][a-zA-Z0-9_-]{20,}/, /\bsk-[a-zA-Z0-9]{20,}/, /\bpk-[a-zA-Z0-9]{20,}/,
  /\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*/, /\b0x[a-f0-9]{40,}\b/i,
  /\bprivate[_\s]?key\b/i, /\bapi[_\s]?key\s*[=:]\s*["']?[a-zA-Z0-9]{10,}/i,
  /\bpassword\s*[=:]\s*["']?[^\s"']{4,}/i,
];
const TRADE_PATTERNS = [
  /\b(buy|sell)\s+(\d+\.?\d*)\s*(shares|contracts|units)\b/i,
  /\b(go\s+long|go\s+short)\b/i, /\b(market\s+order|limit\s+order|stop\s+loss)\b/i,
  /\b(open|close)\s+position\b/i, /\bleverage\s*[:=]\s*\d+x?\b/i,
];
const STRATEGY_PATTERNS = [
  /\boverride\s+(risk|policy|threshold|gate)\b/i,
  /\bchange\s+(risk\s+limit|stop\s+loss|position\s+size)\b/i,
  /\bignore\s+(risk|stop|threshold)\b/i,
  /\bset\s+risk\s*[:=]\s*\d+\.?\d*\b/i,
];

function classifySafety(p) {
  const flags = [];
  const text = `${p.content} ${JSON.stringify(p.metadata)}`;
  const g = p.metadata?.governance;

  if (g?.isGovernedState === true) flags.push("GOVERNED_STATE");
  if (g?.containsTradeOrders === true) flags.push("TRADE_ORDERS");
  if (g?.notExecutionAuthority === false) flags.push("CLAIMS_EXECUTION_AUTHORITY");
  if (CRED_PATTERNS.some(rx => rx.test(text))) flags.push("CREDENTIAL_LEAK");
  if (TRADE_PATTERNS.some(rx => rx.test(text))) flags.push("TRADE_ORDERS");
  if (STRATEGY_PATTERNS.some(rx => rx.test(text))) flags.push("STRATEGY_OVERRIDE");
  if (/\b0x[a-f0-9]{40}\b/i.test(text)) flags.push("WALLET_REFERENCE");
  if (!p.metadata?.source) flags.push("MISSING_SOURCE");
  if (!g) flags.push("MISSING_GOVERNANCE_DECLARATION");
  if (typeof p.metadata?.confidence === "number" && p.metadata.confidence < 0.3) flags.push("LOW_CONFIDENCE");

  return {
    safe: flags.length === 0,
    flags: [...new Set(flags)],
    advisoryOnly: true,
    executionAuthority: flags.includes("CLAIMS_EXECUTION_AUTHORITY") || flags.includes("TRADE_ORDERS") || flags.includes("STRATEGY_OVERRIDE"),
  };
}

// ── Review ledger ──────────────────────────────────────────────
function approveForManualWrite(record, reviewer) {
  return { ...record, status: "approved_for_manual_write", reviewedBy: reviewer, reviewedAt: new Date().toISOString(), rejectionReason: null };
}
function reject(record, reviewer, reason) {
  return { ...record, status: "rejected", reviewedBy: reviewer, reviewedAt: new Date().toISOString(), rejectionReason: reason };
}
function requestRevision(record, reviewer, notes) {
  return { ...record, status: "needs_revision", reviewedBy: reviewer, reviewedAt: new Date().toISOString(), revisionNotes: notes };
}
function isReadyForPromotion(p) {
  return p.validation?.passed === true && p.safety?.safe === true && p.review?.status === "approved_for_manual_write";
}

// ── Promotion packet ───────────────────────────────────────────
function generatePromotionPacket(p) {
  const ready = isReadyForPromotion(p);
  let sql = null;
  let rest = null;

  if (ready) {
    const zv = `array_fill(0, ARRAY[${EMBEDDING_DIM}])::vector`;
    const meta = JSON.stringify(p.metadata).replace(/'/g, "''");
    sql = `INSERT INTO public.memories (id, content, metadata, embedding) VALUES ('${p.proposalId}', '${p.content.replace(/'/g, "''")}', '${meta}'::jsonb, ${zv}) RETURNING id, content, metadata, created_at;`;
    rest = { id: p.proposalId, content: p.content, metadata: p.metadata, embedding: Array(EMBEDDING_DIM).fill(0) };
  }

  return {
    packetId: `pkt-${p.proposalId}`,
    generatedAt: new Date().toISOString(),
    proposalId: p.proposalId,
    readyForExecution: ready,
    reasonIfNotReady: ready ? null : [
      !p.validation?.passed ? "Validation failed" : null,
      !p.safety?.safe ? `Safety: ${p.safety?.flags?.join(", ")}` : null,
      p.review?.status !== "approved_for_manual_write" ? `Review: ${p.review?.status}` : null,
    ].filter(Boolean).join("; ") || "Unknown",
    sqlStatement: sql,
    restPayload: rest,
    governanceAttestation: [
      `isGovernedState: ${p.metadata?.governance?.isGovernedState} (req: false)`,
      `containsTradeOrders: ${p.metadata?.governance?.containsTradeOrders} (req: false)`,
      `notExecutionAuthority: ${p.metadata?.governance?.notExecutionAuthority} (req: true)`,
      `containsCredentials: ${p.metadata?.governance?.containsCredentials} (req: false)`,
      `Safety: ${p.safety?.safe ? "CLEAR" : "FLAGS: " + p.safety?.flags?.join(", ")}`,
      `Review: ${p.review?.status}`,
    ].join("\n"),
    operatorInstructions: ready
      ? "1. Review SQL. 2. Verify governance. 3. Copy to SQL Editor. 4. Execute manually. 5. Verify with SELECT."
      : "Packet NOT ready. Review reasonIfNotReady and governance attestation.",
  };
}

// ── Redaction ──────────────────────────────────────────────────
function redact(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/sbp_[a-zA-Z0-9_-]{20,}/g, "[REDACTED-sbp]")
    .replace(/eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*/g, "[REDACTED-jwt]")
    .replace(/sk-[a-zA-Z0-9]{20,}/g, "[REDACTED-sk]")
    .replace(/\b0x[a-f0-9]{40,}\b/gi, "[REDACTED-wallet]");
}

// ═══════════════════════════════════════════════════════════════
//  TESTS
// ═══════════════════════════════════════════════════════════════

console.log("═══════════════════════════════════════════════════════════");
console.log("  v7B.1.3: Memory Proposal Queue");
console.log("  " + new Date().toISOString());
console.log("═══════════════════════════════════════════════════════════\n");

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { if (fn()) { console.log(`   ✅ ${name}`); passed++; } else { console.log(`   ❌ ${name}`); failed++; } }
  catch (e) { console.log(`   ❌ ${name} — ${e.message}`); failed++; }
}

// ── Section 1: Safe Proposal Tests ─────────────────────────────
console.log("[1] Safe Proposal Tests\n");

test("Valid proposal passes all checks", () => {
  const p = generateProposal("Market observation: SPY showed defensive posture at open.", "v7b1.3-test", 0.85);
  p.validation = validateProposal(p);
  p.safety = classifySafety(p);
  return p.validation.passed && p.safety.safe;
});

test("Proposal with tags is valid", () => {
  const p = generateProposal("Sector rotation noted.", "v7b1.3-test", 0.9, { tags: ["macro", "rotation"] });
  p.validation = validateProposal(p);
  return p.validation.passed;
});

test("Proposal with context is valid", () => {
  const p = generateProposal("Volatility spike.", "v7b1.3-test", 0.75, { context: { ticker: "VIX", threshold: 20 } });
  p.validation = validateProposal(p);
  return p.validation.passed;
});

test("Min confidence (0.1) is valid", () => {
  const p = generateProposal("Weak signal.", "v7b1.3-test", 0.1);
  p.validation = validateProposal(p);
  return p.validation.passed;
});

test("Max confidence (1.0) is valid", () => {
  const p = generateProposal("Strong signal.", "v7b1.3-test", 1.0);
  p.validation = validateProposal(p);
  return p.validation.passed;
});

// ── Section 2: Unsafe Proposal Tests ───────────────────────────
console.log("\n[2] Unsafe Proposal Tests\n");

test("Governed state proposal is rejected", () => {
  const p = generateProposal("Safe content.", "test", 0.8, { governance: { ...defaultGovernance(), isGovernedState: true } });
  p.validation = validateProposal(p);
  return !p.validation.passed && p.validation.checks.some(c => c.name === "not_governed_state" && !c.passed);
});

test("Trade orders proposal is rejected", () => {
  const p = generateProposal("Safe content.", "test", 0.8, { governance: { ...defaultGovernance(), containsTradeOrders: true } });
  p.validation = validateProposal(p);
  return !p.validation.passed && p.validation.checks.some(c => c.name === "no_trade_orders" && !c.passed);
});

test("Execution authority claim is rejected", () => {
  const p = generateProposal("Safe content.", "test", 0.8, { governance: { ...defaultGovernance(), notExecutionAuthority: false } });
  p.validation = validateProposal(p);
  return !p.validation.passed && p.validation.checks.some(c => c.name === "not_execution_authority" && !c.passed);
});

test("Credential in content is flagged", () => {
  const p = generateProposal("Key: sbp_abcdefghijklmnopqrstuv", "test", 0.8);
  p.safety = classifySafety(p);
  return !p.safety.safe && p.safety.flags.includes("CREDENTIAL_LEAK");
});

test("Trade instruction in content is flagged", () => {
  const p = generateProposal("Buy 100 shares of AAPL at market open.", "test", 0.8);
  p.safety = classifySafety(p);
  return !p.safety.safe && p.safety.flags.includes("TRADE_ORDERS");
});

test("Wallet address in content is flagged", () => {
  const p = generateProposal("Transfer to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbD", "test", 0.8);
  p.safety = classifySafety(p);
  return !p.safety.safe && p.safety.flags.includes("WALLET_REFERENCE");
});

test("Strategy override in content is flagged", () => {
  const p = generateProposal("Override risk threshold for this trade.", "test", 0.8);
  p.safety = classifySafety(p);
  return !p.safety.safe && p.safety.flags.includes("STRATEGY_OVERRIDE");
});

// ── Section 3: Malformed Proposal Tests ────────────────────────
console.log("\n[3] Malformed Proposal Tests\n");

test("Empty content is rejected", () => {
  const p = generateProposal("", "test", 0.8);
  p.validation = validateProposal(p);
  return !p.validation.passed && p.validation.checks.some(c => c.name === "content_present" && !c.passed);
});

test("Missing source is rejected", () => {
  const p = generateProposal("Valid content.", "", 0.8);
  p.validation = validateProposal(p);
  return !p.validation.passed && p.validation.checks.some(c => c.name === "source_present" && !c.passed);
});

test("Zero confidence is rejected", () => {
  const p = generateProposal("Content.", "test", 0.0);
  p.validation = validateProposal(p);
  return !p.validation.passed && p.validation.checks.some(c => c.name === "confidence_range" && !c.passed);
});

test("Above 1.0 confidence is rejected", () => {
  const p = generateProposal("Content.", "test", 1.5);
  p.validation = validateProposal(p);
  return !p.validation.passed && p.validation.checks.some(c => c.name === "confidence_range" && !c.passed);
});

test("Missing governance is rejected", () => {
  const p = generateProposal("Content.", "test", 0.8);
  delete p.metadata.governance;
  p.validation = validateProposal(p);
  return !p.validation.passed && p.validation.checks.some(c => c.name === "governance_present" && !c.passed);
});

test("Oversized content is rejected", () => {
  const p = generateProposal("x".repeat(MAX_CONTENT_LENGTH + 1), "test", 0.8);
  p.validation = validateProposal(p);
  return !p.validation.passed && p.validation.checks.some(c => c.name === "content_length" && !c.passed);
});

// ── Section 4: Review Ledger Tests ─────────────────────────────
console.log("\n[4] Review Ledger Tests\n");

test("Initial status is 'proposed'", () => {
  const p = generateProposal("Content.", "test", 0.8);
  return p.review.status === "proposed";
});

test("Approve transitions to approved_for_manual_write", () => {
  const p = generateProposal("Content.", "test", 0.8);
  p.validation = validateProposal(p);
  p.safety = classifySafety(p);
  p.review = approveForManualWrite(p.review, "operator");
  return p.review.status === "approved_for_manual_write" && p.review.reviewedBy === "operator";
});

test("Reject transitions to rejected with reason", () => {
  const p = generateProposal("Content.", "test", 0.8);
  p.review = reject(p.review, "operator", "Too speculative");
  return p.review.status === "rejected" && p.review.rejectionReason === "Too speculative";
});

test("Request revision transitions to needs_revision", () => {
  const p = generateProposal("Content.", "test", 0.8);
  p.review = requestRevision(p.review, "operator", "Add confidence score");
  return p.review.status === "needs_revision" && p.review.revisionNotes === "Add confidence score";
});

test("Ready for promotion only when all gates pass", () => {
  const p = generateProposal("Content.", "test", 0.8);
  p.validation = validateProposal(p);
  p.safety = classifySafety(p);
  p.review = approveForManualWrite(p.review, "op");
  return isReadyForPromotion(p);
});

test("Not ready if validation fails", () => {
  const p = generateProposal("", "", 0.8);
  p.validation = validateProposal(p);
  p.safety = classifySafety(p);
  p.review = approveForManualWrite(p.review, "op");
  return !isReadyForPromotion(p);
});

test("Not ready if safety flags exist", () => {
  const p = generateProposal("Buy 100 shares now.", "test", 0.8);
  p.validation = validateProposal(p);
  p.safety = classifySafety(p);
  p.review = approveForManualWrite(p.review, "op");
  return !isReadyForPromotion(p);
});

test("Not ready if not reviewed", () => {
  const p = generateProposal("Content.", "test", 0.8);
  p.validation = validateProposal(p);
  p.safety = classifySafety(p);
  return !isReadyForPromotion(p);
});

// ── Section 5: Promotion Packet Tests ──────────────────────────
console.log("\n[5] Promotion Packet Tests\n");

test("Ready packet has SQL statement", () => {
  const p = generateProposal("Content.", "test", 0.8);
  p.validation = validateProposal(p);
  p.safety = classifySafety(p);
  p.review = approveForManualWrite(p.review, "op");
  const pkt = generatePromotionPacket(p);
  return pkt.readyForExecution && pkt.sqlStatement !== null && pkt.sqlStatement.includes("INSERT INTO public.memories");
});

test("Ready packet has REST payload", () => {
  const p = generateProposal("Content.", "test", 0.8);
  p.validation = validateProposal(p);
  p.safety = classifySafety(p);
  p.review = approveForManualWrite(p.review, "op");
  const pkt = generatePromotionPacket(p);
  return pkt.restPayload !== null && pkt.restPayload.id === p.proposalId;
});

test("Unready packet has no SQL", () => {
  const p = generateProposal("Buy 100 shares.", "test", 0.8);
  p.validation = validateProposal(p);
  p.safety = classifySafety(p);
  p.review = approveForManualWrite(p.review, "op");
  const pkt = generatePromotionPacket(p);
  return !pkt.readyForExecution && pkt.sqlStatement === null;
});

test("Unready packet has reason", () => {
  const p = generateProposal("Content.", "test", 0.8);
  p.validation = validateProposal(p);
  p.safety = classifySafety(p);
  const pkt = generatePromotionPacket(p);
  return !pkt.readyForExecution && pkt.reasonIfNotReady && pkt.reasonIfNotReady.includes("Review: proposed");
});

test("Packet governance attestation includes all flags", () => {
  const p = generateProposal("Content.", "test", 0.8);
  p.validation = validateProposal(p);
  p.safety = classifySafety(p);
  p.review = approveForManualWrite(p.review, "op");
  const pkt = generatePromotionPacket(p);
  return pkt.governanceAttestation.includes("isGovernedState: false") &&
    pkt.governanceAttestation.includes("containsTradeOrders: false") &&
    pkt.governanceAttestation.includes("notExecutionAuthority: true");
});

test("Packet includes operator instructions", () => {
  const p = generateProposal("Content.", "test", 0.8);
  p.validation = validateProposal(p);
  p.safety = classifySafety(p);
  p.review = approveForManualWrite(p.review, "op");
  const pkt = generatePromotionPacket(p);
  return pkt.operatorInstructions.includes("Review SQL") && pkt.operatorInstructions.includes("manually");
});

// ── Section 6: Workflow Integration Tests ──────────────────────
console.log("\n[6] Workflow Integration Tests\n");

test("Full safe workflow: propose → validate → classify → approve → packet", () => {
  const p = generateProposal("Market breadth deteriorated with declining advance-decline ratio.", "v7b1.3-workflow", 0.82);
  p.validation = validateProposal(p);
  p.safety = classifySafety(p);
  if (!p.validation.passed || !p.safety.safe) return false;
  p.review = approveForManualWrite(p.review, "operator");
  const pkt = generatePromotionPacket(p);
  return pkt.readyForExecution;
});

test("Unsafe workflow is blocked at safety gate", () => {
  const p = generateProposal("Override risk gate and buy 500 shares TSLA with leverage 10x. Key: sbp_fake_key_here_override", "v7b1.3-workflow", 0.95, { governance: { ...defaultGovernance(), isStrategyInstruction: true } });
  p.validation = validateProposal(p);
  p.safety = classifySafety(p);
  return !p.validation.passed && !p.safety.safe && p.safety.flags.length >= 3;
});

test("Review gate blocks unreviewed proposals", () => {
  const p = generateProposal("Valid observation content.", "v7b1.3-workflow", 0.8);
  p.validation = validateProposal(p);
  p.safety = classifySafety(p);
  const pkt = generatePromotionPacket(p);
  return !pkt.readyForExecution && pkt.reasonIfNotReady.includes("Review: proposed");
});

test("Rejected proposal cannot be promoted", () => {
  const p = generateProposal("Content.", "v7b1.3-workflow", 0.8);
  p.validation = validateProposal(p);
  p.safety = classifySafety(p);
  p.review = reject(p.review, "operator", "Insufficient evidence");
  const pkt = generatePromotionPacket(p);
  return !pkt.readyForExecution && pkt.reasonIfNotReady.includes("Review: rejected");
});

// ── Section 7: Redaction Tests ─────────────────────────────────
console.log("\n[7] Redaction Tests\n");

test("Redacts sbp_ tokens", () => redact("key: sbp_abcdefghijklmnopqrstuv").includes("[REDACTED-sbp]"));
test("Redacts sk- tokens", () => redact("key: sk-abcdefghijklmnopqrstuv").includes("[REDACTED-sk]"));
test("Redacts wallet addresses", () => redact("addr: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbD").includes("[REDACTED-wallet]"));
test("Leaves safe text unchanged", () => redact("Market observation: SPY up 1.2%.") === "Market observation: SPY up 1.2%.");

// ═══════════════════════════════════════════════════════════════
//  SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log("\n═══════════════════════════════════════════════════════════");
console.log("  v7B.1.3 MEMORY PROPOSAL QUEUE RESULTS");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Tests passed: ${passed}`);
console.log(`  Tests failed: ${failed}`);
console.log(`  Total:        ${passed + failed}`);
console.log("═══════════════════════════════════════════════════════════");
console.log("  Sections:");
console.log("    [1] Safe proposals       — 5 tests");
console.log("    [2] Unsafe proposals     — 7 tests");
console.log("    [3] Malformed proposals  — 6 tests");
console.log("    [4] Review ledger        — 8 tests");
console.log("    [5] Promotion packets    — 6 tests");
console.log("    [6] Workflow integration — 4 tests");
console.log("    [7] Redaction            — 4 tests");
console.log("═══════════════════════════════════════════════════════════");
console.log("  Write path:        DISABLED by default");
console.log("  Proposal queue:    LOCAL-ONLY");
console.log("  Human review:      REQUIRED");
console.log("  Auto-write:        FORBIDDEN");
console.log("  v7B.2 authorized:  false");
console.log("═══════════════════════════════════════════════════════════");

// ── Save evidence ──────────────────────────────────────────────
const evidence = {
  phase: "v7b1.3-memory-proposal-queue",
  date: new Date().toISOString(),
  tests: { passed, failed, total: passed + failed },
  sections: {
    safeProposals: 5,
    unsafeProposals: 7,
    malformedProposals: 6,
    reviewLedger: 8,
    promotionPackets: 6,
    workflowIntegration: 4,
    redaction: 4,
  },
  safety: {
    writePathDisabled: true,
    localOnly: true,
    humanReviewRequired: true,
    autoWriteForbidden: true,
    v7b2Authorized: false,
  },
};

writeFileSync(
  join(PROJECT_DIR, "docs", "v7b", "v7b1.3-proposal-queue-evidence.json"),
  JSON.stringify(evidence, null, 2)
);

process.exit(failed > 0 ? 1 : 0);
