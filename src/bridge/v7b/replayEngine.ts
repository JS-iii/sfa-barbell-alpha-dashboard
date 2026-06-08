/**
 * Replay Engine v7A.5
 *
 * Replays observation packets through the v7A.4 local write simulator.
 * Proves deterministic accept/reject behavior, audit continuity,
 * and boundary enforcement at scale.
 *
 * NO network calls. NO credentials. NO Open Brain client.
 */

import type { OpenBrainObservationWriteRequest } from "./writeRequestSchema";
import {
  simulateWrite,
  createValidWriteRequest,
  resetCircuitBreaker,
  getCircuitBreakerState,
} from "./localWriteSimulator";
import { resetIdempotencyStore } from "./idempotency";
import { verifyAuditChain, readAuditLog } from "./auditLog";
import type { SimulatedWriteResult } from "./localWriteSimulator";

/**
 * A replay packet ready for the simulator.
 */
export interface ReplayPacket {
  /** Descriptive name for the test */
  name: string;

  /** Expected outcome */
  expectedStatus: "success" | "duplicate" | "rejected" | "blocked";

  /** Expected error code (for rejections) */
  expectedErrorCode?: string;

  /** Whether this should create governed state (must be false) */
  expectGovernedState: boolean;

  /** Whether this should authorize execution (must be false) */
  expectExecutionAuthority: boolean;

  /** The write request to replay */
  request: OpenBrainObservationWriteRequest;
}

/**
 * Replay a single packet through the simulator.
 */
export function replayPacket(packet: ReplayPacket): {
  result: SimulatedWriteResult;
  passed: boolean;
  errors: string[];
} {
  const result = simulateWrite(packet.request);
  const errors: string[] = [];

  if (result.status !== packet.expectedStatus) {
    errors.push(
      `Expected status "${packet.expectedStatus}", got "${result.status}"`
    );
  }

  if (
    packet.expectedErrorCode &&
    result.errorCode !== packet.expectedErrorCode
  ) {
    errors.push(
      `Expected errorCode "${packet.expectedErrorCode}", got "${result.errorCode}"`
    );
  }

  if (result.wouldCreateGovernedState !== packet.expectGovernedState) {
    errors.push(
      `wouldCreateGovernedState: expected ${packet.expectGovernedState}, got ${result.wouldCreateGovernedState}`
    );
  }

  if (result.wouldAuthorizeExecution !== packet.expectExecutionAuthority) {
    errors.push(
      `wouldAuthorizeExecution: expected ${packet.expectExecutionAuthority}, got ${result.wouldAuthorizeExecution}`
    );
  }

  return {
    result,
    passed: errors.length === 0,
    errors,
  };
}

/**
 * Replay multiple packets in sequence.
 *
 * Returns aggregate results and verifies audit chain continuity.
 */
export function replaySequence(
  packets: ReplayPacket[],
  options: { resetStateBetweenPackets?: boolean } = {}
): {
  total: number;
  passed: number;
  failed: number;
  auditChainValid: boolean;
  auditEntriesChecked: number;
  circuitBreakerState: string;
  results: SimulatedWriteResult[];
} {
  const results: SimulatedWriteResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const packet of packets) {
    if (options.resetStateBetweenPackets) {
      resetCircuitBreaker();
    }

    const { result, passed: pktPassed, errors } = replayPacket(packet);
    results.push(result);

    if (pktPassed) {
      passed++;
    } else {
      failed++;
      // Log errors for debugging but don't throw
      errors.forEach((e) => console.log(`      [${packet.name}] ${e}`));
    }
  }

  const auditCheck = verifyAuditChain();

  return {
    total: packets.length,
    passed,
    failed,
    auditChainValid: auditCheck.valid,
    auditEntriesChecked: auditCheck.entriesChecked,
    circuitBreakerState: getCircuitBreakerState(),
    results,
  };
}

/**
 * Verify determinism: replaying the same packet twice produces
 * the same outcome (except for recordId and timestamps).
 */
export function verifyDeterminism(packet: ReplayPacket): boolean {
  const result1 = simulateWrite(packet.request);
  const result2 = simulateWrite(packet.request);

  return (
    result1.status === result2.status &&
    result1.errorCode === result2.errorCode &&
    result1.wouldCreateGovernedState === result2.wouldCreateGovernedState &&
    result1.wouldAuthorizeExecution === result2.wouldAuthorizeExecution
  );
}

/**
 * Reset all simulator state for a clean replay session.
 */
export function resetSimulatorState(): void {
  resetCircuitBreaker();
  resetIdempotencyStore();
}

/**
 * Create a replay packet from a write request with expected outcome.
 */
export function createReplayPacket(
  name: string,
  request: OpenBrainObservationWriteRequest,
  expectedStatus: ReplayPacket["expectedStatus"],
  expectedErrorCode?: string
): ReplayPacket {
  return {
    name,
    request,
    expectedStatus,
    expectedErrorCode,
    expectGovernedState: false,
    expectExecutionAuthority: false,
  };
}
