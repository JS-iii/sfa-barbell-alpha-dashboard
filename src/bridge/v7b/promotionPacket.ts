/**
 * promotionPacket.ts — v7B.1.3 Promotion Packet Generator
 *
 * Creates a manual-write-ready packet from an approved proposal.
 * Does NOT execute any database write.
 * The operator must manually review and execute the packet.
 */

import {
  type MemoryProposal,
  type PromotionPacket,
  type ReviewRecord,
  type SafetyClassification,
  EMBEDDING_DIM,
} from "./proposalSchema";
import { isReadyForPromotion } from "./reviewLedger";

export function generatePromotionPacket(proposal: MemoryProposal): PromotionPacket {
  const ready = isReadyForPromotion(proposal);

  let sqlStatement: string | null = null;
  let restPayload: Record<string, unknown> | null = null;

  if (ready) {
    // SQL statement for manual execution in Supabase SQL Editor
    const zeroVector = `array_fill(0, ARRAY[${EMBEDDING_DIM}])::vector`;
    const metadataJson = JSON.stringify(proposal.metadata).replace(/'/g, "''");

    sqlStatement = `
-- v7B.1.3 PROMOTION PACKET
-- Proposal: ${proposal.proposalId}
-- Status: approved_for_manual_write
-- GENERATED: ${new Date().toISOString()}
-- DO NOT MODIFY WITHOUT OPERATOR REVIEW

INSERT INTO public.memories (
    id,
    content,
    metadata,
    embedding
) VALUES (
    '${proposal.proposalId}',
    '${proposal.content.replace(/'/g, "''")}',
    '${metadataJson}'::jsonb,
    ${zeroVector}
)
RETURNING id, content, metadata, created_at;
`.trim();

    // REST payload for PostgREST
    restPayload = {
      id: proposal.proposalId,
      content: proposal.content,
      metadata: proposal.metadata,
      embedding: Array(EMBEDDING_DIM).fill(0),
    };
  }

  return {
    packetId: `pkt-${proposal.proposalId}`,
    generatedAt: new Date().toISOString(),
    proposalId: proposal.proposalId,
    readyForExecution: ready,
    reasonIfNotReady: ready
      ? null
      : buildNotReadyReason(proposal),
    sqlStatement,
    restPayload,
    governanceAttestation: buildGovernanceAttestation(proposal),
    reviewRecord: proposal.review,
    safetyReport: proposal.safety,
    operatorInstructions: buildOperatorInstructions(ready),
  };
}

function buildNotReadyReason(proposal: MemoryProposal): string {
  const reasons: string[] = [];
  if (!proposal.validation?.passed) reasons.push("Validation failed");
  if (!proposal.safety?.safe) reasons.push(`Safety flags: ${proposal.safety?.flags?.join(", ")}`);
  if (proposal.review?.status !== "approved_for_manual_write") {
    reasons.push(`Review status: ${proposal.review?.status}`);
  }
  return reasons.join("; ");
}

function buildGovernanceAttestation(proposal: MemoryProposal): string {
  const g = proposal.metadata?.governance;
  return [
    "GOVERNANCE ATTESTATION",
    `  isGovernedState: ${g?.isGovernedState} (required: false)`,
    `  containsTradeOrders: ${g?.containsTradeOrders} (required: false)`,
    `  notExecutionAuthority: ${g?.notExecutionAuthority} (required: true)`,
    `  containsCredentials: ${g?.containsCredentials} (required: false)`,
    `  containsWalletReferences: ${g?.containsWalletReferences} (required: false)`,
    `  isStrategyInstruction: ${g?.isStrategyInstruction} (required: false)`,
    `  Safety: ${proposal.safety?.safe ? "CLEAR" : "FLAGS: " + proposal.safety?.flags?.join(", ")}`,
    `  Review: ${proposal.review?.status}`,
  ].join("\n");
}

function buildOperatorInstructions(ready: boolean): string {
  if (!ready) {
    return "Packet NOT ready for execution. Review the reasonIfNotReady field and the governance attestation.";
  }
  return [
    "OPERATOR INSTRUCTIONS:",
    "1. Review the SQL statement below carefully.",
    "2. Verify the governance attestation matches your intent.",
    "3. Copy the SQL to your Supabase SQL Editor.",
    "4. Execute manually.",
    "5. Verify with: SELECT * FROM public.memories WHERE id = [proposalId];",
    "6. This is a MANUAL write — no automation executes this packet.",
  ].join("\n");
}
