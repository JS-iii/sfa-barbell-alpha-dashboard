/**
 * Governance Rehearsal Runner v7A.7
 *
 * Executes the full governance path end-to-end:
 *   observation packet → simulator → replay → dossier → decision → candidate lock
 *
 * Proves the entire chain is coherent without creating governed state,
 * credentials, network writes, Open Brain writes, or execution capability.
 *
 * NO network calls. NO credentials. NO v7B activation.
 */

import { createV7BCandidateLock, canActivateV7BFromLock } from "./v7bCandidateLock";
import type { V7BCandidateLock } from "./v7bCandidateLock";
import { generateDossier, validateDossierDecision } from "./replayDossier";
import type { ReplayPromotionDossier } from "./replayDossier";
import { simulateWrite, createValidWriteRequest } from "./localWriteSimulator";
import { checkIdempotency, generateIdempotencyKey } from "./idempotency";
import { verifyAuditChain } from "./auditLog";

// ── Rehearsal Result ────────────────────────────────────────────

export interface GovernanceRehearsalResult {
  /** Overall status */
  status: "completed" | "blocked" | "failed";

  /** Which step blocked/failed (if not completed) */
  failedStep?: string;

  /** Step-by-step results */
  steps: {
    packetCreated: boolean;
    simulated: boolean;
    replayVerified: boolean;
    dossierGenerated: boolean;
    decisionValidated: boolean;
    candidateLocked: boolean;
    v7bActivationBlocked: boolean;
  };

  /** The final dossier (if generated) */
  dossier?: ReplayPromotionDossier;

  /** The final candidate lock (if created) */
  candidateLock?: V7BCandidateLock;

  /** Whether v7B can be activated (should always be false) */
  v7bActivatable: boolean;

  /** Safety summary */
  safety: {
    notExecutionAuthority: true;
    isGovernedState: false;
    networkWriteStatus: "dry-run-local-only";
    v7bAuthorized: false;
    credentialsPresent: false;
    networkCallsMade: false;
  };
}

// ── Step Inputs ─────────────────────────────────────────────────

export interface RehearsalInput {
  /** The packet payload to rehearse */
  packetPayload: Record<string, unknown>;

  /** Operator decision to apply */
  operatorDecision: string;

  /** Reviewer identity */
  reviewerIdentity: string;

  /** Optional notes */
  notes?: string;

  /** Simulate determinism failure */
  simulateDeterminismFailure?: boolean;

  /** Simulate audit chain failure */
  simulateAuditChainFailure?: boolean;

  /** Simulate boundary violation */
  simulateBoundaryViolation?: boolean;

  /** Simulate stale packet */
  simulateStalePacket?: boolean;
}

// ── Rehearsal Runner ────────────────────────────────────────────

/**
 * Run the full governance rehearsal end-to-end.
 *
 * Pipeline:
 *   input packet → write request → simulate → dossier → candidate lock
 *
 * This NEVER activates v7B. The candidate lock is review-only.
 */
export function runGovernanceRehearsal(
  input: RehearsalInput
): GovernanceRehearsalResult {
  const steps = {
    packetCreated: false,
    simulated: false,
    replayVerified: false,
    dossierGenerated: false,
    decisionValidated: false,
    candidateLocked: false,
    v7bActivationBlocked: true, // Always true in v7A.7
  };

  // ── Step 1: Create packet ────────────────────────────────────

  let writeRequest;
  try {
    writeRequest = createValidWriteRequest();
    // Override with user payload if provided
    if (input.packetPayload) {
      writeRequest.observationDraft = {
        ...writeRequest.observationDraft,
        ...((input.packetPayload as Record<string, unknown>) || {}),
      };
    }
    steps.packetCreated = true;
  } catch {
    return {
      status: "failed",
      failedStep: "packet_creation",
      steps,
      v7bActivatable: false,
      safety: makeSafetySummary(),
    };
  }

  // ── Step 2: Simulate write ───────────────────────────────────

  const simResult = simulateWrite(writeRequest);
  steps.simulated = true;

  // ── Step 3: Boundary check ───────────────────────────────────

  if (
    input.simulateBoundaryViolation ||
    simResult.wouldCreateGovernedState ||
    simResult.wouldAuthorizeExecution
  ) {
    return {
      status: "blocked",
      failedStep: "boundary_check",
      steps,
      v7bActivatable: false,
      safety: makeSafetySummary(),
    };
  }

  // ── Step 4: Replay verification ──────────────────────────────

  const determinismVerified = !input.simulateDeterminismFailure;
  const auditChainResult = verifyAuditChain();
  const auditChainVerified =
    !input.simulateAuditChainFailure && auditChainResult.valid;

  steps.replayVerified = determinismVerified && auditChainVerified;

  if (!steps.replayVerified) {
    return {
      status: "blocked",
      failedStep: input.simulateDeterminismFailure
        ? "determinism_check"
        : "audit_chain_check",
      steps,
      v7bActivatable: false,
      safety: makeSafetySummary(),
    };
  }

  // ── Step 5: Generate dossier ─────────────────────────────────

  const dossier = generateDossier({
    packetPayload: input.packetPayload,
    replayResult: {
      status: simResult.status,
      errorCode: simResult.errorCode,
      errorMessage: simResult.errorMessage,
      idempotencyKey: simResult.idempotencyKey,
      wouldCreateGovernedState: simResult.wouldCreateGovernedState,
      wouldAuthorizeExecution: simResult.wouldAuthorizeExecution,
    },
    determinismVerified,
    auditChainVerified,
    auditEntryCount: auditChainResult.entriesChecked,
  });
  steps.dossierGenerated = true;

  // ── Step 6: Validate operator decision ───────────────────────

  const decisionValidation = validateDossierDecision(
    dossier,
    input.operatorDecision
  );
  steps.decisionValidated = decisionValidation.valid;

  if (!decisionValidation.valid) {
    return {
      status: "blocked",
      failedStep: "decision_validation",
      steps,
      dossier,
      v7bActivatable: false,
      safety: makeSafetySummary(),
    };
  }

  // ── Step 7: Create candidate lock ────────────────────────────

  const candidateLock = createV7BCandidateLock(
    dossier.packetHash,
    dossier.state,
    dossier.generatedAt,
    input.operatorDecision as
      | "promote_to_v7b_candidate"
      | "reject"
      | "needs_revision"
      | "defer",
    input.reviewerIdentity,
    input.notes
  );
  steps.candidateLocked = true;

  // ── Step 8: v7B activation block check ───────────────────────

  const v7bActivatable = canActivateV7BFromLock(candidateLock);

  return {
    status: v7bActivatable ? "failed" : "completed",
    steps,
    dossier,
    candidateLock,
    v7bActivatable,
    safety: makeSafetySummary(),
  };
}

// ── Helper ──────────────────────────────────────────────────────

function makeSafetySummary() {
  return {
    notExecutionAuthority: true as const,
    isGovernedState: false as const,
    networkWriteStatus: "dry-run-local-only" as const,
    v7bAuthorized: false,
    credentialsPresent: false,
    networkCallsMade: false,
  };
}
