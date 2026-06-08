/**
 * Open Brain Observation Write Request Schema v7B
 *
 * Type definitions only. No network client. No credential reads.
 * No imports from any HTTP client library.
 *
 * These types define the shape of a v7B write request for:
 * - Documentation clarity
 * - Future implementation reference
 * - Parity checking against v7A dry-run output
 *
 * v7A.3 status: This file contains only interfaces and type aliases.
 * No executable code. No side effects.
 */

import type { OpenBrainObservationDraft } from "../types";

// ── Write Request ───────────────────────────────────────────────

/** Top-level write request sent to Open Brain observation API */
export interface OpenBrainObservationWriteRequest {
  /** Contract version */
  schemaVersion: "open-brain-observation-write-v7b";

  /** Unique idempotency key (UUID v4) */
  idempotencyKey: string;

  /** The observation draft (from v7A bridge transformer) */
  observationDraft: OpenBrainObservationDraft;

  /** Safety declarations (redundant with draft, required for server validation) */
  safetyDeclarations: WriteSafetyDeclarations;

  /** Governance assertions (redundant with draft, required for server validation) */
  governanceAssertions: WriteGovernanceAssertions;

  /** Reference to the human review decision that approved this write */
  humanReviewReference: HumanReviewReference;

  /** Audit metadata */
  auditMetadata: WriteAuditMetadata;
}

// ── Safety Declarations ─────────────────────────────────────────

/** Safety boundary declarations for the write request */
export interface WriteSafetyDeclarations {
  /** Always true: this observation does not authorize execution */
  notExecutionAuthority: true;

  /** Always false: no trade orders included */
  containsTradeOrders: false;

  /** Always false: no wallet references */
  containsWalletReferences: false;

  /** Always false: no execution instructions */
  containsExecutionInstructions: false;

  /** Always false: no credentials in payload */
  containsCredentials: false;
}

/** Forbidden safety values that trigger rejection */
export const FORBIDDEN_SAFETY_VALUES: Partial<WriteSafetyDeclarations> = {
  notExecutionAuthority: false,
  containsTradeOrders: true,
  containsWalletReferences: true,
  containsExecutionInstructions: true,
  containsCredentials: true,
} as const;

// ── Governance Assertions ───────────────────────────────────────

/** Governance boundary assertions for the write request */
export interface WriteGovernanceAssertions {
  /** Always true: human review is required */
  requiresHumanReview: true;

  /** Always false at write time: not yet governed state */
  isGovernedState: false;

  /** Must be "v7b-live-write" for server to accept */
  networkWriteStatus: "dry-run-local-only" | "v7b-live-write";
}

// ── Human Review Reference ──────────────────────────────────────

/** Links the write request back to a v7A.2 human review decision */
export interface HumanReviewReference {
  /** Must be accept_for_future_observation_write */
  decision: "accept_for_future_observation_write";

  /** Timestamp from the decision ledger entry */
  ledgerEntryTimestamp: string;

  /** Advisory identity of the reviewer */
  reviewerIdentity: string;

  /** Whether the decision has expired (> 7 days old) */
  expired: boolean;
}

// ── Audit Metadata ──────────────────────────────────────────────

/** Metadata for audit trail purposes */
export interface WriteAuditMetadata {
  /** When the write was requested (ISO-8601 UTC) */
  requestedAt: string;

  /** Dashboard version */
  clientVersion: string;

  /** Git commit of the snapshot generator */
  generatorCommit: string;

  /** Hash of the source AlphaSnapshot */
  sourceSnapshotHash: string;

  /** Git commit of the bridge code */
  bridgeCommit: string;
}

// ── Write Response ──────────────────────────────────────────────

/** Successful write response from server */
export interface ObservationWriteSuccess {
  status: "success";
  recordId: string;
  idempotencyKey: string;
  createdAt: string;
  alreadyExisted: boolean;
}

/** Error write response from server */
export interface ObservationWriteError {
  status: "error";
  errorCode: WriteErrorCode;
  errorMessage: string;
  idempotencyKey: string;
  retryable: boolean;
}

