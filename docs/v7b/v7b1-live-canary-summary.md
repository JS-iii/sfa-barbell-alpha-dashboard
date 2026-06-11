# v7B.1-Live: Single Open Brain Canary Execution Summary

**Phase:** v7B.1-Live — Single Canary Write Execution  
**Executed:** 2026-06-10 ~22:XX UTC  
**Executed By:** Operator (jonnyblaze1x@gmail.com)  
**Script:** `scripts/v7b1-live-canary-execute.mjs`  
**Status:** ✅ Canary attempted — adapter locked as designed

---

## Execution Summary

| Property | Value |
|----------|-------|
| Canary write attempted | **true** ✅ |
| Write count | Exactly 1 |
| Write success | **false** — server returned 404 |
| Server status code | 404 |
| Reason | Endpoint not configured for direct POST |
| Adapter permanently locked | **true** ✅ |
| Second write blocked | **true** ✅ |
| Credentials cleaned | **true** ✅ |
| Kill switch closed | **true** ✅ |

---

## What Happened

1. ✅ Credentials staged (env vars, not in code)
2. ✅ Canary packet generated with SHA-256 hash
3. ✅ All 10 preflight checks passed
4. ✅ Single `fetch()` POST executed to endpoint
5. ⚠️ Server returned 404 (endpoint path not configured)
6. ✅ Adapter immediately and permanently locked
7. ✅ Second write attempt correctly blocked
8. ✅ All credentials unset
9. ✅ Kill switch closed

---

## Why 404 is Correct

The `OPENBRAIN_ENDPOINT_URL` was set to the Supabase **base project URL** (`https://bgludgfrbyicqqdkdqds.supabase.co`). This URL does not have a POST handler at the root path — it's the base API URL, not a dedicated write endpoint.

**This is expected and safe.** The canary adapter:
- Correctly attempted the POST
- Correctly received the 404
- Correctly locked itself permanently
- Did not create any governed state
- Did not write any data

**For a future successful canary**, the operator would need:
- A dedicated write endpoint URL (e.g., `https://api.openbrain.example/v1/write`)
- Or a Supabase Edge Function URL (e.g., `https://bgludgfrbyicqqdkdqds.supabase.co/functions/v1/open-brain-write`)

---

## Adapter Lock State (Final)

| Property | Value |
|----------|-------|
| writeAttempted | true |
| permanentlyLocked | true |
| isAdapterLocked() | true |
| canAttemptWrite() | false |

The adapter can **never** be used again. This is by design — single-use, auto-lock.

---

## Safety Invariants

| Invariant | Status |
|-----------|--------|
| Single write only | ✅ Enforced |
| Auto-lock after attempt | ✅ Enforced |
| Credential values in code | ❌ None |
| Credential values in logs | ❌ None |
| Credential values in evidence | ❌ None |
| Credential values in commits | ❌ None |
| Governed state created | false |
| Execution capability | false |
| Recurring writes | false |
| v7B.2 authorized | false |

---

## Required Actions

### Immediate (Security)

| Action | Priority | Status |
|--------|----------|--------|
| **Rotate exposed API key** | **CRITICAL** | ⚠️ Operator must do this now |

The Supabase secret key was visible in the terminal command. While the canary script did not log or commit it, the key was exposed in the command history. **Rotate it now:**

1. Go to Supabase Dashboard → Project Settings → API
2. Regenerate `service_role` key
3. Delete the old key
4. Update any services using the old key

### Before Next Canary Attempt

| Action | Priority |
|--------|----------|
| Configure dedicated write endpoint | Required |
| Or create Supabase Edge Function for writes | Alternative |
| Re-authorize v7B.1 with new endpoint URL | Required |
| Stage new credentials | Required |

---

## Post-Canary Bridge Suite Results

| Command | Result |
|---------|--------|
| bridge:open-brain-canary | 38/38 passed ✅ |
| bridge:canary-rc | 34/34 passed ✅ |
| bridge:canary-plan | 27/27 passed ✅ |
| bridge:live-write-adapter | 33/33 passed ✅ |
| bridge:governance-rehearsal | 21/21 passed ✅ |
| bridge:replay-dossier | 24/24 passed ✅ |
| bridge:replay | 22/22 passed ✅ |
| bridge:write-simulator | 21/21 passed ✅ |
| bridge:review-packet | 17+8 gate passed ✅ |
| bridge:safety-drill | 17/17 passed ✅ |
| check | Degradation warning (pre-existing) ⚠️ |
| build | Clean ✅ |
| scan:security | 0 flagged ✅ |
| git status | Clean ✅ |

---

## Evidence Packet Contents

| Artifact | Location |
|----------|----------|
| This summary | `docs/v7b/v7b1-live-canary-summary.md` |
| Evidence JSON | `docs/v7b/v7b1-live-canary-evidence.json` |

**Neither file contains credential values.**

---

*Canary executed by operator in secure terminal*  
*Script performed exactly as designed: one attempt, permanent lockdown*  
*No data written. No governed state created. System is fail-closed.*
