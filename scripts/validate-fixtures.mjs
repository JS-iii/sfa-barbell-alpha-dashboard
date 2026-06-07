#!/usr/bin/env node
/**
 * validate-fixtures.mjs — Validate all fixture JSON files against the AlphaSnapshot schema.
 *
 * Run: npm run validate:fixtures
 *
 * Good fixtures should PASS validation.
 * Bad fixtures should FAIL validation (proving fail-closed behavior).
 */

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "public", "data", "fixtures");
const VALID_SNAPSHOT = join(__dirname, "..", "public", "data", "mock-alpha-snapshot.json");

// Inline validation (same rules as the runtime validator, in Node.js)
const VALID_PROVIDER_STATUSES = ["active", "stale", "degraded", "unavailable"];
const VALID_REGIMES = ["flight_to_safety", "risk_on", "inflation_hedge", "barbell_core", "uncategorized"];
const VALID_CLASSIFICATIONS = ["long_bias", "short_bias", "neutral", "watch"];
const VALID_SIGNALS = ["constructive", "cautious", "defensive", "unclear"];
const STALE_THRESHOLD_HOURS = 24;

function validate(obj) {
  const errors = [];
  const warnings = [];

  if (!obj || typeof obj !== "object") {
    errors.push("Not an object");
    return { valid: false, errors, warnings };
  }

  // Provenance
  if (!obj.provenance) {
    errors.push("Missing provenance");
  } else {
    const p = obj.provenance;
    if (!p.schemaVersion || typeof p.schemaVersion !== "string") errors.push("provenance.schemaVersion missing/invalid");
    if (!p.generatedAt || typeof p.generatedAt !== "string") errors.push("provenance.generatedAt missing/invalid");
    if (!p.source || typeof p.source !== "string") errors.push("provenance.source missing/invalid");
  }

  // Providers
  if (!Array.isArray(obj.providers)) {
    errors.push("providers must be an array");
  } else {
    obj.providers.forEach((pr, i) => {
      if (!pr.name) errors.push(`providers[${i}].name missing`);
      if (!pr.status) errors.push(`providers[${i}].status missing`);
      else if (!VALID_PROVIDER_STATUSES.includes(pr.status)) errors.push(`providers[${i}].status="${pr.status}" invalid`);
      if (!pr.lastUpdated) errors.push(`providers[${i}].lastUpdated missing`);
    });
  }

  // Assets
  if (!Array.isArray(obj.assets)) {
    errors.push("assets must be an array");
  } else {
    obj.assets.forEach((a, i) => {
      if (a.score === undefined) errors.push(`assets[${i}].score missing`);
      else if (typeof a.score !== "number" || a.score < -100 || a.score > 100) errors.push(`assets[${i}].score=${a.score} out of range [-100,100]`);
      if (a.confidence === undefined) errors.push(`assets[${i}].confidence missing`);
      else if (typeof a.confidence !== "number" || a.confidence < 0 || a.confidence > 1) errors.push(`assets[${i}].confidence=${a.confidence} out of range [0,1]`);
      if (!a.symbol) errors.push(`assets[${i}].symbol missing`);
      if (!a.name) errors.push(`assets[${i}].name missing`);
      if (!a.regime) errors.push(`assets[${i}].regime missing`);
      else if (!VALID_REGIMES.includes(a.regime)) errors.push(`assets[${i}].regime="${a.regime}" invalid`);
      if (!a.classification) errors.push(`assets[${i}].classification missing`);
      else if (!VALID_CLASSIFICATIONS.includes(a.classification)) errors.push(`assets[${i}].classification="${a.classification}" invalid`);
    });
  }

  // Regime
  if (!obj.regime) {
    errors.push("Missing regime");
  } else {
    const r = obj.regime;
    if (!r.currentRegime) errors.push("regime.currentRegime missing");
    if (r.transitionConfidence === undefined) errors.push("regime.transitionConfidence missing");
  }

  // Snapshot staleness (skip for mock data)
  const isMock = obj.data_mode === "mock";
  if (!isMock && obj.provenance && typeof obj.provenance.generatedAt === "string") {
    const generated = new Date(obj.provenance.generatedAt);
    const hoursAgo = (Date.now() - generated.getTime()) / (1000 * 60 * 60);
    if (hoursAgo > STALE_THRESHOLD_HOURS) {
      errors.push(`Snapshot is ${Math.round(hoursAgo)}h old (threshold: ${STALE_THRESHOLD_HOURS}h)`);
    }
  }

  // Composite
  if (!obj.composite) {
    errors.push("Missing composite");
  } else {
    const c = obj.composite;
    if (!c.signal) errors.push("composite.signal missing");
    else if (!VALID_SIGNALS.includes(c.signal)) errors.push(`composite.signal="${c.signal}" invalid`);
    if (c.confidence === undefined) errors.push("composite.confidence missing");
    else if (typeof c.confidence !== "number" || c.confidence < 0 || c.confidence > 1) errors.push(`composite.confidence=${c.confidence} out of range [0,1]`);
    if (!Array.isArray(c.contributingFactors)) errors.push("composite.contributingFactors must be an array");
  }

  return { valid: errors.length === 0, errors, warnings };
}

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    return { _parseError: e.message };
  }
}

