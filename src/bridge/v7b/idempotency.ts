/**
 * Idempotency Engine v7A.4
 *
 * Local-only idempotency key generation and deduplication tracking.
 * NO network calls. NO credentials.
 *
 * Key binding: idempotency key is bound to payload hash.
 * - Same key + same payload = duplicate (return existing)
 * - Same key + different payload = reject (collision)
 * - Different key = new write
 */

import { createHash } from "crypto";

/** In-memory store for idempotency tracking (resets on process restart) */
const idempotencyStore = new Map<string, string>(); // key → payloadHash

/** Local JSONL persistence path */
const IDEMPOTENCY_LOG_PATH = "data/dry-run/idempotency-log-v7a4.jsonl";

import { appendFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";

function ensureDir(path: string) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Generate a UUID v4 (random) idempotency key.
 */
export function generateIdempotencyKey(): string {
  // UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx where y is 8-9-a-b
  const hex = "0123456789abcdef";
  let uuid = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += "-";
    } else if (i === 14) {
      uuid += "4";
    } else if (i === 19) {
      uuid += hex[8 + Math.floor(Math.random() * 4)]; // 8, 9, a, b
    } else {
      uuid += hex[Math.floor(Math.random() * 16)];
    }
  }
  return uuid;
}

/**
 * Recursively sort object keys for stable JSON serialization.
 */
function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as object).sort()) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Compute SHA-256 hash of a JSON-serializable payload.
 */
export function hashPayload(payload: unknown): string {
  const normalized = JSON.stringify(sortKeys(payload));
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Check idempotency status for a given key and payload.
 *
 * Returns:
 * - "new" — key has not been seen before, proceed with write
 * - "duplicate" — same key + same payload, return existing record
 * - "collision" — same key + different payload, reject
 */
export function checkIdempotency(
  key: string,
  payload: unknown
): { status: "new" | "duplicate" | "collision"; storedHash?: string } {
  const payloadHash = hashPayload(payload);
  const storedHash = idempotencyStore.get(key);

  if (!storedHash) {
    // New key — record it
    idempotencyStore.set(key, payloadHash);
    logIdempotencyEntry(key, payloadHash, "new");
    return { status: "new" };
  }

  if (storedHash === payloadHash) {
    return { status: "duplicate", storedHash };
  }

  return { status: "collision", storedHash };
}

/**
 * Record an idempotency key entry to local log.
 */
function logIdempotencyEntry(
  key: string,
  payloadHash: string,
  result: "new" | "duplicate" | "collision"
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    idempotencyKey: key,
    payloadHash,
    result,
  };
  ensureDir(IDEMPOTENCY_LOG_PATH);
  appendFileSync(IDEMPOTENCY_LOG_PATH, JSON.stringify(entry) + "\n");
}

/**
 * Reset the idempotency store (for testing).
 */
export function resetIdempotencyStore(): void {
  idempotencyStore.clear();
}

/**
 * Get the count of tracked idempotency keys.
 */
export function getIdempotencyCount(): number {
  return idempotencyStore.size;
}
