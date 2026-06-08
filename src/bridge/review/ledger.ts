/**
 * Decision Ledger v7A.2
 *
 * Local-only JSONL ledger for human review decisions.
 * NO network writes. NO credentials. NO governed state.
 *
 * Output: data/dry-run/decision-ledger-v7a2.jsonl
 * (Note: *.jsonl in data/dry-run/ is gitignored by v7A.1-hygiene)
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import type { DecisionLedgerEntry } from "./types";

const LEDGER_DIR = "data/dry-run";
const LEDGER_PATH = join(LEDGER_DIR, "decision-ledger-v7a2.jsonl");

function ensureDir(path: string) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Append a decision entry to the local ledger.
 *
 * This writes to LOCAL FILE ONLY. No network call.
 */
export function recordDecision(entry: DecisionLedgerEntry): void {
  ensureDir(LEDGER_PATH);
  appendFileSync(LEDGER_PATH, JSON.stringify(entry) + "\n");
}

/**
 * Read all decision ledger entries.
 */
export function readDecisionLedger(): DecisionLedgerEntry[] {
  if (!existsSync(LEDGER_PATH)) return [];
  const content = readFileSync(LEDGER_PATH, "utf-8");
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

/**
 * Get the count of decisions in the ledger.
 */
export function getDecisionCount(): number {
  return readDecisionLedger().length;
}

/**
 * Check if a packet (by generatedAt) already has a recorded decision.
 */
export function hasDecisionForPacket(packetGeneratedAt: string): boolean {
  return readDecisionLedger().some(
    (entry) => entry.packetGeneratedAt === packetGeneratedAt
  );
}

/**
 * Get all decisions for a specific snapshot.
 */
export function getDecisionsForSnapshot(
  snapshotGeneratedAt: string
): DecisionLedgerEntry[] {
  return readDecisionLedger().filter(
    (entry) => entry.sourceSnapshotGeneratedAt === snapshotGeneratedAt
  );
}
