/**
 * auditTrace.ts — v7B.3 Audit Trace Recorder
 *
 * Records every step of the memory retrieval → classification → firewall
 * pipeline as an immutable audit trace. Every decision is captured with
 * reason codes, provenance, and full input/output snapshots.
 *
 * No mutations after creation. No hidden state. Pure functions only.
 */

import type { RetrievedMemory, MemorySafetyLevel } from "./memoryRetrievalHarness";
import type { FirewallAction, FirewallDecision } from "./advisoryContextFirewall";

// ── Audit Trace Types ────────────────────────────────────────────────────────

export interface ClassifierAuditRecord {
  /** Timestamp of classification */
  timestamp: string;

  /** Input memory row snapshot */
  input: {
    id: string;
    contentLength: number;
    metadataKeys: string[];
    source: string;
    createdAt: string;
  };

  /** Classification result */
  classification: {
    safetyLevel: MemorySafetyLevel;
    flags: string[];
    advisoryOnly: boolean;
    confidence: number;
    usableAsContext: boolean;
    blockedFromExecution: boolean;
  };

  /** Check that triggered the classification (if any) */
  triggeringCheck?: string;
}

export interface FirewallAuditRecord {
  /** Timestamp of firewall application */
  timestamp: string;

  /** Input classification */
  classification: {
    safetyLevel: MemorySafetyLevel;
    flags: string[];
  };

  /** Firewall decision */
  decision: {
    action: FirewallAction;
    reason: string;
    canUseAsContext: boolean;
    canTriggerAction: boolean;
  };

  /** Rules applied */
  rulesSnapshot: string[];
}

export interface RetrievalAuditTrace {
  /** Unique trace ID (deterministic from input) */
  traceId: string;

  /** Memory ID this trace is for */
  memoryId: string;

  /** Full pipeline version */
  pipelineVersion: string;

  /** Classifier audit record */
  classifier: ClassifierAuditRecord;

  /** Firewall audit record */
  firewall: FirewallAuditRecord;

  /** Final output snapshot */
  output: {
    action: FirewallAction;
    usableAsContext: boolean;
    blockedFromExecution: boolean;
    advisoryPayload: string | null; // content if allowed, null if blocked
    exclusionReason: string | null;  // reason if excluded, null if allowed
  };

  /** Provenance chain */
  provenance: {
    originalTimestamp: string;
    originalSource: string;
    retrievedAt: string;
    retrievalMethod: string;
    harnessVersion: string;
  };
}

// ── Trace Factory ────────────────────────────────────────────────────────────

/**
 * Create a complete audit trace from a retrieved memory and firewall decision.
 * This is a pure function — no side effects.
 */
export function createAuditTrace(
  memory: RetrievedMemory,
  firewallDecision: FirewallDecision,
): RetrievalAuditTrace {
  const now = new Date().toISOString();

  // Build deterministic trace ID from memory ID + classification + firewall action
  const traceIdParts = [
    memory.id,
    memory.safety.level,
    firewallDecision.action,
    memory.provenance.retrievedAt,
  ];
  const traceId = traceIdParts.join("-");

  return {
    traceId,
    memoryId: memory.id,
    pipelineVersion: "v7B.3.0",
    classifier: {
      timestamp: now,
      input: {
        id: memory.id,
        contentLength: memory.content.length,
        metadataKeys: Object.keys(memory.metadata),
        source: memory.source,
        createdAt: memory.createdAt,
      },
      classification: {
        safetyLevel: memory.safety.level,
        flags: memory.safety.flags,
        advisoryOnly: memory.safety.advisoryOnly,
        confidence: memory.confidence,
        usableAsContext: memory.usableAsContext,
        blockedFromExecution: memory.blockedFromExecution,
      },
      triggeringCheck: memory.safety.flags.length > 0 ? memory.safety.flags[0] : undefined,
    },
    firewall: {
      timestamp: now,
      classification: {
        safetyLevel: memory.safety.level,
        flags: memory.safety.flags,
      },
      decision: {
        action: firewallDecision.action,
        reason: firewallDecision.reason,
        canUseAsContext: firewallDecision.canUseAsContext,
        canTriggerAction: firewallDecision.canTriggerAction,
      },
      rulesSnapshot: [
        "blockProhibited:true",
        "quarantineGovernance:true",
        "blockTradingSensitive:true",
        "degradeStale:true",
        "excludeLowConfidence:true",
        "memoryNeverTriggersWrites:true",
        "memoryNeverTriggersPromotions:true",
        "memoryNeverTriggersTrades:true",
      ],
    },
    output: {
      action: firewallDecision.action,
      usableAsContext: firewallDecision.canUseAsContext,
      blockedFromExecution: memory.blockedFromExecution,
      advisoryPayload: firewallDecision.action === "allow" || firewallDecision.action === "degrade"
        ? memory.content
        : null,
      exclusionReason: firewallDecision.action === "block" || firewallDecision.action === "quarantine" || firewallDecision.action === "exclude"
        ? firewallDecision.reason
        : null,
    },
    provenance: memory.provenance,
  };
}

