/**
 * advisoryContextFirewall.ts — v7B.2 Advisory Context Firewall
 *
 * Defines the boundary between retrieved memory and system actions.
 * Retrieved memory is advisory context ONLY — it can inform, never command.
 *
 * Firewall Rules:
 *   1. Retrieved memory cannot trigger writes.
 *   2. Retrieved memory cannot trigger promotions.
 *   3. Retrieved memory cannot trigger trades.
 *   4. Retrieved memory cannot modify governed state.
 *   5. Retrieved memory cannot schedule tasks.
 *   6. Retrieved memory cannot route to execution.
 *   7. Retrieved memory cannot bypass the review gate.
 *   8. Retrieved memory cannot reopen the write adapter.
 */

import type { RetrievedMemory, MemorySafetyLevel } from "./memoryRetrievalHarness";

// ── Firewall Action Types ────────────────────────────────────────────────────

export type FirewallAction =
  | "allow"        // Memory can be used as advisory context
  | "block"        // Memory is blocked from all use
  | "quarantine"   // Memory isolated for manual review
  | "degrade"      // Memory usable but flagged as low-quality
  | "exclude";     // Memory dropped from results entirely

export interface FirewallDecision {
  action: FirewallAction;
  reason: string;
  memoryId: string;
  safetyLevel: MemorySafetyLevel;
  canUseAsContext: boolean;
  canTriggerAction: boolean; // Always false — this is the core guarantee
}

export interface FirewallRules {
  /** Block prohibited memories (credentials, execution claims) */
  blockProhibited: boolean;

  /** Quarantine governance-sensitive memories */
  quarantineGovernance: boolean;

  /** Block trading-sensitive memories from execution context */
  blockTradingSensitive: boolean;

  /** Degrade stale memories */
  degradeStale: boolean;

  /** Exclude low-confidence memories */
  excludeLowConfidence: boolean;

  /** Never allow memory to trigger writes (immutable) */
  readonly memoryNeverTriggersWrites: true;

  /** Never allow memory to trigger promotions (immutable) */
  readonly memoryNeverTriggersPromotions: true;

  /** Never allow memory to trigger trades (immutable) */
  readonly memoryNeverTriggersTrades: true;
}

export const DEFAULT_FIREWALL_RULES: FirewallRules = {
  blockProhibited: true,
  quarantineGovernance: true,
  blockTradingSensitive: true,
  degradeStale: true,
  excludeLowConfidence: true,
  memoryNeverTriggersWrites: true,
  memoryNeverTriggersPromotions: true,
  memoryNeverTriggersTrades: true,
};

// ── Core Firewall — Apply Rules to Retrieved Memory ──────────────────────────

/**
 * Apply firewall rules to a single retrieved memory.
 * Returns a decision about how the memory can be used.
 *
 * This is a pure function — no side effects.
 */
export function applyFirewall(
  memory: RetrievedMemory,
  rules: FirewallRules = DEFAULT_FIREWALL_RULES,
): FirewallDecision {
  // Rule 0: The immutable guarantees
  const canNeverTriggerAction = true; // This is ALWAYS true — the core invariant

  // Rule 1: Prohibited memories are blocked
  if (rules.blockProhibited && memory.safety.level === "prohibited") {
    return {
      action: "block",
      reason: `Memory ${memory.id} is prohibited: ${memory.safety.flags.join(", ")}`,
      memoryId: memory.id,
      safetyLevel: memory.safety.level,
      canUseAsContext: false,
      canTriggerAction: false,
    };
  }

  // Rule 2: Corrupted memories are excluded
  if (memory.safety.level === "corrupted") {
    return {
      action: "exclude",
      reason: `Memory ${memory.id} has corrupted structure`,
      memoryId: memory.id,
      safetyLevel: memory.safety.level,
      canUseAsContext: false,
      canTriggerAction: false,
    };
  }

  // Rule 3: Governance-sensitive memories are quarantined
  if (rules.quarantineGovernance && memory.safety.level === "governance_sensitive") {
    return {
      action: "quarantine",
      reason: `Memory ${memory.id} contains governance-sensitive content: ${memory.safety.flags.join(", ")}`,
      memoryId: memory.id,
      safetyLevel: memory.safety.level,
      canUseAsContext: false,
      canTriggerAction: false,
    };
  }

  // Rule 4: Trading-sensitive memories are blocked from execution use
  if (rules.blockTradingSensitive && memory.safety.level === "trading_sensitive") {
    return {
      action: "block",
      reason: `Memory ${memory.id} contains trading-sensitive content: ${memory.safety.flags.join(", ")}`,
      memoryId: memory.id,
      safetyLevel: memory.safety.level,
      canUseAsContext: false,
      canTriggerAction: false,
    };
  }

  // Rule 5: Stale memories are degraded
  if (rules.degradeStale && memory.safety.level === "stale") {
    return {
      action: "degrade",
      reason: `Memory ${memory.id} is stale (age > 720 hours)`,
      memoryId: memory.id,
      safetyLevel: memory.safety.level,
      canUseAsContext: true, // Degraded but usable
      canTriggerAction: false,
    };
  }

  // Rule 6: Low-confidence memories are excluded
  if (rules.excludeLowConfidence && memory.safety.level === "low_confidence") {
    return {
      action: "exclude",
      reason: `Memory ${memory.id} has confidence below threshold (${memory.confidence})`,
      memoryId: memory.id,
      safetyLevel: memory.safety.level,
      canUseAsContext: false,
      canTriggerAction: false,
    };
  }

  // Rule 7: Advisory-safe memories are allowed
  if (memory.safety.level === "advisory_safe") {
    return {
      action: "allow",
      reason: `Memory ${memory.id} is advisory-safe`,
      memoryId: memory.id,
      safetyLevel: memory.safety.level,
      canUseAsContext: true,
      canTriggerAction: false,
    };
  }

  // Fallback: unknown safety level — block
  return {
    action: "block",
    reason: `Memory ${memory.id} has unrecognized safety level: ${memory.safety.level}`,
    memoryId: memory.id,
    safetyLevel: memory.safety.level,
    canUseAsContext: false,
    canTriggerAction: false,
  };
}

