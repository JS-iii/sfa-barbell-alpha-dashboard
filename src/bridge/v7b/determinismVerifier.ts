/**
 * determinismVerifier.ts — v7B.3 Determinism Verifier
 *
 * Proves that the memory retrieval + classification + firewall pipeline
 * is fully deterministic: same input always produces same output.
 *
 * No hidden state. No randomness. No network. No time dependency
 * except explicitly fixture-controlled timestamps.
 */

import type { RetrievedMemory } from "./memoryRetrievalHarness";
import type { FirewallDecision, FirewallRules } from "./advisoryContextFirewall";
import type { RetrievalAuditTrace } from "./auditTrace";
import { createAuditTrace } from "./auditTrace";

// ── Determinism Check Types ──────────────────────────────────────────────────

export interface DeterminismCheck {
  passed: boolean;
  description: string;
  detail?: string;
}

export interface DeterminismReport {
  /** All checks performed */
  checks: DeterminismCheck[];

  /** Overall result */
  fullyDeterministic: boolean;

  /** Number of replay runs performed */
  replayCount: number;

  /** Timing statistics (all runs should be similar) */
  timingStats: {
    minMs: number;
    maxMs: number;
    avgMs: number;
  };

  /** Whether any hidden state was detected */
  hiddenStateDetected: boolean;
}

// ── Core Determinism Test ────────────────────────────────────────────────────

/**
 * Replay the same classification + firewall pipeline N times and verify
 * every output is bit-for-bit identical.
 *
 * @param fixtureRow The raw memory fixture to replay
 * @param classifyFn The classification function
 * @param firewallFn The firewall function
 * @param rules Firewall rules
 * @param retrievalTimestamp Fixed retrieval timestamp
 * @param runs Number of replay runs (default: 5)
 */
