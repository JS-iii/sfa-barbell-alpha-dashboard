/**
 * Manual / Mock Exchange Reserves Provider
 *
 * This is a MANUAL data provider. No live API.
 * In v6, it returns a curated snapshot of known exchange reserves.
 * In future versions, this may connect to a real reserve proof service.
 *
 * data_mode: "manual" — clearly labeled as not live.
 */

import type { ProviderResult, ReservesOutput } from "./types";

// Known exchange reserve snapshots (manually curated)
const KNOWN_RESERVES: ReservesOutput["snapshots"] = [
  {
    exchange: "Binance",
    asset: "BTC",
    amount: 568_420,
    amountUsd: 61_200_000_000,
    date: "2026-06-01",
  },
  {
    exchange: "Coinbase",
    asset: "BTC",
    amount: 412_800,
    amountUsd: 44_500_000_000,
    date: "2026-06-01",
  },
  {
    exchange: "Bitfinex",
    asset: "BTC",
    amount: 204_100,
    amountUsd: 22_000_000_000,
    date: "2026-06-01",
  },
  {
    exchange: "Binance",
    asset: "ETH",
    amount: 3_420_000,
    amountUsd: 14_800_000_000,
    date: "2026-06-01",
  },
  {
    exchange: "Coinbase",
    asset: "ETH",
    amount: 2_890_000,
    amountUsd: 12_500_000_000,
    date: "2026-06-01",
  },
];

export async function fetchReserves(): Promise<ProviderResult<ReservesOutput>> {
  const start = Date.now();
  const fetchedAt = new Date().toISOString();
  const latencyMs = Date.now() - start;

  const btcReserves = KNOWN_RESERVES
    .filter((r) => r.asset === "BTC")
    .reduce((sum, r) => sum + r.amount, 0);

  const ethReserves = KNOWN_RESERVES
    .filter((r) => r.asset === "ETH")
    .reduce((sum, r) => sum + r.amount, 0);

  return {
    data: {
      snapshots: KNOWN_RESERVES,
      totalBtcReserves: btcReserves,
      totalEthReserves: ethReserves,
      note: "MANUAL/MOCK DATA: Exchange reserves are manually curated snapshots. Not live. Updated periodically.",
    },
    fetchedAt,
    latencyMs,
    error: undefined,
  };
}
