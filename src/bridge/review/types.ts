/**
 * Observation Review Packet Contract v7A.2
 *
 * Human-reviewable packet generated from a validated OpenBrainObservationDraft.
 * NO network writes. NO governed state. NO execution authority.
 *
 * Pipeline:
 *   OpenBrainObservationDraft → ReviewPacket → Human Decision → Local Ledger
 */

// ── Allowed Decisions ───────────────────────────────────────────

/** Decisions a human reviewer can make */
export type HumanDecision =
  | "accept_for_future_observation_write"
  | "reject"
  | "needs_revision"
  | "defer";

/** Decisions that are FORBIDDEN and will be rejected */
export const FORBIDDEN_DECISIONS = [
  "approved_for_execution",
  "trade_ready",
  "governed_state",
  "live_write_ready",
] as const;

export type ForbiddenDecision = (typeof FORBIDDEN_DECISIONS)[number];

// ── Review Packet ───────────────────────────────────────────────

export interface ReviewPacket {
  /** Contract version */
  schemaVersion: "open-brain-review-packet-v7a2";

  /** When the packet was generated */
  generatedAt: string; // ISO-8601 UTC

  /** Source draft reference */
  sourceDraft: {
    schemaVersion: string;
    draftedAt: string;
    snapshotGeneratedAt: string;
    snapshotSource: string;
  };

  /** Human-readable summary */
  summary: ReviewSummary;

  /** Risk flags requiring reviewer attention */
  riskFlags: RiskFlag[];

  /** Decision section — human must fill this */
  decision: DecisionSection;

  /** Safety declarations (hardcoded, never conditional) */
  safety: {
    notExecutionAuthority: true;
    isGovernedState: false;
    networkWriteStatus: "dry-run-local-only";
    humanReviewRequired: true;
  };

  /** Audit trail */
  audit: {
    packetGeneratedBy: "v7a2-review-packet-generator";
    bridgeVersion: "v7a2";
    reviewPhase: "pre-write-human-review";
  };
}

// ── Review Summary ──────────────────────────────────────────────

export interface ReviewSummary {
  /** One-line description */
  title: string;

  /** Composite signal at observation time */
  signal: string;

  /** Composite confidence (0-1) */
  confidence: number;

  /** Current regime */
  regime: string;

  /** Number of assets observed */
  assetCount: number;

  /** Number of providers active */
  activeProviders: number;

  /** Number of degraded/unavailable providers */
  degradedProviders: number;

  /** Whether the source was mock data */
  isMockData: boolean;

  /** Key findings for reviewer */
  keyFindings: string[];
}

// ── Risk Flags ──────────────────────────────────────────────────

export interface RiskFlag {
  /** Severity: info, warning, critical */
  severity: "info" | "warning" | "critical";

  /** Short category */
  category: string;

  /** Human-readable description */
  description: string;

  /** Whether this flag blocks acceptance */
  blocksAcceptance: boolean;
}

// ── Decision Section ────────────────────────────────────────────

export interface DecisionSection {
  /** The human reviewer's decision */
  humanDecision?: HumanDecision;

  /** Human reviewer notes (free text, scanned for forbidden patterns) */
  reviewerNotes?: string;

  /** Timestamp of decision */
  decidedAt?: string;

  /** Whether the decision has been recorded in the ledger */
  recordedInLedger: boolean;

  /** Allowed decisions the reviewer can choose from */
  allowedDecisions: HumanDecision[];

  /** Explicitly blocked decisions */
  blockedDecisions: ForbiddenDecision[];
}

// ── Decision Ledger Entry ───────────────────────────────────────

export interface DecisionLedgerEntry {
  /** When the decision was recorded */
  timestamp: string;

  /** Packet reference */
  packetSchemaVersion: string;
  packetGeneratedAt: string;

  /** Source draft reference */
  draftSchemaVersion: string;
  sourceSnapshotGeneratedAt: string;

  /** The decision made */
  humanDecision: HumanDecision;

  /** Reviewer notes */
  reviewerNotes?: string;

  /** Whether the decision allows future v7B write */
  eligibleForV7BWrite: boolean;

  /** Safety declarations at decision time */
  safety: {
    notExecutionAuthority: true;
    isGovernedState: false;
    networkWriteStatus: "dry-run-local-only";
    humanReviewRequired: true;
  };

  /** Audit */
  audit: {
    ledgerVersion: "v7a2";
    entryType: "human-decision";
  };
}

// ── Review Packet Validation Result ─────────────────────────────

export interface ReviewPacketValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** Decision is allowed (not forbidden) */
  decisionAllowed: boolean;
  /** Would create governed state */
  wouldCreateGovernedState: boolean;
  /** Would authorize execution */
  wouldAuthorizeExecution: boolean;
  /** Would enable live write */
  wouldEnableLiveWrite: boolean;
}
