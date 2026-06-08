/**
 * Local Write Simulator v7A.4
 *
 * Simulates the v7B Open Brain write process locally with NO network calls.
 * Validates write requests, enforces boundaries, tracks idempotency,
 * maintains audit log, and simulates circuit breaker / kill switch behavior.
 *
 * NO fetch(). NO credentials. NO Open Brain client. NO Supabase.
 */

import type { OpenBrainObservationWriteRequest } from "./writeRequestSchema";
import { checkIdempotency, generateIdempotencyKey, hashPayload } from "./idempotency";
import { appendAuditEntry } from "./auditLog";

// ── Circuit Breaker State ───────────────────────────────────────

interface CircuitBreakerState {
  state: "closed" | "open" | "half_open";
  consecutiveFailures: number;
  lastFailureTime?: number;
}

const circuitBreaker: CircuitBreakerState = {
  state: "closed",
  consecutiveFailures: 0,
};

const CIRCUIT_BREAKER_CONFIG = {
  failureThresholdOpen: 5,
  failureThresholdHalfOpen: 10,
  openDurationMs: 60000,
  halfOpenDurationMs: 300000,
};

// ── Kill Switch ─────────────────────────────────────────────────

function isKillSwitchActive(): boolean {
  return process.env.OPENBRAIN_WRITE_DISABLED === "true";
}

// ── Circuit Breaker Logic ───────────────────────────────────────

function checkCircuitBreaker(): { allowed: boolean; state: string } {
  const now = Date.now();

  if (circuitBreaker.state === "open") {
    const elapsed = now - (circuitBreaker.lastFailureTime || 0);
    if (elapsed > CIRCUIT_BREAKER_CONFIG.halfOpenDurationMs) {
      circuitBreaker.state = "half_open";
      return { allowed: true, state: "half_open" };
    }
    return { allowed: false, state: "open" };
  }

  if (circuitBreaker.state === "half_open") {
    const elapsed = now - (circuitBreaker.lastFailureTime || 0);
    if (elapsed > CIRCUIT_BREAKER_CONFIG.halfOpenDurationMs) {
      circuitBreaker.state = "closed";
      circuitBreaker.consecutiveFailures = 0;
      return { allowed: true, state: "closed" };
    }
    return { allowed: true, state: "half_open" };
  }

  return { allowed: true, state: "closed" };
}

function recordSuccess(): void {
  if (circuitBreaker.state === "half_open") {
    circuitBreaker.state = "closed";
  }
  circuitBreaker.consecutiveFailures = 0;
}

function recordFailure(): void {
  circuitBreaker.consecutiveFailures++;
  circuitBreaker.lastFailureTime = Date.now();

  if (circuitBreaker.consecutiveFailures >= CIRCUIT_BREAKER_CONFIG.failureThresholdHalfOpen) {
    circuitBreaker.state = "open";
  } else if (circuitBreaker.consecutiveFailures >= CIRCUIT_BREAKER_CONFIG.failureThresholdOpen) {
    circuitBreaker.state = "open";
  }
}

export function resetCircuitBreaker(): void {
  circuitBreaker.state = "closed";
  circuitBreaker.consecutiveFailures = 0;
  circuitBreaker.lastFailureTime = undefined;
}

export function getCircuitBreakerState(): string {
  return circuitBreaker.state;
}

// ── Stale Review Check ──────────────────────────────────────────

function isReviewStale(ledgerEntryTimestamp: string): boolean {
  const reviewTime = new Date(ledgerEntryTimestamp).getTime();
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return now - reviewTime > sevenDaysMs;
}

// ── Scope / Safety Validation ───────────────────────────────────

interface ValidationResult {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
  wouldCreateGovernedState: boolean;
  wouldAuthorizeExecution: boolean;
}