/** All possible write error codes */
export type WriteErrorCode =
  | "SAFETY_VIOLATION"
  | "GOVERNANCE_VIOLATION"
  | "SCOPE_VIOLATION"
  | "HUMAN_REVIEW_REQUIRED"
  | "REVIEW_EXPIRED"
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "CLOCK_SKEW"
  | "VALIDATION_FAILED"
  | "SERVER_ERROR"
  | "WRITE_DISABLED";

/** Union type for write response */
export type ObservationWriteResponse =
  | ObservationWriteSuccess
  | ObservationWriteError;

// ── Scope Validation ────────────────────────────────────────────

/** Result of validating a write request's scope */
export interface ScopeValidationResult {
  valid: boolean;
  errors: string[];
  wouldCreateGovernedState: boolean;
  wouldEscalateAuthority: boolean;
}

// ── Rate Limiting ───────────────────────────────────────────────

/** Client-side rate limit configuration */
export interface RateLimitConfig {
  maxWritesPerMinute: number;
  maxWritesPerHour: number;
  maxWritesPerDay: number;
  burstLimit: number;
}

/** Default rate limits for v7B */
export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  maxWritesPerMinute: 6,
  maxWritesPerHour: 60,
  maxWritesPerDay: 288,
  burstLimit: 3,
} as const;

// ── Retry Policy ────────────────────────────────────────────────

/** Retry configuration for failed writes */
export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: WriteErrorCode[];
}

/** Default retry policy for v7B */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    "RATE_LIMITED",
    "SERVER_ERROR",
    "CLOCK_SKEW",
  ],
} as const;

// ── Circuit Breaker ─────────────────────────────────────────────

/** Circuit breaker configuration */
export interface CircuitBreakerConfig {
  failureThresholdOpen: number;
  failureThresholdHalfOpen: number;
  openDurationMs: number;
  halfOpenDurationMs: number;
}

/** Default circuit breaker configuration */
export const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  failureThresholdOpen: 5,
  failureThresholdHalfOpen: 10,
  openDurationMs: 60000,
  halfOpenDurationMs: 300000,
} as const;

// ── Audit Log ───────────────────────────────────────────────────

/** Audit log entry for v7B operations */
export interface AuditLogEntry {
  eventType: AuditEventType;
  timestamp: string;
  idempotencyKey: string;
  clientVersion: string;
  sourceSnapshotGeneratedAt: string;
  humanDecisionReference: {
    ledgerEntryTimestamp: string;
    decision: string;
  };
  serverResponse?: {
    statusCode: number;
    recordId?: string;
    errorCode?: WriteErrorCode;
    errorMessage?: string;
  };
  latencyMs: number;
  credentialAgeDays: number;
}

/** All possible audit event types */
export type AuditEventType =
  | "write_request"
  | "write_success"
  | "write_duplicate"
  | "write_error"
  | "write_timeout"
  | "credential_rotation"
  | "scope_violation"
  | "circuit_breaker_open"
  | "circuit_breaker_close"
  | "kill_switch_activated";

// ── Environment Variable Names (Placeholders) ───────────────────

/** Names of environment variables used by v7B.
 *  These are NOT read in v7A.3. They exist for documentation only. */
export const ENV_VAR_NAMES = {
  apiKey: "OPENBRAIN_API_KEY",
  endpointUrl: "OPENBRAIN_ENDPOINT_URL",
  projectId: "OPENBRAIN_PROJECT_ID",
  writeDisabled: "OPENBRAIN_WRITE_DISABLED",
} as const;

// ── Idempotency ─────────────────────────────────────────────────

/** Client-side idempotency log entry */
export interface IdempotencyLogEntry {
  idempotencyKey: string;
  requestedAt: string;
  payloadHash: string;
  serverResponse: "success" | "duplicate" | "error" | "timeout";
  serverRecordId?: string;
}

// ── v7A.3 Explicit Statement ────────────────────────────────────

/**
 * v7A.3 EXPLICIT STATEMENT:
 *
 * This file contains ONLY TypeScript type definitions.
 * There is NO executable code in this file.
 * There are NO network calls.
 * There are NO credential reads.
 * There are NO imports from HTTP client libraries.
 * There are NO side effects.
 *
 * These types will be used by v7B implementation code when authorized.
 * Until then, they exist for documentation and parity checking only.
 */
