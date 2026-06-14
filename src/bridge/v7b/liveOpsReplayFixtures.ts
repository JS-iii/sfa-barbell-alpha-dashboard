/**
 * liveOpsReplayFixtures.ts — v7C.2 Deterministic Live Ops Replay Fixtures
 *
 * Pure, deterministic fixtures for replay testing the live ops context packet.
 * No randomness. No network. No file I/O. No mutable state.
 */

import type { LiveOpsContextPacket, Post3zEvidenceSeal } from "./liveOpsContextPacket";

// ── Stable Timestamps ────────────────────────────────────────────────────────

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const REFERENCE_TIMESTAMP = 1718755200000; // 2024-06-19T00:00:00Z — frozen reference

export const LIVEOPS_FIXTURE_TIMES = {
  closure: new Date(REFERENCE_TIMESTAMP).toISOString(),
  timerCycle: new Date(REFERENCE_TIMESTAMP + 6 * HOUR).toISOString(),
  retrieval: new Date(REFERENCE_TIMESTAMP + 12 * HOUR).toISOString(),
} as const;

// ── Fixture 1: Complete Accepted Packet ──────────────────────────────────────

export const FIXTURE_COMPLETE_PACKET: LiveOpsContextPacket = {
  version: "v7C.2.0",
  generatedAt: LIVEOPS_FIXTURE_TIMES.retrieval,
  evidenceChain: [
    {
      name: "Canonical runtime",
      commit: "1f0890d",
      tag: "phase-3z-final-seal",
      description: "Sealed runtime source with 1017 tests",
    },
    {
      name: "Live VPS deployment",
      commit: "6872eca",
      tag: "post-3z-live-vps-deployment-proof",
      description: "VPS deployed and operational",
    },
    {
      name: "Live backlog clearance",
      commit: "b0624fe",
      tag: "post-3z-live-review-backlog-clearance",
      description: "8 entries reviewed, CRITICAL alert cleared",
    },
    {
      name: "Live stability",
      commit: "ca53d32",
      tag: "post-3z-live-stability-verification",
      description: "Read-only live baseline verified",
    },
    {
      name: "Provenance correction",
      commit: "ee3bf4b",
      tag: "post-3z-timer-verification-provenance-correction",
      description: "Pre-cycle source mutation corrected",
    },
    {
      name: "Corrected baseline",
      commit: "bbb29fd",
      tag: "post-3z-timer-cycle-verification-corrected-baseline",
      description: "Pre-cycle baseline after correction",
    },
    {
      name: "Timer-cycle verification",
      commit: "e785335",
      tag: "post-3z-live-timer-cycle-verification",
      description: "Clean timer cycle from sealed source",
    },
    {
      name: "Live operations closure",
      commit: "0d4e9e1",
      tag: "post-3z-live-operations-closure",
      description: "Final closure dossier for Post-3Z live operations",
    },
  ],
  liveVps: {
    head: "1f0890d",
    exactTag: "phase-3z-final-seal",
    manifestCommit: "1f0890d",
    manifestTag: "phase-3z-final-seal",
    treeStatus: "clean",
    runtimePyCount: 0,
  },
  timerCycle: {
    timerActive: true,
    timerEnabled: true,
    serviceResult: "success",
    latestBundleTimestamp: "2026-06-14T06:02:47.972468+00:00",
    newBundleProduced: true,
  },
  healthAlert: {
    healthExitCode: 0,
    healthStatus: "HEALTHY",
    alertExitCode: 0,
    alertStatus: "HEALTHY",
  },
  evidencePreservation: {
    bundleFilesOnDisk: 41,
    indexBehavior: "Mutable overlay — overwritten each timer cycle",
    historicalBundlesPreserved: true,
  },
  reviewQueue: {
    totalEntries: 1,
    unreviewedCount: 1,
    staleCount: 0,
    hasNewCycleEntry: true,
  },
  compliance: {
    mode: "telemetry_and_simulation_only_no_execution",
    expected: "telemetry_and_simulation_only_no_execution",
    valid: true,
  },
  guarantees: {
    contextCannotAuthorizeActions: true,
    contextCannotMutateGovernance: true,
    contextCannotTriggerWrites: true,
    contextCannotClearReviewEntries: true,
    contextCannotAlterStrategyModelProviderThreshold: true,
    contextCannotEnableTradingExecutionWallet: true,
    contextCannotPromoteToGovernance: true,
    contextIsReadOnly: true,
  },
  advisoryNotice:
    "This packet is advisory context only. It reflects the verified live " +
    "operations state but cannot authorize actions, mutate governance, " +
    "trigger writes, clear review entries, alter strategy/model/provider/" +
    "threshold behavior, or enable trading/execution/wallet behavior.",
};

