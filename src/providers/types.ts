/**
 * Provider adapter types for v6 server-side snapshot generator.
 *
 * All providers run server-side (Node.js). No browser code.
 * No API keys are hardcoded. Optional keys come from env vars.
 */

export type ProviderName =
  | "coingecko"
  | "defillama"
  | "fred"
  | "unlocks"
  | "reserves";

export interface ProviderResult<T> {
  /** Normalized provider data, or null if fetch failed */
  data: T | null;
  /** ISO-8601 UTC timestamp of when the data was fetched */
  fetchedAt: string;
  /** Latency in milliseconds */
  latencyMs: number;
  /** Optional error message if the fetch failed */
  error?: string;
}

// ── CoinGecko Output ──────────────────────────────────────────────

export interface CoinGeckoGlobal {
  data: {
    active_cryptocurrencies: number;
    total_market_cap: { usd: number };
    total_volume: { usd: number };
    market_cap_change_percentage_24h_usd: number;
    market_cap_percentage: Record<string, number>;
  };
}

export interface CoinGeckoCoinMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
  market_cap_rank: number;
}

export interface CoinGeckoOutput {
  global: CoinGeckoGlobal | null;
  markets: CoinGeckoCoinMarket[];
}

// ── DeFiLlama Output ────────────────────────────────────────────

export interface DeFiLlamaProtocol {
  name: string;
  defillamaId: string;
  category: string;
  total24h: number;       // 24h fees
  total7d: number;        // 7d fees
  total30d: number;       // 30d fees
}

export interface DeFiLlamaOutput {
  protocols: DeFiLlamaProtocol[];
  total24h: number;
  total7d: number;
  total30d: number;
}

// ── FRED Output ──────────────────────────────────────────────────

export interface FredObservation {
  date: string;           // YYYY-MM-DD
  value: string;          // "2.45" or "."
}

export interface FredOutput {
  seriesId: string;
  seriesName: string;
  observations: FredObservation[];
  latestValue: number | null;
  latestDate: string;
}

// ── Unlocks Output ──────────────────────────────────────────────

export interface UnlockEvent {
  token: string;
  date: string;           // YYYY-MM-DD
  amountUsd: number;
  category: "team" | "investors" | "community" | "ecosystem";
}

export interface UnlocksOutput {
  events: UnlockEvent[];
  totalUpcoming30d: number;  // USD
  note: string;
}

// ── Reserves Output ─────────────────────────────────────────────

export interface ReserveSnapshot {
  exchange: string;
  asset: string;
    amount: number;
  amountUsd: number;
  date: string;
}

export interface ReservesOutput {
  snapshots: ReserveSnapshot[];
  totalBtcReserves: number;
  totalEthReserves: number;
  note: string;
}

// ── Scoring Inputs ──────────────────────────────────────────────

export interface ProviderOutputs {
  coingecko: ProviderResult<CoinGeckoOutput>;
  defillama: ProviderResult<DeFiLlamaOutput>;
  fred: ProviderResult<FredOutput>;
  unlocks: ProviderResult<UnlocksOutput>;
  reserves: ProviderResult<ReservesOutput>;
}
