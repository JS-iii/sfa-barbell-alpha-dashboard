/**
 * Decision Validator v7A.2
 *
 * Enforces the decision boundary: only allowed decisions can be recorded.
 * Forbidden decisions are rejected and will NOT create a ledger entry.
 *
 * This is a fail-closed validator: any violation blocks the decision.
 */

import type {
  HumanDecision,
  ForbiddenDecision,
  ReviewPacket,
  ReviewPacketValidationResult,
  DecisionLedgerEntry,
} from "./types";

/** Decisions a human reviewer is allowed to make */
const ALLOWED_DECISIONS: Set<HumanDecision> = new Set([
  "accept_for_future_observation_write",
  "reject",
  "needs_revision",
  "defer",
]);

/** Decisions that are FORBIDDEN and will be rejected */
const FORBIDDEN_DECISIONS: Set<ForbiddenDecision> = new Set([
  "approved_for_execution",
  "trade_ready",
  "governed_state",
  "live_write_ready",
]);

/**
 * Validate a human decision before recording it.
 *
 * Returns a result indicating whether the decision is allowed.
 * Forbidden decisions are rejected with errors.
 */
export function validateDecision(
  decision: string,
  packet: ReviewPacket
): ReviewPacketValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check if decision is in allowed set
  const isAllowed = ALLOWED_DECISIONS.has(decision as HumanDecision);
  const isForbidden = FORBIDDEN_DECISIONS.has(decision as ForbiddenDecision);

  if (isForbidden) {
    errors.push(`FORBIDDEN: Decision "${decision}" is not permitted. This decision would escalate authority beyond observation review.`);
  } else if (!isAllowed) {
    errors.push(`INVALID: Decision "${decision}" is not recognized. Allowed decisions: ${Array.from(ALLOWED_DECISIONS).join(", ")}`);
  }

  // 2. Check packet safety
  if (packet.safety.notExecutionAuthority !== true) {
    errors.push("CRITICAL: Packet does not declare notExecutionAuthority — decision blocked");
  }
  if (packet.safety.isGovernedState !== false) {
    errors.push("CRITICAL: Packet claims governed state — decision blocked");
  }
  if (packet.safety.networkWriteStatus !== "dry-run-local-only") {
    errors.push(`CRITICAL: Packet networkWriteStatus is "${packet.safety.networkWriteStatus}" — decision blocked`);
  }
  if (packet.safety.humanReviewRequired !== true) {
    errors.push("CRITICAL: Packet does not require human review — decision blocked");
  }

  // 3. Check if packet already has a decision recorded
  if (packet.decision.recordedInLedger) {
    warnings.push("This packet already has a recorded decision. A new decision would overwrite.");
  }

  // 4. Content scan on reviewer notes (if present)
  if (packet.decision.reviewerNotes) {
    const notes = packet.decision.reviewerNotes.toLowerCase();
    const forbiddenNotePatterns = [
      "execute trade",
      "place order",
      "send transaction",
      "private key",
      "approve execution",
      "go live",
      "enable trading",
    ];
    for (const pattern of forbiddenNotePatterns) {
      if (notes.includes(pattern)) {
        errors.push(`FORBIDDEN: Reviewer notes contain prohibited phrase "${pattern}"`);
      }
    }
  }

  const hasCriticalErrors = errors.length > 0;

  return {
    valid: !hasCriticalErrors && isAllowed,
    errors,
    warnings,
    decisionAllowed: isAllowed && !isForbidden,
    wouldCreateGovernedState:
      decision === "governed_state" ||
      packet.safety.isGovernedState === true,
    wouldAuthorizeExecution:
      decision === "approved_for_execution" ||
      decision === "trade_ready" ||
      packet.safety.notExecutionAuthority !== true,
    wouldEnableLiveWrite:
      decision === "live_write_ready" ||
      packet.safety.networkWriteStatus !== "dry-run-local-only",
  };
}

/**
 * Check if a decision string is allowed.
 */
export function isAllowedDecision(decision: string): boolean {
  return ALLOWED_DECISIONS.has(decision as HumanDecision);
}

/**
 * Check if a decision string is forbidden.
 */
export function isForbiddenDecision(decision: string): boolean {
  return FORBIDDEN_DECISIONS.has(decision as ForbiddenDecision);
}

/**
 * Get the list of allowed decisions.
 */
export function getAllowedDecisions(): HumanDecision[] {
  return Array.from(ALLOWED_DECISIONS);
}

/**
 * Get the list of forbidden decisions.
 */
export function getForbiddenDecisions(): ForbiddenDecision[] {
  return Array.from(FORBIDDEN_DECISIONS);
}

/**
 * Determine if a decision makes the packet eligible for v7B write.
 *
 * Only "accept_for_future_observation_write" enables v7B eligibility.
 * All other allowed decisions result in ineligibility.
 */
export function isEligibleForV7BWrite(decision: HumanDecision): boolean {
  return decision === "accept_for_future_observation_write";
}

/**
 * Create a decision ledger entry from a validated decision.
 *
 * This is a pure function — it creates the entry object but does NOT write it.
 * The caller is responsible for writing to the local ledger.
 */
export function createDecisionLedgerEntry(
  packet: ReviewPacket,
  humanDecision: HumanDecision,
  reviewerNotes?: string
): DecisionLedgerEntry {
  return {
    timestamp: new Date().toISOString(),
    packetSchemaVersion: packet.schemaVersion,
    packetGeneratedAt: packet.generatedAt,
    draftSchemaVersion: packet.sourceDraft.schemaVersion,
    sourceSnapshotGeneratedAt: packet.sourceDraft.snapshotGeneratedAt,
    humanDecision,
    reviewerNotes,
    eligibleForV7BWrite: isEligibleForV7BWrite(humanDecision),
    safety: {
      notExecutionAuthority: true,
      isGovernedState: false,
      networkWriteStatus: "dry-run-local-only",
      humanReviewRequired: true,
    },
    audit: {
      ledgerVersion: "v7a2",
      entryType: "human-decision",
    },
  };
}
