# v7B Live Write Readiness Specification

**Status:** v7A.3 — Readiness/Spec Only  
**Phase:** Pre-v7B design documentation. No live write capability exists.  
**Seal Tag:** `sfa-barbell-dashboard-v7a3-live-write-readiness`  

---

## Executive Summary

This document specifies the security, operational, and architectural requirements that must be satisfied before **v7B Live Open Brain Observation Write** can be authorized. It defines boundaries without implementing them. No credentials, clients, or network write code is present in this repository.

**Current State (v7A.3):**
- Open Brain connected: `false`
- Network writes: `false`
- Credentials present: `false`
- Execution capability: `false`
- v7B authorized: `false`

---

## 1. Credential Boundary

### 1.1 Server-Side-Only Principle

All Open Brain write credentials **must** reside server-side only. The following rules are non-negotiable:

| Rule | Requirement |
|------|-------------|
| Environment variables only | Credentials read from `process.env` at runtime |
| Never bundled | No credential strings in source code, bundles, or Git history |
| Never exposed to browser | No client-side API calls to Open Brain |
| No hardcoded defaults | Empty/fallback behavior if env var is missing |
| No logging of values | Credential names may be logged; values must never be |

### 1.2 Required Environment Variable Placeholders

The following environment variable names are reserved for v7B. They are **placeholders only** in v7A.3 — no values exist.

| Variable | Purpose | Required For |
|----------|---------|-------------|
| `OPENBRAIN_API_KEY` | Authentication for observation write endpoint | v7B live write |
| `OPENBRAIN_ENDPOINT_URL` | Base URL for the Open Brain observation API | v7B live write |
| `OPENBRAIN_PROJECT_ID` | Project/org identifier for routing | v7B live write |

**v7A.3 status:** These variables are not read by any code. They exist only in this document.

### 1.3 Credential Rotation

- Rotation period: 90 days maximum
- Rotation procedure: generate new key → deploy → verify write → revoke old key
- Old key must be revoked within 24 hours of new key activation
- Rotation events logged to audit trail

---

## 2. Write Scope Boundary

### 2.1 Allowed Write Scope

The v7B write client may **only** write the following data shape:

```
OpenBrainObservationWriteRequest {
  schemaVersion: "open-brain-observation-write-v7b"
  idempotencyKey: string           // UUID v4, unique per write attempt
  observationDraft: {              // Must match v7A draft exactly
    ...OpenBrainObservationDraft   // From src/bridge/types.ts
  }
  safetyDeclarations: {            // Redundant with draft, required at top level
    notExecutionAuthority: true
    containsTradeOrders: false
    containsWalletReferences: false
    containsExecutionInstructions: false
    containsCredentials: false
  }
  governanceAssertions: {          // Redundant with draft, required at top level
    requiresHumanReview: true
    isGovernedState: false
    networkWriteStatus: "dry-run-local-only" | "v7b-live-write"
  }
  humanReviewReference: {          // Links back to v7A.2 decision ledger
    decision: "accept_for_future_observation_write"
    ledgerEntryTimestamp: string
    reviewerIdentity: string       // Who reviewed (not authenticated, advisory)
  }
  auditMetadata: {
    requestedAt: string            // ISO-8601 UTC
    clientVersion: string          // sfa-barbell-dashboard version
    generatorCommit: string        // Git commit of snapshot generator
    sourceSnapshotHash: string     // Hash of source AlphaSnapshot
  }
}
```

### 2.2 Forbidden Write Scope

The v7B write client **must never** write or mutate the following:

| Forbidden Scope | Reason |
|----------------|--------|
| `governed_state` records | Would bypass human review for state promotion |
| Execution policy documents | Would authorize trading/execution |
| Trade instructions or orders | Out of scope; execution capability does not exist |
| Strategy approval records | Would auto-approve investment strategies |
| Risk control mutations | Would alter risk thresholds without human approval |
| User identity or auth records | Would modify access control |
| Historical observation rewrites | Observations are append-only; no updates or deletes |
| Bulk writes without per-item validation | Each observation must be individually validated |

### 2.3 Scope Enforcement

- Validation function must check `safetyDeclarations` and `governanceAssertions` before any network call
- Any deviation from allowed scope blocks the write (fail-closed)
- The write function returns a `ScopeViolationError` if forbidden fields are detected

---

## 3. Idempotency Design

### 3.1 Idempotency Key Generation

```
idempotencyKey = uuidv4()  // Generated once per write attempt
```

- UUID v4 (random), not v1 (timestamp-based, predictable)
- Stored in the local audit log before the network call
- Passed in the `Idempotency-Key` header (or equivalent)
- Same key + same payload = server returns existing record (no duplicate)

### 3.2 Idempotency Window

- Server-side retention: 24 hours minimum
- After window expires: new write with same key is treated as new request
- Client must generate new UUID for intentional re-writes

### 3.3 Client-Side Idempotency Log

```javascript
interface IdempotencyLogEntry {
  idempotencyKey: string;
  requestedAt: string;
  payloadHash: string;         // SHA-256 of normalized payload
  serverResponse: "success" | "duplicate" | "error" | "timeout";
  serverRecordId?: string;     // Returned by server on success
}
```

