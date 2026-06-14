/**
 * liveOpsContextPacket.ts — v7C.2 Live Operations Context Integration
 *
 * Integrates the accepted Post-3Z live operations closure state into the
 * Barbell/Open Brain advisory context layer. Provides operator-facing
 * visibility into the verified live VPS baseline without granting any
 * execution authority.
 *
 * Core invariant: this packet contains NO execution hooks, NO trade signals,
 * NO governance mutations, NO write paths, NO promotion triggers, NO review
 * clearance capability, NO strategy/model/provider/threshold changes.
 * It is pure advisory context for human operator consumption.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** Evidence seal from the Post-3Z live operations chain */
export interface Post3zEvidenceSeal {
  /** Seal name */
  name: string;

  /** Git commit hash (short) */
  commit: string;

  /** Git tag */
  tag: string;

  /** Description of what this seal proves */
  description: string;
}

/** Live VPS baseline status */
export interface LiveVpsBaseline {
  /** Canonical runtime HEAD */
  head: string;

  /** Exact tag at HEAD */
  exactTag: string;

  /** Manifest commit */
  manifestCommit: string;

  /** Manifest tag */
  manifestTag: string;

  /** Source tree status */
  treeStatus: "clean" | "dirty";

  /** Runtime .py count (must be 0) */
  runtimePyCount: number;
}

/** Timer cycle verification status */
export interface TimerCycleStatus {
  /** Timer systemd status */
  timerActive: boolean;

  /** Timer enabled */
  timerEnabled: boolean;

  /** Service last result */
  serviceResult: string;

  /** Latest evidence bundle timestamp */
  latestBundleTimestamp: string;

  /** Whether a new bundle was produced after the last verification */
  newBundleProduced: boolean;
}

/** Health and alert status */
export interface HealthAlertStatus {
  /** Health check exit code */
  healthExitCode: number;

  /** Health status string */
  healthStatus: "HEALTHY" | "UNHEALTHY";

  /** Alert check exit code */
  alertExitCode: number;

  /** Alert status string */
  alertStatus: "HEALTHY" | "WARNING" | "CRITICAL";
}

/** Evidence preservation summary */
export interface EvidencePreservation {
  /** Number of immutable bundle files on disk */
  bundleFilesOnDisk: number;

  /** Evidence index behavior description */
  indexBehavior: string;

  /** Confirmation that historical bundles are preserved */
  historicalBundlesPreserved: boolean;
}

/** Review queue status */
export interface ReviewQueueStatus {
  /** Total entries in evidence index */
  totalEntries: number;

  /** Unreviewed entries */
  unreviewedCount: number;

  /** Stale entries */
  staleCount: number;

  /** Whether there is a new unreviewed cycle entry (expected) */
  hasNewCycleEntry: boolean;
}

/** Compliance mode status */
export interface ComplianceStatus {
  /** Current compliance mode */
  mode: string;

  /** Whether compliance mode matches expected */
  expected: string;

  /** Whether compliance is valid */
  valid: boolean;
}

/** Complete v7C.2 Live Operations Context Packet */
export interface LiveOpsContextPacket {
  /** Packet version */
  version: string;

  /** Generation timestamp */
  generatedAt: string;

  /** Post-3Z evidence chain (accepted seals) */
  evidenceChain: Post3zEvidenceSeal[];

  /** Live VPS baseline */
  liveVps: LiveVpsBaseline;

  /** Timer cycle status */
  timerCycle: TimerCycleStatus;

  /** Health and alert status */
  healthAlert: HealthAlertStatus;

  /** Evidence preservation */
  evidencePreservation: EvidencePreservation;

  /** Review queue */
  reviewQueue: ReviewQueueStatus;

  /** Compliance status */
  compliance: ComplianceStatus;

  /** Immutable guarantees (hardcoded) */
  guarantees: {
    contextCannotAuthorizeActions: true;
    contextCannotMutateGovernance: true;
    contextCannotTriggerWrites: true;
    contextCannotClearReviewEntries: true;
    contextCannotAlterStrategyModelProviderThreshold: true;
    contextCannotEnableTradingExecutionWallet: true;
    contextCannotPromoteToGovernance: true;
    contextIsReadOnly: true;
  };

  /** Advisory-only notice */
  advisoryNotice: string;
}

// ── Post-3Z Evidence Chain (Accepted Seals) ──────────────────────────────────

export const POST3Z_EVIDENCE_CHAIN: Post3zEvidenceSeal[] = [
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
    description: "VPS deployed and operational at 187.124.159.119",
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
    description: "Pre-cycle source mutation corrected, restored to 1f0890d",
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
    description: "Clean timer cycle from sealed source, new bundle 2024-06-14T06:02:47Z",
  },
  {
    name: "Live operations closure",
    commit: "0d4e9e1",
    tag: "post-3z-live-operations-closure",
    description: "Final closure dossier for Post-3Z live operations",
  },
];

// ── Packet Generation ────────────────────────────────────────────────────────

/**
 * Generate a v7C.2 Live Operations Context Packet.
 *
 * This is a pure function — no side effects, no writes, no mutations.
 * All inputs are fixture-controlled or hardcoded constants.
 */
