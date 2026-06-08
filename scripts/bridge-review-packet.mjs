#!/usr/bin/env node
/**
 * bridge-review-packet.mjs — v7A.2 Observation Review Packet + Human Promotion Gate
 *
 * Pipeline:
 *   AlphaSnapshot → OpenBrainObservationDraft → ReviewPacket → Human Decision → Local Ledger
 *
 * Allowed decisions: accept_for_future_observation_write, reject, needs_revision, defer
 * Forbidden decisions: approved_for_execution, trade_ready, governed_state, live_write_ready
 *
 * Run: npm run bridge:review-packet
 *
 * NO network writes. NO credentials. NO execution capability.
 */

import { readFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_DIR = join(dirname(__filename), "..");

// ── Constants ───────────────────────────────────────────────────

const ALLOWED_DECISIONS = [
  "accept_for_future_observation_write",
  "reject",
  "needs_revision",
  "defer",
];

const FORBIDDEN_DECISIONS = [
  "approved_for_execution",
  "trade_ready",
  "governed_state",
  "live_write_ready",
];

const LEDGER_DIR = join(PROJECT_DIR, "data", "dry-run");
const LEDGER_PATH = join(LEDGER_DIR, "decision-ledger-v7a2.jsonl");

// ── Load snapshot ───────────────────────────────────────────────

const SNAPSHOT_PATH = process.argv[2] || "public/data/mock-alpha-snapshot.json";
const snapshotFullPath = SNAPSHOT_PATH.startsWith("/")
  ? SNAPSHOT_PATH
  : join(PROJECT_DIR, SNAPSHOT_PATH);

console.log("═══════════════════════════════════════════════════════════");
console.log("  v7A.2 Observation Review Packet + Human Promotion Gate");
console.log("  " + new Date().toISOString());
console.log("═══════════════════════════════════════════════════════════\n");

let snapshot;
try {
  snapshot = JSON.parse(readFileSync(snapshotFullPath, "utf-8"));
} catch (e) {
  console.log(`❌ Failed to load snapshot: ${e.message}`);
  process.exit(1);
}

// ── Inline transformer (same as bridge-dry-run) ─────────────────

function transformToDraft(snap) {
  return {
    schemaVersion: "open-brain-observation-draft-v7a",
    draftedAt: new Date().toISOString(),
    sourceSnapshot: {
      schemaVersion: snap.provenance.schemaVersion,
      generatedAt: snap.provenance.generatedAt,
      source: snap.provenance.source,
      dataHash: snap.provenance.dataHash,
      generatorCommit: snap.provenance.generatorCommit,
    },
    providerStatus: snap.providers.map((p) => ({
      name: p.name,
      status: p.status,
      lastUpdated: p.lastUpdated,
      latencyMs: p.latencyMs,
      error: p.error,
    })),
    assetObservations: snap.assets.map((a) => ({
      symbol: a.symbol,
      name: a.name,
      regime: a.regime,
      score: a.score,
      confidence: a.confidence,
      classification: a.classification,
      providerContributions: a.providerContributions,
    })),
    regimeObservation: {
      currentRegime: snap.regime.currentRegime,
      priorRegime: snap.regime.priorRegime,
      transitionConfidence: snap.regime.transitionConfidence,
      description: snap.regime.description,
    },
    compositeObservation: {
      signal: snap.composite.signal,
      confidence: snap.composite.confidence,
      contributingFactors: snap.composite.contributingFactors,
      blockingIssues: snap.composite.blockingIssues,
    },
    safety: {
      notExecutionAuthority: true,
      containsTradeOrders: false,
      containsWalletReferences: false,
      containsExecutionInstructions: false,
      containsCredentials: false,
    },
    governance: {
      requiresHumanReview: true,
      isGovernedState: false,
      dataMode: snap.data_mode || "unknown",
      networkWriteStatus: "dry-run-local-only",
    },
  };
}

// ── Review packet generator ─────────────────────────────────────

function generateReviewPacket(draft) {
  // Pre-check: draft must pass safety boundaries
  const criticalErrors = [];

  if (draft.safety.notExecutionAuthority !== true)
    criticalErrors.push("Draft claims execution authority");
  if (draft.safety.containsTradeOrders !== false)
    criticalErrors.push("Draft contains trade orders");
  if (draft.safety.containsExecutionInstructions !== false)
    criticalErrors.push("Draft contains execution instructions");
  if (draft.safety.containsWalletReferences !== false)
    criticalErrors.push("Draft contains wallet references");
  if (draft.safety.containsCredentials !== false)
    criticalErrors.push("Draft contains credentials");
  if (draft.governance.isGovernedState !== false)
    criticalErrors.push("Draft claims governed state");
  if (draft.governance.requiresHumanReview !== true)
    criticalErrors.push("Draft does not require human review");
  if (draft.governance.networkWriteStatus !== "dry-run-local-only")
    criticalErrors.push(`Draft networkWriteStatus: ${draft.governance.networkWriteStatus}`);

  if (criticalErrors.length > 0) {
    return { packet: null, errors: criticalErrors };
  }

  // Build key findings
  const findings = [];
  findings.push(`Composite signal: ${draft.compositeObservation.signal} (${Math.round(draft.compositeObservation.confidence * 100)}% confidence)`);
  findings.push(`Regime: ${draft.regimeObservation.currentRegime}`);

  const defensive = draft.assetObservations.filter((a) => a.classification === "flight_to_safety");
  const riskOn = draft.assetObservations.filter((a) => a.classification === "risk_on");
  findings.push(`Barbell: ${defensive.length} defensive, ${riskOn.length} risk-on assets`);

  const degraded = draft.providerStatus.filter((p) => p.status === "degraded");
  if (degraded.length > 0)
    findings.push(`Degraded providers: ${degraded.map((p) => p.name).join(", ")}`);

  if (draft.governance.dataMode === "mock")
    findings.push("DATA SOURCE: Mock baseline — not live market data");

  // Build risk flags
  const riskFlags = [];

  if (draft.governance.dataMode === "mock") {
    riskFlags.push({
      severity: "warning", category: "data_source",
      description: "Snapshot is mock data. Verify with live data before promotion.",
      blocksAcceptance: false,
    });
  }

  if (draft.compositeObservation.confidence < 0.3) {
    riskFlags.push({
      severity: "critical", category: "confidence",
      description: `Critical confidence (${Math.round(draft.compositeObservation.confidence * 100)}%). Acceptance NOT recommended.`,
      blocksAcceptance: true,
    });
  } else if (draft.compositeObservation.confidence < 0.5) {
    riskFlags.push({
      severity: "warning", category: "confidence",
      description: `Low confidence (${Math.round(draft.compositeObservation.confidence * 100)}%). Review provider status.`,
      blocksAcceptance: false,
    });
  }

  const degradedCount = draft.providerStatus.filter((p) => p.status === "degraded").length;
  if (degradedCount > 0) {
    riskFlags.push({
      severity: degradedCount >= 2 ? "critical" : "warning",
      category: "provider_degradation",
      description: `${degradedCount} provider(s) degraded.`,
      blocksAcceptance: degradedCount >= 2,
    });
  }

  riskFlags.push({
    severity: "info", category: "governance",
    description: "For observation review only. Does not authorize execution or governed state.",
    blocksAcceptance: false,
  });

  // Build packet
  const packet = {
    schemaVersion: "open-brain-review-packet-v7a2",
    generatedAt: new Date().toISOString(),
    sourceDraft: {
      schemaVersion: draft.schemaVersion,
      draftedAt: draft.draftedAt,
      snapshotGeneratedAt: draft.sourceSnapshot.generatedAt,
      snapshotSource: draft.sourceSnapshot.source,
    },
    summary: {
      title: `Review: ${draft.regimeObservation.currentRegime} | ${draft.compositeObservation.signal}`,
      signal: draft.compositeObservation.signal,
      confidence: draft.compositeObservation.confidence,
      regime: draft.regimeObservation.currentRegime,
      assetCount: draft.assetObservations.length,
      activeProviders: draft.providerStatus.filter((p) => p.status === "active" || p.status === "degraded").length,
      degradedProviders: degradedCount,
      isMockData: draft.governance.dataMode === "mock",
      keyFindings: findings,
    },
    riskFlags,
    decision: {
      recordedInLedger: false,
      allowedDecisions: [...ALLOWED_DECISIONS],
      blockedDecisions: [...FORBIDDEN_DECISIONS],
    },
    safety: {
      notExecutionAuthority: true,
      isGovernedState: false,
      networkWriteStatus: "dry-run-local-only",
      humanReviewRequired: true,
    },
    audit: {
      packetGeneratedBy: "v7a2-review-packet-generator",
      bridgeVersion: "v7a2",
      reviewPhase: "pre-write-human-review",
    },
  };

  return { packet, errors: [] };
}

// ── Decision validator ──────────────────────────────────────────

function validateDecision(decision, packet) {
  const errors = [];
  const isAllowed = ALLOWED_DECISIONS.includes(decision);
  const isForbidden = FORBIDDEN_DECISIONS.includes(decision);

  if (isForbidden) {
    errors.push(`FORBIDDEN: "${decision}" would escalate authority beyond observation review`);
  } else if (!isAllowed) {
    errors.push(`INVALID: "${decision}" not recognized`);
  }

  if (packet.safety.notExecutionAuthority !== true)
    errors.push("Packet lacks notExecutionAuthority");
  if (packet.safety.isGovernedState !== false)
    errors.push("Packet claims governed state");
  if (packet.safety.networkWriteStatus !== "dry-run-local-only")
    errors.push("Packet networkWriteStatus not dry-run");
  if (packet.safety.humanReviewRequired !== true)
    errors.push("Packet does not require human review");

  return {
    valid: errors.length === 0 && isAllowed,
    errors,
    decisionAllowed: isAllowed && !isForbidden,
  };
}

function recordDecision(packet, humanDecision, reviewerNotes) {
  if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR, { recursive: true });

  const entry = {
    timestamp: new Date().toISOString(),
    packetSchemaVersion: packet.schemaVersion,
    packetGeneratedAt: packet.generatedAt,
    draftSchemaVersion: packet.sourceDraft.schemaVersion,
    sourceSnapshotGeneratedAt: packet.sourceDraft.snapshotGeneratedAt,
    humanDecision,
    reviewerNotes,
    eligibleForV7BWrite: humanDecision === "accept_for_future_observation_write",
    safety: {
      notExecutionAuthority: true,
      isGovernedState: false,
      networkWriteStatus: "dry-run-local-only",
      humanReviewRequired: true,
    },
    audit: {
      ledgerVersion: "v7a2",
      entryType: "human-decision",
    },
  };

  appendFileSync(LEDGER_PATH, JSON.stringify(entry) + "\n");
  return entry;
}

