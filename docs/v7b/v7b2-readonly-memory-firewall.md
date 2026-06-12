# v7B.2 — Read-Only Memory Retrieval + Advisory Context Firewall

## Purpose

Prove that retrieved Open Brain memory can be safely used as advisory context without becoming execution authority, governance mutation, trading instruction, or automatic promotion input.

## Architecture

### Two-Module Design

1. **memoryRetrievalHarness.ts** — Retrieves and classifies memories
2. **advisoryContextFirewall.ts** — Enforces action boundaries on retrieved memories

### Classification Pipeline

Every retrieved memory passes through a 9-point classification engine:

| Check | Failure Result | Level |
|-------|---------------|-------|
| Missing required fields | `corrupted` | Block |
| Contains credentials | `prohibited` | Block |
| Claims execution authority | `prohibited` | Block |
| Contains trade orders | `trading_sensitive` | Block |
| Contains governed state | `governance_sensitive` | Quarantine |
| Strategy override | `governance_sensitive` | Quarantine |
| Wallet references | `governance_sensitive` | Quarantine |
| Stale (>30 days) | `stale` | Degrade |
| Low confidence (<0.1) | `low_confidence` | Exclude |
| All checks pass | `advisory_safe` | Allow |

### Firewall Actions

| Action | Usable as Context | Can Trigger Action |
|--------|-------------------|--------------------|
| `allow` | Yes | **No** |
| `block` | No | **No** |
| `quarantine` | No | **No** |
| `degrade` | Yes (flagged) | **No** |
| `exclude` | No | **No** |

### Immutable Guarantees

These are hardcoded `readonly true` properties on the firewall rules object. They cannot be overridden at runtime:

- `memoryNeverTriggersWrites: true`
- `memoryNeverTriggersPromotions: true`
- `memoryNeverTriggersTrades: true`

## Provenance

Every retrieved memory includes:

- `originalTimestamp` — when the memory was written
- `originalSource` — which system wrote it
- `retrievedAt` — when it was retrieved
- `retrievalMethod` — "v7B.2-readonly-harness"
- `harnessVersion` — "v7B.2.0"

## Constraint Compliance

| Constraint | Status |
|------------|--------|
| No INSERT/UPDATE/DELETE/UPSERT | ✅ Read-only |
| No schema changes | ✅ |
| No recurring jobs | ✅ |
| No auto-promotion | ✅ |
| No LLM-to-write path | ✅ |
| No trading logic changes | ✅ |
| No wallet/provider changes | ✅ |
| No execution claims | ✅ |
| No v7B.3 | ✅ Not authorized |

## Test Results

- **50/50 tests passed**, 0 failed
- 8 sections: advisory-safe, prohibited, trading-sensitive, governance-sensitive, stale/low-confidence, firewall rules, immutable guarantees, provenance

## Seal

- Commit: `fcb77a0` (base) → v7B.2 commit
- Tag: `sfa-barbell-dashboard-v7b2-readonly-memory-firewall`
