/**
 * Network Write Guard v7B.0
 *
 * Blocks all outbound network write attempts. This guard sits between
 * any write request and the actual network layer.
 *
 * In v7B.0, ALL network writes are blocked. No HTTP requests are made.
 */

export interface NetworkWriteGuardResult {
  /** Whether the write would be allowed through */
  allowed: boolean;

  /** If blocked, the reason */
  reason?: string;

  /** The guard that blocked it */
  blockedBy: "v7b0_scaffold" | "kill_switch" | "authorization_gate" | "credential_check" | "allowed";
}

/**
 * Check if a network write would be allowed.
 *
 * v7B.0: Always returns allowed=false with blockedBy="v7b0_scaffold".
 */
export function checkNetworkWriteGuard(): NetworkWriteGuardResult {
  return {
    allowed: false,
    reason: "Network writes are blocked by v7B.0 scaffold. The network write guard is active and will remain so until a future authorized v7B phase.",
    blockedBy: "v7b0_scaffold",
  };
}

/**
 * Attempt to perform a network write.
 *
 * v7B.0: Always blocks. No actual network request is made.
 */
export async function guardedNetworkWrite<T>(
  _writeFn: () => Promise<T>
): Promise<{ success: false; blocked: true; reason: string }> {
  const guard = checkNetworkWriteGuard();
  return {
    success: false,
    blocked: true,
    reason: guard.reason || "Blocked by network write guard",
  };
}

/**
 * Check if network writes are currently allowed.
 *
 * v7B.0: Always false.
 */
export function areNetworkWritesAllowed(): boolean {
  return checkNetworkWriteGuard().allowed;
}