// ── Step 1: Transform ──────────────────────────────────────────

console.log("[1] Transforming snapshot to observation draft...\n");
const draft = transformToDraft(snapshot);

// ── Step 2: Generate review packet ─────────────────────────────

console.log("[2] Generating review packet...\n");
const { packet, errors: packetErrors } = generateReviewPacket(draft);

if (!packet) {
  console.log("❌ PACKET GENERATION BLOCKED:");
  packetErrors.forEach((e) => console.log(`   - ${e}`));
  process.exit(1);
}

console.log(`   ✅ Packet generated: ${packet.schemaVersion}`);
console.log(`   ✅ Safety: notExecutionAuthority=${packet.safety.notExecutionAuthority}`);
console.log(`   ✅ Governance: isGovernedState=${packet.safety.isGovernedState}`);
console.log(`   ✅ Network: ${packet.safety.networkWriteStatus}`);
console.log(`   ✅ humanReviewRequired: ${packet.safety.humanReviewRequired}`);
console.log(`   📊 Signal: ${packet.summary.signal} (${Math.round(packet.summary.confidence * 100)}%)`);
console.log(`   📊 Assets: ${packet.summary.assetCount} | Providers: ${packet.summary.activeProviders} (${packet.summary.degradedProviders} degraded)`);
console.log(`   🚩 Risk flags: ${packet.riskFlags.length}`);
packet.riskFlags.forEach((f) => {
  const icon = f.severity === "critical" ? "🔴" : f.severity === "warning" ? "🟡" : "🔵";
  console.log(`      ${icon} [${f.category}] ${f.description}${f.blocksAcceptance ? " (BLOCKS ACCEPTANCE)" : ""}`);
});
console.log();

