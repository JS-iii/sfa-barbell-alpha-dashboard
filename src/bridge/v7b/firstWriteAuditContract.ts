/**
 * First Write Audit Event Contract v7B.0.1
 *
 * Defines the shape of audit events for canary write attempts.
 * These events are created locally — no network write occurs.
 */

export interface FirstWriteAuditEvent {
  /** Event version */
  schemaVersion: "open-brain-first-write-audit-v7b01";

  /** When the event was recorded */
  timestamp: string;

  /** Type of audit event */
  eventType: "canary_blocked" | "canary_planned" | "canary_validated" | "authorization_missing";

  /** Status */
  status: "blocked" | "planned" | "validated";

  /** Which guard blocked it (if blocked) */
  blockedBy?:
    | "kill_switch"
    | "authorization_gate"
    | "credential_check"
    | "governed_state_guard"
    | "network_write_guard"
    | "adapter_disabled"
    | "v7b01_scaffold";

  /** Human-readable description */
  description: string;

  /** Phase */
  phase: "v7b01-canary-plan";

  /** v7B authorization status at event time */
  v7bAuthorized: false;

  /** Safety declarations */
  safety: {
    notExecutionAuthority: true;
    isGovernedState: false;
    networkWriteStatus: "dry-run-local-only";
  };
}

/**
 * Create a blocked audit event for a canary write attempt.
 */
export function createBlockedCanaryAuditEvent(
  blockedBy: FirstWriteAuditEvent["blockedBy"],
  description: string
): FirstWriteAuditEvent {
  return {
    schemaVersion: "open-brain-first-write-audit-v7b01",
    timestamp: new Date().toISOString(),
    eventType: "canary_blocked",
    status: "blocked",
    blockedBy,
    description,
    phase: "v7b01-canary-plan",
    v7bAuthorized: false,
    safety: {
      notExecutionAuthority: true,
      isGovernedState: false,
      networkWriteStatus: "dry-run-local-only",
    },
  };
}

/**
 * Create a "planned" audit event (for validated but not executed canaries).
 */
export function createPlannedCanaryAuditEvent(
  description: string
): FirstWriteAuditEvent {
  return {
    schemaVersion: "open-brain-first-write-audit-v7b01",
    timestamp: new Date().toISOString(),
    eventType: "canary_planned",
    status: "planned",
    description,
    phase: "v7b01-canary-plan",
    v7bAuthorized: false,
    safety: {
      notExecutionAuthority: true,
      isGovernedState: false,
      networkWriteStatus: "dry-run-local-only",
    },
  };
}