---

## 4. Replay Protection

### 4.1 Threat: Replay Attack

An attacker intercepts a valid observation write request and replays it to create duplicate observations.

### 4.2 Mitigations

| Mitigation | Implementation |
|-----------|----------------|
| Timestamp window | Reject writes with `requestedAt` > 5 minutes old |
| Idempotency keys | Server deduplicates on key; replays return existing record |
| Payload hash binding | Key is bound to payload hash; different payload = different key |
| Sequence numbers | Optional monotonic sequence per source snapshot |
| TLS in transit | All communication over HTTPS (minimum TLS 1.2) |

### 4.3 Clock Skew Tolerance

- Client clock drift tolerance: ±2 minutes
- Writes outside tolerance window rejected with `clock_skew_error`
- Client must use NTP-synchronized clock

---

## 5. Audit Log Specification

### 5.1 Audit Log Events

Every v7B operation generates an audit log entry:

```javascript
interface AuditLogEntry {
  eventType: "write_request" | "write_success" | "write_duplicate" | "write_error" | "write_timeout" | "credential_rotation" | "scope_violation";
  timestamp: string;            // ISO-8601 UTC
  idempotencyKey: string;       // Links to the write attempt
  clientVersion: string;        // Dashboard version
  sourceSnapshotGeneratedAt: string;
  humanDecisionReference: {
    ledgerEntryTimestamp: string;
    decision: string;
  };
  serverResponse?: {
    statusCode: number;
    recordId?: string;
    errorCode?: string;
    errorMessage?: string;      // Sanitized — no credential leakage
  };
  latencyMs: number;            // Round-trip time
  credentialAgeDays: number;    // Days since credential creation/rotation
}
```

### 5.2 Audit Log Storage

- Local JSONL file (server-side only): `data/audit/v7b-audit-log.jsonl`
- Retention: 90 days minimum
- Access: read-only after write (append-only)
- Backup: daily copy to separate directory

### 5.3 Audit Log Integrity

- Each entry includes a hash of the previous entry (simple chain)
- Tampering with any entry invalidates the chain
- Integrity check command: `npm run audit:verify-chain`

---

## 6. Human Review Dependency

### 6.1 v7A.2 Gate is Mandatory

No observation may be written to Open Brain unless:

1. A v7A.2 ReviewPacket was generated from the observation draft
2. A human reviewer made a decision of `accept_for_future_observation_write`
3. The decision was recorded in the local decision ledger
4. The ledger entry timestamp is included in the write request

### 6.2 Automatic Rejection Without Review

```javascript
// Pseudocode for v7B write function
async function writeObservation(draft) {
  // 1. Verify human review exists
  const decision = await findDecisionForDraft(draft);
  if (!decision || decision.humanDecision !== "accept_for_future_observation_write") {
    return { error: "HUMAN_REVIEW_REQUIRED", message: "No accept decision found in ledger" };
  }

  // 2. Verify safety declarations
  if (!validateSafetyDeclarations(draft)) {
    return { error: "SAFETY_VIOLATION", message: "Safety check failed" };
  }

  // 3. Verify scope
  if (!validateWriteScope(draft)) {
    return { error: "SCOPE_VIOLATION", message: "Write scope check failed" };
  }

  // 4. Write (with idempotency key)
  // ... network call ...
}
```

### 6.3 Review Expiration

- Human review decisions expire after **7 days**
- Expired decisions cannot be used for live writes
- A new review packet must be generated and reviewed

---

## 7. Revocation Plan

### 7.1 Credential Revocation

| Scenario | Action | Timeline |
|----------|--------|----------|
| Suspected credential leak | Revoke immediately, disable writes | < 5 minutes |
| Routine rotation | Generate new key, deploy, test, revoke old | < 1 hour |
| Employee/offboarding | Rotate credentials for all involved systems | < 24 hours |
| Security incident | Full credential audit + rotation + incident report | < 4 hours |

### 7.2 Write Revocation

- If a specific observation write must be revoked, the mechanism is **server-side deletion/mark-as-revoked**
- The client cannot delete directly; revocation request goes through Open Brain support/API
- Revocation events are logged to the audit trail

### 7.3 Feature Kill Switch

```javascript
// Emergency kill switch (env var)
if (process.env.OPENBRAIN_WRITE_DISABLED === "true") {
  return { error: "WRITE_DISABLED_BY_OPERATOR", message: "Open Brain writes are disabled" };
}
```

- Setting `OPENBRAIN_WRITE_DISABLED=true` blocks all writes without code changes
- Checked at the entry point of every write function
- Default: not set (writes enabled only when v7B is active)

---

## 8. Failure Modes

### 8.1 Failure Classification