// ── Step 3: Simulate human decisions ───────────────────────────

console.log("[3] Simulating human promotion gate decisions...\n");

let decisionTestsPassed = 0;
let decisionTestsFailed = 0;

// Test each allowed decision
for (const decision of ALLOWED_DECISIONS) {
  const result = validateDecision(decision, packet);
  if (result.valid) {
    console.log(`   ✅ ALLOWED: "${decision}" — accepted`);
    decisionTestsPassed++;
  } else {
    console.log(`   ❌ FAILED: "${decision}" should be allowed but was rejected`);
    result.errors.forEach((e) => console.log(`      - ${e}`));
    decisionTestsFailed++;
  }
}

// Test each forbidden decision
for (const decision of FORBIDDEN_DECISIONS) {
  const result = validateDecision(decision, packet);
  if (!result.valid && !result.decisionAllowed) {
    console.log(`   ✅ BLOCKED: "${decision}" — correctly rejected`);
    decisionTestsPassed++;
  } else {
    console.log(`   ❌ FAILED: "${decision}" should be forbidden but was accepted`);
    decisionTestsFailed++;
  }
}

// Record an example decision to the ledger
const exampleDecision = "defer";
const validation = validateDecision(exampleDecision, packet);
if (validation.valid) {
  const entry = recordDecision(packet, exampleDecision, "Review deferred pending live data verification.");
  console.log(`   📝 Recorded example decision: "${exampleDecision}" → ledger`);
  console.log(`      eligibleForV7BWrite: ${entry.eligibleForV7BWrite}`);
}

