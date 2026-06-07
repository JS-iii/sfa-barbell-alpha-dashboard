/**
 * DeFiLlama Provider Adapter
 *
 * Fetches protocol fee/revenue data from DeFiLlama's fees endpoint.
 * Shows which protocols are generating the most real economic activity.
 */

import type { ProviderResult, DeFiLlamaOutput } from "./types";

const BASE = "https://api.llama.fi";

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchDeFiLlama(): Promise<ProviderResult<DeFiLlamaOutput>> {
  const start = Date.now();
  const fetchedAt = new Date().toISOString();

  try {
    // DeFiLlama overview/fees gives top protocols by fees
    const data = await fetchJson<{
      protocols?: Array<{
        name: string;
        defillamaId?: string;
        category?: string;
        total24h?: number;
        total7d?: number;
        total30d?: number;
      }>;
      total24h?: number;
      total7d?: number;
      total30d?: number;
    }>(`${BASE}/overview/fees`);

    const latencyMs = Date.now() - start;

    if (!data || !data.protocols) {
      return {
        data: null,
        fetchedAt,
        latencyMs,
        error: "DeFiLlama fees API returned no protocols",
      };
    }

    const protocols = data.protocols
      .filter((p) => p.total24h && p.total24h > 0)
      .map((p) => ({
        name: p.name,
        defillamaId: p.defillamaId || "",
        category: p.category || "unknown",
        total24h: p.total24h || 0,
        total7d: p.total7d || 0,
        total30d: p.total30d || 0,
      }))
      .slice(0, 30); // Top 30 by fees

    return {
      data: {
        protocols,
        total24h: data.total24h || 0,
        total7d: data.total7d || 0,
        total30d: data.total30d || 0,
      },
      fetchedAt,
      latencyMs,
    };
  } catch (err) {
    return {
      data: null,
      fetchedAt,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "DeFiLlama fetch error",
    };
  }
}
