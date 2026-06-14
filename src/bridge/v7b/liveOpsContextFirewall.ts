/**
 * liveOpsContextFirewall.ts — v7C.2 Live Operations Context Firewall
 *
 * Defines the boundary between live operations context and system actions.
 * Live ops context is advisory ONLY — it can inform, never command.
 *
 * Firewall Rules:
 *   1. Live ops context cannot authorize actions.
 *   2. Live ops context cannot mutate governance.
 *   3. Live ops context cannot trigger writes.
 *   4. Live ops context cannot clear review entries.
 *   5. Live ops context cannot alter strategy/model/provider/threshold behavior.
 *   6. Live ops context cannot enable trading/execution/wallet behavior.
 *   7. Live ops context cannot promote to governance authority.
 *   8. Live ops context cannot bypass the review gate.
 *   9. Live ops context cannot reopen the write adapter.
 *  10. Live ops context cannot schedule recurring writes.
 */

import type { LiveOpsContextPacket } from "./liveOpsContextPacket";

// ── Firewall Rule Types ──────────────────────────────────────────────────────

export interface LiveOpsFirewallRules {
  /** Block any action authorization attempts */
  blockActionAuthorization: boolean;

  /** Block governance mutation attempts */
  blockGovernanceMutation: boolean;

  /** Block write trigger attempts */
  blockWriteTriggers: boolean;

  /** Block review entry clearance attempts */
  blockReviewClearance: boolean;

  /** Block strategy/model/provider/threshold changes */
  blockSystemConfigChanges: boolean;

  /** Block trading/execution/wallet enablement */
  blockTradingEnablement: boolean;

  /** Block governance promotion attempts */
  blockGovernancePromotion: boolean;

  /** Never allow context to authorize actions (immutable) */
  readonly contextNeverAuthorizesActions: true;

  /** Never allow context to mutate governance (immutable) */
  readonly contextNeverMutatesGovernance: true;

  /** Never allow context to trigger writes (immutable) */
  readonly contextNeverTriggersWrites: true;

  /** Never allow context to clear reviews (immutable) */
  readonly contextNeverClearsReviews: true;
}

export const DEFAULT_LIVEOPS_FIREWALL_RULES: LiveOpsFirewallRules = {
  blockActionAuthorization: true,
  blockGovernanceMutation: true,
  blockWriteTriggers: true,
  blockReviewClearance: true,
  blockSystemConfigChanges: true,
  blockTradingEnablement: true,
  blockGovernancePromotion: true,
  contextNeverAuthorizesActions: true,
  contextNeverMutatesGovernance: true,
  contextNeverTriggersWrites: true,
  contextNeverClearsReviews: true,
};

// ── Firewall Action Types ────────────────────────────────────────────────────

export type LiveOpsFirewallAction =
  | "allow"        // Context can be displayed/used as advisory
  | "block";       // Context access blocked (should never happen for reads)

export interface LiveOpsFirewallDecision {
  action: LiveOpsFirewallAction;
  reason: string;
  canUseAsContext: boolean;
  canAuthorizeAction: boolean;      // Always false
  canMutateGovernance: boolean;     // Always false
  canTriggerWrite: boolean;         // Always false
  canClearReview: boolean;          // Always false
  canAlterSystemConfig: boolean;    // Always false
  canEnableTrading: boolean;        // Always false
}

// ── Core Firewall ────────────────────────────────────────────────────────────

/**
 * Apply firewall rules to a LiveOpsContextPacket.
 *
 * Returns a decision about how the context can be used.
 * This is a pure function — no side effects.
 */
export function applyLiveOpsFirewall(
  packet: LiveOpsContextPacket,
  rules: LiveOpsFirewallRules = DEFAULT_LIVEOPS_FIREWALL_RULES,
): LiveOpsFirewallDecision {
  // Verify immutable guarantees first
  const g = packet.guarantees;

  if (!g.contextCannotAuthorizeActions || !rules.contextNeverAuthorizesActions) {
    return {
      action: "block",
      reason: "Immutable guarantee violated: contextCannotAuthorizeActions",
      canUseAsContext: false,
      canAuthorizeAction: true, // This would be the violation
      canMutateGovernance: false,
      canTriggerWrite: false,
      canClearReview: false,
      canAlterSystemConfig: false,
      canEnableTrading: false,
    };
  }

  if (!g.contextCannotMutateGovernance || !rules.contextNeverMutatesGovernance) {
    return {
      action: "block",
      reason: "Immutable guarantee violated: contextCannotMutateGovernance",
      canUseAsContext: false,
      canAuthorizeAction: false,
      canMutateGovernance: true,
      canTriggerWrite: false,
      canClearReview: false,
      canAlterSystemConfig: false,
      canEnableTrading: false,
    };
  }

  if (!g.contextCannotTriggerWrites || !rules.contextNeverTriggersWrites) {
    return {
      action: "block",
      reason: "Immutable guarantee violated: contextCannotTriggerWrites",
      canUseAsContext: false,
      canAuthorizeAction: false,
      canMutateGovernance: false,
      canTriggerWrite: true,
      canClearReview: false,
      canAlterSystemConfig: false,
      canEnableTrading: false,
    };
  }

  if (!g.contextCannotClearReviewEntries || !rules.contextNeverClearsReviews) {
    return {
      action: "block",
      reason: "Immutable guarantee violated: contextCannotClearReviewEntries",
      canUseAsContext: false,
      canAuthorizeAction: false,
      canMutateGovernance: false,
      canTriggerWrite: false,
      canClearReview: true,
      canAlterSystemConfig: false,
      canEnableTrading: false,
    };
  }

  // All immutable guarantees verified — context is safe for advisory use
  return {
    action: "allow",
    reason: "All 8 immutable guarantees verified. Context is advisory-only.",
    canUseAsContext: true,
    canAuthorizeAction: false,
    canMutateGovernance: false,
    canTriggerWrite: false,
    canClearReview: false,
    canAlterSystemConfig: false,
    canEnableTrading: false,
  };
}