function validateWriteRequest(request: OpenBrainObservationWriteRequest): ValidationResult {
  // 1. Kill switch
  if (isKillSwitchActive()) {
    return {
      valid: false,
      errorCode: "WRITE_DISABLED",
      errorMessage: "Kill switch is active (OPENBRAIN_WRITE_DISABLED=true)",
      wouldCreateGovernedState: false,
      wouldAuthorizeExecution: false,
    };
  }

  // 2. Circuit breaker
  const cb = checkCircuitBreaker();
  if (!cb.allowed) {
    return {
      valid: false,
      errorCode: "CIRCUIT_BREAKER_OPEN",
      errorMessage: `Circuit breaker is ${cb.state}`,
      wouldCreateGovernedState: false,
      wouldAuthorizeExecution: false,
    };
  }

  // 3. Safety declarations
  const safety = request.safetyDeclarations;
  if (safety.notExecutionAuthority !== true) {
    return {
      valid: false,
      errorCode: "SAFETY_VIOLATION",
      errorMessage: "notExecutionAuthority is not true",
      wouldCreateGovernedState: true,
      wouldAuthorizeExecution: true,
    };
  }
  if (safety.containsTradeOrders !== false) {
    return {
      valid: false,
      errorCode: "SAFETY_VIOLATION",
      errorMessage: "containsTradeOrders is not false",
      wouldCreateGovernedState: false,
      wouldAuthorizeExecution: true,
    };
  }
  if (safety.containsExecutionInstructions !== false) {
    return {
      valid: false,
      errorCode: "SAFETY_VIOLATION",
      errorMessage: "containsExecutionInstructions is not false",
      wouldCreateGovernedState: false,
      wouldAuthorizeExecution: true,
    };
  }
  if (safety.containsWalletReferences !== false) {
    return {
      valid: false,
      errorCode: "SAFETY_VIOLATION",
      errorMessage: "containsWalletReferences is not false",
      wouldCreateGovernedState: false,
      wouldAuthorizeExecution: false,
    };
  }
  if (safety.containsCredentials !== false) {
    return {
      valid: false,
      errorCode: "SAFETY_VIOLATION",
      errorMessage: "containsCredentials is not false",
      wouldCreateGovernedState: false,
      wouldAuthorizeExecution: false,
    };
  }

  // 4. Governance assertions
  const gov = request.governanceAssertions;
  if (gov.requiresHumanReview !== true) {
    return {
      valid: false,
      errorCode: "GOVERNANCE_VIOLATION",
      errorMessage: "requiresHumanReview is not true",
      wouldCreateGovernedState: true,
      wouldAuthorizeExecution: false,
    };
  }
  if (gov.isGovernedState !== false) {
    return {
      valid: false,
      errorCode: "GOVERNANCE_VIOLATION",
      errorMessage: "isGovernedState is not false",
      wouldCreateGovernedState: true,
      wouldAuthorizeExecution: false,
    };
  }
  if (gov.networkWriteStatus !== "v7b-live-write") {
    return {
      valid: false,
      errorCode: "GOVERNANCE_VIOLATION",
      errorMessage: `networkWriteStatus is "${gov.networkWriteStatus}", expected "v7b-live-write"`,
      wouldCreateGovernedState: false,
      wouldAuthorizeExecution: false,
    };
  }

  // 5. Human review reference
  const review = request.humanReviewReference;
  if (review.decision !== "accept_for_future_observation_write") {
    return {
      valid: false,
      errorCode: "HUMAN_REVIEW_REQUIRED",
      errorMessage: `Human decision is "${review.decision}", expected "accept_for_future_observation_write"`,
      wouldCreateGovernedState: false,
      wouldAuthorizeExecution: false,
    };
  }
  if (review.expired) {
    return {
      valid: false,
      errorCode: "REVIEW_EXPIRED",
      errorMessage: "Human review decision has expired",
      wouldCreateGovernedState: false,
      wouldAuthorizeExecution: false,
    };
  }
  if (isReviewStale(review.ledgerEntryTimestamp)) {
    return {
      valid: false,
      errorCode: "REVIEW_EXPIRED",
      errorMessage: "Human review decision is older than 7 days",
      wouldCreateGovernedState: false,
      wouldAuthorizeExecution: false,
    };
  }

  // 6. Forbidden content scan
  const payload = JSON.stringify(request);
  const forbiddenPatterns = [
    { pattern: /"governed_state":\s*true/, name: "governed_state escalation" },
    { pattern: /"execute_trade"/, name: "execution instruction" },
    { pattern: /"approve_execution"/, name: "execution approval" },
    { pattern: /"strategy_approval"/, name: "strategy approval" },
    { pattern: /"risk_control_mutation"/, name: "risk control mutation" },
  ];
  for (const { pattern, name } of forbiddenPatterns) {
    if (pattern.test(payload)) {
      return {
        valid: false,
        errorCode: "SCOPE_VIOLATION",
        errorMessage: `Forbidden content detected: ${name}`,
        wouldCreateGovernedState: name === "governed_state escalation",
        wouldAuthorizeExecution: name.includes("execution"),
      };
    }
  }

  return {
    valid: true,
    wouldCreateGovernedState: false,
    wouldAuthorizeExecution: false,
  };
}

