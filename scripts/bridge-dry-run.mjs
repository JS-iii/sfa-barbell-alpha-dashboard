#!/usr/bin/env node
/**
 * bridge-dry-run.mjs — Open Brain Observation Bridge (DRY-RUN ONLY v7A)
 *
 * Pipeline:
 *   validated AlphaSnapshot → OpenBrainObservationDraft → local JSONL log
 *
 * NO network writes. NO Open Brain credentials. NO Supabase key.
 *
 * Run: npm run bridge:dry-run
 */

import { readFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_DIR = join(dirname(__filename), "..");

// Load the snapshot
const SNAPSHOT_PATH = process.argv[2] || "public/data/mock-alpha-snapshot.json";
const snapshotFullPath = SNAPSHOT_PATH.startsWith("/")
  ? SNAPSHOT_PATH
  : join(PROJECT_DIR, SNAPSHOT_PATH);

console.log("═══════════════════════════════════════════════════════════");
console.log("  Open Brain Observation Bridge — DRY-RUN v7A");
console.log("  " + new Date().toISOString());
console.log("═══════════════════════════════════════════════════════════\n");

console.log(`[1] Loading snapshot: ${SNAPSHOT_PATH}`);

let snapshot;
try {
  snapshot = JSON.parse(readFileSync(snapshotFullPath, "utf-8"));
} catch (e) {
  console.log(`❌ Failed to load snapshot: ${e.message}`);
  process.exit(1);
}

// ── Inline transformer (avoids import complexity) ─────────────

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

function validateDraft(draft, sourceSnap) {
  const errors = [];

  // Safety checks
  if (draft.safety.notExecutionAuthority !== true)
    errors.push("notExecutionAuthority not true");
  if (draft.safety.containsTradeOrders !== false)
    errors.push("containsTradeOrders not false");
  if (draft.safety.containsWalletReferences !== false)
    errors.push("containsWalletReferences not false");
  if (draft.safety.containsExecutionInstructions !== false)
    errors.push("containsExecutionInstructions not false");
  if (draft.safety.containsCredentials !== false)
    errors.push("containsCredentials not false");

  // Governance checks
  if (draft.governance.isGovernedState !== false)
    errors.push("isGovernedState not false");
  if (draft.governance.requiresHumanReview !== true)
    errors.push("requiresHumanReview not true");
  if (draft.governance.networkWriteStatus !== "dry-run-local-only")
    errors.push(`networkWriteStatus: ${draft.governance.networkWriteStatus}`);

  // Provenance preserved
  if (draft.sourceSnapshot.generatedAt !== sourceSnap.provenance.generatedAt)
    errors.push("provenance.generatedAt not preserved");
  if (draft.sourceSnapshot.source !== sourceSnap.provenance.source)
    errors.push("provenance.source not preserved");

  // Confidence not inflated
  for (let i = 0; i < draft.assetObservations.length; i++) {
    const obs = draft.assetObservations[i];
    const src = sourceSnap.assets[i];
    if (src && obs.confidence > src.confidence + 0.01) {
      errors.push(`confidence inflated for ${obs.symbol}: ${obs.confidence} > ${src.confidence}`);
    }
  }

  // Content scan
  const draftJson = JSON.stringify(draft);
  const forbidden = [
    /execute_trade/i, /place_order/i, /send_transaction/i,
    /private_key/i, /api_key\s*[:=]/i, /supabase/i,
    /service_role/i, /wallet.*seed/i,
  ];
  for (const p of forbidden) {
    if (p.test(draftJson)) errors.push(`Forbidden pattern: ${p.toString()}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    safetyCheckPassed:
      draft.safety.notExecutionAuthority === true &&
      draft.safety.containsTradeOrders === false &&
      draft.safety.containsExecutionInstructions === false,
  };
}

// ── Transform ──────────────────────────────────────────────────

console.log("[2] Transforming to observation draft...\n");
const draft = transformToDraft(snapshot);

// ── Validate ──────────────────────────────────────────────────

console.log("[3] Validating observation draft...\n");
const validation = validateDraft(draft, snapshot);

if (validation.errors.length > 0) {
  console.log("❌ VALIDATION FAILED:");
  validation.errors.forEach((e) => console.log(`   - ${e}`));
  process.exit(1);
}

console.log("   ✅ All safety flags correct");
console.log(`   ✅ notExecutionAuthority: ${draft.safety.notExecutionAuthority}`);
console.log(`   ✅ containsTradeOrders: ${draft.safety.containsTradeOrders}`);
console.log(`   ✅ containsExecutionInstructions: ${draft.safety.containsExecutionInstructions}`);
console.log(`   ✅ isGovernedState: ${draft.governance.isGovernedState}`);
console.log(`   ✅ networkWriteStatus: ${draft.governance.networkWriteStatus}`);
console.log(`   ✅ Provenance preserved`);
console.log(`   ✅ Confidence not inflated`);
console.log(`   ✅ No forbidden patterns`);
console.log();

// ── Log to JSONL ──────────────────────────────────────────────

const LOG_DIR = join(PROJECT_DIR, "data", "dry-run");
const LOG_PATH = join(LOG_DIR, "open-brain-observations-dry-run.jsonl");

if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

const logEntry = {
  timestamp: new Date().toISOString(),
  draftSchemaVersion: draft.schemaVersion,
  validationResult: validation.valid ? "valid" : "invalid",
  safetyFlagsCorrect: validation.safetyCheckPassed,
  wouldWriteTo: "open-brain-observations-v7b",
  actuallyWrittenTo: "local-jsonl-dry-run-log-only",
  networkWriteBlocked: true,
  sourceSnapshotSource: draft.sourceSnapshot.source,
  sourceSnapshotGeneratedAt: draft.sourceSnapshot.generatedAt,
  compositeSignal: draft.compositeObservation.signal,
  compositeConfidence: draft.compositeObservation.confidence,
  providerCount: draft.providerStatus.length,
  assetCount: draft.assetObservations.length,
};

appendFileSync(LOG_PATH, JSON.stringify(logEntry) + "\n");

console.log(`[4] Logged to: ${LOG_PATH}`);
console.log();

// ── Summary ───────────────────────────────────────────────────

console.log("═══════════════════════════════════════════════════════════");
console.log("  ✅ DRY-RUN COMPLETE — No network writes occurred");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Draft schema: ${draft.schemaVersion}`);
console.log(`  Assets observed: ${draft.assetObservations.length}`);
console.log(`  Providers tracked: ${draft.providerStatus.length}`);
console.log(`  Composite signal: ${draft.compositeObservation.signal}`);
console.log(`  Composite confidence: ${draft.compositeObservation.confidence}`);
console.log(`  Execution authority: ${draft.safety.notExecutionAuthority ? "DENIED" : "WARNING"}`);
console.log(`  Governed state: ${draft.governance.isGovernedState}`);
console.log(`  Network write: ${draft.governance.networkWriteStatus}`);
console.log(`  Log entries: ${readFileSync(LOG_PATH, "utf-8").split("\n").filter(Boolean).length}`);
console.log("═══════════════════════════════════════════════════════════");
console.log();
console.log("  ⚠️  This is a DRY-RUN. No data was sent to Open Brain.");
console.log("  ⚠️  No credentials were used. No network write occurred.");
console.log("  ⚠️  v7B will add network write capability (not yet authorized).");
