/**
 * proposalValidator.ts — v7B.1.3 Proposal Validator
 *
 * Fail-closed validation for memory proposals.
 * Any missing or invalid field blocks the proposal.
 */

import {
  type MemoryProposal,
  type ValidationResult,
  type CheckResult,
  type GovernanceFlags,
  MAX_CONTENT_LENGTH,
  MIN_CONFIDENCE,
  DEFAULT_GOVERNANCE,
} from "./proposalSchema";

export function validateProposal(proposal: MemoryProposal): ValidationResult {
  const checks: CheckResult[] = [];

  // 1. Content present and not empty
  checks.push(check(
    "content_present",
    typeof proposal.content === "string" && proposal.content.trim().length > 0,
    "Content must be a non-empty string"
  ));

  // 2. Content not oversized
  checks.push(check(
    "content_length",
    typeof proposal.content === "string" && proposal.content.length <= MAX_CONTENT_LENGTH,
    `Content exceeds ${MAX_CONTENT_LENGTH} character limit`
  ));

  // 3. Source present
  checks.push(check(
    "source_present",
    typeof proposal.metadata?.source === "string" && proposal.metadata.source.trim().length > 0,
    "Metadata.source is required"
  ));

  // 4. Confidence in valid range
  checks.push(check(
    "confidence_range",
    typeof proposal.metadata?.confidence === "number" &&
      proposal.metadata.confidence >= MIN_CONFIDENCE &&
      proposal.metadata.confidence <= 1.0,
    `Confidence must be between ${MIN_CONFIDENCE} and 1.0`
  ));

  // 5. Governance flags present
  checks.push(check(
    "governance_present",
    proposal.metadata?.governance !== undefined &&
      proposal.metadata.governance !== null,
    "Metadata.governance is required"
  ));

  // 6. isGovernedState === false
  checks.push(check(
    "not_governed_state",
    proposal.metadata?.governance?.isGovernedState === false,
    "isGovernedState must be false"
  ));

  // 7. containsTradeOrders === false
  checks.push(check(
    "no_trade_orders",
    proposal.metadata?.governance?.containsTradeOrders === false,
    "containsTradeOrders must be false"
  ));

  // 8. notExecutionAuthority === true
  checks.push(check(
    "not_execution_authority",
    proposal.metadata?.governance?.notExecutionAuthority === true,
    "notExecutionAuthority must be true"
  ));

  // 9. containsCredentials === false
  checks.push(check(
    "no_credentials",
    proposal.metadata?.governance?.containsCredentials === false,
    "containsCredentials must be false"
  ));

  // 10. containsWalletReferences === false
  checks.push(check(
    "no_wallet_refs",
    proposal.metadata?.governance?.containsWalletReferences === false,
    "containsWalletReferences must be false"
  ));

  // 11. isStrategyInstruction === false
  checks.push(check(
    "no_strategy_instruction",
    proposal.metadata?.governance?.isStrategyInstruction === false,
    "isStrategyInstruction must be false"
  ));

  // 12. Proposal ID present
  checks.push(check(
    "proposal_id_present",
    typeof proposal.proposalId === "string" && proposal.proposalId.length > 0,
    "proposalId is required"
  ));

  // 13. Version matches
  checks.push(check(
    "version_valid",
    typeof proposal.version === "string" && proposal.version.startsWith("v7b"),
    "Version must be v7b-prefixed"
  ));

  const allPassed = checks.every(c => c.passed);

  return {
    passed: allPassed,
    checkedAt: new Date().toISOString(),
    checks,
  };
}

function check(name: string, condition: boolean, reason: string): CheckResult {
  return { name, passed: condition, reason: condition ? undefined : reason };
}

export function createDefaultGovernance(): GovernanceFlags {
  return { ...DEFAULT_GOVERNANCE };
}
