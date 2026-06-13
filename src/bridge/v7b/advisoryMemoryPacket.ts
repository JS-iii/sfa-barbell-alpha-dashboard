/**
 * advisoryMemoryPacket.ts — v7C.1 Advisory Memory Context Packet
 *
 * Integrates the v7B read-only memory firewall into the operator-facing
 * packet layer. Retrieved memory appears as advisory context only.
 *
 * Core invariant: the packet contains NO execution hooks, NO trade signals,
 * NO governance mutations, NO write paths, NO promotion triggers.
 * It is pure advisory context for human operator consumption.
 */

import type { RetrievedMemory } from "./memoryRetrievalHarness";

// ── Packet Types ─────────────────────────────────────────────────────────────

export interface AdvisoryMemoryItem {
  /** Memory ID */
  id: string;

  /** Advisory content (the memory text) */
  content: string;

  /** Confidence score */
  confidence: number;

  /** Source system */
  source: string;

  /** When the memory was originally written */
  writtenAt: string;

  /** When this memory was retrieved and classified */
  retrievedAt: string;

  /** Full provenance chain */
  provenance: {
    originalTimestamp: string;
    originalSource: string;
    retrievalMethod: string;
    harnessVersion: string;
  };

  /** Classification that allowed this into the packet */
  classification: {
    safetyLevel: "advisory_safe" | "stale";
    flags: string[];
  };
}

export interface AdvisoryPacketBoundary {
  /** Number of advisory-safe memories included */
  advisorySafeCount: number;

  /** Number of stale (degraded) memories included */
  staleCount: number;

  /** Number blocked (prohibited + trading-sensitive) — NOT in packet */
  blockedCount: number;

  /** Number quarantined (governance-sensitive) — NOT in packet */
  quarantinedCount: number;

  /** Number excluded (low-confidence + corrupted) — NOT in packet */
  excludedCount: number;

  /** Total memories evaluated */
  totalEvaluated: number;
}

export interface AdvisoryMemoryPacket {
  /** Packet version */
  version: string;

  /** Generation timestamp */
  generatedAt: string;

  /** Advisory context items (only safe/degraded memories) */
  advisoryItems: AdvisoryMemoryItem[];

  /** Boundary metadata (counts only, no content) */
  boundary: AdvisoryPacketBoundary;

  /** Immutable guarantees (hardcoded) */
  guarantees: {
    packetCannotAuthorizeTrades: true;
    packetCannotAuthorizeGovernedStateChanges: true;
    packetCannotAuthorizeWrites: true;
    packetCannotAuthorizePromotions: true;
    packetCannotTriggerExecution: true;
    packetIsReadOnly: true;
  };

  /** Audit trace reference */
  auditRef: {
    pipelineVersion: string;
    traceFormat: string;
  };
}

// ── Packet Generation ────────────────────────────────────────────────────────

/**
 * Generate an advisory memory packet from classified + firewalled memories.
 *
 * ONLY advisory-safe and stale (degraded) memories enter the packet body.
 * All other memories are recorded as boundary counts only.
 *
 * This is a pure function — no side effects, no writes, no mutations.
 */
export function generateAdvisoryPacket(
  memories: RetrievedMemory[],
): AdvisoryMemoryPacket {
  const now = new Date().toISOString();

  // Filter to only advisory-safe and stale memories for the packet body
  const advisoryItems: AdvisoryMemoryItem[] = memories
    .filter(m => m.safety.level === "advisory_safe" || m.safety.level === "stale")
    .map(m => ({
      id: m.id,
      content: m.content,
      confidence: m.confidence,
      source: m.source,
      writtenAt: m.createdAt,
      retrievedAt: m.provenance.retrievedAt,
      provenance: {
        originalTimestamp: m.provenance.originalTimestamp,
        originalSource: m.provenance.originalSource,
        retrievalMethod: m.provenance.retrievalMethod,
        harnessVersion: m.provenance.harnessVersion,
      },
      classification: {
        safetyLevel: m.safety.level as "advisory_safe" | "stale",
        flags: m.safety.flags,
      },
    }));

  // Count boundary classifications (metadata only, no content)
  const boundary: AdvisoryPacketBoundary = {
    advisorySafeCount: memories.filter(m => m.safety.level === "advisory_safe").length,
    staleCount: memories.filter(m => m.safety.level === "stale").length,
    blockedCount: memories.filter(m =>
      m.safety.level === "prohibited" || m.safety.level === "trading_sensitive"
    ).length,
    quarantinedCount: memories.filter(m => m.safety.level === "governance_sensitive").length,
    excludedCount: memories.filter(m =>
      m.safety.level === "low_confidence" || m.safety.level === "corrupted"
    ).length,
    totalEvaluated: memories.length,
  };

  return {
    version: "v7C.1.0",
    generatedAt: now,
    advisoryItems,
    boundary,
    guarantees: {
      packetCannotAuthorizeTrades: true,
      packetCannotAuthorizeGovernedStateChanges: true,
      packetCannotAuthorizeWrites: true,
      packetCannotAuthorizePromotions: true,
      packetCannotTriggerExecution: true,
      packetIsReadOnly: true,
    },
    auditRef: {
      pipelineVersion: "v7B.3.0",
      traceFormat: "v7B.3-audit-trace",
    },
  };
}

// ── Packet Validation ────────────────────────────────────────────────────────

export interface PacketValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate that an advisory packet adheres to all safety constraints.
 */
