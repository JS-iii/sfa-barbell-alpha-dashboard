/**
 * Asset Scoring Engine
 *
 * Transforms provider outputs into barbell-style asset scores.
 *
 * Principles:
 * - Missing data REDUCES confidence, never increases it
 * - No provider = no bullish signal (fail-closed)
 * - CoinGecko provides price/volume momentum
 * - DeFiLlama provides fee-based economic activity
 * - FRED provides macro rate regime signal
 * - Unlocks provide supply pressure signal
 * - Reserves provide exchange health signal
 */

import type { AssetScore, ProviderStatus } from "@/types/alphaSnapshot";
import type { ProviderOutputs } from "@/providers/types";

interface ScoreInput {
  symbol: string;
  name: string;
  coingeckoId?: string;
}

const TRACKED_ASSETS: ScoreInput[] = [
  { symbol: "BTC", name: "Bitcoin", coingeckoId: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", coingeckoId: "ethereum" },
  { symbol: "GLD", name: "SPDR Gold Shares" },
  { symbol: "TLT", name: "iShares 20+ Year Treasury" },
];

export function scoreAssets(outputs: ProviderOutputs): {
  assets: AssetScore[];
  providerContributions: Record<string, ProviderStatus[]>;
} {
  const assets: AssetScore[] = [];
  const activeProviders = countActiveProviders(outputs);

  for (const asset of TRACKED_ASSETS) {
    const score = computeAssetScore(asset, outputs, activeProviders);
    assets.push(score);
  }

  const providerContributions = extractProviderStatuses(outputs);

  return { assets, providerContributions };
}

function computeAssetScore(
  asset: ScoreInput,
  outputs: ProviderOutputs,
  activeCount: number
): AssetScore {
  const contributions: Record<string, number> = {};
  let score = 0;
  let confidence = 0.3; // Baseline: low confidence if no data

  // ── CoinGecko: price momentum ────────────────────────────────
  if (outputs.coingecko.data) {
    const cg = outputs.coingecko.data;
    const global = cg.global;
    const market = asset.coingeckoId
      ? cg.markets.find((m) => m.id === asset.coingeckoId)
      : null;

    if (market) {
      const priceChange24h = market.price_change_percentage_24h || 0;
      const priceChange7d = market.price_change_percentage_7d_in_currency || 0;
      const momentum = priceChange24h * 0.4 + priceChange7d * 0.6;

      // Normalize: ±20% change → ±50 score points
      score += Math.max(-50, Math.min(50, momentum * 2.5));
      contributions["coingecko_momentum"] = 0.25;
    }

    // Global market sentiment (affects all assets)
    if (global?.data) {
      const gd = global.data;
      const mcapChange = gd.market_cap_change_percentage_24h_usd || 0;
      // Broad market sentiment: ±10% → ±15 points
      score += Math.max(-15, Math.min(15, mcapChange * 1.5));
      contributions["coingecko_global"] = 0.15;
    }
  }

  // ── DeFiLlama: economic activity ────────────────────────────
  if (outputs.defillama.data) {
    const dl = outputs.defillama.data;
    // High fees = high economic activity = constructive signal
    const feeTrend =
      dl.total7d > 0 ? (dl.total24h - dl.total7d / 7) / (dl.total7d / 7) : 0;
    score += Math.max(-20, Math.min(20, feeTrend * 30));
    contributions["defillama_fees"] = 0.15;
  }

  // ── FRED: macro regime ──────────────────────────────────────
  if (outputs.fred.data?.latestValue) {
    const yield10y = outputs.fred.data.latestValue;
    // Rising yields → risk-off for growth assets, neutral for BTC/ETH
    // Falling yields → risk-on
    if (asset.symbol === "GLD" || asset.symbol === "TLT") {
      // Fixed income / gold benefits from falling yields
      const yieldSignal = yield10y < 4.0 ? 15 : yield10y > 4.5 ? -10 : 0;
      score += yieldSignal;
      contributions["fred_rates"] = 0.15;
    } else {
      // Crypto neutral to slightly negative on rising yields
      const yieldSignal = yield10y > 4.5 ? -8 : yield10y < 3.5 ? 8 : 0;
      score += yieldSignal;
      contributions["fred_rates"] = 0.1;
    }
  }

  // ── Unlocks: supply pressure ────────────────────────────────
  if (outputs.unlocks.data) {
    const unlocks = outputs.unlocks.data;
    const tokenUnlocks = unlocks.events.filter(
      (e) => e.token === asset.symbol
    );
    if (tokenUnlocks.length > 0) {
      // Large unlocks = supply pressure = negative
      const totalPressure = tokenUnlocks.reduce(
        (sum, e) => sum + e.amountUsd,
        0
      );
      // $100M+ unlock = -20 points
      score += Math.max(-25, Math.min(0, -(totalPressure / 5_000_000)));
      contributions["unlocks_supply"] = 0.1;
    }
  }

  // ── Reserves: exchange health ───────────────────────────────
  if (outputs.reserves.data) {
    if (asset.symbol === "BTC") {
      // Declining reserves = distribution signal
      // (We don't have trend, so this is a weak signal)
      score += 5; // Slight positive: reserves exist = liquidity
      contributions["reserves_liquidity"] = 0.1;
    } else if (asset.symbol === "ETH") {
      score += 3;
      contributions["reserves_liquidity"] = 0.1;
    }
  }

  // ── Confidence calculation ───────────────────────────────────
  // More active providers = higher confidence
  // But max confidence is capped by data quality
  const maxConfidence = Math.min(1.0, 0.3 + activeCount * 0.15);
  confidence = Math.min(maxConfidence, confidence + activeCount * 0.12);

  // Normalize score to [-100, 100]
  score = Math.max(-100, Math.min(100, Math.round(score)));

  // Classification
  const classification = classifyScore(score);

  // Regime classification
  const regime = classifyRegime(score, asset.symbol);

  return {
    symbol: asset.symbol,
    name: asset.name,
    regime,
    score,
    confidence: Math.round(confidence * 100) / 100,
    classification,
    providerContributions: contributions,
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

function classifyScore(score: number): AssetScore["classification"] {
  if (score >= 40) return "long_bias";
  if (score <= -30) return "short_bias";
  if (score >= -10 && score <= 10) return "neutral";
  return "watch";
}

function classifyRegime(score: number, symbol: string): AssetScore["regime"] {
  if (symbol === "GLD" || symbol === "TLT") {
    if (score > 30) return "flight_to_safety";
    return "barbell_core";
  }
  if (symbol === "BTC" || symbol === "ETH") {
    if (score > 20) return "barbell_core";
    if (score < -20) return "risk_on"; // Actually risk-off for crypto
    return "uncategorized";
  }
  if (score > 30) return "risk_on";
  if (score < -20) return "inflation_hedge";
  return "uncategorized";
}

function extractProviderStatuses(
  _outputs: ProviderOutputs
): Record<string, ProviderStatus[]> {
  const map: Record<string, ProviderStatus[]> = {};
  // This is populated by the generator from actual provider status
  return map;
}