export function generateLiveOpsContextPacket(
  overrides?: Partial<LiveOpsContextPacket>,
): LiveOpsContextPacket {
  const now = new Date().toISOString();

  return {
    version: "v7C.2.0",
    generatedAt: now,
    evidenceChain: [...POST3Z_EVIDENCE_CHAIN],
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
    ...overrides,
  };
}

// ── Packet Validation ────────────────────────────────────────────────────────

export interface LiveOpsValidationResult {
  valid: boolean;
  errors: string[];
  checksPassed: number;
  checksFailed: number;
}

/**
 * Validate that a LiveOpsContextPacket adheres to all safety constraints.
 */
export function validateLiveOpsPacket(packet: LiveOpsContextPacket): LiveOpsValidationResult {
  const errors: string[] = [];
  let checksPassed = 0;
  let checksFailed = 0;

  function check(name: string, condition: boolean, errorMsg: string) {
    if (condition) {
      checksPassed++;
    } else {
      checksFailed++;
      errors.push(errorMsg);
    }
  }

  // Check 1: All guarantees are true
  const g = packet.guarantees;
  check("guarantee: contextCannotAuthorizeActions", g.contextCannotAuthorizeActions === true,
    "contextCannotAuthorizeActions is not true");
  check("guarantee: contextCannotMutateGovernance", g.contextCannotMutateGovernance === true,
    "contextCannotMutateGovernance is not true");
  check("guarantee: contextCannotTriggerWrites", g.contextCannotTriggerWrites === true,
    "contextCannotTriggerWrites is not true");
  check("guarantee: contextCannotClearReviewEntries", g.contextCannotClearReviewEntries === true,
    "contextCannotClearReviewEntries is not true");
  check("guarantee: contextCannotAlterStrategyModelProviderThreshold",
    g.contextCannotAlterStrategyModelProviderThreshold === true,
    "contextCannotAlterStrategyModelProviderThreshold is not true");
  check("guarantee: contextCannotEnableTradingExecutionWallet",
    g.contextCannotEnableTradingExecutionWallet === true,
    "contextCannotEnableTradingExecutionWallet is not true");
  check("guarantee: contextCannotPromoteToGovernance", g.contextCannotPromoteToGovernance === true,
    "contextCannotPromoteToGovernance is not true");
  check("guarantee: contextIsReadOnly", g.contextIsReadOnly === true,
    "contextIsReadOnly is not true");

  // Check 2: Evidence chain is non-empty
  check("evidence chain non-empty", packet.evidenceChain.length > 0,
    "Evidence chain is empty");

  // Check 3: Evidence chain contains the closure seal
  check("evidence chain contains closure seal",
    packet.evidenceChain.some(s => s.tag === "post-3z-live-operations-closure"),
    "Evidence chain missing closure seal");

  // Check 4: VPS head matches canonical seal
  check("VPS head is canonical seal", packet.liveVps.head === "1f0890d",
    `VPS head ${packet.liveVps.head} !== 1f0890d`);

  // Check 5: Manifest alignment
  check("manifest commit matches HEAD", packet.liveVps.manifestCommit === packet.liveVps.head,
    "Manifest commit does not match HEAD");

  // Check 6: Runtime .py count is 0
  check("runtime .py count is 0", packet.liveVps.runtimePyCount === 0,
    `Runtime .py count is ${packet.liveVps.runtimePyCount}`);

  // Check 7: Tree is clean
  check("source tree is clean", packet.liveVps.treeStatus === "clean",
    `Source tree is ${packet.liveVps.treeStatus}`);

  // Check 8: Compliance is valid
  check("compliance is valid", packet.compliance.valid === true,
    "Compliance is not valid");
  check("compliance mode matches expected", packet.compliance.mode === packet.compliance.expected,
    `Compliance mode ${packet.compliance.mode} !== expected ${packet.compliance.expected}`);

  // Check 9: Health is HEALTHY
  check("health is HEALTHY", packet.healthAlert.healthStatus === "HEALTHY",
    `Health is ${packet.healthAlert.healthStatus}`);

  // Check 10: Alert is not CRITICAL
  check("alert is not CRITICAL", packet.healthAlert.alertStatus !== "CRITICAL",
    `Alert is ${packet.healthAlert.alertStatus}`);

  // Check 11: Advisory notice is present
  check("advisory notice present", packet.advisoryNotice.length > 0,
    "Advisory notice is empty");

  // Check 12: Evidence preservation confirmed
  check("historical bundles preserved", packet.evidencePreservation.historicalBundlesPreserved === true,
    "Historical bundles not preserved");

  // Check 13: Review queue has expected new cycle entry
  check("has new cycle entry", packet.reviewQueue.hasNewCycleEntry === true,
    "No new cycle entry detected");

  return {
    valid: errors.length === 0,
    errors,
    checksPassed,
    checksFailed,
  };
}

// ── Deterministic Serialization ──────────────────────────────────────────────

/**
 * Serialize a LiveOpsContextPacket deterministically for hash comparison.
 * Keys sorted, stable ordering, no timestamps.
 */
export function deterministicPacketHashInput(packet: LiveOpsContextPacket): string {
  // Exclude generatedAt (timestamp) and sort all keys
  const { generatedAt, ...stable } = packet;
  return JSON.stringify(stable, Object.keys(stable).sort());
}
