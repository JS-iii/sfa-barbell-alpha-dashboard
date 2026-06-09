/**
 * Kill Switch Scaffold v7B.0
 *
 * Environment-variable-based kill switch. Default state: DISABLED.
 *
 * Checks OPENBRAIN_WRITE_DISABLED env var:
 * - "true" → writes blocked
 * - unset/any other value → writes still blocked (v7B.0 default)
 *
 * The kill switch can ONLY be "enabled" (writes allowed) in a future
 * authorized v7B phase with explicit operator authorization.
 */

export interface KillSwitchState {
  /** Whether writes are currently allowed */
  writesAllowed: boolean;

  /** Reason for current state */
  reason: string;

  /** Whether the kill switch is explicitly disabled (ready for future enable) */
  explicitlyDisabled: boolean;
}

/**
 * Check the kill switch state.
 *
 * v7B.0: Always returns writesAllowed=false.
 * The kill switch is only considered "off" (writes allowed) if:
 * 1. OPENBRAIN_WRITE_DISABLED is explicitly "false"
 * 2. AND a future authorization gate approves
 */
export function checkKillSwitch(): KillSwitchState {
  const envValue = process.env.OPENBRAIN_WRITE_DISABLED;

  // v7B.0: Default is blocked unless explicitly set to "false"
  // But even "false" requires future authorization, so still blocked
  if (envValue === "true" || envValue === undefined || envValue === "") {
    return {
      writesAllowed: false,
      reason:
        envValue === "true"
          ? "Kill switch explicitly enabled (OPENBRAIN_WRITE_DISABLED=true)"
          : "Kill switch default: disabled (v7B.0 scaffold). Set OPENBRAIN_WRITE_DISABLED=false and obtain operator authorization to enable.",
      explicitlyDisabled: false,
    };
  }

  // Even if set to "false", v7B.0 still blocks (needs future auth)
  return {
    writesAllowed: false,
    reason: "Kill switch set to allow, but v7B.0 scaffold blocks pending future operator authorization.",
    explicitlyDisabled: true,
  };
}

/**
 * Check if the kill switch would allow writes.
 *
 * v7B.0: Always false.
 */
export function isKillSwitchAllowingWrites(): boolean {
  return checkKillSwitch().writesAllowed;
}

/**
 * Get the kill switch reason string.
 */
export function getKillSwitchReason(): string {
  return checkKillSwitch().reason;
}
