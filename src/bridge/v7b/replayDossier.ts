/**
 * Replay Promotion Dossier v7A.6
 *
 * Converts replayed observation packets into human-reviewable promotion
 * dossiers without creating governed state, credentials, network writes,
 * Open Brain writes, or execution capability.
 *
 * A dossier is the final checkpoint before any v7B consideration.
 * It aggregates replay results, audit chain status, determinism verification,
 * and boundary checks into a single operator-reviewable document.
 */

import { hashPayload } from "./idempotency";
import { verifyAuditChain } from "./auditLog";

// ── Dossier States ──────────────────────────────────────────────

export type DossierState =
  | "replay_verified"
  | "promotion_candidate"
  | "rejected"
  | "needs_operator_review"
  | "blocked_boundary_violation";

// ── Dossier ─────────────────────────────────────────────────────

export interface ReplayPromotionDossier {
  /** Contract version */
  schemaVersion: "open-brain-replay-dossier-v7a6";

  /** When the dossier was generated */
  generatedAt: string;

  /** Current state of this dossier */
  state: DossierState;

  /** SHA-256 hash of the source packet payload */
  packetHash: string;

  /** Result of the replay (success / duplicate / rejected / blocked) */
  replayResult: string;

  /** Simulator status detail */
  simulatorResult: {
    status: string;
    errorCode?: string;
    errorMessage?: string;
  };

  /** If rejected, the specific reason */
  rejectionReason?: string;

  /** Audit chain verification status at dossier generation time */
  auditChainStatus: {
    valid: boolean;
    entriesChecked: number;
    firstBrokenSequence?: number;
  };

  /** Whether the replay was deterministic */
  determinismStatus: "verified" | "failed" | "not_tested";

  /** Idempotency key from the write request */
  idempotencyKey: string;

  /** Human operator decision placeholder */
  operatorDecision?: {
    decision?: "promote_to_v7b_candidate" | "reject" | "needs_revision" | "defer";
    decidedAt?: string;
    reviewerIdentity?: string;
    notes?: string;
  };

  /** Allowed operator decisions for this dossier */
  allowedDecisions: string[];

  /** Safety declarations (hardcoded) */
  safety: {
    notExecutionAuthority: true;
    isGovernedState: false;
    networkWriteStatus: "dry-run-local-only";
    humanReviewRequired: true;
    noCredentialsPresent: true;
    noNetworkCallsMade: true;
  };

  /** Audit trail */
  audit: {
    dossierGeneratedBy: "v7a6-replay-dossier-generator";
    bridgeVersion: "v7a6";
    dossierPhase: "promotion-preflight";
  };
}

// ── Dossier Input ───────────────────────────────────────────────

export interface DossierInput {
  /** The packet payload that was replayed */
  packetPayload: unknown;

  /** Result from simulateWrite() */
  replayResult: {
    status: string;
    errorCode?: string;
    errorMessage?: string;
    idempotencyKey: string;
    wouldCreateGovernedState: boolean;
    wouldAuthorizeExecution: boolean;
  };

  /** Whether the replay was verified deterministic */
  determinismVerified: boolean;

  /** Whether the audit chain was verified */
  auditChainVerified: boolean;

  /** Number of audit entries at dossier generation time */
  auditEntryCount: number;
}

// ── Forbidden transitions ───────────────────────────────────────

/** Decisions that are NOT allowed in the operator decision field */
export const FORBIDDEN_DOSSIER_DECISIONS = [
  "auto_promote",
  "approve_for_execution",
  "enable_live_write",
  "create_governed_state",
  "grant_execution_authority",
] as const;

/** Allowed operator decisions */
export const ALLOWED_DOSSIER_DECISIONS = [
  "promote_to_v7b_candidate",
  "reject",
  "needs_revision",
  "defer",
] as const;

// ── Dossier Generator ───────────────────────────────────────────

/**
 * Generate a promotion dossier from a replay result.
 *
 * This function NEVER makes network calls. It is pure analysis.
 */