// ── Fixture 2: Packet with Broken Guarantee (for negative testing) ───────────

export const FIXTURE_BROKEN_GUARANTEE_PACKET: LiveOpsContextPacket = {
  ...FIXTURE_COMPLETE_PACKET,
  generatedAt: LIVEOPS_FIXTURE_TIMES.retrieval,
  guarantees: {
    ...FIXTURE_COMPLETE_PACKET.guarantees,
    contextCannotAuthorizeActions: false as unknown as true, // Deliberately broken
  },
};

// ── Fixture 3: Packet with Wrong HEAD (for negative testing) ─────────────────

export const FIXTURE_WRONG_HEAD_PACKET: LiveOpsContextPacket = {
  ...FIXTURE_COMPLETE_PACKET,
  generatedAt: LIVEOPS_FIXTURE_TIMES.retrieval,
  liveVps: {
    ...FIXTURE_COMPLETE_PACKET.liveVps,
    head: "ce8dde0", // Wrong HEAD — the pre-correction state
  },
};

// ── Fixture 4: Packet with Dirty Tree (for negative testing) ─────────────────

export const FIXTURE_DIRTY_TREE_PACKET: LiveOpsContextPacket = {
  ...FIXTURE_COMPLETE_PACKET,
  generatedAt: LIVEOPS_FIXTURE_TIMES.retrieval,
  liveVps: {
    ...FIXTURE_COMPLETE_PACKET.liveVps,
    treeStatus: "dirty",
  },
};

// ── Fixture 5: Packet with CRITICAL Alert (for negative testing) ─────────────

export const FIXTURE_CRITICAL_ALERT_PACKET: LiveOpsContextPacket = {
  ...FIXTURE_COMPLETE_PACKET,
  generatedAt: LIVEOPS_FIXTURE_TIMES.retrieval,
  healthAlert: {
    healthExitCode: 1,
    healthStatus: "UNHEALTHY",
    alertExitCode: 2,
    alertStatus: "CRITICAL",
  },
};

// ── Fixture 6: Packet with Runtime .py files (for negative testing) ──────────

export const FIXTURE_RUNTIME_PY_PACKET: LiveOpsContextPacket = {
  ...FIXTURE_COMPLETE_PACKET,
  generatedAt: LIVEOPS_FIXTURE_TIMES.retrieval,
  liveVps: {
    ...FIXTURE_COMPLETE_PACKET.liveVps,
    runtimePyCount: 3,
  },
};

// ── All Fixtures ─────────────────────────────────────────────────────────────

export const ALL_LIVEOPS_FIXTURES = [
  { id: "complete", packet: FIXTURE_COMPLETE_PACKET, expectValid: true },
  { id: "broken_guarantee", packet: FIXTURE_BROKEN_GUARANTEE_PACKET, expectValid: false },
  { id: "wrong_head", packet: FIXTURE_WRONG_HEAD_PACKET, expectValid: false },
  { id: "dirty_tree", packet: FIXTURE_DIRTY_TREE_PACKET, expectValid: false },
  { id: "critical_alert", packet: FIXTURE_CRITICAL_ALERT_PACKET, expectValid: false },
  { id: "runtime_py", packet: FIXTURE_RUNTIME_PY_PACKET, expectValid: false },
] as const;

// ── Determinism Helpers ──────────────────────────────────────────────────────

/**
 * Serialize a packet to a deterministic string for comparison.
 * Excludes the generatedAt timestamp.
 */
export function deterministicLiveOpsString(packet: LiveOpsContextPacket): string {
  const { generatedAt, ...stable } = packet;
  return JSON.stringify(stable, Object.keys(stable).sort());
}

/**
 * Check if two packets are bit-for-bit identical (excluding timestamp).
 */
export function packetsAreIdentical(a: LiveOpsContextPacket, b: LiveOpsContextPacket): boolean {
  return deterministicLiveOpsString(a) === deterministicLiveOpsString(b);
}
