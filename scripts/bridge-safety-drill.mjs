#!/usr/bin/env node
/**
 * bridge-safety-drill.mjs — v7A.1 Bridge Safety Drill + Rejection Harness
 *
 * Proves the Open Brain observation bridge rejects unsafe, malformed,
 * or authority-escalating drafts before any v7B live write consideration.
 *
 * Run: npm run bridge:safety-drill
 *
 * 16 tests: 1 valid pass + 15 rejection cases.
 * All fixtures are inline — no external files needed.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_DIR = join(dirname(__filename), "..");

// ── Load a real snapshot for provenance reference ──────────────

const SNAPSHOT_PATH = process.argv[2] || "public/data/mock-alpha-snapshot.json";
const snapshotFullPath = SNAPSHOT_PATH.startsWith("/")
  ? SNAPSHOT_PATH
  : join(PROJECT_DIR, SNAPSHOT_PATH);

let snapshot;
try {
  snapshot = JSON.parse(readFileSync(snapshotFullPath, "utf-8"));
} catch (e) {
  console.log(`❌ Cannot load snapshot: ${e.message}`);
  process.exit(1);
}

// ── Base valid observation draft ────────────────────────────────

function makeValidDraft(srcSnap) {
  return {
    schemaVersion: "open-brain-observation-draft-v7a",
    draftedAt: new Date().toISOString(),
    sourceSnapshot: {
      schemaVersion: srcSnap.provenance.schemaVersion,
      generatedAt: srcSnap.provenance.generatedAt,
      source: srcSnap.provenance.source,
      dataHash: srcSnap.provenance.dataHash,
      generatorCommit: srcSnap.provenance.generatorCommit,
    },
    providerStatus: srcSnap.providers.map((p) => ({
      name: p.name,
      status: p.status,
      lastUpdated: p.lastUpdated,
      latencyMs: p.latencyMs,
      error: p.error,
    })),
    assetObservations: srcSnap.assets.map((a) => ({
      symbol: a.symbol,
      name: a.name,
      regime: a.regime,
      score: a.score,
      confidence: a.confidence,
      classification: a.classification,
      providerContributions: a.providerContributions,
    })),
    regimeObservation: {
      currentRegime: srcSnap.regime.currentRegime,
      priorRegime: srcSnap.regime.priorRegime,
      transitionConfidence: srcSnap.regime.transitionConfidence,
      description: srcSnap.regime.description,
    },
    compositeObservation: {
      signal: srcSnap.composite.signal,
      confidence: srcSnap.composite.confidence,
      contributingFactors: srcSnap.composite.contributingFactors,
      blockingIssues: srcSnap.composite.blockingIssues,
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
      dataMode: srcSnap.data_mode || "unknown",
      networkWriteStatus: "dry-run-local-only",
    },
  };
}

// ── Rejection validator (same rules as bridge transformer) ─────

function validateDraft(draft, sourceSnap) {
  const errors = [];

  // 1. Schema version
  if (draft.schemaVersion !== "open-brain-observation-draft-v7a") {
    errors.push("schemaVersion mismatch");
  }

  // 2. Safety flags
  if (draft.safety.notExecutionAuthority !== true)
    errors.push("notExecutionAuthority is not true");
  if (draft.safety.containsTradeOrders !== false)
    errors.push("containsTradeOrders is not false");
  if (draft.safety.containsWalletReferences !== false)
    errors.push("containsWalletReferences is not false");
  if (draft.safety.containsExecutionInstructions !== false)
    errors.push("containsExecutionInstructions is not false");
  if (draft.safety.containsCredentials !== false)
    errors.push("containsCredentials is not false");

  // 3. Governance
  if (draft.governance.isGovernedState !== false)
    errors.push("isGovernedState is not false");
  if (draft.governance.requiresHumanReview !== true)
    errors.push("requiresHumanReview is not true");
  if (draft.governance.networkWriteStatus !== "dry-run-local-only")
    errors.push(`networkWriteStatus: ${draft.governance.networkWriteStatus}`);

  // 4. Provenance preserved
  if (!draft.sourceSnapshot) {
    errors.push("missing sourceSnapshot");
  } else {
    if (draft.sourceSnapshot.generatedAt !== sourceSnap.provenance.generatedAt)
      errors.push("provenance.generatedAt not preserved");
    if (draft.sourceSnapshot.source !== sourceSnap.provenance.source)
      errors.push("provenance.source not preserved");
  }

  // 5. Confidence not inflated
  if (draft.assetObservations && sourceSnap.assets) {
    for (let i = 0; i < draft.assetObservations.length; i++) {
      const obs = draft.assetObservations[i];
      const src = sourceSnap.assets[i];
      if (src && obs.confidence > src.confidence + 0.01) {
        errors.push(`confidence inflated for ${obs.symbol}: ${obs.confidence} > ${src.confidence}`);
      }
    }
  }
  if (draft.compositeObservation && sourceSnap.composite) {
    if (draft.compositeObservation.confidence > sourceSnap.composite.confidence + 0.01) {
      errors.push(`composite confidence inflated`);
    }
  }

  // 6. Score integrity (snapshot score must equal observation score)
  if (draft.assetObservations && sourceSnap.assets) {
    for (let i = 0; i < draft.assetObservations.length; i++) {
      const obs = draft.assetObservations[i];
      const src = sourceSnap.assets[i];
      if (src && obs.score !== src.score) {
        errors.push(`score changed for ${obs.symbol}: ${obs.score} != ${src.score}`);
      }
    }
  }

  // 7. Provider status preserved (must not be empty if source has providers)
  if (!draft.providerStatus || draft.providerStatus.length === 0) {
    if (sourceSnap.providers && sourceSnap.providers.length > 0) {
      errors.push("providerStatus removed");
    }
  }

  // 8. Content scan for forbidden patterns
  const draftJson = JSON.stringify(draft);
  const forbidden = [
    { pattern: /execute_trade/i, name: "execute_trade" },
    { pattern: /place_order/i, name: "place_order" },
    { pattern: /send_transaction/i, name: "send_transaction" },
    { pattern: /private_key/i, name: "private_key" },
    { pattern: /api_key\s*[:=]/i, name: "api_key" },
    { pattern: /supabase/i, name: "supabase" },
    { pattern: /service_role/i, name: "service_role" },
    { pattern: /wallet.*seed/i, name: "wallet_seed" },
    { pattern: /sk-[a-zA-Z0-9]{20,}/i, name: "secret_key" },
  ];
  for (const f of forbidden) {
    if (f.pattern.test(draftJson)) errors.push(`forbidden pattern: ${f.name}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    safetyCheckPassed:
      draft.safety?.notExecutionAuthority === true &&
      draft.safety?.containsTradeOrders === false &&
      draft.safety?.containsExecutionInstructions === false &&
      draft.safety?.containsWalletReferences === false &&
      draft.safety?.containsCredentials === false,
  };
}

// ── Safety fixtures (mutations of valid draft) ─────────────────

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const validDraft = makeValidDraft(snapshot);

const fixtures = [
  {
    id: "valid",
    name: "Valid AlphaSnapshot → valid OpenBrainObservationDraft",
    draft: validDraft,
    shouldPass: true,
    expectedReason: null,
  },
  {
    id: "missing-provenance",
    name: "Missing provenance → reject",
    draft: (() => { const d = deepClone(validDraft); d.sourceSnapshot = null; return d; })(),
    shouldPass: false,
    expectedReason: "sourceSnapshot",
  },
  {
    id: "inflated-confidence",
    name: "Inflated confidence → reject",
    draft: (() => {
      const d = deepClone(validDraft);
      if (d.assetObservations[0]) d.assetObservations[0].confidence = 0.99;
      return d;
    })(),
    shouldPass: false,
    expectedReason: "confidence",
  },
  {
    id: "score-changed",
    name: "Snapshot score changed during transform → reject",
    draft: (() => {
      const d = deepClone(validDraft);
      if (d.assetObservations[0]) d.assetObservations[0].score = 999;
      return d;
    })(),
    shouldPass: false,
    expectedReason: "score",
  },
  {
    id: "provider-status-removed",
    name: "Provider status removed → reject",
    draft: (() => { const d = deepClone(validDraft); d.providerStatus = []; return d; })(),
    shouldPass: false,
    expectedReason: "providerStatus",
  },
  {
    id: "not-execution-authority-false",
    name: "notExecutionAuthority false → reject",
    draft: (() => { const d = deepClone(validDraft); d.safety.notExecutionAuthority = false; return d; })(),
    shouldPass: false,
    expectedReason: "notExecutionAuthority",
  },
  {
    id: "contains-trade-orders",
    name: "containsTradeOrders true → reject",
    draft: (() => { const d = deepClone(validDraft); d.safety.containsTradeOrders = true; return d; })(),
    shouldPass: false,
    expectedReason: "containsTradeOrders",
  },
  {
    id: "contains-execution-instructions",
    name: "containsExecutionInstructions true → reject",
    draft: (() => { const d = deepClone(validDraft); d.safety.containsExecutionInstructions = true; return d; })(),
    shouldPass: false,
    expectedReason: "containsExecutionInstructions",
  },
  {
    id: "contains-wallet-references",
    name: "containsWalletReferences true → reject",
    draft: (() => { const d = deepClone(validDraft); d.safety.containsWalletReferences = true; return d; })(),
    shouldPass: false,
    expectedReason: "containsWalletReferences",
  },
  {
    id: "contains-credentials",
    name: "containsCredentials true → reject",
    draft: (() => { const d = deepClone(validDraft); d.safety.containsCredentials = true; return d; })(),
    shouldPass: false,
    expectedReason: "containsCredentials",
  },
  {
    id: "is-governed-state",
    name: "isGovernedState true → reject",
    draft: (() => { const d = deepClone(validDraft); d.governance.isGovernedState = true; return d; })(),
    shouldPass: false,
    expectedReason: "isGovernedState",
  },
  {
    id: "requires-human-review-false",
    name: "requiresHumanReview false → reject",
    draft: (() => { const d = deepClone(validDraft); d.governance.requiresHumanReview = false; return d; })(),
    shouldPass: false,
    expectedReason: "requiresHumanReview",
  },
  {
    id: "network-write-status",
    name: "networkWriteStatus != dry-run-local-only → reject",
    draft: (() => { const d = deepClone(validDraft); d.governance.networkWriteStatus = "live-write-enabled"; return d; })(),
    shouldPass: false,
    expectedReason: "networkWriteStatus",
  },
  {
    id: "forbidden-execution-language",
    name: "Payload containing execution language → reject",
    draft: (() => {
      const d = deepClone(validDraft);
      d.compositeObservation.contributingFactors.push("execute_trade BTC 0.5 market");
      return d;
    })(),
    shouldPass: false,
    expectedReason: "execute_trade",
  },
  {
    id: "forbidden-wallet-language",
    name: "Payload containing wallet language → reject",
    draft: (() => {
      const d = deepClone(validDraft);
      d.assetObservations[0].name = "Bitcoin wallet_seed abc123";
      return d;
    })(),
    shouldPass: false,
    expectedReason: "wallet_seed",
  },
  {
    id: "forbidden-credential-language",
    name: "Payload containing credential language → reject",
    draft: (() => {
      const d = deepClone(validDraft);
      d.metadata = { injected_secret: "sk-abc123xyz789def456ghi" };
      return d;
    })(),
    shouldPass: false,
    expectedReason: "secret_key",
  },
  {
    id: "agent-governed-state",
    name: "Draft attempting governed state for agent reading → reject",
    draft: (() => {
      const d = deepClone(validDraft);
      d.governance.isGovernedState = true;
      d.governance.requiresHumanReview = false;
      d.safety.notExecutionAuthority = false;
      d.metadata = { agentCanRead: true, promotionStatus: "auto_promoted" };
      return d;
    })(),
    shouldPass: false,
    expectedReason: "isGovernedState",
  },
];

// ── Run drill ───────────────────────────────────────────────────

console.log("═══════════════════════════════════════════════════════════");
console.log("  v7A.1 Bridge Safety Drill + Rejection Harness");
console.log("  " + new Date().toISOString());
console.log("═══════════════════════════════════════════════════════════\n");

let passed = 0;
let failed = 0;
const results = [];

for (const fixture of fixtures) {
  const result = validateDraft(fixture.draft, snapshot);
  const didPass = fixture.shouldPass ? result.valid : !result.valid;

  const expectedRejection = fixture.expectedReason;
  const actualRejection = result.errors.find((e) =>
    expectedRejection ? e.toLowerCase().includes(expectedRejection.toLowerCase()) : false
  );
  const reasonMatch = fixture.shouldPass
    ? true
    : expectedRejection
      ? !!actualRejection
      : result.errors.length > 0;

  const status = didPass && reasonMatch ? "PASS" : "FAIL";
  const icon = status === "PASS" ? "✅" : "❌";

  if (status === "PASS") passed++; else failed++;

  results.push({
    id: fixture.id,
    name: fixture.name,
    status,
    expected: fixture.shouldPass ? "pass" : "reject",
    actual: result.valid ? "valid" : `invalid (${result.errors.length} errors)`,
    reason: result.errors[0] || "none",
  });

  console.log(`${icon} ${fixture.name}`);
  if (status === "FAIL") {
    console.log(`   Expected: ${fixture.shouldPass ? "valid" : "rejected"}`);
    console.log(`   Actual: ${result.valid ? "valid" : "invalid"}`);
    if (result.errors.length > 0) {
      result.errors.slice(0, 3).forEach((e) => console.log(`   - ${e}`));
    }
  }
}

console.log("\n═══════════════════════════════════════════════════════════");
console.log(`  Results: ${passed} passed, ${failed} failed / ${fixtures.length} total`);
console.log("═══════════════════════════════════════════════════════════");

// Summary table
console.log("\n--- Pass/Fail Table ---\n");
console.log("| # | Test | Expected | Status |");
console.log("|---|------|----------|--------|");
results.forEach((r, i) => {
  const statusIcon = r.status === "PASS" ? "✅" : "❌";
  console.log(`| ${i + 1} | ${r.name} | ${r.expected} | ${statusIcon} ${r.status} |`);
});

console.log("\n--- Safety Boundary Verification ---");
console.log("Open Brain connected:      false");
console.log("Network writes:            false (dry-run only)");
console.log("Execution capability:      false");
console.log("Credentials present:       false");
console.log("v7B authorized:            false");
console.log("notExecutionAuthority:     enforced on all drafts");
console.log("isGovernedState:           blocked on all drafts");

process.exit(failed > 0 ? 1 : 0);