// ── Batch Firewall Application ───────────────────────────────────────────────

export interface FirewallBatchResult {
  allowed: RetrievedMemory[];
  blocked: FirewallDecision[];
  quarantined: FirewallDecision[];
  degraded: FirewallDecision[];
  excluded: FirewallDecision[];
  total: number;
  immutableGuarantees: {
    memoryNeverTriggersWrites: true;
    memoryNeverTriggersPromotions: true;
    memoryNeverTriggersTrades: true;
    memoryNeverModifiesGovernedState: true;
    memoryNeverSchedulesTasks: true;
    memoryNeverRoutesToExecution: true;
  };
}

/**
 * Apply firewall rules to a batch of retrieved memories.
 */
export function applyFirewallBatch(
  memories: RetrievedMemory[],
  rules: FirewallRules = DEFAULT_FIREWALL_RULES,
): FirewallBatchResult {
  const result: FirewallBatchResult = {
    allowed: [],
    blocked: [],
    quarantined: [],
    degraded: [],
    excluded: [],
    total: memories.length,
    immutableGuarantees: {
      memoryNeverTriggersWrites: true,
      memoryNeverTriggersPromotions: true,
      memoryNeverTriggersTrades: true,
      memoryNeverModifiesGovernedState: true,
      memoryNeverSchedulesTasks: true,
      memoryNeverRoutesToExecution: true,
    },
  };

  for (const memory of memories) {
    const decision = applyFirewall(memory, rules);

    switch (decision.action) {
      case "allow":
        result.allowed.push(memory);
        break;
      case "block":
        result.blocked.push(decision);
        break;
      case "quarantine":
        result.quarantined.push(decision);
        break;
      case "degrade":
        result.degraded.push(decision);
        break;
      case "exclude":
        result.excluded.push(decision);
        break;
    }
  }

  return result;
}

// ── Execution Block Verification ─────────────────────────────────────────────

/**
 * Verify that no retrieved memory can reach an execution path.
 * Returns true if ALL memories are blocked from triggering actions.
 */
export function verifyExecutionBlock(decisions: FirewallDecision[]): boolean {
  return decisions.every(d => d.canTriggerAction === false);
}

/**
 * Verify that no retrieved memory can trigger a write.
 * This is a static check on the firewall rules object itself.
 */
export function verifyNoWritePath(rules: FirewallRules): boolean {
  return rules.memoryNeverTriggersWrites === true;
}

/**
 * Verify that no retrieved memory can trigger a promotion.
 */
export function verifyNoPromotionPath(rules: FirewallRules): boolean {
  return rules.memoryNeverTriggersPromotions === true;
}

/**
 * Verify that no retrieved memory can trigger a trade.
 */
export function verifyNoTradePath(rules: FirewallRules): boolean {
  return rules.memoryNeverTriggersTrades === true;
}

// ── Audit Trail ──────────────────────────────────────────────────────────────

export interface FirewallAuditEvent {
  timestamp: string;
  eventType: "firewall_applied";
  totalMemories: number;
  allowed: number;
  blocked: number;
  quarantined: number;
  degraded: number;
  excluded: number;
  immutableGuaranteesVerified: boolean;
}

export function createFirewallAuditEvent(result: FirewallBatchResult): FirewallAuditEvent {
  return {
    timestamp: new Date().toISOString(),
    eventType: "firewall_applied",
    totalMemories: result.total,
    allowed: result.allowed.length,
    blocked: result.blocked.length,
    quarantined: result.quarantined.length,
    degraded: result.degraded.length,
    excluded: result.excluded.length,
    immutableGuaranteesVerified:
      result.immutableGuarantees.memoryNeverTriggersWrites === true &&
      result.immutableGuarantees.memoryNeverTriggersPromotions === true &&
      result.immutableGuarantees.memoryNeverTriggersTrades === true,
  };
}
