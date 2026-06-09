/**
 * Canary Eligibility Validator v7B.0.1
 *
 * Validates canary write payloads before any live write attempt.
 * All validation is local. No network calls. No credentials.
 *
 * A canary payload is only valid if:
 * 1. It has the correct schema version
 * 2. writeType is exactly "canary"
 * 3. Safety declarations are correct
 * 4. Governance assertions are correct (v7bAuthorized: false)
 * 5. No forbidden content (governed_state, execution, etc.)
 * 6. Operator authorization is false (v7B.0.1)
 */

export interface CanaryValidationResult {
  valid: boolean;
  errors: string[];
  wouldCreateGovernedState: boolean;
  wouldAuthorizeExecution: boolean;
  credentialsPresent: boolean;
  openBrainConnected: boolean;
  networkWriteAttempted: boolean;
}

/** Schema version for canary writes */
export const CANARY_SCHEMA_VERSION = "open-brain-canary-write-v7b01";

/**
 * Validate a canary write payload.
 *
 * This is a fail-closed validator: any issue blocks the payload.
 */
export function validateCanaryPayload(
  payload: unknown
): CanaryValidationResult {
  const errors: string[] = [];
  const p = payload as Record<string, unknown>;

  // 1. Schema version
  if (p.schemaVersion !== CANARY_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be "${CANARY_SCHEMA_VERSION}", got "${p.schemaVersion}"`);
  }

  // 2. writeType must be "canary"
  if (p.writeType !== "canary") {
    errors.push(`writeType must be "canary", got "${p.writeType}"`);
  }

  // 3. Safety declarations
  const safety = (p.safetyDeclarations || {}) as Record<string, unknown>;
  if (safety.notExecutionAuthority !== true) {
    errors.push("safetyDeclarations.notExecutionAuthority must be true");
  }
  if (safety.containsTradeOrders !== false) {
    errors.push("safetyDeclarations.containsTradeOrders must be false");
  }
  if (safety.containsExecutionInstructions !== false) {
    errors.push("safetyDeclarations.containsExecutionInstructions must be false");
  }
  if (safety.containsWalletReferences !== false) {
    errors.push("safetyDeclarations.containsWalletReferences must be false");
  }
  if (safety.containsCredentials !== false) {
    errors.push("safetyDeclarations.containsCredentials must be false");
  }
  if (safety.isGovernedState !== false) {
    errors.push("safetyDeclarations.isGovernedState must be false");
  }

  // 4. Governance assertions
  const gov = (p.governanceAssertions || {}) as Record<string, unknown>;
  if (gov.requiresHumanReview !== true) {
    errors.push("governanceAssertions.requiresHumanReview must be true");
  }
  if (gov.networkWriteStatus !== "canary-write-only") {
    errors.push(`governanceAssertions.networkWriteStatus must be "canary-write-only", got "${gov.networkWriteStatus}"`);
  }
  if (gov.v7bAuthorized !== false) {
    errors.push(`governanceAssertions.v7bAuthorized must be false in v7B.0.1, got "${gov.v7bAuthorized}"`);
  }

  // 5. Operator authorization must be false
  const opAuth = (p.operatorAuthorization || {}) as Record<string, unknown>;
  if (opAuth.authorized !== false) {
    errors.push(`operatorAuthorization.authorized must be false in v7B.0.1`);
  }

  // 6. Forbidden content scan
  const payloadStr = JSON.stringify(payload).toLowerCase();
  const forbiddenPatterns = [
    { pattern: /"governed_state"\s*:\s*true/, name: "governed_state: true" },
    { pattern: /"execute_trade"/, name: "execute_trade" },
    { pattern: /"approve_execution"/, name: "approve_execution" },
    { pattern: /"strategy_approval"/, name: "strategy_approval" },
    { pattern: /"risk_control_mutation"/, name: "risk_control_mutation" },
    { pattern: /sk-[a-z0-9]{20,}/i, name: "secret key pattern" },
    { pattern: /0x[a-f0-9]{40}/i, name: "ethereum address pattern" },
  ];

  for (const { pattern, name } of forbiddenPatterns) {
    if (pattern.test(payloadStr)) {
      errors.push(`Forbidden content detected: ${name}`);
    }
  }

  const hasErrors = errors.length > 0;

  return {
    valid: !hasErrors,
    errors,
    wouldCreateGovernedState:
      safety.isGovernedState === true ||
      payloadStr.includes('"governed_state":true'),
    wouldAuthorizeExecution:
      safety.notExecutionAuthority !== true ||
      safety.containsExecutionInstructions === true ||
      safety.containsTradeOrders === true,
    credentialsPresent: false,
    openBrainConnected: false,
    networkWriteAttempted: false,
  };
}

/**
 * Create a minimal valid canary payload for testing.
 */
export function createValidCanaryPayload(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    schemaVersion: CANARY_SCHEMA_VERSION,
    writeType: "canary",
    idempotencyKey: "canary-test-key",
    safetyDeclarations: {
      notExecutionAuthority: true,
      containsTradeOrders: false,
      containsWalletReferences: false,
      containsExecutionInstructions: false,
      containsCredentials: false,
      isGovernedState: false,
    },
    governanceAssertions: {
      requiresHumanReview: true,
      networkWriteStatus: "canary-write-only",
      v7bAuthorized: false,
    },
    observation: {
      signal: "defensive",
      confidence: 0.5,
      timestamp: new Date().toISOString(),
      source: "canary-test",
    },
    operatorAuthorization: {
      authorizationId: null,
      authorized: false,
    },
    auditMetadata: {
      requestedAt: new Date().toISOString(),
      clientVersion: "7.0.0",
      rehearsalPhase: "v7b01-canary-plan",
    },
    ...overrides,
  };
}
