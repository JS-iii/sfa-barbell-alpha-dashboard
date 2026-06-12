/**
 * memoryRetrievalHarness.ts — v7B.2 Read-Only Memory Retrieval
 *
 * Retrieves Open Brain memories as advisory context only.
 * Every retrieved memory is classified before being returned.
 * No retrieval path leads to writes, trades, or execution.
 */

import type { MemoryProposal } from "./proposalSchema";

// ── Retrieval Safety Classification ───────────────────────────────────────────

export type MemorySafetyLevel =
  | "advisory_safe"      // Safe for advisory context
  | "governance_sensitive" // Contains governance references — quarantine
  | "trading_sensitive"  // Contains trade patterns — block from execution
  | "stale"              // Too old or low confidence — degrade
  | "low_confidence"     // Confidence below threshold — exclude or flag
  | "prohibited"         // Claims execution authority or contains credentials
  | "corrupted";         // Missing required fields or invalid structure

export interface RetrievedMemory {
  /** The memory row ID */
  id: string;

  /** Memory content */
  content: string;

  /** Original metadata */
  metadata: Record<string, unknown>;

  /** Memory source */
  source: string;

  /** Creation timestamp */
  createdAt: string;

  /** Safety classification */
  safety: {
    level: MemorySafetyLevel;
    flags: string[];
    advisoryOnly: boolean;
  };

  /** Provenance chain */
  provenance: MemoryProvenance;

  /** Confidence score (0-1) */
  confidence: number;

  /** Whether this memory is usable as advisory context */
  usableAsContext: boolean;

  /** Whether this memory is blocked from execution paths */
  blockedFromExecution: boolean;
}

export interface MemoryProvenance {
  /** When this memory was originally written */
  originalTimestamp: string;

  /** Source system that wrote the memory */
  originalSource: string;

  /** When this memory was retrieved */
  retrievedAt: string;

  /** Retrieval method used */
  retrievalMethod: string;

  /** Version of the retrieval harness */
  harnessVersion: string;
}

// ── Retrieval Options ────────────────────────────────────────────────────────

export interface RetrievalOptions {
  /** Maximum number of memories to retrieve */
  limit?: number;

  /** Minimum confidence threshold (memories below are excluded) */
  minConfidence?: number;

  /** Maximum age in hours (memories older are marked stale) */
  maxAgeHours?: number;

  /** Filter by source */
  sourceFilter?: string;

  /** Filter by tag */
  tagFilter?: string;

  /** Whether to include governance-sensitive memories */
  includeGovernanceSensitive?: boolean;

  /** Whether to include trading-sensitive memories */
  includeTradingSensitive?: boolean;
}

export const DEFAULT_RETRIEVAL_OPTIONS: RetrievalOptions = {
  limit: 10,
  minConfidence: 0.1,
  maxAgeHours: 720, // 30 days
  includeGovernanceSensitive: false,
  includeTradingSensitive: false,
};

// ── Classification Engine ────────────────────────────────────────────────────

/**
 * Classify a retrieved memory by safety level.
 * This is a pure function — no side effects, no mutations.
 */
export function classifyRetrievedMemory(
  row: RawMemoryRow,
  retrievalTimestamp: string,
): RetrievedMemory {
  const flags: string[] = [];
  const meta = row.metadata || {};

  // Check 1: Missing required fields
  if (!row.id || !row.content || row.content.trim().length === 0) {
    return buildRetrievedMemory(row, "corrupted", ["missing_required_fields"], retrievalTimestamp, 0);
  }

  // Check 2: Contains credentials
  if (meta.containsCredentials === true || containsCredentialPatterns(row.content)) {
    flags.push("contains_credentials");
    return buildRetrievedMemory(row, "prohibited", flags, retrievalTimestamp, getConfidence(meta));
  }

  // Check 3: Claims execution authority
  if (meta.notExecutionAuthority === false || claimsExecutionAuthority(row.content)) {
    flags.push("claims_execution_authority");
    return buildRetrievedMemory(row, "prohibited", flags, retrievalTimestamp, getConfidence(meta));
  }

  // Check 4: Contains trade orders
  if (meta.containsTradeOrders === true || containsTradePatterns(row.content)) {
    flags.push("contains_trade_orders");
    return buildRetrievedMemory(row, "trading_sensitive", flags, retrievalTimestamp, getConfidence(meta));
  }

  // Check 5: Contains governed state
  if (meta.isGovernedState === true) {
    flags.push("contains_governed_state");
    return buildRetrievedMemory(row, "governance_sensitive", flags, retrievalTimestamp, getConfidence(meta));
  }

  // Check 6: Strategy override
  if (meta.isStrategyInstruction === true || containsStrategyOverride(row.content)) {
    flags.push("strategy_override");
    return buildRetrievedMemory(row, "governance_sensitive", flags, retrievalTimestamp, getConfidence(meta));
  }

  // Check 7: Wallet references
  if (meta.containsWalletReferences === true || containsWalletReferences(row.content)) {
    flags.push("wallet_references");
    return buildRetrievedMemory(row, "governance_sensitive", flags, retrievalTimestamp, getConfidence(meta));
  }

  // Check 8: Stale memory
  const ageHours = getAgeHours(row.created_at);
  if (ageHours > 720) { // 30 days
    flags.push("stale_memory");
    return buildRetrievedMemory(row, "stale", flags, retrievalTimestamp, getConfidence(meta));
  }

  // Check 9: Low confidence
  const confidence = getConfidence(meta);
  if (confidence < 0.1) {
    flags.push("low_confidence");
    return buildRetrievedMemory(row, "low_confidence", flags, retrievalTimestamp, confidence);
  }

  // All checks passed — advisory safe
  return buildRetrievedMemory(row, "advisory_safe", flags, retrievalTimestamp, confidence);
}

