/**
 * Audit Log v7A.4
 *
 * Append-only JSONL audit log with SHA-256 hash chain integrity.
 * Each entry includes the hash of the previous entry, creating a
 * tamper-evident chain.
 *
 * NO network calls. NO credentials.
 */

import { createHash, randomBytes } from "crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { dirname } from "path";

const AUDIT_DIR = "data/dry-run";
const AUDIT_PATH = `${AUDIT_DIR}/v7b-audit-log-v7a4.jsonl`;

function ensureDir(path: string) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/** Genesis hash for the first entry */
const GENESIS_HASH = "0".repeat(64);

/**
 * Audit log entry with hash chain.
 */
export interface AuditLogEntry {
  /** Sequential entry number */
  sequence: number;

  /** ISO-8601 UTC timestamp */
  timestamp: string;

  /** Type of audit event */
  eventType:
    | "write_request"
    | "write_success"
    | "write_duplicate"
    | "write_error"
    | "write_rejected"
    | "scope_violation"
    | "safety_violation"
    | "governance_violation"
    | "human_review_missing"
    | "review_expired"
    | "kill_switch_active"
    | "circuit_breaker_open"
    | "circuit_breaker_close"
    | "idempotency_collision";

  /** Idempotency key of the related write */
  idempotencyKey: string;

  /** Human-readable description */
  description: string;

  /** Simulated server status */
  simulatedStatus: "success" | "duplicate" | "rejected" | "blocked";

  /** SHA-256 hash of this entry's content */
  entryHash: string;

  /** SHA-256 hash of the previous entry (genesis hash for first entry) */
  previousHash: string;

  /** Kill switch state at time of entry */
  killSwitchActive: boolean;

  /** Circuit breaker state at time of entry */
  circuitBreakerState: "closed" | "open" | "half_open";
}

/**
 * Recursively sort object keys for stable JSON serialization.
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
 * Compute the hash of an audit entry.
 */
function hashEntry(entry: Omit<AuditLogEntry, "entryHash">): string {
  const content = JSON.stringify(sortKeys(entry));
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Get the hash of the last entry in the chain, or genesis hash if empty.
 */
function getLastHash(): string {
  if (!existsSync(AUDIT_PATH)) return GENESIS_HASH;
  const lines = readFileSync(AUDIT_PATH, "utf-8")
    .split("\n")
    .filter((l) => l.trim());
  if (lines.length === 0) return GENESIS_HASH;
  const lastEntry = JSON.parse(lines[lines.length - 1]) as AuditLogEntry;
  return lastEntry.entryHash;
}

/**
 * Get the next sequence number.
 */
function getNextSequence(): number {
  if (!existsSync(AUDIT_PATH)) return 1;
  const lines = readFileSync(AUDIT_PATH, "utf-8")
    .split("\n")
    .filter((l) => l.trim());
  return lines.length + 1;
}

/**
 * Append an entry to the audit log.
 */
export function appendAuditEntry(
  eventType: AuditLogEntry["eventType"],
  idempotencyKey: string,
  description: string,
  simulatedStatus: AuditLogEntry["simulatedStatus"],
  killSwitchActive: boolean,
  circuitBreakerState: AuditLogEntry["circuitBreakerState"]
): AuditLogEntry {
  ensureDir(AUDIT_PATH);

  const previousHash = getLastHash();
  const sequence = getNextSequence();

  const entryWithoutHash: Omit<AuditLogEntry, "entryHash"> = {
    sequence,
    timestamp: new Date().toISOString(),
    eventType,
    idempotencyKey,
    description,
    simulatedStatus,
    previousHash,
    killSwitchActive,
    circuitBreakerState,
  };

  const entryHash = hashEntry(entryWithoutHash);

  const entry: AuditLogEntry = {
    ...entryWithoutHash,
    entryHash,
  };

  appendFileSync(AUDIT_PATH, JSON.stringify(entry) + "\n");
  return entry;
}

/**
 * Read all audit log entries.
 */
export function readAuditLog(): AuditLogEntry[] {
  if (!existsSync(AUDIT_PATH)) return [];
  const content = readFileSync(AUDIT_PATH, "utf-8");
  return content
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

/**
 * Verify the integrity of the audit log hash chain.
 *
 * Returns true if the chain is intact, false if tampering is detected.
 */
export function verifyAuditChain(): {
  valid: boolean;
  entriesChecked: number;
  firstBrokenSequence?: number;
  expectedHash?: string;
  actualHash?: string;
} {
  const entries = readAuditLog();
  if (entries.length === 0) {
    return { valid: true, entriesChecked: 0 };
  }

  let previousHash = GENESIS_HASH;

  for (const entry of entries) {
    // Check that previousHash matches the actual previous entry's hash
    if (entry.previousHash !== previousHash) {
      return {
        valid: false,
        entriesChecked: entry.sequence - 1,
        firstBrokenSequence: entry.sequence,
        expectedHash: previousHash,
        actualHash: entry.previousHash,
      };
    }

    // Recompute the entry hash to verify it hasn't been tampered
    const { entryHash, ...entryWithoutHash } = entry;
    const recomputedHash = hashEntry(entryWithoutHash);
    if (recomputedHash !== entryHash) {
      return {
        valid: false,
        entriesChecked: entry.sequence,
        firstBrokenSequence: entry.sequence,
        expectedHash: recomputedHash,
        actualHash: entryHash,
      };
    }

    previousHash = entryHash;
  }

  return { valid: true, entriesChecked: entries.length };
}

/**
 * Reset the audit log (for testing).
 */
export function resetAuditLog(): void {
  // File stays; tests should use fresh file paths or accept append behavior
  // In the CLI we'll handle cleanup
}

/**
 * Get the count of audit log entries.
 */
export function getAuditEntryCount(): number {
  return readAuditLog().length;
}
