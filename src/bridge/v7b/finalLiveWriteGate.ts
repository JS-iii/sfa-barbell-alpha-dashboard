/**
 * Final Live-Write Gate v7B.0.2
 *
 * The ultimate gate before any v7B.1 canary write. Orchestrates all
 * guard layers and always returns blocked in v7B.0.2.
 *
 * Gate order:
 *   1. Kill switch check
 *   2. Authorization gate (v7B.1)
 *   3. Credential preflight
 *   4. Governed state guard
 *   5. Network write guard
 *   6. Canary RC packet validation
 *   7. Operator signoff check
 *   8. Disabled adapter (final catch-all)
 */

import type { CanaryRCPacket } from "./canaryRCPacket";
import { verifyPacketHash, hasOperatorSignoff, isPacketStale } from "./canaryRCPacket";

export interface FinalGateResult {
  /** Whether the write would be allowed */
  allowed: boolean;

  /** Which layer blocked (if blocked) */
  blockedBy?: string;

  /** Human-readable reason */
  reason: string;

  /** All layer results */
  layers: LayerResult[];
}

export interface LayerResult {
  name: string;
  passed: boolean;
  reason: string;
}

/**
 * Run the final live-write gate against a canary RC packet.
 *
 * v7B.0.2: Always returns allowed=false.
 */
export function runFinalLiveWriteGate(packet: CanaryRCPacket): FinalGateResult {
  const layers: LayerResult[] = [];

  // Layer 1: Kill switch
  const killSwitchEnv = process.env.OPENBRAIN_WRITE_DISABLED;
  const killSwitchBlocked = killSwitchEnv === "true" || killSwitchEnv === undefined || killSwitchEnv === "";
  layers.push({
    name: "kill_switch",
    passed: !killSwitchBlocked,
    reason: killSwitchBlocked ? "Kill switch is fail-closed" : "Kill switch allows writes",
  });

  // Layer 2: v7B.1 authorization
  layers.push({
    name: "v7b1_authorization",
    passed: false,
    reason: "v7B.1 is NOT AUTHORIZED. Live writes blocked by v7B.0.2 scaffold.",
  });

  // Layer 3: Credential preflight
  const credVars = ["OPENBRAIN_API_KEY", "SUPABASE_KEY", "SUPABASE_SERVICE_KEY"];
  const credsDetected = credVars.filter((v) => process.env[v] && process.env[v].trim() !== "");
  layers.push({
    name: "credential_preflight",
    passed: credsDetected.length === 0,
    reason: credsDetected.length > 0 ? `Credentials detected: ${credsDetected.join(", ")}` : "No credentials detected",
  });

  // Layer 4: Governed state guard
  const hasGovernedState = JSON.stringify(packet).toLowerCase().includes('"governed_state":true');
  layers.push({
    name: "governed_state_guard",
    passed: !hasGovernedState,
    reason: hasGovernedState ? "Governed state detected in packet" : "No governed state",
  });

  // Layer 5: Network write guard
  layers.push({
    name: "network_write_guard",
    passed: false,
    reason: "Network writes blocked by v7B.0.2 scaffold",
  });

  // Layer 6: Packet hash integrity
  const hashValid = verifyPacketHash(packet);
  layers.push({
    name: "packet_hash_integrity",
    passed: hashValid,
    reason: hashValid ? "Packet hash verified" : "Packet hash mismatch — tampering detected",
  });

  // Layer 7: Operator signoff
  const signed = hasOperatorSignoff(packet);
  layers.push({
    name: "operator_signoff",
    passed: signed,
    reason: signed ? "Operator has signed" : "Operator signoff missing",
  });

  // Layer 8: Packet staleness
  const stale = isPacketStale(packet);
  layers.push({
    name: "packet_freshness",
    passed: !stale,
    reason: stale ? "Packet is stale (>24h)" : "Packet is fresh",
  });

  // Determine outcome (v7B.0.2: always blocked)
  const firstFailure = layers.find((l) => !l.passed);
  return {
    allowed: false,
    blockedBy: firstFailure?.name || "v7b02_scaffold",
    reason: firstFailure
      ? `Blocked by ${firstFailure.name}: ${firstFailure.reason}`
      : "Blocked by v7B.0.2 scaffold (all layers passed but v7B.1 not authorized)",
    layers,
  };
}

/**
 * Check if the final gate would allow a write.
 *
 * v7B.0.2: Always false.
 */
export function isFinalGateAllowing(): boolean {
  return false;
}
