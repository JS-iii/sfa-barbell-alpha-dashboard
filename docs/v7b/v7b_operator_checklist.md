# v7B Operator Checklist

**Status:** v7A.3 — Pre-authorization checklist  
**Purpose:** Human operator must complete all items before v7B live write capability can be authorized.  

**Rule:** No item may be skipped. If an item is marked N/A, a justification must be documented.  

---

## Pre-Flight Checks

### Repository State

- [ ] **v7A.2 is sealed** — Tag `sfa-barbell-dashboard-v7a2-review-packet` exists and points to the accepted commit
- [ ] **All v7A.2 checks pass** — `npm run bridge:safety-drill` (17/17), `npm run bridge:review-packet` (25/25), `npm run check`, `npm run build`, `npm run scan:security`
- [ ] **No uncommitted changes** — `git status --short` returns empty
- [ ] **Main branch is clean** — No experimental code on main

### Documentation Review

- [ ] **`docs/v7b/v7b_live_write_readiness.md` reviewed** — Operator has read and understood the readiness spec
- [ ] **`docs/v7b/open_brain_observation_write_contract.md` reviewed** — Operator understands the write request/response contract
- [ ] **`docs/v7b/v7b_threat_model.md` reviewed** — Operator has reviewed threat matrix and accepts residual risks
- [ ] **Threat mitigations accepted** — Operator confirms listed mitigations are sufficient for their risk tolerance
- [ ] **Blast radius understood** — Operator can articulate what an attacker could and could not do

---

## Credential Setup

- [ ] **Open Brain account provisioned** — Account exists with appropriate project
- [ ] **API key generated** — Key has been created with `observation:write` and `observation:read` scope only
- [ ] **API key scope verified** — Confirmed key does NOT have: governed_state:write, execution:approve, admin:*, or any other elevated scope
- [ ] **API key stored in environment** — `OPENBRAIN_API_KEY` is set in the server environment (not in code, not in Git)
- [ ] **`OPENBRAIN_ENDPOINT_URL` configured** — Correct endpoint URL in environment
- [ ] **`OPENBRAIN_PROJECT_ID` configured** — Project ID in environment
- [ ] **No credential files in repository** — Verified with `npm run scan:security` and manual check
- [ ] **Credential rotation calendar set** — 90-day rotation scheduled with reminder

---

## Dry-Run Verification

- [ ] **Dry-run/live parity checked** — `npm run bridge:parity-check` passes (or equivalent manual verification)
- [ ] **v7A dry-run outputs match v7B write shape** — Field-by-field comparison confirms structural identity
- [ ] **Safety declarations verified** — Both dry-run and live write have identical safety declarations
- [ ] **Governance assertions verified** — Both have identical governance boundaries

---

## Human Review Gate

- [ ] **v7A.2 decision ledger has entries** — At least one `accept_for_future_observation_write` decision exists
- [ ] **Decision ledger integrity verified** — `npm run ledger:verify` passes (or manual hash chain check)
- [ ] **Review expiration understood** — Operator knows decisions expire after 7 days
- [ ] **Review workflow documented** — Process for generating review packets and making decisions is written down

---

## Kill Switch & Rollback

- [ ] **`OPENBRAIN_WRITE_DISABLED` env var tested** — Setting it to `"true"` blocks writes (test in staging)
- [ ] **Kill switch documented** — Team knows how to disable writes without code changes
- [ ] **Rollback procedure documented** — Steps to revoke observations are written
- [ ] **Credential rotation procedure tested** — Rotation works in a non-production environment

---

## Monitoring & Alerting

- [ ] **Audit log destination confirmed** — `data/audit/v7b-audit-log.jsonl` directory exists and is writable
- [ ] **Log rotation configured** — Old logs are rotated and retained per policy
- [ ] **Unusual activity alerts defined** — Operator knows what to watch for (frequency spikes, old credentials, scope violations)
- [ ] **Circuit breaker behavior understood** — Operator knows what happens when the circuit opens

---

## Testing

- [ ] **Scope violation test** — Attempting to write forbidden data is rejected
- [ ] **Safety violation test** — Attempting to write with `notExecutionAuthority=false` is rejected
- [ ] **Human review bypass test** — Attempting to write without accept decision is rejected
- [ ] **Expired review test** — Attempting to write with expired decision is rejected
- [ ] **Rate limit test** — Rapid writes trigger rate limiting
- [ ] **Kill switch test** — `OPENBRAIN_WRITE_DISABLED=true` blocks all writes
- [ ] **Credential failure test** — Invalid API key is rejected (use test key)
- [ ] **Idempotency test** — Same idempotency key with same payload returns duplicate, not new record

---

## Operator Authorization

**By signing below, the operator confirms:**

- [ ] All checklist items above are complete (or N/A with documented justification)
- [ ] The threat model has been reviewed and residual risk is accepted
- [ ] The blast radius is understood and acceptable
- [ ] The kill switch is tested and known to the team
- [ ] Rollback procedures are documented and tested
- [ ] This authorization is for **v7B live observation writes only**
- [ ] This authorization does **not** grant execution capability
- [ ] This authorization does **not** enable governed state creation
- [ ] This authorization can be **revoked at any time** by the operator

### Authorization Record

```
Operator Name: ________________________________
Date: ________________________________
Authorization ID: v7b-auth-[YYYY-MM-DD]-[operator-initials]
Valid Until: ________________________________ (recommend 90 days max)
Notes: ________________________________
```

---

## Post-Authorization (After v7B Go-Live)

- [ ] **First write observed** — Confirmed successful write to Open Brain
- [ ] **Audit log shows correct entry** — First write is properly audited
- [ ] **Idempotency verified** — Same payload returns duplicate on retry
- [ ] **Monitoring confirmed** — Alerts are working for the new write path
- [ ] **First decision ledger entry** — Human review decision recorded for first write

---

## Revocation

To revoke v7B authorization at any time:

1. Set `OPENBRAIN_WRITE_DISABLED=true` in environment (immediate stop)
2. Remove or rotate `OPENBRAIN_API_KEY` (permanent stop)
3. Document the revocation reason
4. Update this checklist with revocation date

```
Revocation Date: ________________________________
Revoked By: ________________________________
Reason: ________________________________
```

---

*This checklist must be completed before v7B can be authorized. No exceptions.*
