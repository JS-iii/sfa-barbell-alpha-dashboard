# v7B.3 — Replay Trace Format

## Overview

Every memory retrieval operation produces a deterministic audit trace that can be replayed, inspected, and verified across time without relying on live database access, hidden state, or LLM discretion.

## Trace Structure

```json
{
  "traceId": "<memory-id>-<safety-level>-<firewall-action>-<retrieval-timestamp>",
  "memoryId": "<uuid>",
  "pipelineVersion": "v7B.3.0",
  "classifier": {
    "timestamp": "<iso-timestamp>",
    "input": {
      "id": "<uuid>",
      "contentLength": 147,
      "metadataKeys": ["version", "confidence", "tags"],
      "source": "v7B.1.5-one-approved-write",
      "createdAt": "<iso-timestamp>"
    },
    "classification": {
      "safetyLevel": "advisory_safe | prohibited | trading_sensitive | governance_sensitive | stale | low_confidence | corrupted",
      "flags": [],
      "advisoryOnly": true,
      "confidence": 0.95,
      "usableAsContext": true,
      "blockedFromExecution": false
    },
    "triggeringCheck": null
  },
  "firewall": {
    "timestamp": "<iso-timestamp>",
    "classification": {
      "safetyLevel": "advisory_safe",
      "flags": []
    },
    "decision": {
      "action": "allow | block | quarantine | degrade | exclude",
      "reason": "safe | prohibited | trading | governance | stale | low_confidence | corrupted | unknown",
      "canUseAsContext": true,
      "canTriggerAction": false
    },
    "rulesSnapshot": [
      "blockProhibited:true",
      "quarantineGovernance:true",
      "blockTradingSensitive:true",
      "degradeStale:true",
      "excludeLowConfidence:true",
      "memoryNeverTriggersWrites:true",
      "memoryNeverTriggersPromotions:true",
      "memoryNeverTriggersTrades:true"
    ]
  },
  "output": {
    "action": "allow",
    "usableAsContext": true,
    "blockedFromExecution": false,
    "advisoryPayload": "<content or null>",
    "exclusionReason": null
  },
  "provenance": {
    "originalTimestamp": "<when-memory-was-written>",
    "originalSource": "<source-system>",
    "retrievedAt": "<when-retrieved>",
    "retrievalMethod": "v7B.3-replay-harness",
    "harnessVersion": "v7B.3.0"
  }
}
```

## Determinism Guarantees

1. **Same input → same traceId**: Identical memory rows produce identical trace IDs.
2. **Same input → identical JSON**: Every field is reproducible across replays.
3. **No hidden state**: Classification depends only on content, metadata, and explicit timestamps.
4. **No randomness**: `Math.random()` is never called.
5. **No network**: No `fetch()`, no database queries during classification.
6. **No file I/O**: No `readFileSync`, `writeFileSync` during classification.

## Immutable Guarantees (hardcoded readonly)

```typescript
memoryNeverTriggersWrites: true
memoryNeverTriggersPromotions: true
memoryNeverTriggersTrades: true
```

These are `readonly` properties on the firewall rules object. They cannot be overridden.

## Fixture Set

13 deterministic fixtures covering all 7 classification levels:

| Count | Level | Example |
|-------|-------|---------|
| 3 | `advisory_safe` | v7B.1.5 memory, architecture docs, standup notes |
| 2 | `prohibited` | Credentials, execution authority claim |
| 2 | `trading_sensitive` | Buy BTC, Sell SOL |
| 3 | `governance_sensitive` | Governed state, strategy override, wallet ref |
| 1 | `stale` | 60-day-old document |
| 1 | `low_confidence` | Confidence 0.03 |
| 1 | `corrupted` | Empty content |

## Replay Method

```bash
npm run v7b3:memory-replay-audit-trace
```

Performs 65 total replays (13 fixtures × 5 runs) and verifies bit-for-bit identical outputs.