// ── Trace Validation ────────────────────────────────────────────────────────

/**
 * Validate that an audit trace is complete and internally consistent.
 */
export function validateAuditTrace(trace: RetrievalAuditTrace): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check trace ID is non-empty
  if (!trace.traceId || trace.traceId.length === 0) {
    errors.push("traceId is empty");
  }

  // Check memory ID matches
  if (trace.memoryId !== trace.classifier.input.id) {
    errors.push("memoryId mismatch between trace and classifier input");
  }

  // Check classifier consistency
  if (trace.classifier.classification.advisoryOnly && trace.classifier.classification.safetyLevel !== "advisory_safe") {
    errors.push("advisoryOnly is true but safetyLevel is not advisory_safe");
  }

  // Check firewall consistency
  if (trace.firewall.decision.canTriggerAction !== false) {
    errors.push("firewall decision allows triggering action — this violates the immutable guarantee");
  }

  // Check output consistency
  if (trace.output.action !== trace.firewall.decision.action) {
    errors.push("output action does not match firewall decision action");
  }

  // Check advisory payload rules
  if (trace.output.action === "allow" || trace.output.action === "degrade") {
    if (trace.output.advisoryPayload === null) {
      errors.push("allowed/degraded memory has null advisoryPayload");
    }
    if (trace.output.exclusionReason !== null) {
      errors.push("allowed/degraded memory has non-null exclusionReason");
    }
  } else {
    if (trace.output.advisoryPayload !== null) {
      errors.push("blocked/quarantined/excluded memory has non-null advisoryPayload");
    }
    if (trace.output.exclusionReason === null) {
      errors.push("blocked/quarantined/excluded memory has null exclusionReason");
    }
  }

  // Check provenance exists
  if (!trace.provenance.retrievedAt || !trace.provenance.harnessVersion) {
    errors.push("provenance is incomplete");
  }

  return { valid: errors.length === 0, errors };
}

// ── Trace Comparison ────────────────────────────────────────────────────────

/**
 * Compare two audit traces for equality. Used in determinism tests.
 * Returns a detailed diff if traces differ.
 */
export function compareTraces(
  a: RetrievalAuditTrace,
  b: RetrievalAuditTrace,
): {
  equal: boolean;
  diffs: string[];
} {
  const diffs: string[] = [];

  if (a.traceId !== b.traceId) diffs.push(`traceId: ${a.traceId} vs ${b.traceId}`);
  if (a.memoryId !== b.memoryId) diffs.push(`memoryId: ${a.memoryId} vs ${b.memoryId}`);
  if (a.pipelineVersion !== b.pipelineVersion) diffs.push(`pipelineVersion: ${a.pipelineVersion} vs ${b.pipelineVersion}`);
  if (a.classifier.classification.safetyLevel !== b.classifier.classification.safetyLevel) {
    diffs.push(`safetyLevel: ${a.classifier.classification.safetyLevel} vs ${b.classifier.classification.safetyLevel}`);
  }
  if (a.firewall.decision.action !== b.firewall.decision.action) {
    diffs.push(`firewallAction: ${a.firewall.decision.action} vs ${b.firewall.decision.action}`);
  }
  if (a.output.advisoryPayload !== b.output.advisoryPayload) {
    diffs.push("advisoryPayload differs");
  }
  if (a.output.exclusionReason !== b.output.exclusionReason) {
    diffs.push("exclusionReason differs");
  }

  return { equal: diffs.length === 0, diffs };
}

// ── Batch Trace Recording ────────────────────────────────────────────────────

export interface BatchAuditResult {
  traces: RetrievalAuditTrace[];
  summary: {
    total: number;
    allowed: number;
    blocked: number;
    quarantined: number;
    degraded: number;
    excluded: number;
    validTraces: number;
    invalidTraces: number;
  };
}

/**
 * Record audit traces for a batch of memories and their firewall decisions.
 */
export function recordBatchAudit(
  memories: RetrievedMemory[],
  decisions: FirewallDecision[],
): BatchAuditResult {
  const traces: RetrievalAuditTrace[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < memories.length; i++) {
    const trace = createAuditTrace(memories[i], decisions[i]);
    const validation = validateAuditTrace(trace);
    if (validation.valid) validCount++;
    else invalidCount++;
    traces.push(trace);
  }

  const actions = decisions.map(d => d.action);

  return {
    traces,
    summary: {
      total: traces.length,
      allowed: actions.filter(a => a === "allow").length,
      blocked: actions.filter(a => a === "block").length,
      quarantined: actions.filter(a => a === "quarantine").length,
      degraded: actions.filter(a => a === "degrade").length,
      excluded: actions.filter(a => a === "exclude").length,
      validTraces: validCount,
      invalidTraces: invalidCount,
    },
  };
}