| Code | Description | Client Action | Retry |
|------|-------------|---------------|-------|
| `network_timeout` | Server did not respond within timeout | Log, alert operator | Yes (exponential backoff) |
| `rate_limited` | Too many requests (429) | Log, wait for window | Yes (after window) |
| `auth_failed` | API key invalid or expired | Log CRITICAL, stop writes | No (manual intervention) |
| `scope_violation` | Write payload outside allowed scope | Log, reject permanently | No (fix payload) |
| `clock_skew` | Timestamp too old or future | Sync clock, retry | Yes (after sync) |
| `duplicate` | Idempotency key already used | Log as success (idempotent) | No (already written) |
| `server_error` | 5xx from server | Log, alert operator | Yes (limited retries) |
| `validation_failed` | Schema validation failed on server | Log, fix payload | No (fix payload) |

### 8.2 Retry Policy

```javascript
const RETRY_POLICY = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: ["network_timeout", "rate_limited", "server_error"],
};
```

### 8.3 Circuit Breaker

- After 5 consecutive failures: circuit opens (no writes for 60 seconds)
- After 10 consecutive failures: circuit opens (no writes for 300 seconds)
- Manual reset required after 20 consecutive failures
- All circuit breaker events logged to audit trail

---

## 9. Rollback Plan

### 9.1 Rollback Triggers

| Trigger | Action |
|---------|--------|
| Unauthorized observation written | Revoke via server API, audit log the revocation |
| Credential compromise | Rotate credentials, review all writes in last 24h |
| Schema mismatch | Stop writes, fix schema, re-validate, resume |
| Operator request | Set `OPENBRAIN_WRITE_DISABLED=true` |

### 9.2 Rollback Verification

After any rollback action:
1. Verify no new writes are occurring (audit log check)
2. Verify credential state (rotation confirmation)
3. Verify affected observations are marked correctly
4. Document the incident

---

## 10. Dry-Run / Live Parity

### 10.1 Parity Requirement

The v7B live write payload **must** be identical in structure to the v7A dry-run output. The only difference is the `networkWriteStatus` field:

| Phase | `networkWriteStatus` | Destination |
|-------|---------------------|-------------|
| v7A dry-run | `dry-run-local-only` | Local JSONL file |
| v7B live write | `v7b-live-write` | Open Brain API endpoint |

### 10.2 Parity Verification

Before v7B authorization:
1. Generate 10+ observation drafts via v7A dry-run
2. For each draft, simulate the v7B write payload (without sending)
3. Compare field-by-field with the dry-run output
4. Any mismatch blocks v7B authorization

### 10.3 Parity Test Command

```bash
npm run bridge:parity-check
```

This command (to be implemented in v7B) validates that dry-run and live payloads are structurally identical.

---

## 11. Rate Limiting

### 11.1 Client-Side Rate Limits

| Limit | Value | Purpose |
|-------|-------|---------|
| Max writes per minute | 6 | Prevent accidental floods |
| Max writes per hour | 60 | Reasonable observation frequency |
| Max writes per day | 288 | One every 5 minutes average |
| Burst limit | 3 writes in 10 seconds | Handle legitimate bursts |

### 11.2 Rate Limit Enforcement

- Token bucket algorithm on client side
- Exceeded limits: write queued or rejected with `rate_limited`
- All rate limit events logged to audit trail

---

## 12. Least-Privilege Principle

### 12.1 API Key Scope

The Open Brain API key used for v7B must have **only** these permissions:

- `observation:write` — Append observation records
- `observation:read` — Read own observations (for idempotency checks)

### 12.2 Forbidden Permissions

The API key **must not** have:

- `governed_state:write`
- `execution:approve`
- `strategy:mutate`
- `risk_control:mutate`
- `user:manage`
- `admin:*`

### 12.3 Scope Verification

Before v7B go-live: verify key permissions via API and document the result.

---

## 13. Access Control Expectations

### 13.1 Row-Level Security (RLS) — Supabase/Open Brain

If the Open Brain storage backend supports RLS or equivalent:

- Each observation record must be scoped to the `OPENBRAIN_PROJECT_ID`
- No cross-project data access
- Service role key must not be used for write operations
- Write operations use the scoped API key only

### 13.2 Data Retention

- Observations: retained indefinitely (append-only audit trail)
- Audit logs: 90 days local, longer on server if available
- Decision ledger: retained indefinitely (governance evidence)

### 13.3 Encryption

- In transit: TLS 1.2+ (HTTPS)
- At rest: server-side encryption (provider-managed)
- Client-side: no credential storage in files

---

## 14. v7A.3 Explicit Statement

**v7A.3 adds no live write capability.**

This document is purely specification. The following do **not** exist in this repository:

- ❌ Open Brain client library or SDK import
- ❌ Supabase client initialization
- ❌ API key values (hardcoded or in env files)
- ❌ `fetch()` or HTTP client calls to Open Brain endpoints
- ❌ Network write functions
- ❌ Credential storage files
- ❌ `OPENBRAIN_API_KEY` or related env var reads in code
- ❌ WebSocket or real-time connection code

v7B will be the phase where these are implemented, and only after:
1. This readiness spec is accepted by the operator
2. The threat model is reviewed
3. The operator checklist is completed and signed off
4. Explicit v7B authorization is given

---

*This is a design specification document. Not executable code. No live capability.*
