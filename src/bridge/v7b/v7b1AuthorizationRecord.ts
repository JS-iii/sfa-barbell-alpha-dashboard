/**
 * v7B.1 Authorization Record v7B.0.2
 *
 * The shape of a v7B.1 authorization record. Hardcoded unauthorized
 * in v7B.0.2. A future phase may populate this from operator input.
 */

export interface V7B1AuthorizationRecord {
  /** Record version */
  schemaVersion: "open-brain-v7b1-authorization-v7b02";

  /** Authorization status */
  authorized: false;

  /** Authorization ID (null in v7B.0.2) */
  authorizationId: null;

  /** Who authorized (null in v7B.0.2) */
  authorizedBy: null;

  /** When authorized (null in v7B.0.2) */
  authorizedAt: null;

  /** Authorization method (null in v7B.0.2) */
  method: null;

  /** Human-readable status */
  status: "pending_authorization";

  /** Reason for current status */
  reason: string;

  /** Prerequisites for authorization */
  prerequisites: {
    v7b02CanaryRCSealed: boolean;
    operatorSignoffComplete: boolean;
    credentialsStaged: boolean;
    securityReviewPassed: boolean;
    killSwitchVerifiedClosed: boolean;
    rollbackPlanReviewed: boolean;
  };

  /** Safety */
  safety: {
    notExecutionAuthority: true;
    isGovernedState: false;
    networkWriteStatus: "dry-run-local-only";
    canActivateV7B1: false;
  };
}

/**
 * Get the v7B.1 authorization record.
 *
 * v7B.0.2: Always returns unauthorized.
 */
export function getV7B1AuthorizationRecord(
  prerequisites: Partial<V7B1AuthorizationRecord["prerequisites"]> = {}
): V7B1AuthorizationRecord {
  return {
    schemaVersion: "open-brain-v7b1-authorization-v7b02",
    authorized: false,
    authorizationId: null,
    authorizedBy: null,
    authorizedAt: null,
    method: null,
    status: "pending_authorization",
    reason:
      "v7B.1 is NOT AUTHORIZED. " +
      "v7B.0.2 is final pre-live-write staging only. " +
      "Explicit operator authorization in a future phase is required.",
    prerequisites: {
      v7b02CanaryRCSealed: prerequisites.v7b02CanaryRCSealed ?? false,
      operatorSignoffComplete: prerequisites.operatorSignoffComplete ?? false,
      credentialsStaged: prerequisites.credentialsStaged ?? false,
      securityReviewPassed: prerequisites.securityReviewPassed ?? false,
      killSwitchVerifiedClosed: prerequisites.killSwitchVerifiedClosed ?? false,
      rollbackPlanReviewed: prerequisites.rollbackPlanReviewed ?? false,
    },
    safety: {
      notExecutionAuthority: true,
      isGovernedState: false,
      networkWriteStatus: "dry-run-local-only",
      canActivateV7B1: false,
    },
  };
}

/**
 * Check if v7B.1 is authorized.
 *
 * v7B.0.2: Always false.
 */
export function isV7B1Authorized(): boolean {
  return getV7B1AuthorizationRecord().authorized;
}
