/**
 * safetyClassifier.ts — v7B.1.3 Safety Classifier
 *
 * Scans proposal content and metadata for safety violations.
 * Enhanced from v7B.1.2 governance classifier.
 */

import {
  type SafetyClassification,
  type SafetyFlag,
  type MemoryProposal,
} from "./proposalSchema";

// ── Credential patterns ────────────────────────────────────────
const CREDENTIAL_PATTERNS = [
  /\bsb[p_][a-zA-Z0-9_-]{20,}/,       // Supabase secret
  /\bsk-[a-zA-Z0-9]{20,}/,            // Secret key
  /\bpk-[a-zA-Z0-9]{20,}/,            // Public key
  /\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*/, // JWT
  /\b0x[a-f0-9]{40,}\b/i,             // Ethereum address / private key
  /\bprivate[_\s]?key\b/i,            // Private key mention
  /\bapi[_\s]?key\s*[=:]\s*["']?[a-zA-Z0-9]{10,}/i,
  /\bpassword\s*[=:]\s*["']?[^\s"']{4,}/i,
];

// ── Trade order patterns ───────────────────────────────────────
const TRADE_PATTERNS = [
  /\b(buy|sell)\s+(\d+\.?\d*)\s*(shares|contracts|units)\b/i,
  /\b(go\s+long|go\s+short)\b/i,
  /\b(market\s+order|limit\s+order|stop\s+loss)\b/i,
  /\b(open|close)\s+position\b/i,
  /\bleverage\s*[:=]\s*\d+x?\b/i,
  /\btake\s+profit\s+at\s+\d+\.?\d*\b/i,
];

// ── Strategy override patterns ─────────────────────────────────
const STRATEGY_PATTERNS = [
  /\boverride\s+(risk|policy|threshold|gate)\b/i,
  /\bchange\s+(risk\s+limit|stop\s+loss|position\s+size)\b/i,
  /\bignore\s+(risk|stop|threshold)\b/i,
  /\bset\s+risk\s*[:=]\s*\d+\.?\d*\b/i,
  /\bnew\s+strategy\s*:?\s*\n/i,
];

// ── Main classifier ────────────────────────────────────────────
export function classifySafety(proposal: MemoryProposal): SafetyClassification {
  const flags: SafetyFlag[] = [];
  const text = `${proposal.content} ${JSON.stringify(proposal.metadata)}`;
  const gov = proposal.metadata?.governance;

  // Metadata-based flags
  if (gov?.isGovernedState === true) flags.push("GOVERNED_STATE");
  if (gov?.containsTradeOrders === true) flags.push("TRADE_ORDERS");
  if (gov?.notExecutionAuthority === false) flags.push("CLAIMS_EXECUTION_AUTHORITY");

  // Content scan flags
  if (CREDENTIAL_PATTERNS.some(p => p.test(text))) flags.push("CREDENTIAL_LEAK");
  if (TRADE_PATTERNS.some(p => p.test(text))) flags.push("TRADE_ORDERS");
  if (STRATEGY_PATTERNS.some(p => p.test(text))) flags.push("STRATEGY_OVERRIDE");
  if (/\b0x[a-f0-9]{40}\b/i.test(text)) flags.push("WALLET_REFERENCE");

  // Structural flags
  if (!proposal.metadata?.source) flags.push("MISSING_SOURCE");
  if (!gov) flags.push("MISSING_GOVERNANCE_DECLARATION");
  if (typeof proposal.metadata?.confidence === "number" && proposal.metadata.confidence < 0.3) {
    flags.push("LOW_CONFIDENCE");
  }

  return {
    safe: flags.length === 0,
    flags: [...new Set(flags)], // deduplicate
    advisoryOnly: true,
    executionAuthority: flags.includes("CLAIMS_EXECUTION_AUTHORITY") ||
      flags.includes("TRADE_ORDERS") ||
      flags.includes("STRATEGY_OVERRIDE"),
  };
}