// ── Simulated Write ─────────────────────────────────────────────

export interface SimulatedWriteResult {
  status: "success" | "duplicate" | "rejected" | "blocked";
  errorCode?: string;
  errorMessage?: string;
  idempotencyKey: string;
  recordId?: string;
  simulatedLatencyMs: number;
  auditSequence: number;
  circuitBreakerState: string;
  killSwitchActive: boolean;
  wouldCreateGovernedState: boolean;
  wouldAuthorizeExecution: boolean;
}

/**
 * Simulate a write to Open Brain.
 *
 * This function NEVER makes a network call. It:
 * 1. Validates the request
 * 2. Checks idempotency
 * 3. Simulates a server response
 * 4. Writes to the local audit log
 */
export function simulateWrite(
  request: OpenBrainObservationWriteRequest
): SimulatedWriteResult {
  const key = request.idempotencyKey;

  // Step 1: Validate
  const validation = validateWriteRequest(request);
  const cbState = checkCircuitBreaker();
  const killSwitch = isKillSwitchActive();

  if (!validation.valid) {
    recordFailure();
    const auditEntry = appendAuditEntry(
      validation.errorCode === "SAFETY_VIOLATION"
        ? "safety_violation"
        : validation.errorCode === "GOVERNANCE_VIOLATION"
          ? "governance_violation"
          : validation.errorCode === "WRITE_DISABLED"
            ? "kill_switch_active"
            : validation.errorCode === "CIRCUIT_BREAKER_OPEN"
              ? "circuit_breaker_open"
              : validation.errorCode === "REVIEW_EXPIRED"
                ? "review_expired"
                : "human_review_missing",
      key,
      validation.errorMessage || "Write rejected",
      "rejected",
      killSwitch,
      cbState.state
    );

    return {
      status: "rejected",
      errorCode: validation.errorCode,
      errorMessage: validation.errorMessage,
      idempotencyKey: key,
      simulatedLatencyMs: 0,
      auditSequence: auditEntry.sequence,
      circuitBreakerState: cbState.state,
      killSwitchActive: killSwitch,
      wouldCreateGovernedState: validation.wouldCreateGovernedState,
      wouldAuthorizeExecution: validation.wouldAuthorizeExecution,
    };
  }

  // Step 2: Check idempotency
  const idempotencyResult = checkIdempotency(key, request);

  if (idempotencyResult.status === "collision") {
    recordFailure();
    const auditEntry = appendAuditEntry(
      "idempotency_collision",
      key,
      "Idempotency key collision: same key, different payload",
      "rejected",
      killSwitch,
      cbState.state
    );

    return {
      status: "rejected",
      errorCode: "IDEMPOTENCY_COLLISION",
      errorMessage: "Idempotency key already used with different payload",
      idempotencyKey: key,
      simulatedLatencyMs: 0,
      auditSequence: auditEntry.sequence,
      circuitBreakerState: cbState.state,
      killSwitchActive: killSwitch,
      wouldCreateGovernedState: false,
      wouldAuthorizeExecution: false,
    };
  }

  if (idempotencyResult.status === "duplicate") {
    recordSuccess();
    const auditEntry = appendAuditEntry(
      "write_duplicate",
      key,
      "Duplicate write: same idempotency key and payload",
      "duplicate",
      killSwitch,
      cbState.state
    );

    return {
      status: "duplicate",
      idempotencyKey: key,
      recordId: `rec-${key.slice(0, 8)}`,
      simulatedLatencyMs: 5,
      auditSequence: auditEntry.sequence,
      circuitBreakerState: cbState.state,
      killSwitchActive: killSwitch,
      wouldCreateGovernedState: false,
      wouldAuthorizeExecution: false,
    };
  }

  // Step 3: Simulate success
  recordSuccess();
  const simulatedLatencyMs = 50 + Math.floor(Math.random() * 150);
  const recordId = `rec-${key.slice(0, 8)}-${Date.now().toString(36)}`;

  const auditEntry = appendAuditEntry(
    "write_success",
    key,
    `Simulated write success: recordId=${recordId}`,
    "success",
    killSwitch,
    cbState.state
  );

  return {
    status: "success",
    idempotencyKey: key,
    recordId,
    simulatedLatencyMs,
    auditSequence: auditEntry.sequence,
    circuitBreakerState: cbState.state,
    killSwitchActive: killSwitch,
    wouldCreateGovernedState: false,
    wouldAuthorizeExecution: false,
  };
}