console.log("═══════════════════════════════════════════════════════════");
console.log("  AlphaSnapshot Fixture Validator");
console.log("═══════════════════════════════════════════════════════════\n");

// 1. Validate the good snapshot
console.log("[1] Valid Mock Snapshot");
const good = loadJson(VALID_SNAPSHOT);
if (good._parseError) {
  console.log(`    ❌ Parse error: ${good._parseError}`);
  process.exit(1);
}
const goodResult = validate(good);
if (goodResult.valid) {
  console.log("    ✅ PASS — Valid snapshot accepted\n");
} else {
  console.log("    ❌ FAIL — Valid snapshot rejected (this is a bug):");
  goodResult.errors.forEach((e) => console.log(`       - ${e}`));
  console.log();
  process.exit(1);
}

// 2. Validate all fixtures
console.log("[2] Fixture Files (should FAIL validation):\n");
let allFailedAsExpected = true;

try {
  const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    console.log("    ⚠️  No fixture files found\n");
  }

  for (const file of files.sort()) {
    const path = join(FIXTURES_DIR, file);
    const data = loadJson(path);

    if (data._parseError) {
      console.log(`    ❌ ${file}: Parse error — ${data._parseError}`);
      allFailedAsExpected = false;
      continue;
    }

    const result = validate(data);
    if (result.valid) {
      console.log(`    ⚠️  ${file}: UNEXPECTED PASS (should have failed)`);
      allFailedAsExpected = false;
    } else {
      // Extract a concise reason for the failure
      const primaryError = result.errors[0];
      let reason = primaryError;
      if (primaryError.includes("confidence")) reason = "confidence out of range";
      else if (primaryError.includes("score=")) reason = "score out of range";
      else if (primaryError.includes('status="')) reason = "invalid provider status enum";
      else if (primaryError.includes("old")) reason = "stale snapshot";
      else if (primaryError.includes("generatedAt")) reason = "missing provenance.generatedAt";
      else if (primaryError.includes("source")) reason = "missing provenance.source";

      console.log(`    ✅ ${file} → PASS: failed as expected: ${reason}`);
      result.errors.forEach((e) => console.log(`       - ${e}`));
    }
    console.log();
  }

  console.log("═══════════════════════════════════════════════════════════");
  if (allFailedAsExpected) {
    console.log("  ✅ All fixtures behaved correctly (good=pass, bad=fail)");
    process.exit(0);
  } else {
    console.log("  ⚠️  Some fixtures did not behave as expected");
    process.exit(1);
  }
} catch (err) {
  console.error(`    ❌ Error reading fixtures: ${err.message}`);
  process.exit(1);
}
