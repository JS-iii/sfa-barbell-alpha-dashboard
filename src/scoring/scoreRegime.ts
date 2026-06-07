/**
 * Regime Scoring Engine
 *
 * Determines the current market regime from provider outputs.
 *
 * Principles:
 * - Missing providers = lower transition confidence
 * - No single provider dominates the regime signal
 * - Composite signal is defensive by default (fail-closed)
 */

import type { RegimeSummary, CompositeSignal } from "@/types/alphaSnapshot";
import type { ProviderOutputs } from "@/providers/types";

export function scoreRegime(
  outputs: ProviderOutputs
): { regime: RegimeSummary; composite: CompositeSignal } {
  const activeProviders = countActiveProviders(outputs);
  const maxConfidence = Math.min(1.0, 0.3 + activeProviders * 0.15);

  // ── Gather signals from each provider ─────────────────────────

  const signals: string[] = [];
  const factors: string[] = [];
  const issues: string[] = [];

  // CoinGecko: market momentum
  if (outputs.coingecko.data?.global?.data) {
    const mcChange =
      outputs.coingecko.data.global.data
        .market_cap_change_percentage_24h_usd || 0;
    if (mcChange > 3) {
      signals.push("risk_on");
      factors.push("Global market cap up " + mcChange.toFixed(1) + "% in 24h");
    } else if (mcChange < -3) {
      signals.push("flight_to_safety");
      factors.push(
        "Global market cap down " + Math.abs(mcChange).toFixed(1) + "% in 24h"
      );
    } else {
      factors.push("Global market flat (" + mcChange.toFixed(1) + "% 24h)");
    }
  } else {
    issues.push("CoinGecko global data unavailable — market context limited");
  }

  // FRED: interest rate regime
  if (outputs.fred.data?.latestValue) {
    const yield10y = outputs.fred.data.latestValue;
    if (yield10y > 4.5) {
      signals.push("flight_to_safety");
      factors.push("10Y Treasury at " + yield10y.toFixed(2) + "% — restrictive rates");
    } else if (yield10y < 3.5) {
      signals.push("risk_on");
      factors.push("10Y Treasury at " + yield10y.toFixed(2) + "% — accommodative rates");
    } else {
      factors.push("10Y Treasury neutral at " + yield10y.toFixed(2) + "%");
    }
  } else {
    issues.push("FRED rate data unavailable — macro context limited");
  }

  // DeFiLlama: economic activity
  if (outputs.defillama.data) {
    const dl = outputs.defillama.data;
    if (dl.total24h > 50_000_000) {
      factors.push("DeFi fees elevated ($" + (dl.total24h / 1e6).toFixed(0) + "M/24h)");
    } else if (dl.total24h < 10_000_000) {
      signals.push("flight_to_safety");
      factors.push("DeFi fees depressed ($" + (dl.total24h / 1e6).toFixed(0) + "M/24h)");
    } else {
      factors.push("DeFi fees moderate ($" + (dl.total24h / 1e6).toFixed(0) + "M/24h)");
    }
  } else {
    issues.push("DeFiLlama fee data unavailable — on-chain activity context limited");
  }

  // Unlocks: supply pressure
  if (outputs.unlocks.data) {
    const u = outputs.unlocks.data;
    if (u.totalUpcoming30d > 200_000_000) {
      signals.push("flight_to_safety");
      factors.push(
        "Large token unlocks upcoming ($" +
          (u.totalUpcoming30d / 1e6).toFixed(0) +
          "M in 30d)"
      );
    } else if (u.totalUpcoming30d > 50_000_000) {
      factors.push(
        "Moderate unlock pressure ($" +
          (u.totalUpcoming30d / 1e6).toFixed(0) +
          "M in 30d)"
      );
    }
  }

  // ── Determine regime ──────────────────────────────────────────

  const safetyCount = signals.filter((s) => s === "flight_to_safety").length;
  const riskCount = signals.filter((s) => s === "risk_on").length;

  let currentRegime: RegimeSummary["currentRegime"];
  let priorRegime: RegimeSummary["priorRegime"] = "risk_on"; // Default prior

  if (safetyCount > riskCount && safetyCount >= 1) {
    currentRegime = "flight_to_safety";
  } else if (riskCount > safetyCount && riskCount >= 2) {
    currentRegime = "risk_on";
  } else if (safetyCount === riskCount && safetyCount > 0) {
    currentRegime = "barbell_core"; // Mixed signals = barbell
  } else {
    currentRegime = "uncategorized";
  }

  // ── Composite signal ──────────────────────────────────────────

  let compositeSignal: CompositeSignal["signal"];

  if (currentRegime === "flight_to_safety") {
    compositeSignal = "defensive";
  } else if (currentRegime === "risk_on") {
    compositeSignal = "constructive";
  } else if (currentRegime === "barbell_core") {
    compositeSignal = "cautious";
  } else {
    compositeSignal = "unclear";
    if (activeProviders < 2) {
      issues.push("Insufficient provider data for clear composite signal");
    }
  }

  const description = buildDescription(currentRegime, factors, issues);

  return {
    regime: {
      currentRegime,
      priorRegime,
      regimeDate: new Date().toISOString(),
      transitionConfidence: Math.round(maxConfidence * 100) / 100,
      description,
    },
    composite: {
      signal: compositeSignal,
      confidence: Math.round(maxConfidence * 100) / 100,
      contributingFactors: factors,
      blockingIssues: issues.length > 0 ? issues : undefined,
    },
  };
}

function countActiveProviders(outputs: ProviderOutputs): number {
  let count = 0;
  if (outputs.coingecko.data) count++;
  if (outputs.defillama.data) count++;
  if (outputs.fred.data) count++;
  if (outputs.unlocks.data) count++;
  if (outputs.reserves.data) count++;
  return count;
}

function buildDescription(
  regime: string,
  factors: string[],
  issues: string[]
): string {
  const regimeLabel = regime.replace(/_/g, " ");
  const factorText = factors.length > 0 ? factors.join("; ") + "." : "No clear signals.";
  const issueText =
    issues.length > 0
      ? " " + issues.length + " provider(s) unavailable — confidence reduced."
      : "";

  return (
    regimeLabel.charAt(0).toUpperCase() +
    regimeLabel.slice(1) +
    " regime. " +
    factorText +
    issueText
  );
}