console.log();

// ── Step 4: Embedded safety tests ──────────────────────────────

console.log("[4] Running embedded safety tests...\n");

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result) {
      console.log(`   ✅ ${name}`);
      testsPassed++;
    } else {
      console.log(`   ❌ ${name}`);
      testsFailed++;
    }
  } catch (e) {
    console.log(`   ❌ ${name} — threw: ${e.message}`);
    testsFailed++;
  }
}

// T1: Valid draft creates review packet
test("Valid draft creates review packet", () => {
  const result = generateReviewPacket(draft);
  return result.packet !== null && result.errors.length === 0;
});

// T2: Draft with execution authority cannot create packet
test("Draft with execution authority blocked from packet creation", () => {
  const badDraft = JSON.parse(JSON.stringify(draft));
  badDraft.safety.notExecutionAuthority = false;
  const result = generateReviewPacket(badDraft);
  return result.packet === null && result.errors.length > 0;
});

// T3: Draft with governed state cannot create packet
test("Draft claiming governed state blocked from packet creation", () => {
  const badDraft = JSON.parse(JSON.stringify(draft));
  badDraft.governance.isGovernedState = true;
  const result = generateReviewPacket(badDraft);
  return result.packet === null && result.errors.length > 0;
});

// T4: Draft with live write status cannot create packet
test("Draft with live-write status blocked from packet creation", () => {
  const badDraft = JSON.parse(JSON.stringify(draft));
  badDraft.governance.networkWriteStatus = "live-write-enabled";
  const result = generateReviewPacket(badDraft);
  return result.packet === null && result.errors.length > 0;
});

// T5: Draft with trade orders cannot create packet
test("Draft with trade orders blocked from packet creation", () => {
  const badDraft = JSON.parse(JSON.stringify(draft));
  badDraft.safety.containsTradeOrders = true;
  const result = generateReviewPacket(badDraft);
  return result.packet === null && result.errors.length > 0;
});

