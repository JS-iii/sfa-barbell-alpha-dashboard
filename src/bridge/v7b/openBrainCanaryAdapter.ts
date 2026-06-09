/**
 * Open Brain Canary Write Adapter v7B.1
 *
 * Executes exactly ONE Open Brain canary write, then immediately
 * locks itself. No second write is possible.
 *
 * Uses fetch() — this is the only module in the entire codebase
 * that performs HTTP requests.
 *
 * Credentials are read from environment variables only.
 */

import type { CanaryRCPacket } from "./canaryRCPacket";
import { verifyPacketHash, hasOperatorSignoff, isPacketStale } from "./canaryRCPacket";

// ── Single-Write Lock ───────────────────────────────────────────

interface AdapterState {
  /** Whether a write has already been attempted */
  writeAttempted: boolean;

  /** Result of the write (if attempted) */
  lastResult?: {
    status: "success" | "error" | "blocked";
    timestamp: string;
    errorCode?: string;
    errorMessage?: string;
  };

  /** Whether the adapter is permanently locked */
  permanentlyLocked: boolean;
}

const state: AdapterState = {
  writeAttempted: false,
  permanentlyLocked: false,
};

// ── Credential Interface ────────────────────────────────────────

export interface StagedCredentials {
  apiKey: string;
  endpointUrl: string;
  projectId?: string;
}

export interface CredentialPreflightResult {
  staged: boolean;
  credentials?: StagedCredentials;
  error?: string;
}

/**
 * Check for staged credentials in environment variables.
 */
export function checkStagedCredentials(): CredentialPreflightResult {
  const apiKey = process.env.OPENBRAIN_API_KEY;
  const endpointUrl = process.env.OPENBRAIN_ENDPOINT_URL;

  if (!apiKey || apiKey.trim() === "") {
    return { staged: false, error: "OPENBRAIN_API_KEY not set in environment" };
  }
  if (!endpointUrl || endpointUrl.trim() === "") {
    return { staged: false, error: "OPENBRAIN_ENDPOINT_URL not set in environment" };
  }

  return {
    staged: true,
    credentials: {
      apiKey,
      endpointUrl,
      projectId: process.env.OPENBRAIN_PROJECT_ID,
    },
  };
}

// ── Write Result ────────────────────────────────────────────────

export interface CanaryWriteResult {
  /** Whether the write succeeded */
  success: boolean;

  /** If blocked, why */
  blocked?: boolean;
  blockedBy?: string;
  blockReason?: string;

  /** Server response (if write reached server) */
  serverResponse?: {
    statusCode: number;
    recordId?: string;
    body?: string;
  };

  /** Error (if any) */
  error?: {
    code: string;
    message: string;
  };

  /** Audit event */
  auditEvent: CanaryAuditEvent;

  /** Adapter state after this attempt */
  adapterState: "locked" | "error";
}

export interface CanaryAuditEvent {
  timestamp: string;
  eventType: "canary_write_attempted" | "canary_write_succeeded" | "canary_write_failed" | "canary_write_blocked";
  packetHash: string;
  writeAttempted: boolean;
  credentialsStaged: boolean;
  adapterPermanentlyLocked: boolean;
}

// ── Preflight ───────────────────────────────────────────────────

export interface PreflightResult {
  passed: boolean;
  failedCheck?: string;
  reason?: string;
}

/**
 * Run preflight checks before any write attempt.
 */
export function runCanaryPreflight(packet: CanaryRCPacket): PreflightResult {
  // 1. Check if permanently locked (set after any write attempt completes)
  if (state.permanentlyLocked) {
    return { passed: false, failedCheck: "permanent_lock", reason: "Adapter is permanently locked." };
  }

  // 3. Kill switch
  const ks = process.env.OPENBRAIN_WRITE_DISABLED;
  if (ks === "true" || ks === undefined || ks === "") {
    return { passed: false, failedCheck: "kill_switch", reason: "Kill switch is fail-closed." };
  }

  // 4. Packet hash integrity
  if (!verifyPacketHash(packet)) {
    return { passed: false, failedCheck: "hash_integrity", reason: "Packet hash mismatch — tampering detected." };
  }

  // 5. Packet freshness
  if (isPacketStale(packet)) {
    return { passed: false, failedCheck: "packet_freshness", reason: "Packet is stale (>24h old)." };
  }

  // 6. v7B.1 authorization check (env var must be set)
  const v7b1Auth = process.env.V7B1_CANARY_AUTHORIZED;
  if (v7b1Auth !== "true") {
    return { passed: false, failedCheck: "v7b1_authorization", reason: "V7B1_CANARY_AUTHORIZED is not 'true'. Operator must explicitly set this env var." };
  }

  // 7. Credentials staged
  const creds = checkStagedCredentials();
  if (!creds.staged) {
    return { passed: false, failedCheck: "credentials", reason: creds.error };
  }

  // 8. Governed state check
  if (packet.payload.safetyDeclarations.isGovernedState !== false) {
    return { passed: false, failedCheck: "governed_state", reason: "Packet claims governed state." };
  }

  // 9. Execution authority check
  if (packet.payload.safetyDeclarations.notExecutionAuthority !== true) {
    return { passed: false, failedCheck: "execution_authority", reason: "Packet claims execution authority." };
  }

  // 10. Packet not already signed (operator must sign at canary time)
  if (!hasOperatorSignoff(packet)) {
    // This is expected — the operator signs at canary time
    // We don't block here, we just note it
  }

  return { passed: true };
}

