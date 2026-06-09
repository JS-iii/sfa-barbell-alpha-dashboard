/**
 * v7B Candidate Lock v7A.7
 *
 * A review-only, non-executable lock object that records a dossier's
 * promotion to v7B candidate status. This lock CANNOT activate v7B.
 * It is a governance checkpoint only.
 *
 * To actually activate v7B, a separate operator authorization is
 * required beyond this lock. The lock is append-only and audit-logged.
 *
 * NO network calls. NO credentials. NO execution capability.
 */

// ── Lock States ─────────────────────────────────────────────────

export type CandidateLockState =
  | "candidate_locked"      // Dossier promoted to candidate, awaiting v7B auth
  | "candidate_rejected"    // Dossier rejected, cannot become candidate
  | "candidate_blocked"     // Boundary violation blocked promotion
  | "candidate_expired"     // Candidate lock expired (90 days max)
  | "v7b_not_authorized";   // Explicit: v7B has not been authorized

// ── Candidate Lock ──────────────────────────────────────────────

export interface V7BCandidateLock {
  /** Contract version */
  schemaVersion: "open-brain-v7b-candidate-lock-v7a7";

  /** When the lock was created */
  lockedAt: string;

  /** Current state */
  state: CandidateLockState;

  /** Reference to the source dossier */
  sourceDossier: {
    packetHash: string;
    dossierState: string;
    generatedAt: string;
  };

  /** Operator decision that created this lock */
  operatorDecision: {
    decision: "promote_to_v7b_candidate" | "reject" | "needs_revision" | "defer";
    decidedAt: string;
    reviewerIdentity: string;
    notes?: string;
  };

  /** Expiration: candidate locks expire after 90 days */
  expiresAt: string;

  /** Whether this lock has expired */
  isExpired: boolean;

  /** Explicit v7B authorization status */
  v7bAuthorization: {
    authorized: false;           // ALWAYS false in v7A.7
    authorizationId: null;       // ALWAYS null in v7A.7
    authorizedBy: null;          // ALWAYS null in v7A.7
    authorizedAt: null;          // ALWAYS null in v7A.7
  };

  /** Unlock requirements (documentary only) */
  unlockRequirements: {
    requiresExplicitOperatorAuthorization: true;
    requiresCredentialSetup: true;
    requiresSecurityReview: true;
    requiresOperatorChecklistCompletion: true;
    separatePhaseAuthorization: "v7b-only-not-v7a7";
  };

  /** Safety declarations (hardcoded) */
  safety: {
    notExecutionAuthority: true;
    isGovernedState: false;
    networkWriteStatus: "dry-run-local-only";
    humanReviewRequired: true;
    v7bActivationBlocked: true;     // KEY: v7B cannot be activated from this lock
  };

  /** Audit */
  audit: {
    lockGeneratedBy: "v7a7-governance-rehearsal";
    bridgeVersion: "v7a7";
    phase: "v7b-candidate-lock-only";
  };
}

// ── Forbidden actions ───────────────────────────────────────────

/** Actions that are NOT allowed on a candidate lock */
export const FORBIDDEN_LOCK_ACTIONS = [
  "activate_v7b",
  "enable_live_write",
  "create_governed_state",
  "grant_execution_authority",
  "auto_promote_from_lock",
  "bypass_operator_authorization",
  "inject_credentials",
  "make_network_call",
] as const;

// ── Lock Factory ────────────────────────────────────────────────

/**
 * Create a v7B candidate lock from a promotion dossier and operator decision.
 *
 * This function NEVER activates v7B. It creates a governance record only.
 * The lock is always in a "not authorized" state for v7B activation.
 */
export function createV7BCandidateLock(
  packetHash: string,
  dossierState: string,
  dossierGeneratedAt: string,
  operatorDecision: "promote_to_v7b_candidate" | "reject" | "needs_revision" | "defer",
  reviewerIdentity: string,
  notes?: string
): V7BCandidateLock {
  const now = new Date();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(now.getTime() + ninetyDaysMs);

  let state: CandidateLockState;

  if (operatorDecision === "promote_to_v7b_candidate") {
    state = "candidate_locked";
  } else if (operatorDecision === "reject") {
    state = "candidate_rejected";
  } else {
    state = "v7b_not_authorized";
  }

  return {
    schemaVersion: "open-brain-v7b-candidate-lock-v7a7",
    lockedAt: now.toISOString(),
    state,
    sourceDossier: {
      packetHash,
      dossierState,
      generatedAt: dossierGeneratedAt,
    },
    operatorDecision: {
      decision: operatorDecision,
      decidedAt: now.toISOString(),
      reviewerIdentity,
      notes,
    },
    expiresAt: expiresAt.toISOString(),
    isExpired: false,
    v7bAuthorization: {
      authorized: false,
      authorizationId: null,
      authorizedBy: null,
      authorizedAt: null,
    },
    unlockRequirements: {
      requiresExplicitOperatorAuthorization: true,
      requiresCredentialSetup: true,
      requiresSecurityReview: true,
      requiresOperatorChecklistCompletion: true,
      separatePhaseAuthorization: "v7b-only-not-v7a7",
    },
    safety: {
      notExecutionAuthority: true,
      isGovernedState: false,
      networkWriteStatus: "dry-run-local-only",
      humanReviewRequired: true,
      v7bActivationBlocked: true,
    },
    audit: {
      lockGeneratedBy: "v7a7-governance-rehearsal",
      bridgeVersion: "v7a7",
      phase: "v7b-candidate-lock-only",
    },
  };
}

/**
 * Check if a lock action is allowed.
 *
 * All v7B activation actions are blocked.
 */
export function isLockActionAllowed(action: string): boolean {
  const forbidden = FORBIDDEN_LOCK_ACTIONS as unknown as string[];
  return !forbidden.includes(action);
}

/**
 * Check if v7B can be activated from this lock.
 *
 * This ALWAYS returns false in v7A.7. v7B activation requires
 * a separate authorization phase beyond this lock.
 */
export function canActivateV7BFromLock(_lock: V7BCandidateLock): boolean {
  // v7A.7 explicitly blocks all v7B activation
  return false;
}

/**
 * Check if a candidate lock has expired.
 */
export function isLockExpired(lock: V7BCandidateLock): boolean {
  return new Date().getTime() > new Date(lock.expiresAt).getTime();
}

/**
 * Get the list of forbidden lock actions.
 */
export function getForbiddenLockActions(): readonly string[] {
  return FORBIDDEN_LOCK_ACTIONS as unknown as string[];
}
