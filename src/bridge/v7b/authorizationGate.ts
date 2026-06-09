/**
 * Authorization Gate v7B.0
 *
 * Requires explicit operator authorization before any live write
 * capability can be considered. This is a hardcoded gate that
 * checks for a future authorization signal.
 *
 * v7B.0: Authorization is ALWAYS false. No mechanism exists to
 * set it true in this phase.
 */

export interface AuthorizationState {
  /** Whether v7B live writes are authorized */
  authorized: boolean;

  /** Authorization ID (null in v7B.0) */
  authorizationId: string | null;

  /** Who authorized (null in v7B.0) */
  authorizedBy: string | null;

  /** When authorized (null in v7B.0) */
  authorizedAt: string | null;

  /** Reason for current state */
  reason: string;
}

// ── Hardcoded v7B.0 state ──────────────────────────────────────

/** Authorization is NOT granted in v7B.0. This constant is used by the gate. */
const V7B0_AUTHORIZATION_STATE: AuthorizationState = {
  authorized: false,
  authorizationId: null,
  authorizedBy: null,
  authorizedAt: null,
  reason: "v7B.0 is contract/scaffold only. Live writes are not authorized. A future v7B activation phase with explicit operator approval is required.",
};

/**
 * Check the current authorization state.
 *
 * v7B.0: Always returns authorized=false.
 */
export function checkAuthorization(): AuthorizationState {
  return { ...V7B0_AUTHORIZATION_STATE };
}

/**
 * Check if live writes are authorized.
 *
 * v7B.0: Always false.
 */
export function isAuthorized(): boolean {
  return checkAuthorization().authorized;
}

/**
 * Validate that an action requires authorization.
 *
 * Returns an error if authorization is not present.
 */
export function requireAuthorization(
  action: string
): { allowed: boolean; error?: string } {
  const auth = checkAuthorization();
  if (!auth.authorized) {
    return {
      allowed: false,
      error: `Action "${action}" blocked: v7B live writes are not authorized. ${auth.reason}`,
    };
  }
  return { allowed: true };
}
