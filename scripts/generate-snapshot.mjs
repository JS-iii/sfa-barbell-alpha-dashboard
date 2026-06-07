#!/usr/bin/env node
/**
 * generate-snapshot.mjs — Server-side AlphaSnapshot generator (v6)
 *
 * Pipeline:
 *   provider adapters → normalized AlphaSnapshot → validation → JSON artifact
 *
 * Run: npm run generate:snapshot
 * Output: public/data/generated-alpha-snapshot.json
 */

import { writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "data");
const OUT_PATH = join(OUT_DIR, "generated-alpha-snapshot.json");

// ── Import providers ────────────────────────────────────────────

// We use tsx to run TypeScript files directly
import { fetchCoinGecko } from "../src/providers/coingecko.js";
import { fetchDeFiLlama } from "../src/providers/defillama.js";
import { fetchFred } from "../src/providers/fred.js";
import { fetchUnlocks } from "../src/providers/unlocks.js";
import { fetchReserves } from "../src/providers/reserves.js";
import { scoreAssets } from "../src/scoring/scoreAssets.js";
import { scoreRegime } from "../src/scoring/scoreRegime.js";
import { validateSnapshot } from "../src/lib/validateSnapshot.js";

// ── Inline provider types for the generator ────────────────────

async function generate() {
  const start = Date.now();
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  AlphaSnapshot Generator v6");
  console.log("  " + new Date().toISOString());
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── Step 1: Fetch all providers ───────────────────────────────

  console.log("[1] Fetching providers...\n");

  const results = await Promise.allSettled([
    fetchCoinGecko(),
    fetchDeFiLlama(),
    fetchFred(),
    fetchUnlocks(),
    fetchReserves(),
  ]);

  const outputs = {
    coingecko: results[0].status === "fulfilled" ? results[0].value : { data: null, fetchedAt: new Date().toISOString(), latencyMs: 0, error: "Provider rejected" },
    defillama: results[1].status === "fulfilled" ? results[1].value : { data: null, fetchedAt: new Date().toISOString(), latencyMs: 0, error: "Provider rejected" },
    fred:      results[2].status === "fulfilled" ? results[2].value : { data: null, fetchedAt: new Date().toISOString(), latencyMs: 0, error: "Provider rejected" },
    unlocks:   results[3].status === "fulfilled" ? results[3].value : { data: null, fetchedAt: new Date().toISOString(), latencyMs: 0, error: "Provider rejected" },
    reserves:  results[4].status === "fulfilled" ? results[4].value : { data: null, fetchedAt: new Date().toISOString(), latencyMs: 0, error: "Provider rejected" },
  };

  // Print provider status
  const providerNames = ["coingecko", "defillama", "fred", "unlocks", "reserves"];
  for (const name of providerNames) {
    const r = outputs[name];
    const status = r.error
      ? `⚠️  ${name}: ${r.error} (${r.latencyMs}ms)`
      : `✅ ${name}: OK (${r.latencyMs}ms)`;
    console.log(`    ${status}`);
  }
  console.log();

  // ── Step 2: Score assets ──────────────────────────────────────

  console.log("[2] Scoring assets...\n");
  const { assets } = scoreAssets(outputs);
  for (const a of assets) {
    const emoji =
      a.classification === "long_bias"
        ? "🟢"
        : a.classification === "short_bias"
          ? "🔴"
          : a.classification === "watch"
            ? "🔵"
            : "🟡";
    console.log(
      `    ${emoji} ${a.symbol}: score=${a.score}, confidence=${(a.confidence * 100).toFixed(0)}%, classification=${a.classification}, regime=${a.regime}`
    );
  }
  console.log();

  // ── Step 3: Score regime ──────────────────────────────────────

  console.log("[3] Scoring regime...\n");
  const { regime, composite } = scoreRegime(outputs);
  console.log(`    Current regime: ${regime.currentRegime} (confidence: ${(regime.transitionConfidence * 100).toFixed(0)}%)`);
  console.log(`    Composite signal: ${composite.signal} (confidence: ${(composite.confidence * 100).toFixed(0)}%)`);
  if (composite.blockingIssues?.length) {
    console.log(`    ⚠️  Blocking issues: ${composite.blockingIssues.join("; ")}`);
  }
  console.log();

  // ── Step 4: Build provider status array ───────────────────────

  const providerStatuses = providerNames.map((name) => {
    const r = outputs[name];
    const isError = !!r.error;
    const isMock =
      name === "unlocks" || name === "reserves" || r.error?.includes("mock");

    return {
      name,
      status: isError ? (isMock ? "active" : "degraded") : "active",
      lastUpdated: r.fetchedAt,
      latencyMs: r.latencyMs,
      error: r.error,
    };
  });

  // ── Step 5: Build AlphaSnapshot ───────────────────────────────

  const snapshot = {
    provenance: {
      schemaVersion: "5.1.0",
      generatedAt: new Date().toISOString(),
      source: "sfa-barbell-alpha-v6",
      dataHash: null, // Could compute SHA-256
      generatorCommit: null, // Could read from git
    },
    data_mode: "live",
    providers: providerStatuses,
    assets,
    regime,
    composite,
    metadata: {
      staleThresholdHours: 24,
      note: "v6 server-side generated snapshot. Provider-backed with graceful degradation.",
      generator: "generate-snapshot.mjs",
      providerCount: providerNames.filter((n) => outputs[n].data).length,
    },
  };

  // ── Step 6: Validate ──────────────────────────────────────────

  console.log("[4] Validating snapshot...\n");
  const validation = validateSnapshot(snapshot);

  if (!validation.valid) {
    console.log("❌ VALIDATION FAILED:");
    validation.errors.forEach((e) => console.log(`   - ${e.path}: ${e.message}`));
    process.exit(1);
  }

  if (validation.warnings.length > 0) {
    console.log("⚠️  Validation warnings:");
    validation.warnings.forEach((w) => console.log(`   - ${w.path}: ${w.message}`));
  }

  console.log("✅ Snapshot validates\n");

  // ── Step 7: Write output ──────────────────────────────────────

  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2));

  const elapsed = Date.now() - start;
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  ✅ Generated: ${OUT_PATH}`);
  console.log(`  ⏱  Elapsed: ${elapsed}ms`);
  console.log(`  📊 Providers: ${providerNames.filter((n) => outputs[n].data).length}/5 active`);
  console.log(`  🏷️  Regime: ${regime.currentRegime}`);
  console.log(`  📈 Signal: ${composite.signal} (${(composite.confidence * 100).toFixed(0)}% confidence)`);
  console.log("═══════════════════════════════════════════════════════════");
}

generate().catch((err) => {
  console.error("❌ Generator failed:", err.message);
  process.exit(1);
});
