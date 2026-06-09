/**
 * Governed State Guard v7B.0
 *
 * Prevents the creation of governed state at the write layer.
 * Any attempt to create governed state is blocked.
 *
 * This guard enforces that observation writes remain observations only
 * and never escalate to governed state status.
 */

export interface GovernedStateCheckResult {
  /** Whether governed state would be created */
  wouldCreateGovernedState: boolean;

  /** Whether the check passed (no governed state = pass) */
  passed: boolean;

  /** If failed, the reason */
  reason?: string;
}

/**
 * Check if a payload would attempt to create governed state.
 *
 * Scans for forbidden patterns that indicate governed state creation.
 */
export function checkGovernedStateCreation(payload: unknown): GovernedStateCheckResult {
  const payloadStr = JSON.stringify(payload).toLowerCase();

  const forbiddenPatterns = [
    { pattern: /"governed_state"\s*:\s*true/, description: "governed_state set to true" },
    { pattern: /"isgovernedstate"\s*:\s*true/, description: "isGovernedState set to true" },
    { pattern: /"create_governed_state"/, description: "create_governed_state action" },
    { pattern: /"promote_to_governed"/, description: "promote_to_governed action" },
    { pattern: /"governed_state_write"/, description: "governed_state_write scope" },
  ];

  for (const { pattern, description } of forbiddenPatterns) {
    if (pattern.test(payloadStr)) {
      return {
        wouldCreateGovernedState: true,
        passed: false,
        reason: `Governed state creation blocked: ${description}`,
      };
    }
  }

  return {
    wouldCreateGovernedState: false,
    passed: true,
  };
}

/**
 * Check if a safety declaration indicates governed state.
 */
export function checkGovernedStateFromSafety(
  isGovernedState: boolean
): GovernedStateCheckResult {
  if (isGovernedState) {
    return {
      wouldCreateGovernedState: true,
      passed: false,
      reason: "Governed state creation blocked: isGovernedState is true in safety declaration",
    };
  }
  return { wouldCreateGovernedState: false, passed: true };
}

/**
 * Check if governed state creation is allowed.
 *
 * v7B.0: Governed state creation is NEVER allowed.
 */
export function isGovernedStateCreationAllowed(): boolean {
  return false;
}
