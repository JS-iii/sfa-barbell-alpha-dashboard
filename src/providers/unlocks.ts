/**
 * Manual / Mock Token Unlocks Provider
 *
 * This is a MANUAL data provider. No live API.
 * In v6, it returns a curated set of known upcoming unlocks.
 * In future versions, this may connect to a real unlock data service.
 *
 * data_mode: "manual" — clearly labeled as not live.
 */

import type { ProviderResult, UnlocksOutput } from "./types";

// Known upcoming unlocks (manually curated, should be updated periodically)
const KNOWN_UNLOCKS: UnlocksOutput["events"] = [
  {
    token: "ARB",
    date: "2026-06-16",
    amountUsd: 92_000_000,
    category: "team",
  },
  {
    token: "OP",
    date: "2026-06-30",
    amountUsd: 67_000_000,
    category: "investors",
  },
  {
    token: "STRK",
    date: "2026-07-15",
    amountUsd: 128_000_000,
    category: "community",
  },
  {
    token: "AVAX",
    date: "2026-07-22",
    amountUsd: 45_000_000,
    category: "ecosystem",
  },
  {
    token: "APT",
    date: "2026-08-12",
    amountUsd: 83_000_000,
    category: "investors",
  },
];

export async function fetchUnlocks(): Promise<ProviderResult<UnlocksOutput>> {
  const start = Date.now();
  const fetchedAt = new Date().toISOString();
  const latencyMs = Date.now() - start;

  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const upcoming = KNOWN_UNLOCKS.filter((e) => {
    const d = new Date(e.date);
    return d >= now && d <= thirtyDays;
  });

  const totalUpcoming30d = upcoming.reduce((sum, e) => sum + e.amountUsd, 0);

  return {
    data: {
      events: upcoming,
      totalUpcoming30d,
      note: "MANUAL/MOCK DATA: Token unlocks are manually curated snapshots. Not live. Updated periodically.",
    },
    fetchedAt,
    latencyMs,
    error: undefined,
  };
}
