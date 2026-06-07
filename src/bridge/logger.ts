/**
 * Dry-Run JSONL Logger v7A
 *
 * Logs observation drafts locally as JSONL.
 * NO network writes. NO credentials needed.
 *
 * Output: data/dry-run/open-brain-observations-dry-run.jsonl
 */

import { appendFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { DryRunLogEntry } from "./types";

const LOG_DIR = "data/dry-run";
const LOG_PATH = `${LOG_DIR}/open-brain-observations-dry-run.jsonl`;

function ensureDir(path: string) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Append a dry-run log entry as JSONL.
 *
 * This writes to LOCAL FILE ONLY. No network call.
 */
export function logDryRunEntry(entry: DryRunLogEntry): void {
  ensureDir(LOG_PATH);
  appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
}

/**
 * Initialize (or clear) the dry-run log file.
 */
export function initDryRunLog(): void {
  ensureDir(LOG_PATH);
  // Don't clear existing log — append for audit trail
}

/**
 * Read all dry-run log entries.
 */
export function readDryRunLog(): DryRunLogEntry[] {
  if (!existsSync(LOG_PATH)) return [];
  const content = require("fs").readFileSync(LOG_PATH, "utf-8");
  return content
    .split("\n")
    .filter((line: string) => line.trim())
    .map((line: string) => JSON.parse(line));
}
