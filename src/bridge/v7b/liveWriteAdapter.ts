/**
 * Live Write Adapter v7B.0
 *
 * The interface contract for a future Open Brain live write adapter.
 * The default implementation is DISABLED — it always fails closed.
 *
 * This module defines the shape of a live write adapter but does NOT:
 * - Connect to Open Brain
 * - Use credentials
 * - Perform network writes
 * - Create governed state
 * - Enable execution capability
 *
 * v7B.0 status: Contract/scaffold only. Adapter is disabled.
 */

import type { OpenBrainObservationWriteRequest } from "./writeRequestSchema";
import type { ObservationWriteResponse } from "./writeRequestSchema";

// ── Adapter Interface ───────────────────────────────────────────

export interface LiveWriteAdapter {
  /** Whether the adapter is enabled */
  readonly isEnabled: boolean;

  /** Attempt to write an observation */
  write(request: OpenBrainObservationWriteRequest): Promise<ObservationWriteResponse>;

  /** Check if the adapter is ready to write */
  isReady(): boolean;

  /** Get adapter status */
  getStatus(): AdapterStatus;
}

export interface AdapterStatus {
  enabled: boolean;
  credentialsPresent: boolean;
  killSwitchActive: boolean;
  authorized: boolean;
  networkAvailable: boolean;
  lastError?: string;
}

// ── Disabled Adapter (v7B.0 default) ────────────────────────────

/**
 * The disabled live write adapter.
 *
 * This is the ONLY adapter implementation in v7B.0.
 * It always fails closed with a clear error message.
 */
export class DisabledLiveWriteAdapter implements LiveWriteAdapter {
  readonly isEnabled = false;

  async write(): Promise<ObservationWriteResponse> {
    return {
      status: "error",
      errorCode: "ADAPTER_DISABLED",
      errorMessage:
        "Live write adapter is disabled. " +
        "v7B.0 is contract/scaffold only. " +
        "Operator authorization required to enable.",
      idempotencyKey: "",
      retryable: false,
    };
  }

  isReady(): boolean {
    return false;
  }

  getStatus(): AdapterStatus {
    return {
      enabled: false,
      credentialsPresent: false,
      killSwitchActive: true,
      authorized: false,
      networkAvailable: false,
      lastError: "Adapter disabled by v7B.0 scaffold",
    };
  }
}

// ── Singleton instance ──────────────────────────────────────────

/** The global adapter instance — always disabled in v7B.0 */
const adapterInstance = new DisabledLiveWriteAdapter();

export function getLiveWriteAdapter(): LiveWriteAdapter {
  return adapterInstance;
}

/**
 * Attempt a live write through the adapter.
 *
 * In v7B.0, this ALWAYS fails with ADAPTER_DISABLED.
 */
export async function attemptLiveWrite(
  _request: OpenBrainObservationWriteRequest
): Promise<ObservationWriteResponse> {
  const adapter = getLiveWriteAdapter();
  return adapter.write(_request);
}
