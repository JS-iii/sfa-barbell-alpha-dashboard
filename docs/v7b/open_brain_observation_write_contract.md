# Open Brain Observation Write Contract

**Status:** v7A.3 — Schema/Contract Specification Only  
**Scope:** Defines the exact shape of a v7B observation write request. No network client exists.  

---

## 1. Write Request Schema

### 1.1 Top-Level Structure

```typescript
interface OpenBrainObservationWriteRequest {
  /** Contract version */
  schemaVersion: "open-brain-observation-write-v7b";

  /** Unique idempotency key (UUID v4) */
  idempotencyKey: string;

  /** The observation draft (from v7A bridge) */
  observationDraft: OpenBrainObservationDraft;

  /** Safety declarations (redundant, required for server validation) */
  safetyDeclarations: WriteSafetyDeclarations;

  /** Governance assertions (redundant, required for server validation) */
  governanceAssertions: WriteGovernanceAssertions;

  /** Reference to the human review decision that approved this write */
  humanReviewReference: HumanReviewReference;

  /** Audit metadata */
  auditMetadata: WriteAuditMetadata;
}
```

### 1.2 Safety Declarations

```typescript
interface WriteSafetyDeclarations {
  /** Must always be true */
  notExecutionAuthority: true;

  /** Must always be false */
  containsTradeOrders: false;

  /** Must always be false */
  containsWalletReferences: false;

  /** Must always be false */
  containsExecutionInstructions: false;

  /** Must always be false */
  containsCredentials: false;
}
```

**Validation rule:** If any safety declaration deviates from the required value, the write is rejected with `SAFETY_VIOLATION`.

### 1.3 Governance Assertions

```typescript
interface WriteGovernanceAssertions {
  /** Must always be true */
  requiresHumanReview: true;

  /** Must always be false at write time */
  isGovernedState: false;

  /** "v7b-live-write" for live writes, checked by server */
  networkWriteStatus: "dry-run-local-only" | "v7b-live-write";
}
```

**Validation rule:**
- `requiresHumanReview` must be `true`
- `isGovernedState` must be `false`
- `networkWriteStatus` must be exactly `"v7b-live-write"` for the server to accept

### 1.4 Human Review Reference

```typescript
interface HumanReviewReference {
  /** Must be "accept_for_future_observation_write" */
  decision: "accept_for_future_observation_write";

  /** Timestamp from the decision ledger entry */
  ledgerEntryTimestamp: string;

  /** Advisory identity of the reviewer */
  reviewerIdentity: string;

  /** Whether the decision has expired (> 7 days old) */
  expired: boolean;  // Set by client before sending
}
```

**Validation rule:**
- `decision` must be exactly `"accept_for_future_observation_write"`
- `expired` must be `false`
- `ledgerEntryTimestamp` must be within the last 7 days

### 1.5 Audit Metadata

```typescript
interface WriteAuditMetadata {
  /** When the write was requested (ISO-8601 UTC) */
  requestedAt: string;

  /** Dashboard version */
  clientVersion: string;

  /** Git commit of the snapshot generator */
  generatorCommit: string;

  /** Hash of the source AlphaSnapshot */
  sourceSnapshotHash: string;

  /** Git commit of the bridge code */
  bridgeCommit: string;
}
```

---

## 2. Write Response Schema

### 2.1 Success Response

```typescript
interface ObservationWriteSuccess {
  status: "success";
  recordId: string;           // Server-assigned record ID
  idempotencyKey: string;     // Echoed back
  createdAt: string;          // Server timestamp
  alreadyExisted: boolean;    // True if this was a duplicate (idempotent)
}
```

### 2.2 Error Response

```typescript
interface ObservationWriteError {
  status: "error";
  errorCode:
    | "SAFETY_VIOLATION"
    | "GOVERNANCE_VIOLATION"
    | "SCOPE_VIOLATION"
    | "HUMAN_REVIEW_REQUIRED"
    | "REVIEW_EXPIRED"
    | "AUTH_FAILED"
    | "RATE_LIMITED"
    | "CLOCK_SKEW"
    | "VALIDATION_FAILED"
    | "SERVER_ERROR"
    | "WRITE_DISABLED";
  errorMessage: string;       // Human-readable, safe to log
  idempotencyKey: string;     // Echoed back
  retryable: boolean;         // Whether the client should retry
}
```

### 2.3 Error Code Reference

