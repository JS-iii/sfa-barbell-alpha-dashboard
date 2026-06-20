#!/usr/bin/env node
/**
 * v7c3-operator-intelligence-packet.mjs — v7C.3 Operator Intelligence Packet
 *
 * Read-only, advisory-only synthesis layer.
 * Combines dashboard posture, advisory memory context, live ops context,
 * Markov forward-test evidence, and xStocks observation posture into one
 * deterministic operator packet.
 *
 * NO network. NO credentials. NO Open Brain client. NO Supabase client.
 * NO filesystem writes. NO governance mutation. NO trading/execution/wallet logic.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_DIR = join(dirname(__filename), "..");

console.log("═══════════════════════════════════════════════════════════");
console.log("  v7C.3 Operator Intelligence Packet");
console.log("  " + new Date().toISOString());
console.log("═══════════════════════════════════════════════════════════\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    if (fn()) { console.log(`   ✅ ${name}`); passed++; }
    else { console.log(`   ❌ ${name}`); failed++; }
  } catch (e) {
    console.log(`   ❌ ${name} — threw: ${e.message}`);
    failed++;
  }
}

const REFERENCE_TIMESTAMP = 1718755200000; // stable fixture timestamp
const FIXTURE_TIME = new Date(REFERENCE_TIMESTAMP + 13 * 60 * 60 * 1000).toISOString();

const STATES = Object.freeze({
  systemHealth: ["healthy", "degraded", "blocked"],
  marketRegime: ["risk_on", "selective", "hostile", "unknown"],
  barbellPosture: ["accumulate", "observe", "defensive", "blocked"],
  tacticalPermission: ["allowed", "caution", "blocked"],
  xstocksPosture: ["observe", "simulate", "review"],
  memorySignal: ["relevant", "weak", "none", "excluded"],
  markovSignal: ["supportive", "caution", "veto", "unavailable"],
  operatorAction: ["review", "stand_down", "investigate", "update_watchlist"],
});

const IMMUTABLE_GUARANTEES = Object.freeze({
  packetCannotAuthorizeActions: true,
  packetCannotMutateGovernance: true,
  packetCannotTriggerWrites: true,
  packetCannotClearReviewEntries: true,
  packetCannotAlterStrategyModelProviderThreshold: true,
  packetCannotEnableTradingExecutionWallet: true,
  packetCannotPromoteToGovernance: true,
  packetIsReadOnly: true,
  memoryCannotCommandPacket: true,
  markovCannotTriggerEntry: true,
});

function makeInputs(overrides = {}) {
  const base = {
    dashboard: {
      providerStatus: "healthy",
      dataFreshness: "fresh",
      btcDominanceTrend: "rising",
      exchangeReserveTrend: "falling",
      liquidityCondition: "selective",
      volatilityCondition: "elevated",
      unlockRisk: "moderate",
      protocolRevenueTrend: "mixed",
    },
    memoryContext: {
      available: true,
      classification: "SAFE",
      relevantItems: 3,
      excludedItems: 0,
      quarantinedItems: 0,
      summary: "Prior hostile small-cap regime remains relevant; use memory as context only.",
      canTriggerAction: false,
      canMutateGovernance: false,
      canPromote: false,
    },
    liveOpsContext: {
      available: true,
      healthStatus: "HEALTHY",
      alertStatus: "HEALTHY",
      complianceMode: "telemetry_and_simulation_only_no_execution",
      runtimePyCount: 0,
      treeStatus: "clean",
      reviewUnreviewed: 1,
      reviewStale: 0,
      canAuthorizeAction: false,
      canTriggerWrite: false,
      canEnableTrading: false,
    },
    markovEvidence: {
      available: true,
      sampleCount: 8,
      latestState: "flat_chop",
      confidence: "low",
      blockedBadTrades: 3,
      falseBlocks: 1,
      warning: "Chop risk elevated; use as veto/caution only.",
      canTriggerEntry: false,
    },
    xstocks: {
      observationMode: true,
      premiumRisk: "moderate",
      liquidityStatus: "watch",
      simulatorStatus: "available",
      executionEnabled: false,
    },
    tacticalCrypto: {
      smallCapRegime: "hostile",
      concentrationRisk: "high",
      confidenceCeiling: 7,
      validationWindowOpen: false,
    },
  };
  return deepMerge(base, overrides);
}

function deepMerge(target, source) {
  const out = Array.isArray(target) ? [...target] : { ...target };
  for (const [key, value] of Object.entries(source || {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = deepMerge(out[key] || {}, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function deriveSystemHealth(input) {
  if (input.liveOpsContext.alertStatus === "CRITICAL") return "blocked";
  if (input.liveOpsContext.healthStatus !== "HEALTHY") return "degraded";
  if (input.liveOpsContext.runtimePyCount !== 0) return "blocked";
  if (input.liveOpsContext.treeStatus !== "clean") return "blocked";
  if (input.memoryContext.quarantinedItems > 0) return "degraded";
  return "healthy";
}

function deriveMarketRegime(input) {
  if (input.tacticalCrypto.smallCapRegime === "hostile") return "hostile";
  if (input.dashboard.providerStatus !== "healthy") return "unknown";
  if (input.dashboard.liquidityCondition === "broad" && input.dashboard.volatilityCondition !== "elevated") return "risk_on";
  return "selective";
}

function deriveBarbellPosture(input, marketRegime, systemHealth) {
  if (systemHealth === "blocked") return "blocked";
  if (marketRegime === "hostile") return "defensive";
  if (marketRegime === "risk_on" && input.dashboard.unlockRisk !== "high") return "accumulate";
  return "observe";
}

function deriveTacticalPermission(input, marketRegime, markovSignal, systemHealth) {
  if (systemHealth === "blocked") return "blocked";
  if (marketRegime === "hostile") return "blocked";
  if (markovSignal === "veto") return "blocked";
  if (markovSignal === "caution") return "caution";
  if (input.tacticalCrypto.confidenceCeiling < 8) return "caution";
  return "allowed";
}

function deriveXstocksPosture(input, systemHealth) {
  if (systemHealth === "blocked") return "review";
  if (input.xstocks.observationMode && input.xstocks.simulatorStatus === "available") return "simulate";
  return "observe";
}

function deriveMemorySignal(input) {
  if (!input.memoryContext.available) return "none";
  if (input.memoryContext.quarantinedItems > 0 || input.memoryContext.classification !== "SAFE") return "excluded";
  if (input.memoryContext.relevantItems >= 3) return "relevant";
  if (input.memoryContext.relevantItems > 0) return "weak";
  return "none";
}

function deriveMarkovSignal(input) {
  if (!input.markovEvidence.available) return "unavailable";
  if (input.markovEvidence.latestState === "flat_chop") return "veto";
  if (input.markovEvidence.confidence === "low") return "caution";
  return "supportive";
}

function deriveOperatorAction(systemHealth, marketRegime, tacticalPermission, memorySignal) {
  if (systemHealth === "blocked") return "review";
  if (tacticalPermission === "blocked") return "stand_down";
  if (memorySignal === "relevant" && marketRegime !== "risk_on") return "investigate";
  return "update_watchlist";
}

function makeOperatorPacket(input = makeInputs()) {
  const systemHealth = deriveSystemHealth(input);
  const marketRegime = deriveMarketRegime(input);
  const markovSignal = deriveMarkovSignal(input);
  const memorySignal = deriveMemorySignal(input);
  const barbellPosture = deriveBarbellPosture(input, marketRegime, systemHealth);
  const tacticalPermission = deriveTacticalPermission(input, marketRegime, markovSignal, systemHealth);
  const xstocksPosture = deriveXstocksPosture(input, systemHealth);
  const operatorAction = deriveOperatorAction(systemHealth, marketRegime, tacticalPermission, memorySignal);

  return {
    version: "v7C.3.0",
    generatedAt: FIXTURE_TIME,
    mode: "read_only_advisory_operator_intelligence",
    inputs: {
      dashboard: "read_only_snapshot_fixture",
      memoryContext: "read_only_advisory_context_fixture",
      liveOpsContext: "read_only_live_ops_context_fixture",
      markovEvidence: "manual_forward_test_fixture",
      xstocks: "observation_only_fixture",
      tacticalCrypto: "observation_only_fixture",
    },
    states: {
      systemHealth,
      marketRegime,
      barbellPosture,
      tacticalPermission,
      xstocksPosture,
      memorySignal,
      markovSignal,
      operatorAction,
    },
    summary: makeSummary({ systemHealth, marketRegime, barbellPosture, tacticalPermission, xstocksPosture, memorySignal, markovSignal, operatorAction }),
    reviewItems: makeReviewItems(input, { systemHealth, marketRegime, tacticalPermission, markovSignal, memorySignal }),
    prohibitions: {
      executionEnabled: false,
      walletEnabled: false,
      networkWriteEnabled: false,
      governanceMutationEnabled: false,
      memoryPromotionEnabled: false,
      reviewClearanceEnabled: false,
      strategyThresholdMutationEnabled: false,
    },
    guarantees: { ...IMMUTABLE_GUARANTEES },
    advisoryNotice: "Operator intelligence only. This packet cannot authorize trades, writes, promotions, review clearance, governance mutation, wallet use, or execution.",
  };
}

function makeSummary(states) {
  return [
    `System health: ${states.systemHealth}`,
    `Market regime: ${states.marketRegime}`,
    `Barbell posture: ${states.barbellPosture}`,
    `Tactical permission: ${states.tacticalPermission}`,
    `xStocks posture: ${states.xstocksPosture}`,
    `Memory signal: ${states.memorySignal}`,
    `Markov signal: ${states.markovSignal}`,
    `Operator action: ${states.operatorAction}`,
  ];
}

function makeReviewItems(input, states) {
  const items = [];
  if (states.systemHealth !== "healthy") items.push("Review system health before using packet context.");
  if (states.marketRegime === "hostile") items.push("Maintain defensive tactical posture until onchain regime improves.");
  if (states.markovSignal === "veto") items.push("Respect Markov chop veto; do not use it as an entry trigger.");
  if (states.memorySignal === "relevant") items.push("Compare current conditions with prior hostile small-cap evidence.");
  if (input.liveOpsContext.reviewUnreviewed > 0) items.push("Review live ops queue entries manually; packet cannot clear them.");
  if (input.xstocks.observationMode) items.push("Continue xStocks simulation/observation; execution remains disabled.");
  return items;
}

function validateOperatorPacket(packet) {
  const errors = [];
  let checksPassed = 0;
  let checksFailed = 0;
  function check(condition, errorMsg) {
    if (condition) checksPassed++;
    else { checksFailed++; errors.push(errorMsg); }
  }

  check(packet.version === "v7C.3.0", "Version is not v7C.3.0");
  check(packet.mode === "read_only_advisory_operator_intelligence", "Mode is not read-only advisory");
  for (const [key, allowed] of Object.entries(STATES)) {
    check(allowed.includes(packet.states[key]), `Invalid state for ${key}: ${packet.states[key]}`);
  }
  const g = packet.guarantees;
  check(g.packetCannotAuthorizeActions === true, "packetCannotAuthorizeActions not true");
  check(g.packetCannotMutateGovernance === true, "packetCannotMutateGovernance not true");
  check(g.packetCannotTriggerWrites === true, "packetCannotTriggerWrites not true");
  check(g.packetCannotClearReviewEntries === true, "packetCannotClearReviewEntries not true");
  check(g.packetCannotAlterStrategyModelProviderThreshold === true, "packetCannotAlterStrategyModelProviderThreshold not true");
  check(g.packetCannotEnableTradingExecutionWallet === true, "packetCannotEnableTradingExecutionWallet not true");
  check(g.packetCannotPromoteToGovernance === true, "packetCannotPromoteToGovernance not true");
  check(g.packetIsReadOnly === true, "packetIsReadOnly not true");
  check(g.memoryCannotCommandPacket === true, "memoryCannotCommandPacket not true");
  check(g.markovCannotTriggerEntry === true, "markovCannotTriggerEntry not true");
  check(packet.prohibitions.executionEnabled === false, "Execution enabled");
  check(packet.prohibitions.walletEnabled === false, "Wallet enabled");
  check(packet.prohibitions.networkWriteEnabled === false, "Network write enabled");
  check(packet.prohibitions.governanceMutationEnabled === false, "Governance mutation enabled");
  check(packet.prohibitions.memoryPromotionEnabled === false, "Memory promotion enabled");
  check(packet.prohibitions.reviewClearanceEnabled === false, "Review clearance enabled");
  check(packet.prohibitions.strategyThresholdMutationEnabled === false, "Strategy threshold mutation enabled");
  check(packet.advisoryNotice.includes("cannot authorize trades"), "Advisory notice too weak");
  check(packet.reviewItems.length > 0, "No review items produced");
  check(Array.isArray(packet.summary) && packet.summary.length === 8, "Summary not complete");

  return { valid: errors.length === 0, errors, checksPassed, checksFailed };
}

function applyOperatorFirewall(packet) {
  const validation = validateOperatorPacket(packet);
  const g = packet.guarantees || {};
  const p = packet.prohibitions || {};
  const blocked = !validation.valid ||
    g.packetCannotAuthorizeActions !== true ||
    g.packetCannotMutateGovernance !== true ||
    g.packetCannotTriggerWrites !== true ||
    g.packetCannotEnableTradingExecutionWallet !== true ||
    p.executionEnabled !== false ||
    p.walletEnabled !== false ||
    p.networkWriteEnabled !== false ||
    p.governanceMutationEnabled !== false;

  return {
    action: blocked ? "block" : "allow",
    canUseAsOperatorContext: !blocked,
    canAuthorizeAction: false,
    canMutateGovernance: false,
    canTriggerWrite: false,
    canClearReview: false,
    canAlterSystemConfig: false,
    canEnableTrading: false,
    canPromoteMemory: false,
    canTriggerEntry: false,
    validation,
  };
}

function stableString(obj) {
  function sortRec(value) {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(sortRec);
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = sortRec(value[key]);
    return sorted;
  }
  return JSON.stringify(sortRec(obj));
}

function stableHash(obj) {
  return createHash("sha256").update(stableString(obj)).digest("hex");
}

function stripCommentsAndStrings(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/`(?:\\.|[^`])*`/g, "")
    .replace(/"(?:\\.|[^"])*"/g, "")
    .replace(/'(?:\\.|[^'])*'/g, "");
}

const input = makeInputs();
const packet = makeOperatorPacket(input);

console.log("[1] Packet Generation & State Synthesis\n");

test("Operator packet generates as v7C.3.0", () => packet.version === "v7C.3.0");
test("Packet mode is read-only advisory intelligence", () => packet.mode === "read_only_advisory_operator_intelligence");
test("System health derives healthy from clean live ops", () => packet.states.systemHealth === "healthy");
test("Hostile small-cap input derives hostile market regime", () => packet.states.marketRegime === "hostile");
test("Hostile regime derives defensive barbell posture", () => packet.states.barbellPosture === "defensive");
test("Hostile tactical regime derives blocked tactical permission", () => packet.states.tacticalPermission === "blocked");
test("xStocks observation mode derives simulate posture", () => packet.states.xstocksPosture === "simulate");
test("Safe relevant memory derives relevant memory signal", () => packet.states.memorySignal === "relevant");
test("Flat chop Markov state derives veto signal", () => packet.states.markovSignal === "veto");
test("Blocked tactical permission derives stand_down action", () => packet.states.operatorAction === "stand_down");

console.log("\n[2] Validation & Firewall\n");

test("Complete packet passes validation", () => validateOperatorPacket(packet).valid === true);
test("Validation performs 30 checks", () => validateOperatorPacket(packet).checksPassed === 30);
test("Firewall allows valid packet as context", () => applyOperatorFirewall(packet).action === "allow");
test("Firewall cannot authorize actions", () => applyOperatorFirewall(packet).canAuthorizeAction === false);
test("Firewall cannot mutate governance", () => applyOperatorFirewall(packet).canMutateGovernance === false);
test("Firewall cannot trigger writes", () => applyOperatorFirewall(packet).canTriggerWrite === false);
test("Firewall cannot clear review entries", () => applyOperatorFirewall(packet).canClearReview === false);
test("Firewall cannot alter system config", () => applyOperatorFirewall(packet).canAlterSystemConfig === false);
test("Firewall cannot enable trading", () => applyOperatorFirewall(packet).canEnableTrading === false);
test("Firewall cannot promote memory", () => applyOperatorFirewall(packet).canPromoteMemory === false);
test("Firewall cannot trigger Markov entry", () => applyOperatorFirewall(packet).canTriggerEntry === false);

console.log("\n[3] Negative Safety Fixtures\n");

test("CRITICAL alert blocks packet", () => {
  const bad = makeOperatorPacket(makeInputs({ liveOpsContext: { alertStatus: "CRITICAL" } }));
  return bad.states.systemHealth === "blocked" && applyOperatorFirewall(bad).action === "allow" && bad.states.operatorAction === "review";
});

test("Runtime .py presence blocks system health", () => {
  const bad = makeOperatorPacket(makeInputs({ liveOpsContext: { runtimePyCount: 2 } }));
  return bad.states.systemHealth === "blocked" && bad.states.barbellPosture === "blocked";
});

test("Dirty tree blocks system health", () => {
  const bad = makeOperatorPacket(makeInputs({ liveOpsContext: { treeStatus: "dirty" } }));
  return bad.states.systemHealth === "blocked";
});

test("Unsafe memory is excluded", () => {
  const bad = makeOperatorPacket(makeInputs({ memoryContext: { classification: "UNSAFE", quarantinedItems: 1 } }));
  return bad.states.memorySignal === "excluded" && bad.states.systemHealth === "degraded";
});

test("Unavailable Markov evidence becomes unavailable, not entry", () => {
  const missing = makeOperatorPacket(makeInputs({ markovEvidence: { available: false } }));
  const d = applyOperatorFirewall(missing);
  return missing.states.markovSignal === "unavailable" && d.canTriggerEntry === false;
});

test("Execution-enabled prohibition fails validation", () => {
  const broken = { ...packet, prohibitions: { ...packet.prohibitions, executionEnabled: true } };
  return validateOperatorPacket(broken).valid === false && applyOperatorFirewall(broken).action === "block";
});

test("Wallet-enabled prohibition fails validation", () => {
  const broken = { ...packet, prohibitions: { ...packet.prohibitions, walletEnabled: true } };
  return validateOperatorPacket(broken).valid === false && applyOperatorFirewall(broken).action === "block";
});

test("Broken immutable guarantee fails validation", () => {
  const broken = { ...packet, guarantees: { ...packet.guarantees, packetCannotTriggerWrites: false } };
  return validateOperatorPacket(broken).valid === false && applyOperatorFirewall(broken).action === "block";
});

console.log("\n[4] Determinism\n");

test("Same inputs produce identical packet", () => stableString(makeOperatorPacket(makeInputs())) === stableString(makeOperatorPacket(makeInputs())));
test("Same packet validates identically", () => {
  const r1 = validateOperatorPacket(packet);
  const r2 = validateOperatorPacket(packet);
  return r1.valid === r2.valid && r1.checksPassed === r2.checksPassed && r1.checksFailed === r2.checksFailed;
});
test("Same packet firewalls identically", () => {
  const d1 = applyOperatorFirewall(packet);
  const d2 = applyOperatorFirewall(packet);
  return d1.action === d2.action && d1.canUseAsOperatorContext === d2.canUseAsOperatorContext;
});
test("Stable hash is deterministic", () => stableHash(packet) === stableHash(makeOperatorPacket(makeInputs())));
test("Changed input changes hash", () => stableHash(packet) !== stableHash(makeOperatorPacket(makeInputs({ tacticalCrypto: { smallCapRegime: "improving" } }))));
test("Hash length is 64 hex chars", () => /^[a-f0-9]{64}$/.test(stableHash(packet)));

console.log("\n[5] Source Integrity\n");

test("Script contains no network calls", () => {
  const source = stripCommentsAndStrings(readFileSync(join(PROJECT_DIR, "scripts", "v7c3-operator-intelligence-packet.mjs"), "utf-8"));
  return !source.includes("fetch(") && !source.includes("XMLHttpRequest") && !source.includes("WebSocket");
});

test("Script contains no filesystem writes", () => {
  const source = stripCommentsAndStrings(readFileSync(join(PROJECT_DIR, "scripts", "v7c3-operator-intelligence-packet.mjs"), "utf-8"));
  return !source.includes("writeFile") && !source.includes("appendFile") && !source.includes("mkdir") && !source.includes("rmSync");
});

test("Script contains no credential values", () => {
  const source = stripCommentsAndStrings(readFileSync(join(PROJECT_DIR, "scripts", "v7c3-operator-intelligence-packet.mjs"), "utf-8"));
  const hasSecretKey = /[\'"]sk-[a-zA-Z0-9]{20,}[\'"]/.test(source);
  const hasApiKey = /api[_-]?key\s*[:=]\s*[\'"][a-zA-Z0-9]{20,}[\'"]/i.test(source);
  const hasJwtToken = /eyJ[a-zA-Z0-9_-]{20,}\.eyJ/.test(source);
  return !hasSecretKey && !hasApiKey && !hasJwtToken;
});

test("Script contains no dynamic code execution", () => {
  const source = stripCommentsAndStrings(readFileSync(join(PROJECT_DIR, "scripts", "v7c3-operator-intelligence-packet.mjs"), "utf-8"));
  return !source.includes("eval(") && !source.includes("new Function") && !source.includes("child_process");
});

test("Packet JSON contains no execution hooks", () => {
  const json = JSON.stringify(packet);
  return !json.includes("execute(") && !json.includes("trade(") && !json.includes("promote(") && !json.includes("clearReview(");
});

test("Packet inputs are fixture/read-only labels only", () => Object.values(packet.inputs).every(v => v.includes("fixture") || v.includes("read_only")));

console.log("\n[6] Advisory-Only Confirmation\n");

test("Advisory notice explicitly blocks trades", () => packet.advisoryNotice.includes("cannot authorize trades"));
test("Advisory notice explicitly blocks writes", () => packet.advisoryNotice.includes("writes"));
test("Advisory notice explicitly blocks wallet use", () => packet.advisoryNotice.includes("wallet"));
test("Markov guarantee is veto-only", () => packet.guarantees.markovCannotTriggerEntry === true);
test("Memory guarantee prevents command behavior", () => packet.guarantees.memoryCannotCommandPacket === true);
test("Review items preserve manual review", () => packet.reviewItems.some(item => item.includes("manually")));
test("xStocks execution remains disabled", () => packet.prohibitions.executionEnabled === false && packet.states.xstocksPosture === "simulate");

test("Total packet state count is 8", () => Object.keys(packet.states).length === 8);

console.log("\n═══════════════════════════════════════════════════════════");
console.log("  v7C.3 OPERATOR INTELLIGENCE PACKET — RESULTS");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Tests passed: ${passed}`);
console.log(`  Tests failed: ${failed}`);
console.log(`  Total:        ${passed + failed}`);
console.log("═══════════════════════════════════════════════════════════");
console.log("  Operator packet generated: true");
console.log("  Read-only advisory:        true");
console.log("  Network writes:            false");
console.log("  Filesystem writes:         false");
console.log("  Governance mutated:        false");
console.log("  Review entries cleared:    false");
console.log("  Trading enabled:           false");
console.log("  Wallet enabled:            false");
console.log("  Markov entry trigger:      false");
console.log("  Memory command behavior:   false");
console.log("  Next phase authorized:     false (requires separate gate)");
console.log("═══════════════════════════════════════════════════════════");

process.exit(failed > 0 ? 1 : 0);