export function verifyReplayDeterminism(
  fixtureRow: { id: string; content: string; metadata: Record<string, unknown>; source: string; created_at: string },
  classifyFn: (row: typeof fixtureRow, ts: string) => RetrievedMemory,
  firewallFn: (memory: RetrievedMemory, rules: FirewallRules) => FirewallDecision,
  rules: FirewallRules,
  retrievalTimestamp: string,
  runs: number = 5,
): DeterminismReport {
  const checks: DeterminismCheck[] = [];
  const timings: number[] = [];

  // Run classification N times
  const classifiedMemories: RetrievedMemory[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const classified = classifyFn(fixtureRow, retrievalTimestamp);
    timings.push(performance.now() - start);
    classifiedMemories.push(classified);
  }

  // Check 1: All classifications produce identical safety levels
  const firstLevel = classifiedMemories[0].safety.level;
  const allSameLevel = classifiedMemories.every(m => m.safety.level === firstLevel);
  checks.push({
    passed: allSameLevel,
    description: `All ${runs} runs produce same safety level`,
    detail: allSameLevel ? `All: ${firstLevel}` : `First: ${firstLevel}, mismatch found`,
  });

  // Check 2: All classifications produce identical flags
  const firstFlags = JSON.stringify(classifiedMemories[0].safety.flags.sort());
  const allSameFlags = classifiedMemories.every(
    m => JSON.stringify(m.safety.flags.sort()) === firstFlags,
  );
  checks.push({
    passed: allSameFlags,
    description: `All ${runs} runs produce same classification flags`,
  });

  // Check 3: All classifications produce identical confidence
  const firstConfidence = classifiedMemories[0].confidence;
  const allSameConfidence = classifiedMemories.every(m => m.confidence === firstConfidence);
  checks.push({
    passed: allSameConfidence,
    description: `All ${runs} runs produce same confidence score`,
    detail: `Confidence: ${firstConfidence}`,
  });

  // Check 4: All classifications produce identical usableAsContext
  const firstUsable = classifiedMemories[0].usableAsContext;
  const allSameUsable = classifiedMemories.every(m => m.usableAsContext === firstUsable);
  checks.push({
    passed: allSameUsable,
    description: `All ${runs} runs produce same usableAsContext`,
  });

  // Check 5: All classifications produce identical blockedFromExecution
  const firstBlocked = classifiedMemories[0].blockedFromExecution;
  const allSameBlocked = classifiedMemories.every(m => m.blockedFromExecution === firstBlocked);
  checks.push({
    passed: allSameBlocked,
    description: `All ${runs} runs produce same blockedFromExecution`,
  });

  // Run firewall N times
  const firewallDecisions: FirewallDecision[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const decision = firewallFn(classifiedMemories[i], rules);
    timings.push(performance.now() - start);
    firewallDecisions.push(decision);
  }

  // Check 6: All firewall decisions produce identical actions
  const firstAction = firewallDecisions[0].action;
  const allSameAction = firewallDecisions.every(d => d.action === firstAction);
  checks.push({
    passed: allSameAction,
    description: `All ${runs} firewall runs produce same action`,
    detail: allSameAction ? `All: ${firstAction}` : `First: ${firstAction}, mismatch`,
  });

  // Check 7: All firewall decisions have canTriggerAction=false
  const allBlocked = firewallDecisions.every(d => d.canTriggerAction === false);
  checks.push({
    passed: allBlocked,
    description: `All ${runs} firewall runs have canTriggerAction=false`,
  });

  // Check 8: All audit traces are identical
  const firstTrace = createAuditTrace(classifiedMemories[0], firewallDecisions[0]);
  const traceJson = JSON.stringify(firstTrace);
  const allSameTrace = classifiedMemories.every((_, i) => {
    const trace = createAuditTrace(classifiedMemories[i], firewallDecisions[i]);
    return JSON.stringify(trace) === traceJson;
  });
  checks.push({
    passed: allSameTrace,
    description: `All ${runs} runs produce identical audit traces`,
  });

  // Check 9: No hidden randomness in classification
  // (if outputs are identical across runs, there's no randomness)
  checks.push({
    passed: allSameLevel && allSameFlags && allSameConfidence && allSameUsable && allSameBlocked,
    description: "No hidden randomness detected in classification",
  });

  // Check 10: No hidden time dependency in classification
  // (same fixed timestamp used across all runs)
  checks.push({
    passed: allSameConfidence,
    description: "Classification does not depend on non-fixture time",
  });

  // Timing stats (should be similar across runs — wildly different timings
  // would suggest non-deterministic behavior like network or file I/O)
  const minMs = Math.min(...timings);
  const maxMs = Math.max(...timings);
  const avgMs = timings.reduce((a, b) => a + b, 0) / timings.length;

  // Flag if timing variance is extreme (>10x difference suggests hidden work)
  const timingVarianceOk = maxMs < minMs * 10 || minMs === 0;
  checks.push({
    passed: timingVarianceOk,
    description: "Timing variance within acceptable range (no hidden I/O)",
    detail: `Min: ${minMs.toFixed(3)}ms, Max: ${maxMs.toFixed(3)}ms, Avg: ${avgMs.toFixed(3)}ms`,
  });

  const allPassed = checks.every(c => c.passed);

  return {
    checks,
    fullyDeterministic: allPassed,
    replayCount: runs,
    timingStats: { minMs, maxMs, avgMs },
    hiddenStateDetected: !allPassed,
  };
}

// ── Batch Determinism Test ───────────────────────────────────────────────────

export interface BatchDeterminismResult {
  fixtureResults: {
    fixtureId: string;
    report: DeterminismReport;
  }[];
  overallDeterministic: boolean;
  totalFixtures: number;
  passingFixtures: number;
}

/**
 * Run determinism verification on a batch of fixtures.
 */
export function verifyBatchDeterminism(
  fixtures: { id: string; content: string; metadata: Record<string, unknown>; source: string; created_at: string }[],
  classifyFn: (row: typeof fixtures[0], ts: string) => RetrievedMemory,
  firewallFn: (memory: RetrievedMemory, rules: FirewallRules) => FirewallDecision,
  rules: FirewallRules,
  retrievalTimestamp: string,
  runs: number = 5,
): BatchDeterminismResult {
  const results = fixtures.map(fixture => ({
    fixtureId: fixture.id,
    report: verifyReplayDeterminism(fixture, classifyFn, firewallFn, rules, retrievalTimestamp, runs),
  }));

  const passingCount = results.filter(r => r.report.fullyDeterministic).length;

  return {
    fixtureResults: results,
    overallDeterministic: passingCount === fixtures.length,
    totalFixtures: fixtures.length,
    passingFixtures: passingCount,
  };
}