| Code | Meaning | Retryable |
|------|---------|-----------|
| `SAFETY_VIOLATION` | Safety declarations invalid | No — fix payload |
| `GOVERNANCE_VIOLATION` | Governance assertions invalid | No — fix payload |
| `SCOPE_VIOLATION` | Write scope check failed | No — fix payload |
| `HUMAN_REVIEW_REQUIRED` | No accept decision in ledger | No — get human review |
| `REVIEW_EXPIRED` | Human review decision > 7 days old | No — re-review |
| `AUTH_FAILED` | API key invalid or expired | No — rotate credentials |
| `RATE_LIMITED` | Too many requests | Yes — after window |
| `CLOCK_SKEW` | Timestamp outside tolerance | Yes — sync clock |
| `VALIDATION_FAILED` | Schema validation failed | No — fix payload |
| `SERVER_ERROR` | Server-side error | Yes — limited retries |
| `WRITE_DISABLED` | Kill switch active | No — operator intervention |

---

## 3. Validation Rules

### 3.1 Client-Side Pre-Write Validation (Mandatory)

Before any network call, the client must validate:

```
1. Safety declarations match required values
2. Governance assertions match required values
3. networkWriteStatus === "v7b-live-write"
4. humanReviewReference.decision === "accept_for_future_observation_write"
5. humanReviewReference.expired === false
6. observationDraft matches the v7A contract exactly
7. No forbidden patterns in the payload
8. Idempotency key is valid UUID v4
9. OPENBRAIN_WRITE_DISABLED is not "true"
10. Rate limit bucket has tokens available
```

### 3.2 Server-Side Validation (Expected)

The server should validate:

```
1. API key is valid and has observation:write scope
2. Idempotency key is unique (or maps to same payload)
3. Schema version is recognized
4. Safety declarations match required values
5. Governance assertions match required values
6. Timestamp is within clock skew tolerance
7. Payload size is within limits (< 100KB)
8. Content-type is application/json
```

---

## 4. Scope Enforcement Function

### 4.1 Pseudocode

```typescript
function validateWriteScope(request: OpenBrainObservationWriteRequest): ScopeValidationResult {
  const errors: string[] = [];

  // Safety check
  const safety = request.safetyDeclarations;
  if (safety.notExecutionAuthority !== true) errors.push("notExecutionAuthority must be true");
  if (safety.containsTradeOrders !== false) errors.push("containsTradeOrders must be false");
  if (safety.containsWalletReferences !== false) errors.push("containsWalletReferences must be false");
  if (safety.containsExecutionInstructions !== false) errors.push("containsExecutionInstructions must be false");
  if (safety.containsCredentials !== false) errors.push("containsCredentials must be false");

  // Governance check
  const gov = request.governanceAssertions;
  if (gov.requiresHumanReview !== true) errors.push("requiresHumanReview must be true");
  if (gov.isGovernedState !== false) errors.push("isGovernedState must be false");
  if (gov.networkWriteStatus !== "v7b-live-write") errors.push("networkWriteStatus must be v7b-live-write");

  // Human review check
  const review = request.humanReviewReference;
  if (review.decision !== "accept_for_future_observation_write") errors.push("decision must be accept_for_future_observation_write");
  if (review.expired) errors.push("human review has expired");

  // Forbidden content scan
  const payload = JSON.stringify(request);
  const forbiddenPatterns = [
    /"governed_state":\s*true/,
    /"execute_trade"/,
    /"approve_execution"/,
    /"strategy_approval"/,
    /"risk_control_mutation"/,
    /"historical_rewrite"/,
  ];
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(payload)) errors.push(`Forbidden pattern detected: ${pattern.source}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    wouldCreateGovernedState: gov.isGovernedState === true || safety.notExecutionAuthority !== true,
    wouldEscalateAuthority: safety.notExecutionAuthority !== true || safety.containsTradeOrders === true,
  };
}
```

---

## 5. Dry-Run vs Live Write Comparison

| Aspect | v7A Dry-Run | v7B Live Write |
|--------|-------------|----------------|
| `schemaVersion` | `open-brain-observation-draft-v7a` | `open-brain-observation-write-v7b` |
| `networkWriteStatus` | `dry-run-local-only` | `v7b-live-write` |
| Destination | Local JSONL file | Open Brain API endpoint |
| Idempotency key | Not used | UUID v4 required |
| Human review ref | Not included | Required |
| Safety declarations | In draft | Duplicated at top level |
| Governance assertions | In draft | Duplicated at top level |
| Response | N/A (local file append) | Structured success/error |
| Rate limiting | N/A | Enforced |
| Audit logging | Dry-run log | Full audit trail |

---

## 6. v7A.3 Status

**This contract exists only as documentation and TypeScript interfaces.**

No code imports, instantiates, or sends this request shape. No network client exists.

The interface files in `src/bridge/v7b/` are:
- Type definitions only
- No `fetch()` calls
- no `supabase` imports
- No credential reads
- No environment variable access

---

*This is a contract specification. Not executable code. No live capability.*
