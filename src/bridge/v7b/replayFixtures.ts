/**
 * replayFixtures.ts — v7B.3 Deterministic Replay Fixtures
 *
 * Pure, deterministic memory row fixtures for replay testing.
 * No randomness. No network. No file I/O. No mutable state.
 * Every fixture has a stable ID, stable timestamp, and stable content.
 */

// ── Fixture IDs (deterministic, never random) ───────────────────────────────

export const FIXTURE_IDS = {
  advisorySafe_v7B15: "9fdb0e43-f83f-4672-af32-3150e2deb930",
  advisorySafe_architecture: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  advisorySafe_operational: "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  prohibited_credentials: "c3d4e5f6-a7b8-9012-cdef-345678901234",
  prohibited_execution: "d4e5f6a7-b8c9-0123-defa-456789012345",
  trading_buyBtc: "e5f6a7b8-c9d0-1234-efab-567890123456",
  trading_sellSol: "f6a7b8c9-d0e1-2345-fabc-678901234567",
  governance_governedState: "a7b8c9d0-e1f2-3456-abcd-789012345678",
  governance_strategyOverride: "b8c9d0e1-f2a3-4567-bcde-890123456789",
  governance_walletRef: "c9d0e1f2-a3b4-5678-cdef-901234567890",
  stale_oldDoc: "d0e1f2a3-b4c5-6789-defa-012345678901",
  lowConfidence_weak: "e1f2a3b4-c5d6-7890-efab-123456789012",
  corrupted_empty: "f2a3b4c5-d6e7-8901-fabc-234567890123",
  corrupted_noId: "",
} as const;

// ── Stable Timestamps (fixture-controlled) ───────────────────────────────────

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const REFERENCE_TIMESTAMP = 1718755200000; // 2024-06-19T00:00:00Z — frozen reference

export const FIXTURE_TIMES = {
  recent: new Date(REFERENCE_TIMESTAMP - 1 * DAY).toISOString(),      // 1 day ago
  medium: new Date(REFERENCE_TIMESTAMP - 15 * DAY).toISOString(),     // 15 days ago
  stale: new Date(REFERENCE_TIMESTAMP - 60 * DAY).toISOString(),      // 60 days ago (>720h)
  retrieval: new Date(REFERENCE_TIMESTAMP).toISOString(),              // reference time
} as const;

// ── Raw Memory Row Interface ─────────────────────────────────────────────────

export interface FixtureMemoryRow {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  source: string;
  created_at: string;
}

// ── Fixture Factory ──────────────────────────────────────────────────────────

function makeFixture(
  id: string,
  content: string,
  metadata: Record<string, unknown>,
  source: string,
  createdAt: string,
): FixtureMemoryRow {
  return { id, content, metadata, source, created_at: createdAt };
}

// ── Complete Fixture Set ─────────────────────────────────────────────────────

