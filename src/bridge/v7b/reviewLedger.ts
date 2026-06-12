/**
 * reviewLedger.ts — v7B.1.3 Human Review Ledger
 *
 * Tracks proposal review status.
 * All state changes require explicit human action.
 */

import {
  type ReviewRecord,
  type ReviewStatus,
  type MemoryProposal,
} from "./proposalSchema";

export function createReviewRecord(): ReviewRecord {
  return {
    status: "proposed",
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    revisionNotes: null,
  };
}

export function approveForManualWrite(
  record: ReviewRecord,
  reviewer: string,
): ReviewRecord {
  return {
    ...record,
    status: "approved_for_manual_write",
    reviewedBy: reviewer,
    reviewedAt: new Date().toISOString(),
    rejectionReason: null,
  };
}

export function reject(
  record: ReviewRecord,
  reviewer: string,
  reason: string,
): ReviewRecord {
  return {
    ...record,
    status: "rejected",
    reviewedBy: reviewer,
    reviewedAt: new Date().toISOString(),
    rejectionReason: reason,
  };
}

export function requestRevision(
  record: ReviewRecord,
  reviewer: string,
  notes: string,
): ReviewRecord {
  return {
    ...record,
    status: "needs_revision",
    reviewedBy: reviewer,
    reviewedAt: new Date().toISOString(),
    revisionNotes: notes,
  };
}

export function isReadyForPromotion(proposal: MemoryProposal): boolean {
  return (
    proposal.validation?.passed === true &&
    proposal.safety?.safe === true &&
    proposal.review?.status === "approved_for_manual_write"
  );
}

export function getStatusDescription(status: ReviewStatus): string {
  const descriptions: Record<ReviewStatus, string> = {
    proposed: "Awaiting human review",
    approved_for_manual_write: "Approved — ready for manual promotion packet",
    rejected: "Rejected — will not be promoted",
    needs_revision: "Requires changes before re-review",
  };
  return descriptions[status];
}
