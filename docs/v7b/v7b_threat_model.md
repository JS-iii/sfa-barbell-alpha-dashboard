# v7B Threat Model

**Status:** v7A.3 — Threat analysis for hypothetical v7B live writes  
**Scope:** Identifies attack vectors, blast radius, and mitigations. No live capability exists.  

---

## 1. Threat Assessment Matrix

| ID | Threat | Severity | Likelihood | Risk |
|----|--------|----------|------------|------|
| T1 | Credential leak (API key exposed) | Critical | Low | High |
| T2 | Replay attack (duplicate writes) | High | Medium | High |
| T3 | Scope escalation (write forbidden data) | Critical | Low | High |
| T4 | Human review bypass (fake accept decision) | Critical | Low | High |
| T5 | Insider abuse (authorized user misbehaves) | High | Low | Medium |
| T6 | Rate limit bypass (flood writes) | Medium | Medium | Medium |
| T7 | Clock skew exploitation (stale timestamp) | Medium | Low | Low |
| T8 | Supply chain (malicious dependency) | High | Low | Medium |
| T9 | Denial of service (server unavailable) | Medium | High | Medium |
| T10 | Data exfiltration (read back observations) | Low | Low | Low |

---

## 2. Threat Details

### T1: Credential Leak (API Key Exposed)

**Description:** The Open Brain API key is accidentally exposed in logs, Git history, environment dumps, or screenshots.

**Blast Radius:**
- Attacker can write observations to Open Brain
- Attacker could attempt scope escalation (blocked by server validation)
- Cannot read other projects' data (key is project-scoped)
- Cannot execute trades (no execution capability exists)

**Mitigations:**
- Server-side only: key never touches browser or client code
- Environment variable: not in source, not in bundles
- Regular rotation: 90-day maximum lifetime
- Audit logging: all write attempts logged with credential age
- No hardcoded defaults: code fails safe if env var missing
- `.gitignore` excludes all env files

**Kill Switch:** Set `OPENBRAIN_WRITE_DISABLED=true` → all writes stop immediately.

**Detection:**
- Monitor for writes from unexpected IP addresses
- Monitor for unusual write frequency
- Alert on writes with old credential age (> 90 days)

---

### T2: Replay Attack (Duplicate Writes)

**Description:** Attacker intercepts a valid write request and replays it to create duplicate observation records.

**Blast Radius:**
- Duplicate observations in Open Brain
- Could skew analysis if duplicates are not deduplicated
- Cannot modify existing observations (append-only)

**Mitigations:**
- UUID v4 idempotency key: server deduplicates on key
- Idempotency key bound to payload hash: different payload = different key
- Timestamp window: rejects writes > 5 minutes old
- Server-side deduplication is the primary defense

**Residual Risk:** Low. Replay creates no new data — server returns existing record.

---

### T3: Scope Escalation (Write Forbidden Data)

**Description:** Attacker crafts a payload attempting to write governed state, execution policies, or other forbidden scope.

**Blast Radius:**
- If server validation fails: write rejected, no damage
- If server validation bypassed: depends on server's own scope enforcement

**Mitigations:**
- Client-side scope validation (first line of defense)
- Explicit forbidden pattern scanning in payload
- Server-side scope validation (critical line of defense)
- Least-privilege API key (only `observation:write` scope)
- Key cannot write governed_state even if payload tries

**Defense in Depth:**
```
Client scope check → Forbidden pattern scan → Server scope check → Server permission check
     (blocks)              (blocks)               (blocks)            (blocks)
```

---

### T4: Human Review Bypass (Fake Accept Decision)

**Description:** Attacker fabricates a human review decision to bypass the v7A.2 promotion gate.

**Blast Radius:**
- Unreviewed observations could be written to Open Brain
- Depends on whether the attacker can also fabricate the ledger entry

**Mitigations:**
- Decision ledger is append-only JSONL with integrity chain
- Ledger entries include cryptographic hash chain
- Tampering with ledger invalidates the chain
- Write request includes ledger entry timestamp
- Server can cross-reference ledger entry existence
- Review expiration: decisions expire after 7 days

**Detection:**
- Verify ledger integrity before writes: `npm run ledger:verify`
- Audit log shows decision source
- Unusual reviewer identities trigger alerts

---

### T5: Insider Abuse (Authorized User Misbehaves)

**Description:** A person with legitimate access to the system intentionally misuses it.

**Blast Radius:**
- Could write observations with fabricated data
- Could approve observations that should be rejected
- Cannot execute trades (no execution capability)
- Cannot escalate to governed state (blocked by safety declarations)

**Mitigations:**
- All decisions logged with reviewer identity
- Audit trail is append-only and integrity-protected
- Principle of least privilege: reviewers can only decide, not execute
- Multi-person review for sensitive decisions (future enhancement)
- Regular audit of decision patterns

---

### T6: Rate Limit Bypass (Flood Writes)

**Description:** System writes too frequently due to bug, misconfiguration, or malicious intent.

**Blast Radius:**
- Server rate limiting kicks in (429 responses)
- Potential cost implications if writes are metered
- Audit log grows rapidly

**Mitigations:**
- Client-side token bucket rate limiter
- Server-side rate limiting
- Circuit breaker after consecutive failures
- Alert on unusual write frequency
- Max writes per day: 288 (one every 5 minutes)

---

### T7: Clock Skew Exploitation

**Description:** Attacker manipulates system clock to pass timestamp validation with stale data.

**Blast Radius:**
- Stale observations written with recent timestamp
- Limited: observation data itself has its own timestamp from snapshot