/**
 * Create a minimal valid write request for testing.
 */
export function createValidWriteRequest(
  overrides?: Partial<OpenBrainObservationWriteRequest>
): OpenBrainObservationWriteRequest {
  return {
    schemaVersion: "open-brain-observation-write-v7b",
    idempotencyKey: generateIdempotencyKey(),
    observationDraft: {
      schemaVersion: "open-brain-observation-draft-v7a",
      draftedAt: new Date().toISOString(),
      sourceSnapshot: {
        schemaVersion: "alpha-snapshot-v6",
        generatedAt: new Date().toISOString(),
        source: "mock",
      },
      providerStatus: [],
      assetObservations: [],
      regimeObservation: {
        currentRegime: "flight_to_safety",
        priorRegime: "flight_to_safety",
        transitionConfidence: 0.1,
        description: "Defensive regime",
      },
      compositeObservation: {
        signal: "defensive",
        confidence: 0.76,
        contributingFactors: ["mock data"],
        blockingIssues: [],
      },
      safety: {
        notExecutionAuthority: true,
        containsTradeOrders: false,
        containsWalletReferences: false,
        containsExecutionInstructions: false,
        containsCredentials: false,
      },
      governance: {
        requiresHumanReview: true,
        isGovernedState: false,
        dataMode: "mock",
        networkWriteStatus: "dry-run-local-only",
      },
    },
    safetyDeclarations: {
      notExecutionAuthority: true,
      containsTradeOrders: false,
      containsWalletReferences: false,
      containsExecutionInstructions: false,
      containsCredentials: false,
    },
    governanceAssertions: {
      requiresHumanReview: true,
      isGovernedState: false,
      networkWriteStatus: "v7b-live-write",
    },
    humanReviewReference: {
      decision: "accept_for_future_observation_write",
      ledgerEntryTimestamp: new Date().toISOString(),
      reviewerIdentity: "test-reviewer",
      expired: false,
    },
    auditMetadata: {
      requestedAt: new Date().toISOString(),
      clientVersion: "5.1.0",
      generatorCommit: "abc123",
      sourceSnapshotHash: "sha256-abc",
      bridgeCommit: "def456",
    },
    ...overrides,
  } as OpenBrainObservationWriteRequest;
}