// ── Helper Functions ─────────────────────────────────────────────────────────

interface RawMemoryRow {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  source: string;
  created_at: string;
}

function buildRetrievedMemory(
  row: RawMemoryRow,
  level: MemorySafetyLevel,
  flags: string[],
  retrievalTimestamp: string,
  confidence: number,
): RetrievedMemory {
  const isProhibited = level === "prohibited" || level === "corrupted";
  const isExecutionBlocked =
    isProhibited ||
    level === "trading_sensitive" ||
    level === "governance_sensitive";
  const isUsable =
    level === "advisory_safe" ||
    level === "stale" ||
    level === "low_confidence";

  return {
    id: row.id,
    content: row.content,
    metadata: row.metadata,
    source: row.source || "unknown",
    createdAt: row.created_at,
    safety: {
      level,
      flags,
      advisoryOnly: level === "advisory_safe",
    },
    provenance: {
      originalTimestamp: row.created_at,
      originalSource: row.source || "unknown",
      retrievedAt: retrievalTimestamp,
      retrievalMethod: "v7B.2-readonly-harness",
      harnessVersion: "v7B.2.0",
    },
    confidence,
    usableAsContext: isUsable && !isProhibited,
    blockedFromExecution: isExecutionBlocked || isProhibited,
  };
}

function getConfidence(meta: Record<string, unknown>): number {
  if (typeof meta.confidence === "number") return meta.confidence;
  return 0;
}

function getAgeHours(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return (now - created) / (1000 * 60 * 60);
}

// ── Pattern Detection ────────────────────────────────────────────────────────

function containsCredentialPatterns(text: string): boolean {
  return /(sbp_[a-f0-9]{48,}|sk-[a-zA-Z0-9]{24,}|pk-[a-zA-Z0-9]{24,}|eyJ[a-zA-Z0-9]*\.eyJ)/i.test(text);
}

function containsTradePatterns(text: string): boolean {
  const tradeTerms = /\b(buy|sell|long|short|position|order)\b.*\b(BTC|ETH|SOL|DOGE|AVAX|LINK|UNI|AAVE|CRV|LDO|ARB|OP)\b/i;
  const reverseTerms = /\b(BTC|ETH|SOL|DOGE|AVAX|LINK|UNI|AAVE|CRV|LDO|ARB|OP)\b.*\b(buy|sell|long|short|position|order)\b/i;
  return tradeTerms.test(text) || reverseTerms.test(text);
}

function claimsExecutionAuthority(text: string): boolean {
  return /\b(execute|execution|auto-trade|auto-execute)\b.*\b(order|trade|position|transaction)\b/i.test(text) &&
    !/advisory/.test(text) && !/never execution authority/.test(text);
}

function containsStrategyOverride(text: string): boolean {
  return /\b(override|bypass|disable)\b.*\b(strategy|risk|stop|limit|guardrail)\b/i.test(text) ||
    /\b(strategy|risk|stop|limit|guardrail)\b.*\b(override|bypass|disable)\b/i.test(text);
}

function containsWalletReferences(text: string): boolean {
  return /0x[a-fA-F0-9]{40}/.test(text);
}

// ── Batch Classification ─────────────────────────────────────────────────────

export function classifyMemoryBatch(
  rows: RawMemoryRow[],
  retrievalTimestamp: string = new Date().toISOString(),
): RetrievedMemory[] {
  return rows.map(row => classifyRetrievedMemory(row, retrievalTimestamp));
}

// ── Filtering ────────────────────────────────────────────────────────────────

export function filterUsableMemories(
  memories: RetrievedMemory[],
  options: RetrievalOptions = DEFAULT_RETRIEVAL_OPTIONS,
): RetrievedMemory[] {
  const opts = { ...DEFAULT_RETRIEVAL_OPTIONS, ...options };

  return memories.filter(m => {
    // Must be usable as context
    if (!m.usableAsContext) return false;

    // Must meet confidence threshold
    if (m.confidence < (opts.minConfidence ?? 0.1)) return false;

    // Must not be stale
    const ageHours = getAgeHours(m.createdAt);
    if (ageHours > (opts.maxAgeHours ?? 720)) return false;

    // Source filter
    if (opts.sourceFilter && m.source !== opts.sourceFilter) return false;

    // Exclude governance-sensitive unless explicitly included
    if (m.safety.level === "governance_sensitive" && !opts.includeGovernanceSensitive) return false;

    // Exclude trading-sensitive unless explicitly included
    if (m.safety.level === "trading_sensitive" && !opts.includeTradingSensitive) return false;

    return true;
  }).slice(0, opts.limit ?? 10);
}

// ── SQL Generation (for manual execution) ────────────────────────────────────

export function generateRetrievalSQL(options: RetrievalOptions = DEFAULT_RETRIEVAL_OPTIONS): string {
  const opts = { ...DEFAULT_RETRIEVAL_OPTIONS, ...options };
  let sql = `SELECT id, content, metadata, source, created_at\nFROM public.memories\n`;

  const conditions: string[] = [];

  if (opts.sourceFilter) {
    conditions.push(`source = '${opts.sourceFilter.replace(/'/g, "''")}'`);
  }

  if (opts.minConfidence !== undefined) {
    conditions.push(`(metadata->>'confidence')::float >= ${opts.minConfidence}`);
  }

  if (opts.maxAgeHours !== undefined) {
    conditions.push(`created_at >= NOW() - INTERVAL '${opts.maxAgeHours} hours'`);
  }

  if (conditions.length > 0) {
    sql += `WHERE ${conditions.join(" AND ")}\n`;
  }

  sql += `ORDER BY created_at DESC\n`;
  sql += `LIMIT ${opts.limit ?? 10};`;

  return sql;
}
