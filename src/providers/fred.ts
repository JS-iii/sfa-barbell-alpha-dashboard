/**
 * FRED Provider Adapter
 *
 * Fetches 10-Year U.S. Treasury Constant Maturity Rate (DGS10).
 * API key is optional — without it, uses mock/fallback mode.
 *
 * Series: DGS10 — 10-Year Treasury Constant Maturity Rate
 * URL: https://fred.stlouisfed.org/series/DGS10
 *
 * Environment variable: FRED_API_KEY (optional)
 */

import type { ProviderResult, FredOutput } from "./types";

const BASE = "https://api.stlouisfed.org/fred";
const SERIES_ID = "DGS10";
const SERIES_NAME = "10-Year Treasury Constant Maturity Rate";

function getApiKey(): string | undefined {
  try {
    const g = globalThis as Record<string, unknown>;
    const proc = g.process as Record<string, unknown> | undefined;
    const env = proc?.env as Record<string, string> | undefined;
    return env?.FRED_API_KEY;
  } catch {
    return undefined;
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export async function fetchFred(): Promise<ProviderResult<FredOutput>> {
  const start = Date.now();
  const fetchedAt = new Date().toISOString();
  const apiKey = getApiKey();

  // ── Mock/Fallback Mode (no API key) ────────────────────────────
  if (!apiKey) {
    const latencyMs = Date.now() - start;
    // Return a realistic mock value with clear labeling
    return {
      data: {
        seriesId: SERIES_ID,
        seriesName: SERIES_NAME,
        observations: [
          { date: "2026-06-05", value: "4.42" },
          { date: "2026-06-04", value: "4.39" },
          { date: "2026-06-03", value: "4.41" },
        ],
        latestValue: 4.42,
        latestDate: "2026-06-05",
      },
      fetchedAt,
      latencyMs,
      error: "FRED_API_KEY not set — using mock data (labeled as manual/fallback)",
    };
  }

  // ── Live Mode (with API key) ──────────────────────────────────
  try {
    const url = `${BASE}/series/observations?series_id=${SERIES_ID}&sort_order=desc&limit=5&api_key=${apiKey}&file_type=json`;
    const data = await fetchJson<{
      observations?: Array<{ date: string; value: string }>;
    }>(url);

    const latencyMs = Date.now() - start;

    if (!data || !data.observations || data.observations.length === 0) {
      return {
        data: null,
        fetchedAt,
        latencyMs,
        error: "FRED API returned no observations",
      };
    }

    const observations = data.observations;
    const latest = observations[0];
    const latestValue = latest.value === "." ? null : parseFloat(latest.value);

    return {
      data: {
        seriesId: SERIES_ID,
        seriesName: SERIES_NAME,
        observations,
        latestValue,
        latestDate: latest.date,
      },
      fetchedAt,
      latencyMs,
    };
  } catch (err) {
    return {
      data: null,
      fetchedAt,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "FRED fetch error",
    };
  }
}