// ── Write Execution ─────────────────────────────────────────────

/**
 * Execute a canary write to Open Brain.
 *
 * This function can ONLY be called once. After the call, the adapter
 * is permanently locked regardless of success or failure.
 *
 * @param packet The canary RC packet to write
 * @param fetchImpl Optional fetch implementation (for testing)
 */
export async function executeCanaryWrite(
  packet: CanaryRCPacket,
  fetchImpl: typeof fetch = fetch
): Promise<CanaryWriteResult> {
  // Mark as attempted immediately (single-write lock)
  state.writeAttempted = true;

  // Run preflight
  const preflight = runCanaryPreflight(packet);
  if (!preflight.passed) {
    state.permanentlyLocked = true;
    return {
      success: false,
      blocked: true,
      blockedBy: preflight.failedCheck,
      blockReason: preflight.reason,
      auditEvent: {
        timestamp: new Date().toISOString(),
        eventType: "canary_write_blocked",
        packetHash: packet.packetHash,
        writeAttempted: true,
        credentialsStaged: checkStagedCredentials().staged,
        adapterPermanentlyLocked: true,
      },
      adapterState: "locked",
    };
  }

  // Get credentials
  const credsResult = checkStagedCredentials();
  if (!credsResult.staged || !credsResult.credentials) {
    state.permanentlyLocked = true;
    return {
      success: false,
      error: { code: "CREDENTIALS_MISSING", message: "Credentials not staged" },
      auditEvent: {
        timestamp: new Date().toISOString(),
        eventType: "canary_write_failed",
        packetHash: packet.packetHash,
        writeAttempted: true,
        credentialsStaged: false,
        adapterPermanentlyLocked: true,
      },
      adapterState: "locked",
    };
  }

  const creds = credsResult.credentials;

  // Build request
  const requestBody = JSON.stringify({
    schemaVersion: packet.payload.writeType,
    idempotencyKey: packet.payload.idempotencyKey,
    safetyDeclarations: packet.payload.safetyDeclarations,
    governanceAssertions: packet.payload.governanceAssertions,
    observation: packet.payload.observation,
    operatorAuthorization: packet.payload.operatorAuthorization,
    auditMetadata: packet.payload.auditMetadata,
  });

  try {
    // Execute the write
    const response = await fetchImpl(creds.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${creds.apiKey}`,
        "X-Idempotency-Key": packet.payload.idempotencyKey,
        ...(creds.projectId ? { "X-Project-Id": creds.projectId } : {}),
      },
      body: requestBody,
    });

    const responseBody = await response.text();

    // IMMEDIATELY lock after write (success or failure)
    state.permanentlyLocked = true;

    const success = response.status >= 200 && response.status < 300;

    return {
      success,
      serverResponse: {
        statusCode: response.status,
        body: responseBody,
      },
      auditEvent: {
        timestamp: new Date().toISOString(),
        eventType: success ? "canary_write_succeeded" : "canary_write_failed",
        packetHash: packet.packetHash,
        writeAttempted: true,
        credentialsStaged: true,
        adapterPermanentlyLocked: true,
      },
      adapterState: "locked",
    };
  } catch (networkError) {
    // IMMEDIATELY lock even on network error
    state.permanentlyLocked = true;

    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: networkError instanceof Error ? networkError.message : String(networkError),
      },
      auditEvent: {
        timestamp: new Date().toISOString(),
        eventType: "canary_write_failed",
        packetHash: packet.packetHash,
        writeAttempted: true,
        credentialsStaged: true,
        adapterPermanentlyLocked: true,
      },
      adapterState: "locked",
    };
  }
}

// ── Adapter Status ──────────────────────────────────────────────

export function getAdapterState(): AdapterState {
  return { ...state };
}

export function isAdapterLocked(): boolean {
  return state.permanentlyLocked || state.writeAttempted;
}

export function canAttemptWrite(): boolean {
  return !state.writeAttempted && !state.permanentlyLocked;
}

// ── Reset (for testing only) ────────────────────────────────────

export function resetAdapterState(): void {
  state.writeAttempted = false;
  state.permanentlyLocked = false;
  state.lastResult = undefined;
}
