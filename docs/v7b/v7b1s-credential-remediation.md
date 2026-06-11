# v7B.1S: Credential Exposure Remediation Seal

**Phase:** v7B.1S — Post-Canary Credential Exposure Remediation  
**Seal:** `bf24c3d` — `sfa-barbell-dashboard-v7b1-live-canary` (prior)  
**Date:** 2026-06-10  
**Status:** Remediation sealed — no new live writes performed  
**Scope:** Documentation and verification only

---

## 1. Operator Attestation

**Operator confirms:** The exposed Supabase secret key was **deleted/rotated** via the Supabase Dashboard.

**Attestation method:** Verbal confirmation provided to Kimi session.  
**Attestation accepted:** Yes — per operator declaration.

---

## 2. Exposure Summary

| Property | Value |
|----------|-------|
| Exposure type | Supabase `service_role` secret key |
| Exposure vector | Terminal command pasted into chat (not committed to repo) |
| Exposure scope | Chat session only — never reached git history |
| Remediation | Key rotated via Supabase Dashboard |
| Replacement key committed | No |
| Replacement key logged | No |

---

## 3. Comprehensive Credential Scan Results

### Scan 1: Key Fragments in Tracked Files

| Fragment | Status |
|----------|--------|
| `sb_secret` | ✅ Not found |
| `W3Hy66A2` | ✅ Not found |
| `KvR06b9SjvjyTg` | ✅ Not found |
| `rPFrwdFF` | ✅ Not found |
| `bgludgfrbyicqqdkdqds` | ⚠️ Found — public project identifier (not a secret) |

The `bgludgfrbyicqqdkdqds` project reference is intentionally documented in evidence files and the MCP configuration. It is the public project identifier, not a credential.

### Scan 2: Git History

| Fragment | Status |
|----------|--------|
| `sb_secret` | ✅ Not in any commit |
| `W3Hy66A2` | ✅ Not in any commit |
| `KvR06b9SjvjyTg` | ✅ Not in any commit |
| `rPFrwdFF` | ✅ Not in any commit |

**The exposed key never entered the git repository.** The exposure was limited to the chat session only.

### Scan 3: Git Diff / Uncommitted Changes

| Check | Status |
|-------|--------|
| Uncommitted changes | ✅ Clean |
| Cached/staged changes | ✅ Clean |
| Untracked files | ✅ Clean |

### Scan 4: Evidence Files

| File | Key Present |
|------|-------------|
| `docs/v7b/v7b1-live-canary-evidence.json` | ❌ No |
| `docs/v7b/v7b1-live-canary-summary.md` | ❌ No |
| `docs/v7b/v7b1r-live-evidence.json` | ❌ No |
| `docs/v7b/v7b1r-live-summary.md` | ❌ No |
| `docs/v7b/v7b1r_reconnection_audit_report.md` | ❌ No |
| `docs/v7b/v7b1_live_operator_runbook.md` | ❌ No |

### Scan 5: Source Code

| File | Key Present |
|------|-------------|
| `src/bridge/v7b/openBrainCanaryAdapter.ts` | ❌ No |
| `scripts/v7b1-live-canary-execute.mjs` | ❌ No |
| `scripts/v7b1r-live-supabase-audit.mjs` | ❌ No |
| `scripts/bridge-open-brain-canary.mjs` | ❌ No |

---

## 4. Prior v7B.1-Live Canary Classification

| Property | Value |
|----------|-------|
| Network canary attempted | **true** ✅ |
| Endpoint response | **404** (endpoint not configured) |
| Actual Open Brain write | **false** (server rejected with 404) |
| Adapter lockdown | **successful** ✅ |
| Second write blocked | **successful** ✅ |
| Governed state created | false |
| Data written | false |
| Credential exposure | **remediated** ✅ |

**Classification:** The v7B.1-live canary was a **network reachability test** that proved the adapter's single-write + lockdown mechanism works correctly, but it did not result in an actual Open Brain write because the endpoint URL was the Supabase base URL rather than a dedicated write endpoint.

---

## 5. Bridge Suite Results (Post-Remediation)

| Command | Result |
|---------|--------|
| bridge:safety-drill | ✅ 17/17 passed |
| bridge:review-packet | ✅ 17+8 gate passed |
| bridge:write-simulator | ✅ 21/21 passed |
| bridge:replay | ✅ 22/22 passed |
| bridge:replay-dossier | ✅ 24/24 passed |
| bridge:governance-rehearsal | ✅ 21/21 passed |
| bridge:live-write-adapter | ✅ 33/33 passed |
| bridge:canary-plan | ✅ 27/27 passed |
| bridge:canary-rc | ✅ 34/34 passed |
| bridge:open-brain-canary | ✅ 38/38 passed |
| check | ⚠️ Degradation warning (pre-existing) |
| build | ✅ Clean |
| scan:security | ✅ 0 flagged |
| git status | ✅ Clean |

**Total:** 220+ tests, 0 failures.

---

## 6. Safety Invariants

| Invariant | Status |
|-----------|--------|
| Exposed key rotated | ✅ Operator attested |
| Replacement key committed | ❌ No |
| Replacement key logged | ❌ No |
| No new live writes during remediation | ✅ Confirmed |
| No credential values in repo | ✅ Confirmed |
| No credential values in evidence | ✅ Confirmed |
| No credential values in git history | ✅ Confirmed |
| Git status clean | ✅ Confirmed |
| Bridge suite green | ✅ 220+ tests, 0 failures |
| Build clean | ✅ Confirmed |
| Security scan clean | ✅ 0 flagged |
| v7B.2 authorized | **false** |
| Recurring writes | **false** |

---

## 7. Standing By for v7B.1.1

After this seal:

| Phase | Status |
|-------|--------|
| v7B.1-pre (adapter + tests) | ✅ Sealed |
| v7B.1-live (canary 404 + lockdown) | ✅ Sealed |
| v7B.1S (remediation) | ✅ Sealing now |
| **v7B.1.1** (corrected endpoint canary) | **Pending authorization** |
| v7B.2 | Not authorized |

---

*Remediation sealed without new live writes. No credentials committed. Operator attestation accepted.*