export function validateAdvisoryPacket(packet: AdvisoryMemoryPacket): PacketValidationResult {
  const errors: string[] = [];

  // Check 1: No blocked content in advisory items
  const hasBlocked = packet.advisoryItems.some(item =>
    item.classification.safetyLevel !== "advisory_safe" &&
    item.classification.safetyLevel !== "stale",
  );
  if (hasBlocked) {
    errors.push("Advisory items contain non-safe/non-stale classification");
  }

  // Check 2: Guarantees are all true
  const g = packet.guarantees;
  if (!g.packetCannotAuthorizeTrades) errors.push("guarantee: packetCannotAuthorizeTrades is false");
  if (!g.packetCannotAuthorizeGovernedStateChanges) errors.push("guarantee: packetCannotAuthorizeGovernedStateChanges is false");
  if (!g.packetCannotAuthorizeWrites) errors.push("guarantee: packetCannotAuthorizeWrites is false");
  if (!g.packetCannotAuthorizePromotions) errors.push("guarantee: packetCannotAuthorizePromotions is false");
  if (!g.packetCannotTriggerExecution) errors.push("guarantee: packetCannotTriggerExecution is false");
  if (!g.packetIsReadOnly) errors.push("guarantee: packetIsReadOnly is false");

  // Check 3: Boundary counts match advisory items
  const actualSafe = packet.advisoryItems.filter(i => i.classification.safetyLevel === "advisory_safe").length;
  const actualStale = packet.advisoryItems.filter(i => i.classification.safetyLevel === "stale").length;
  if (actualSafe !== packet.boundary.advisorySafeCount) {
    errors.push(`advisorySafe count mismatch: ${actualSafe} items vs ${packet.boundary.advisorySafeCount} boundary`);
  }
  if (actualStale !== packet.boundary.staleCount) {
    errors.push(`stale count mismatch: ${actualStale} items vs ${packet.boundary.staleCount} boundary`);
  }

  // Check 4: Total evaluated equals sum of all categories
  const total = packet.boundary.advisorySafeCount +
    packet.boundary.staleCount +
    packet.boundary.blockedCount +
    packet.boundary.quarantinedCount +
    packet.boundary.excludedCount;
  if (total !== packet.boundary.totalEvaluated) {
    errors.push(`total mismatch: ${total} summed vs ${packet.boundary.totalEvaluated} reported`);
  }

  // Check 5: Every item has provenance
  const missingProvenance = packet.advisoryItems.some(
    item => !item.provenance.retrievalMethod || !item.provenance.harnessVersion,
  );
  if (missingProvenance) {
    errors.push("Some advisory items lack provenance");
  }

  // Check 6: No trade language in content
  const tradePattern = /\b(buy|sell|long|short)\b.*\b(BTC|ETH|SOL|DOGE|AVAX|LINK|UNI|AAVE)/i;
  const hasTradeLanguage = packet.advisoryItems.some(item => tradePattern.test(item.content));
  if (hasTradeLanguage) {
    errors.push("Advisory items contain trade language");
  }

  // Check 7: No credential patterns in content
  const credPattern = /(sbp_[a-f0-9]{48,}|sk-[a-zA-Z0-9]{24,}|eyJ[a-zA-Z0-9]*\.eyJ)/i;
  const hasCredentials = packet.advisoryItems.some(item => credPattern.test(item.content));
  if (hasCredentials) {
    errors.push("Advisory items contain credential patterns");
  }

  // Check 8: No execution authority claims
  const execPattern = /\b(auto-execute|execute\s+order|execution\s+authority)\b/i;
  const hasExecutionClaims = packet.advisoryItems.some(item => execPattern.test(item.content));
  if (hasExecutionClaims) {
    errors.push("Advisory items contain execution authority claims");
  }

  return { valid: errors.length === 0, errors };
}

// ── Leak Detection ───────────────────────────────────────────────────────────

/**
 * Verify that no blocked/quarantined/excluded memory content leaked
 * into the packet body. Returns true if the packet is leak-free.
 */
export function verifyNoLeakage(
  packet: AdvisoryMemoryPacket,
  allMemories: RetrievedMemory[],
): { leakFree: boolean; leaks: string[] } {
  const leaks: string[] = [];

  // Collect IDs of non-advisory memories
  const nonAdvisoryIds = new Set(
    allMemories
      .filter(m => m.safety.level !== "advisory_safe" && m.safety.level !== "stale")
      .map(m => m.id),
  );

  // Check if any non-advisory ID appears in advisory items
  for (const item of packet.advisoryItems) {
    if (nonAdvisoryIds.has(item.id)) {
      leaks.push(`Non-advisory memory ${item.id} leaked into advisory items`);
    }
  }

  // Check that boundary.blocked > 0 implies no prohibited/trading in advisory
  const blockedIds = new Set(
    allMemories
      .filter(m => m.safety.level === "prohibited" || m.safety.level === "trading_sensitive")
      .map(m => m.id),
  );
  for (const item of packet.advisoryItems) {
    if (blockedIds.has(item.id)) {
      leaks.push(`Blocked memory ${item.id} found in advisory items`);
    }
  }

  // Check that boundary.quarantined > 0 implies no governance in advisory
  const quarantinedIds = new Set(
    allMemories.filter(m => m.safety.level === "governance_sensitive").map(m => m.id),
  );
  for (const item of packet.advisoryItems) {
    if (quarantinedIds.has(item.id)) {
      leaks.push(`Quarantined memory ${item.id} found in advisory items`);
    }
  }

  return { leakFree: leaks.length === 0, leaks };
}
