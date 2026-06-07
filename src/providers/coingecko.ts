/**
 * CoinGecko Provider Adapter
 *
 * Fetches:
 * - Global crypto market data (total market cap, volume, dominance)
 * - Top coin market data (price, volume, change %)
 *
 * Rate limit: ~10-30 calls/minute on free tier.
 * We add delays and retry logic for graceful degradation.
 */

import type { ProviderResult, CoinGeckoOutput } from "./types";

const BASE = "https://api.coingecko.com/api/v3";
const DELAY_MS = 600; // Respect free tier rate limit

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson<T>(url: string, retries = 2): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.status === 429) {
        if (attempt < retries) {
          await sleep(DELAY_MS * (attempt + 1) * 2);
          continue;
        }
        return null;
      }
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      if (attempt < retries) {
        await sleep(DELAY_MS);
        continue;
      }
      return null;
    }
  }
  return null;
}

export async function fetchCoinGecko(): Promise<ProviderResult<CoinGeckoOutput>> {
  const start = Date.now();
  const fetchedAt = new Date().toISOString();

  try {
    // 1. Global data
    const global = await fetchJson<{ data: unknown }>(`${BASE}/global`);
    await sleep(DELAY_MS);

    // 2. Top coins by market cap
    const markets = await fetchJson<unknown[]>(
      `${BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h,7d,30d`
    );

    const latencyMs = Date.now() - start;

    if (!global && !markets) {
      return {
        data: null,
        fetchedAt,
        latencyMs,
        error: "CoinGecko API unavailable (both endpoints failed)",
      };
    }

    return {
      data: {
        global: global as CoinGeckoOutput["global"],
        markets: (markets || []) as CoinGeckoOutput["markets"],
      },
      fetchedAt,
      latencyMs,
      error: !global
        ? "Global endpoint failed, markets available"
        : !markets
          ? "Markets endpoint failed, global available"
          : undefined,
    };
  } catch (err) {
    return {
      data: null,
      fetchedAt,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "CoinGecko fetch error",
    };
  }
}
