# Canary Write Payload Contract

**Status:** v7B.0.1 — Schema/Contract Only  
**Scope:** Defines the exact shape of a canary write payload. No live write execution.  

---

## 1. Canary Write Request

```typescript
interface CanaryWriteRequest {
  /** Contract version */
  schemaVersion: "open-brain-canary-write-v7b01";

  /** Unique idempotency key */
  idempotencyKey: string;

  /** Must be "canary" */
  writeType: "canary";

  /** Safety declarations */
  safetyDeclarations: {
    notExecutionAuthority: true;
    containsTradeOrders: false;
    containsWalletReferences: false;
    containsExecutionInstructions: false;
    containsCredentials: false;
    isGovernedState: false;
  };

  /** Governance assertions */
  governanceAssertions: {
    requiresHumanReview: true;
    networkWriteStatus: "canary-write-only";
    v7bAuthorized: false;  // Must be false in v7B.0.1
  };

  /** Minimal observation payload */
  observation: {
    signal: string;
    confidence: number;
    timestamp: string;
    source: "canary-test";
  };

  /** Operator authorization reference */
  operatorAuthorization: {
    authorizationId: string | null;  // null in v7B.0.1
    authorized: false;               // false in v7B.0.1
  };

  /** Audit metadata */
  auditMetadata: {
    requestedAt: string;
    clientVersion: string;
    rehearsalPhase: "v7b01-canary-plan";
  };
}
```

## 2. Validation Rules

| Rule | Required Value | Rejection If |
|------|---------------|-------------|
| `writeType` | `"canary"` | Missing or not `"canary"` |
| `notExecutionAuthority` | `true` | `false` |
| `isGovernedState` | `false` | `true` |
| `v7bAuthorized` | `false` | `true` (v7B.0.1) |
| `networkWriteStatus` | `"canary-write-only"` | `"v7b-live-write"` |
| `writeType` | `"canary"` | `"governed_state"`, `"execution"` |
| `operatorAuthorization.authorized` | `false` | `true` (v7B.0.1) |

## 3. Forbidden Content

A canary payload MUST NOT contain:
- `governed_state: true`
- `execute_trade`
- `approve_execution`
- `strategy_approval`
- Wallet addresses or private key references
- Real API keys

---

*This is a contract specification. Not executable code. No live capability.*
