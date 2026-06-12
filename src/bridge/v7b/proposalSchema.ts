/**
 * proposalSchema.ts — v7B.1.3 Memory Proposal Schema
 *
 * Defines the structure for memory write proposals.
 * All proposals remain local artifacts until human review.
 * No database writes are performed by this module.
 */

export interface MemoryProposal {
  proposalId: string;
  version: string;
  createdAt: string;

  content: string;
  metadata: ProposalMetadata;

  validation: ValidationResult;
  safety: SafetyClassification;
  review: ReviewRecord;
}

export interface ProposalMetadata {
  source: string;
  version: string;
  confidence: number; // 0.0 to 1.0
  proposedBy: string;
  proposedAt: string;

  governance: GovernanceFlags;

  tags?: string[];
  context?: Record<string, unknown>;
}

export interface GovernanceFlags {
  isGovernedState: boolean; // must be false
  containsTradeOrders: boolean; // must be false
  notExecutionAuthority: boolean; // must be true
  containsCredentials: boolean; // must be false
  containsWalletReferences: boolean; // must be false
  isStrategyInstruction: boolean; // must be false
}

export interface ValidationResult {
  passed: boolean;
  checkedAt: string;
  checks: CheckResult[];
}

export interface CheckResult {
  name: string;
  passed: boolean;
  reason?: string;
}

export interface SafetyClassification {
  safe: boolean;
  flags: SafetyFlag[];
  advisoryOnly: boolean;
  executionAuthority: boolean;
}

export type SafetyFlag =
  | "GOVERNED_STATE"
  | "TRADE_ORDERS"
  | "CLAIMS_EXECUTION_AUTHORITY"
  | "CREDENTIAL_LEAK"
  | "WALLET_REFERENCE"
  | "STRATEGY_OVERRIDE"
  | "RISK_GATE_OVERRIDE"
  | "MISSING_SOURCE"
  | "MISSING_GOVERNANCE_DECLARATION"
  | "LOW_CONFIDENCE"
  | "OVERSIZED_CONTENT"
  | "MALFORMED_METADATA";

export type ReviewStatus =
  | "proposed"
  | "approved_for_manual_write"
  | "rejected"
  | "needs_revision";

export interface ReviewRecord {
  status: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  revisionNotes: string | null;
}

export interface PromotionPacket {
  packetId: string;
  generatedAt: string;
  proposalId: string;

  readyForExecution: boolean;
  reasonIfNotReady: string | null;

  sqlStatement: string | null;
  restPayload: Record<string, unknown> | null;

  governanceAttestation: string;
  reviewRecord: ReviewRecord;
  safetyReport: SafetyClassification;

  operatorInstructions: string;
}

// ── Schema defaults ────────────────────────────────────────────

export const DEFAULT_GOVERNANCE: GovernanceFlags = {
  isGovernedState: false,
  containsTradeOrders: false,
  notExecutionAuthority: true,
  containsCredentials: false,
  containsWalletReferences: false,
  isStrategyInstruction: false,
};

export const INITIAL_REVIEW: ReviewRecord = {
  status: "proposed",
  reviewedBy: null,
  reviewedAt: null,
  rejectionReason: null,
  revisionNotes: null,
};

// ── Constants ──────────────────────────────────────────────────

export const PROPOSAL_VERSION = "v7b1.3";
export const MAX_CONTENT_LENGTH = 10000; // characters
export const MIN_CONFIDENCE = 0.1;
export const EMBEDDING_DIM = 768;