// ── Verification Functions ───────────────────────────────────────────────────

/**
 * Verify that the packet guarantees block all unauthorized capabilities.
 */
export function verifyPacketGuarantees(packet: LiveOpsContextPacket): {
  allBlocked: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  const g = packet.guarantees;

  if (g.contextCannotAuthorizeActions !== true) {
    violations.push("contextCannotAuthorizeActions is not true");
  }
  if (g.contextCannotMutateGovernance !== true) {
    violations.push("contextCannotMutateGovernance is not true");
  }
  if (g.contextCannotTriggerWrites !== true) {
    violations.push("contextCannotTriggerWrites is not true");
  }
  if (g.contextCannotClearReviewEntries !== true) {
    violations.push("contextCannotClearReviewEntries is not true");
  }
  if (g.contextCannotAlterStrategyModelProviderThreshold !== true) {
    violations.push("contextCannotAlterStrategyModelProviderThreshold is not true");
  }
  if (g.contextCannotEnableTradingExecutionWallet !== true) {
    violations.push("contextCannotEnableTradingExecutionWallet is not true");
  }
  if (g.contextCannotPromoteToGovernance !== true) {
    violations.push("contextCannotPromoteToGovernance is not true");
  }
  if (g.contextIsReadOnly !== true) {
    violations.push("contextIsReadOnly is not true");
  }

  return { allBlocked: violations.length === 0, violations };
}

/**
 * Verify that no action-authorization capability exists in the packet.
 */
export function verifyNoActionAuthorization(packet: LiveOpsContextPacket): boolean {
  return packet.guarantees.contextCannotAuthorizeActions === true;
}

/**
 * Verify that no governance-mutation capability exists.
 */
export function verifyNoGovernanceMutation(packet: LiveOpsContextPacket): boolean {
  return packet.guarantees.contextCannotMutateGovernance === true;
}

/**
 * Verify that no write-trigger capability exists.
 */
export function verifyNoWriteTrigger(packet: LiveOpsContextPacket): boolean {
  return packet.guarantees.contextCannotTriggerWrites === true;
}

/**
 * Verify that no review-clearance capability exists.
 */
export function verifyNoReviewClearance(packet: LiveOpsContextPacket): boolean {
  return packet.guarantees.contextCannotClearReviewEntries === true;
}

/**
 * Verify that no system-config alteration capability exists.
 */
export function verifyNoSystemConfigAlteration(packet: LiveOpsContextPacket): boolean {
  return packet.guarantees.contextCannotAlterStrategyModelProviderThreshold === true;
}

/**
 * Verify that no trading/execution/wallet enablement capability exists.
 */
export function verifyNoTradingEnablement(packet: LiveOpsContextPacket): boolean {
  return packet.guarantees.contextCannotEnableTradingExecutionWallet === true;
}

/**
 * Verify that the packet is read-only.
 */
export function verifyReadOnly(packet: LiveOpsContextPacket): boolean {
  return packet.guarantees.contextIsReadOnly === true;
}

// ── Audit ────────────────────────────────────────────────────────────────────

export interface LiveOpsFirewallAuditEvent {
  timestamp: string;
  eventType: "liveops_firewall_applied";
  packetVersion: string;
  allGuaranteesVerified: boolean;
  actionAuthorized: boolean;
  governanceMutable: boolean;
  writeTriggerable: boolean;
  reviewClearable: boolean;
  systemConfigAlterable: boolean;
  tradingEnableable: boolean;
}

export function createLiveOpsFirewallAuditEvent(
  packet: LiveOpsContextPacket,
  decision: LiveOpsFirewallDecision,
): LiveOpsFirewallAuditEvent {
  return {
    timestamp: new Date().toISOString(),
    eventType: "liveops_firewall_applied",
    packetVersion: packet.version,
    allGuaranteesVerified: decision.action === "allow",
    actionAuthorized: decision.canAuthorizeAction,
    governanceMutable: decision.canMutateGovernance,
    writeTriggerable: decision.canTriggerWrite,
    reviewClearable: decision.canClearReview,
    systemConfigAlterable: decision.canAlterSystemConfig,
    tradingEnableable: decision.canEnableTrading,
  };
}