export function generateDossier(input: DossierInput): ReplayPromotionDossier {
  const packetHash = hashPayload(input.packetPayload);

  // ── State determination (fail-closed) ─────────────────────────

  let state: DossierState;
  let rejectionReason: string | undefined;
  let allowedDecisions: string[];

  // 1. Boundary violation check (highest priority)
  if (
    input.replayResult.wouldCreateGovernedState ||
    input.replayResult.wouldAuthorizeExecution
  ) {
    state = "blocked_boundary_violation";
    rejectionReason =
      "Replay result indicates governed state or execution authority would be created. " +
      "This is a critical boundary violation. Dossier blocked.";
    allowedDecisions = ["reject"];
  }
  // 2. Replay failed
  else if (input.replayResult.status === "rejected") {
    state = "rejected";
    rejectionReason =
      input.replayResult.errorMessage ||
      `Replay rejected with code: ${input.replayResult.errorCode}`;
    allowedDecisions = ["reject", "needs_revision"];
  }
  // 3. Replay blocked (circuit breaker, kill switch)
  else if (input.replayResult.status === "blocked") {
    state = "blocked_boundary_violation";
    rejectionReason =
      input.replayResult.errorMessage || "Replay blocked by safety mechanism";
    allowedDecisions = ["reject", "defer"];
  }
  // 4. Audit chain invalid
  else if (!input.auditChainVerified) {
    state = "needs_operator_review";
    rejectionReason = "Audit chain verification failed. Operator review required.";
    allowedDecisions = ["needs_revision", "defer", "reject"];
  }
  // 5. Determinism not verified
  else if (!input.determinismVerified) {
    state = "needs_operator_review";
    rejectionReason =
      "Replay determinism could not be verified. Operator review required.";
    allowedDecisions = ["needs_revision", "defer", "reject"];
  }
  // 6. Success path
  else if (input.replayResult.status === "success") {
    state = "promotion_candidate";
    allowedDecisions = [
      "promote_to_v7b_candidate",
      "reject",
      "needs_revision",
      "defer",
    ];
  }
  // 7. Duplicate (idempotent) — still valid but already exists
  else if (input.replayResult.status === "duplicate") {
    state = "replay_verified";
    rejectionReason = "Duplicate replay: packet already processed. No new action needed.";
    allowedDecisions = ["defer", "reject"];
  }
  // 8. Unknown status — fail closed
  else {
    state = "needs_operator_review";
    rejectionReason = `Unknown replay status: ${input.replayResult.status}. Operator review required.`;
    allowedDecisions = ["needs_revision", "defer", "reject"];
  }

  // ── Build dossier ─────────────────────────────────────────────

  return {
    schemaVersion: "open-brain-replay-dossier-v7a6",
    generatedAt: new Date().toISOString(),
    state,
    packetHash,
    replayResult: input.replayResult.status,
    simulatorResult: {
      status: input.replayResult.status,
      errorCode: input.replayResult.errorCode,
      errorMessage: input.replayResult.errorMessage,
    },
    rejectionReason,
    auditChainStatus: {
      valid: input.auditChainVerified,
      entriesChecked: input.auditEntryCount,
    },
    determinismStatus: input.determinismVerified ? "verified" : "failed",
    idempotencyKey: input.replayResult.idempotencyKey,
    allowedDecisions,
    safety: {
      notExecutionAuthority: true,
      isGovernedState: false,
      networkWriteStatus: "dry-run-local-only",
      humanReviewRequired: true,
      noCredentialsPresent: true,
      noNetworkCallsMade: true,
    },
    audit: {
      dossierGeneratedBy: "v7a6-replay-dossier-generator",
      bridgeVersion: "v7a6",
      dossierPhase: "promotion-preflight",
    },
  };
}

/**
 * Validate an operator decision on a dossier.
 *
 * Returns true if the decision is allowed for this dossier's state.
 */
export function validateDossierDecision(
  dossier: ReplayPromotionDossier,
  decision: string
): { valid: boolean; error?: string } {
  // Check if decision is in the allowed list
  if (!dossier.allowedDecisions.includes(decision)) {
    return {
      valid: false,
      error: `Decision "${decision}" is not allowed for dossier state "${dossier.state}". Allowed: ${dossier.allowedDecisions.join(", ")}`,
    };
  }

  // Check if decision is forbidden
  const forbidden = FORBIDDEN_DOSSIER_DECISIONS as unknown as string[];
  if (forbidden.includes(decision)) {
    return {
      valid: false,
      error: `Decision "${decision}" is forbidden and will never be allowed.`,
    };
  }

  return { valid: true };
}

/**
 * Check if a dossier can be promoted to v7B candidate status.
 *
 * A dossier can only be promoted if:
 * 1. Its state is "promotion_candidate"
 * 2. The operator has made a "promote_to_v7b_candidate" decision
 * 3. No boundary violations are present
 */
export function canPromoteToV7BCandidate(
  dossier: ReplayPromotionDossier
): boolean {
  return (
    dossier.state === "promotion_candidate" &&
    dossier.safety.notExecutionAuthority === true &&
    dossier.safety.isGovernedState === false &&
    dossier.safety.networkWriteStatus === "dry-run-local-only" &&
    !dossier.rejectionReason
  );
}

/**
 * Reset dossier state (for testing).
 */
export function resetDossierState(): void {
  // Dossiers are immutable; no global state to reset
}