**Mitigations:**
- Timestamp window: ±2 minutes tolerance
- NTP-synchronized clock required
- `requestedAt` is independent of observation data timestamp
- Server validates timestamp independently

---

### T8: Supply Chain Attack

**Description:** A dependency of the project is compromised and injects malicious code.

**Blast Radius:**
- Depends on which dependency is compromised
- Could potentially exfiltrate credentials or modify write behavior

**Mitigations:**
- `package-lock.json` pinned versions
- `npm audit` runs in CI
- Minimal dependencies for v7B write client
- No unnecessary networking libraries
- All network code is in a single, reviewable file
- Security scan: `npm run scan:security`

---

### T9: Denial of Service (Server Unavailable)

**Description:** Open Brain API is unavailable due to outage, maintenance, or attack.

**Blast Radius:**
- Writes fail temporarily
- No data loss (writes can be retried)

**Mitigations:**
- Exponential backoff retry
- Circuit breaker prevents retry storms
- Failed writes logged locally for later reconciliation
- Queue writes for retry when service recovers
- Graceful degradation: dashboard continues to function

---

### T10: Data Exfiltration (Read Back Observations)

**Description:** Attacker reads observations back from Open Brain.

**Blast Radius:**
- Observation data is not particularly sensitive
- Contains market analysis, not personal data
- No wallet addresses, no PII

**Mitigations:**
- API key has minimal read scope (own observations only)
- Project-scoped: cannot read other projects
- Observations contain no PII, no secrets, no wallet data
- Server-side access controls on read endpoints

---

## 3. Attack Scenarios

### Scenario A: Credential Leak + Immediate Exploitation

```
Attacker finds API key in log file
  → Attempts to write observation
    → Client-side scope check: PASS (attacker crafts valid payload)
      → Server receives write
        → Server validates safety declarations: PASS
          → Server checks API key scope: observation:write only
            → Write succeeds (append-only observation, no harm)
              → Audit log records write with credential age
                → Operator alert: unusual credential age or IP
                  → Operator revokes key, rotates, investigates
```

**Outcome:** Attacker can write observations but cannot escalate scope. Detection via audit alerts.

### Scenario B: Scope Escalation Attempt

```
Attacker crafts payload with governed_state=true
  → Client-side scope check: FAIL
    → Write blocked before network call
      → Error logged: SCOPE_VIOLATION
        → Alert operator
```

**Outcome:** Blocked at client. No network call made.

### Scenario C: Human Review Bypass Attempt

```
Attacker fabricates decision: "accept_for_future_observation_write"
  → Ledger integrity check: FAIL (hash chain broken)
    → Write blocked
      → Error logged: HUMAN_REVIEW_REQUIRED
        → Alert operator
```

**Outcome:** Blocked at client. Ledger tampering is detectable.

---

## 4. Blast Radius Summary

### What an Attacker CAN Do (with full compromise)

- Write observations to Open Brain (append-only, no harm to existing data)
- Create noise in observation stream (detectable via frequency analysis)

### What an Attacker CANNOT Do (enforced by design)

- ❌ Execute trades (no execution capability exists)
- ❌ Create governed state (blocked by safety declarations + server validation)
- ❌ Modify existing observations (append-only system)
- ❌ Read other projects' data (project-scoped key)
- ❌ Bypass human review (ledger integrity check)
- ❌ Escalate API key permissions (server-enforced scopes)
- ❌ Delete observations (no delete scope)
- ❌ Access wallet data (never present in system)

---

## 5. Mitigation Effectiveness

| Control | T1 Cred Leak | T2 Replay | T3 Scope Esc | T4 Review Bypass | T5 Insider | T6 Flood | T7 Clock | T8 Supply | T9 DoS | T10 Exfil |
|---------|:----------:|:---------:|:------------:|:----------------:|:----------:|:--------:|:--------:|:---------:|:------:|:---------:|
| Server-side credentials only | ✅ | — | — | — | — | — | — | — | — | — |
| Idempotency keys | — | ✅ | — | — | — | — | — | — | — | — |
| Client scope validation | — | — | ✅ | — | — | — | — | — | — | — |
| Server scope validation | — | — | ✅ | — | — | — | — | — | — | — |
| Least-privilege key | ✅ | — | ✅ | — | — | — | — | — | — | ✅ |
| Ledger integrity chain | — | — | — | ✅ | — | — | — | — | — | — |
| Review expiration | — | — | — | ✅ | — | — | — | — | — | — |
| Audit logging | ✅ | — | ✅ | ✅ | ✅ | — | — | — | — | — |
| Rate limiting | — | — | — | — | — | ✅ | — | — | ✅ | — |
| Circuit breaker | — | — | — | — | — | ✅ | — | — | ✅ | — |
| Kill switch | ✅ | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| Credential rotation | ✅ | — | — | — | — | — | — | — | — | — |
| NTP sync | — | — | — | — | — | — | ✅ | — | — | — |
| Dependency pinning | — | — | — | — | — | — | — | ✅ | — | — |
| Security scanning | — | — | — | — | — | — | — | ✅ | — | — |

---

## 6. v7A.3 Status

**This threat model is analytical only.** No v7B live write capability exists. All threats in the "v7B" column are hypothetical — they describe what would be at risk *if* v7B were implemented.

Current repository posture:
- No API keys present
- No network clients present
- No write endpoints configured
- No credentials in environment
- All write code is documentation/spec only

---

*This is a threat analysis document. Not executable code. No live capability.*