export const ALL_FIXTURES: FixtureMemoryRow[] = [
  // Advisory-safe memories
  makeFixture(
    FIXTURE_IDS.advisorySafe_v7B15,
    "Open Brain memory proposal queue requires human approval before promotion. Retrieved memory is advisory context only and never execution authority.",
    { version: "v7B.1.5", confidence: 0.95, tags: ["governance", "operational", "non-trading"] },
    "v7B.1.5-one-approved-write",
    FIXTURE_TIMES.recent,
  ),
  makeFixture(
    FIXTURE_IDS.advisorySafe_architecture,
    "System architecture uses event sourcing for state mutations. All domain events are immutable and append-only.",
    { version: "v7B.2", confidence: 0.88, tags: ["architecture", "design-pattern"] },
    "architecture-docs",
    FIXTURE_TIMES.recent,
  ),
  makeFixture(
    FIXTURE_IDS.advisorySafe_operational,
    "Daily standup notes: reviewed canary adapter tests, all 38 passing. No credential exposure detected in latest scan.",
    { version: "v7B.1.6", confidence: 0.72, tags: ["operational", "testing"] },
    "daily-notes",
    FIXTURE_TIMES.medium,
  ),

  // Prohibited memories
  makeFixture(
    FIXTURE_IDS.prohibited_credentials,
    "Configuration key for staging: sbp_1234567890abcdef1234567890abcdef1234567890abcdef",
    { confidence: 0.9 },
    "leaked-config",
    FIXTURE_TIMES.recent,
  ),
  makeFixture(
    FIXTURE_IDS.prohibited_execution,
    "Auto-execute buy order for BTC when signal strength exceeds threshold.",
    { confidence: 0.9 },
    "dangerous-script",
    FIXTURE_TIMES.recent,
  ),

  // Trading-sensitive memories
  makeFixture(
    FIXTURE_IDS.trading_buyBtc,
    "Market analysis suggests Buy BTC at current support level with stop loss at 5%.",
    { confidence: 0.85 },
    "market-analysis",
    FIXTURE_TIMES.recent,
  ),
  makeFixture(
    FIXTURE_IDS.trading_sellSol,
    "Technical indicators: Sell SOL position as RSI indicates overbought conditions.",
    { confidence: 0.78 },
    "technical-analysis",
    FIXTURE_TIMES.recent,
  ),

  // Governance-sensitive memories
  makeFixture(
    FIXTURE_IDS.governance_governedState,
    "Portfolio rebalancing parameters updated.",
    { isGovernedState: true, confidence: 0.9 },
    "portfolio-system",
    FIXTURE_TIMES.recent,
  ),
  makeFixture(
    FIXTURE_IDS.governance_strategyOverride,
    "Override risk guardrail for high-conviction alpha signals.",
    { confidence: 0.9 },
    "strategy-notes",
    FIXTURE_TIMES.recent,
  ),
  makeFixture(
    FIXTURE_IDS.governance_walletRef,
    "Treasury wallet: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbD — used for operational expenses.",
    { confidence: 0.9 },
    "wallet-registry",
    FIXTURE_TIMES.recent,
  ),

  // Stale memory
  makeFixture(
    FIXTURE_IDS.stale_oldDoc,
    "v7A system design document — superceded by v7B architecture.",
    { confidence: 0.9 },
    "legacy-docs",
    FIXTURE_TIMES.stale,
  ),

  // Low confidence memory
  makeFixture(
    FIXTURE_IDS.lowConfidence_weak,
    "Some vague notes about maybe improving the system someday.",
    { confidence: 0.03 },
    "draft-notes",
    FIXTURE_TIMES.recent,
  ),

  // Corrupted memories
  makeFixture(
    FIXTURE_IDS.corrupted_empty,
    "",
    { confidence: 0.5 },
    "broken-pipeline",
    FIXTURE_TIMES.recent,
  ),
];

// ── Fixture Subsets by Expected Classification ───────────────────────────────

export const ADVISORY_SAFE_FIXTURES = ALL_FIXTURES.filter(
  f => f.id === FIXTURE_IDS.advisorySafe_v7B15 ||
       f.id === FIXTURE_IDS.advisorySafe_architecture ||
       f.id === FIXTURE_IDS.advisorySafe_operational,
);

export const PROHIBITED_FIXTURES = ALL_FIXTURES.filter(
  f => f.id === FIXTURE_IDS.prohibited_credentials ||
       f.id === FIXTURE_IDS.prohibited_execution,
);

export const TRADING_FIXTURES = ALL_FIXTURES.filter(
  f => f.id === FIXTURE_IDS.trading_buyBtc ||
       f.id === FIXTURE_IDS.trading_sellSol,
);

export const GOVERNANCE_FIXTURES = ALL_FIXTURES.filter(
  f => f.id === FIXTURE_IDS.governance_governedState ||
       f.id === FIXTURE_IDS.governance_strategyOverride ||
       f.id === FIXTURE_IDS.governance_walletRef,
);

export const STALE_FIXTURES = ALL_FIXTURES.filter(
  f => f.id === FIXTURE_IDS.stale_oldDoc,
);

export const LOW_CONFIDENCE_FIXTURES = ALL_FIXTURES.filter(
  f => f.id === FIXTURE_IDS.lowConfidence_weak,
);

export const CORRUPTED_FIXTURES = ALL_FIXTURES.filter(
  f => f.id === FIXTURE_IDS.corrupted_empty,
);

// ── Determinism Helpers ──────────────────────────────────────────────────────

/**
 * Serialize a value to a deterministic string for hash comparison.
 * Keys are sorted. No undefined values. Dates as ISO strings.
 */
export function deterministicSerialize(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

/**
 * Compute a SHA-256 hash of a deterministic serialization.
 */
export async function fixtureHash(value: unknown): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(deterministicSerialize(value)).digest("hex");
}
