/**
 * Canary Release Candidate Packet v7B.0.2
 *
 * The exact immutable canary packet that would be used for v7B.1.
 * Includes deterministic SHA-256 hash, operator signoff placeholder,
 * and hardcoded unauthorized status.
 *
 * This packet CANNOT execute in v7B.0.2.
 */

import { createHash } from "crypto";

export interface CanaryRCPacket {
  /** Packet version */
  schemaVersion: "open-brain-canary-rc-v7b02";

  /** When the packet was generated */
  generatedAt: string;

  /** Immutable SHA-256 hash of the canonical serialized packet */
  packetHash: string;

  /** Canonical serialized form (for hash verification) */
  canonicalForm: string;

  /** The canary write payload */
  payload: {
    writeType: "canary";
    idempotencyKey: string;
    safetyDeclarations: {
      notExecutionAuthority: true;
      containsTradeOrders: false;
      containsWalletReferences: false;
      containsExecutionInstructions: false;
      containsCredentials: false;
      isGovernedState: false;
    };
    governanceAssertions: {
      requiresHumanReview: true;
      networkWriteStatus: "canary-write-only";
      v7bAuthorized: false;
    };
    observation: {
      signal: string;
      confidence: number;
      timestamp: string;
      source: "canary-test";
    };
    operatorAuthorization: {
      authorizationId: null;
      authorized: false;
    };
    auditMetadata: {
      requestedAt: string;
      clientVersion: string;
      rehearsalPhase: "v7b02-canary-rc";
    };
  };

  /** Operator signoff placeholder */
  operatorSignoff: {
    signed: false;
    signedAt: null;
    signedBy: null;
    signatureHash: null;
  };

  /** v7B.1 authorization reference (hardcoded unauthorized) */
  v7b1Authorization: {
    authorized: false;
    authorizationId: null;
    authorizedAt: null;
    authorizedBy: null;
  };

  /** Safety invariants at packet generation time */
  invariants: {
    openBrainConnected: false;
    networkWritesEnabled: false;
    credentialsPresent: false;
    executionCapability: false;
    governedStateCreated: false;
    liveWriteAdapterEnabled: false;
    killSwitchState: "fail-closed";
  };
}

/**
 * Recursively sort object keys for deterministic serialization.
 */
function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Compute SHA-256 hash of a canonical JSON string.
 */
function computeHash(canonicalJson: string): string {
  return createHash("sha256").update(canonicalJson).digest("hex");
}

/**
 * Generate a canary release candidate packet.
 *
 * The packet is immutable — its hash is computed at generation time
 * and any tampering invalidates the hash.
 */
export function generateCanaryRCPacket(
  idempotencyKey?: string
): CanaryRCPacket {
  const now = new Date().toISOString();

  // Build payload without hash first
  const payload = {
    writeType: "canary" as const,
    idempotencyKey: idempotencyKey || `canary-rc-${now}`,
    safetyDeclarations: {
      notExecutionAuthority: true as const,
      containsTradeOrders: false as const,
      containsWalletReferences: false as const,
      containsExecutionInstructions: false as const,
      containsCredentials: false as const,
      isGovernedState: false as const,
    },
    governanceAssertions: {
      requiresHumanReview: true as const,
      networkWriteStatus: "canary-write-only" as const,
      v7bAuthorized: false as const,
    },
    observation: {
      signal: "defensive",
      confidence: 0.5,
      timestamp: now,
      source: "canary-test" as const,
    },
    operatorAuthorization: {
      authorizationId: null as null,
      authorized: false as const,
    },
    auditMetadata: {
      requestedAt: now,
      clientVersion: "7.0.0",
      rehearsalPhase: "v7b02-canary-rc" as const,
    },
  };

  // Build the packet structure without hash for canonical form
  const packetWithoutHash = {
    schemaVersion: "open-brain-canary-rc-v7b02" as const,
    generatedAt: now,
    payload,
    operatorSignoff: {
      signed: false as const,
      signedAt: null as null,
      signedBy: null as null,
      signatureHash: null as null,
    },
    v7b1Authorization: {
      authorized: false as const,
      authorizationId: null as null,
      authorizedAt: null as null,
      authorizedBy: null as null,
    },
    invariants: {
      openBrainConnected: false as const,
      networkWritesEnabled: false as const,
      credentialsPresent: false as const,
      executionCapability: false as const,
      governedStateCreated: false as const,
      liveWriteAdapterEnabled: false as const,
      killSwitchState: "fail-closed" as const,
    },
  };

  // Deterministic canonical serialization
  const canonicalForm = JSON.stringify(sortKeys(packetWithoutHash));
  const packetHash = computeHash(canonicalForm);

  return {
    ...packetWithoutHash,
    packetHash,
    canonicalForm,
  };
}

/**
 * Verify a packet's hash matches its content.
 */
export function verifyPacketHash(packet: CanaryRCPacket): boolean {
  const { packetHash: _, canonicalForm: __, ...withoutHashFields } = packet;
  const recomputed = computeHash(
    JSON.stringify(sortKeys(withoutHashFields))
  );
  return recomputed === packet.packetHash;
}

/**
 * Check if a packet is stale (generated > 24h ago).
 */
export function isPacketStale(packet: CanaryRCPacket): boolean {
  const generated = new Date(packet.generatedAt).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  return Date.now() - generated > dayMs;
}

/**
 * Check if operator signoff is present.
 */
export function hasOperatorSignoff(packet: CanaryRCPacket): boolean {
  return packet.operatorSignoff.signed === true;
}