// T6: Allowed decision validates successfully
test("Allowed decision 'accept_for_future_observation_write' passes validation", () => {
  const result = validateDecision("accept_for_future_observation_write", packet);
  return result.valid && result.decisionAllowed;
});

// T7: Forbidden decision 'approved_for_execution' is rejected
test("Forbidden decision 'approved_for_execution' is rejected", () => {
  const result = validateDecision("approved_for_execution", packet);
  return !result.valid && !result.decisionAllowed;
});

// T8: Forbidden decision 'trade_ready' is rejected
test("Forbidden decision 'trade_ready' is rejected", () => {
  const result = validateDecision("trade_ready", packet);
  return !result.valid && !result.decisionAllowed;
});

// T9: Forbidden decision 'governed_state' is rejected
test("Forbidden decision 'governed_state' is rejected", () => {
  const result = validateDecision("governed_state", packet);
  return !result.valid && !result.decisionAllowed;
});

// T10: Forbidden decision 'live_write_ready' is rejected
test("Forbidden decision 'live_write_ready' is rejected", () => {
  const result = validateDecision("live_write_ready", packet);
  return !result.valid && !result.decisionAllowed;
});

// T11: Packet has humanReviewRequired=true
test("Packet requires human review", () => {
  return packet.safety.humanReviewRequired === true;
});

// T12: Packet is not governed state
test("Packet is not governed state", () => {
  return packet.safety.isGovernedState === false;
});

// T13: Packet has dry-run network status
test("Packet network write status is dry-run-local-only", () => {
  return packet.safety.networkWriteStatus === "dry-run-local-only";
});

// T14: Unknown decision is rejected
test("Unknown decision 'random_thing' is rejected", () => {
  const result = validateDecision("random_thing", packet);
  return !result.valid;
});

// T15: Decision ledger entry has correct safety
test("Decision ledger entry preserves safety declarations", () => {
  const entry = recordDecision(packet, "defer", "test entry");
  return (
    entry.safety.notExecutionAuthority === true &&
    entry.safety.isGovernedState === false &&
    entry.safety.networkWriteStatus === "dry-run-local-only" &&
    entry.safety.humanReviewRequired === true &&
    entry.eligibleForV7BWrite === false
  );
});

// T16: accept_for_future_observation_write sets eligibleForV7BWrite=true
test("'accept' decision sets eligibleForV7BWrite=true", () => {
  const entry = recordDecision(packet, "accept_for_future_observation_write", "Looks sound");
  return entry.eligibleForV7BWrite === true;
});

// T17: Unsafe packet (notExecutionAuthority=false) blocks all decisions
test("Unsafe packet blocks decision validation", () => {
  const unsafePacket = JSON.parse(JSON.stringify(packet));
  unsafePacket.safety.notExecutionAuthority = false;
  const result = validateDecision("defer", unsafePacket);
  return !result.valid;
});

console.log();

// ── Summary ────────────────────────────────────────────────────

console.log("═══════════════════════════════════════════════════════════");
console.log("  v7A.2 REVIEW PACKET — SUMMARY");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Decision gate tests: ${decisionTestsPassed} passed, ${decisionTestsFailed} failed / ${ALLOWED_DECISIONS.length + FORBIDDEN_DECISIONS.length}`);
console.log(`  Safety tests:        ${testsPassed} passed, ${testsFailed} failed / ${testsPassed + testsFailed}`);
console.log(`  Ledger entries:      ${existsSync(LEDGER_PATH) ? readFileSync(LEDGER_PATH, "utf-8").split("\n").filter(Boolean).length : 0}`);
console.log("═══════════════════════════════════════════════════════════");
console.log("  Open Brain connected:      false");
console.log("  Network writes:            false (dry-run only)");
console.log("  Execution capability:      false");
console.log("  Credentials present:       false");
console.log("  v7B authorized:            false");
console.log("  Governed state created:    false");
console.log("  Human review required:     true (enforced)");
console.log("═══════════════════════════════════════════════════════════\n");

process.exit(testsFailed > 0 || decisionTestsFailed > 0 ? 1 : 0);
