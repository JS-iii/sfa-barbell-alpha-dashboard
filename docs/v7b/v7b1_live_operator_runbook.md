# v7B.1-Live Operator Runbook

**Phase:** Single Open Brain Canary Write Execution  
**Seal:** `sfa-barbell-dashboard-v7b1-canary-write` at `0690eb9`  
**Status:** v7B.1-pre accepted; v7B.1-live pending operator credential staging

## ⚠️ CRITICAL: Never Paste Credentials Into Chat

- Do NOT paste `OPENBRAIN_API_KEY` into ChatGPT, Kimi, logs, README, commits, or test fixtures.
- Stage credentials ONLY in your local secure shell/session.
- Unset credentials immediately after the canary attempt.

## Pre-Flight Verification (already completed)

All 12 pre-execution checks passed at `0690eb9`:

| # | Check | Result |
|---|-------|--------|
| 1 | HEAD commit | `0690eb9` ✅ |
| 2 | Tag at HEAD | `sfa-barbell-dashboard-v7b1-canary-write` ✅ |
| 3 | Git status | Clean ✅ |
| 4 | 38 canary adapter tests | All passed ✅ |
| 5 | `npm run check` | Clean ✅ |
| 6 | `npm run build` | Clean ✅ |
| 7 | `scan:security` | 0 flagged files ✅ |
| 8 | Canary packet hash | Valid SHA-256 ✅ |
| 9 | Kill switch | Fail-closed ✅ |
| 10 | Credentials staged | **NOT YET — operator action required** |
| 11 | v7B.1 authorization | **NOT YET — operator action required** |
| 12 | Kill switch open | **NOT YET — operator action required** |

## Step-by-Step Execution

### Step 1: Navigate to project directory

```bash
cd /mnt/agents/output/app
```

### Step 2: Stage credentials in your secure shell

Run these commands **in your local terminal** (not in chat):

```bash
export OPENBRAIN_WRITE_DISABLED=false
export OPENBRAIN_API_KEY='sk-your-actual-openbrain-api-key-here'
export OPENBRAIN_ENDPOINT_URL='https://your-actual-openbrain-endpoint.example.com/v1/write'
export V7B1_CANARY_AUTHORIZED=true
# Optional:
# export OPENBRAIN_PROJECT_ID='your-project-id'
```

**Security rules:**
- Use single quotes around values to prevent shell expansion
- Never commit these values
- Never paste them into any chat interface
- They exist only in this shell session

### Step 3: Execute the canary

```bash
npx tsx scripts/v7b1-live-canary-execute.mjs
```

This script will:
1. Verify credentials are staged (without logging values)
2. Verify kill switch is open
3. Verify v7B.1 authorization flag
4. Generate the immutable canary packet
5. Run the 10-point preflight
6. Execute exactly ONE `fetch()` POST to the Open Brain endpoint
7. **Immediately lock the adapter permanently**
8. Attempt a second write to prove it's blocked
9. Capture all evidence (without credential values)
10. Unset all credentials
11. Close the kill switch
12. Save evidence packet to `docs/v7b/v7b1-live-canary-evidence.json`
13. Save summary to `docs/v7b/v7b1-live-canary-summary.md`

### Step 4: Unset credentials (script does this, but double-check)

```bash
unset OPENBRAIN_API_KEY OPENBRAIN_ENDPOINT_URL OPENBRAIN_PROJECT_ID V7B1_CANARY_AUTHORIZED
export OPENBRAIN_WRITE_DISABLED=true
```

### Step 5: Verify cleanup

```bash
# Confirm credentials are gone
echo "API key set: ${OPENBRAIN_API_KEY:-NO}"
echo "Endpoint set: ${OPENBRAIN_ENDPOINT_URL:-NO}"
echo "Kill switch: ${OPENBRAIN_WRITE_DISABLED}"

# Confirm no credentials in evidence
 grep -i "sk-" docs/v7b/v7b1-live-canary-evidence.json || echo "No credential values in evidence ✅"
```

### Step 6: Run post-canary suite

```bash
npm run bridge:safety-drill
npm run bridge:review-packet
npm run bridge:write-simulator
npm run bridge:replay
npm run bridge:replay-dossier
npm run bridge:governance-rehearsal
npm run bridge:live-write-adapter
npm run bridge:canary-plan
npm run bridge:canary-rc
npm run bridge:open-brain-canary
npm run check
npm run build
npm run scan:security
```

### Step 7: Review evidence

```bash
cat docs/v7b/v7b1-live-canary-summary.md
```

### Step 8: Commit and seal

```bash
git add docs/v7b/v7b1-live-canary-evidence.json docs/v7b/v7b1-live-canary-summary.md
git commit -m "v7B.1-live: Single Open Brain canary execution evidence"
git tag sfa-barbell-dashboard-v7b1-live-canary
git push origin main
git push origin sfa-barbell-dashboard-v7b1-live-canary
```

## Rollback Procedure

If anything goes wrong before the write:

```bash
# Immediately unset credentials
unset OPENBRAIN_API_KEY OPENBRAIN_ENDPOINT_URL OPENBRAIN_PROJECT_ID V7B1_CANARY_AUTHORIZED
export OPENBRAIN_WRITE_DISABLED=true

# Verify adapter state
cd /mnt/agents/output/app && node -e "
const { getAdapterState } = require('./src/bridge/v7b/openBrainCanaryAdapter');
console.log(getAdapterState());
"

# If adapter is locked but write should not count, report the issue
# Do NOT reset adapter state in production — only for test recovery
```

## Evidence Packet Contents

The evidence packet (`docs/v7b/v7b1-live-canary-evidence.json`) contains:

| Field | Description |
|-------|-------------|
| `phase` | `v7b1-live-canary-execution` |
| `startedAt` / `completedAt` | ISO timestamps |
| `preflightChecks` | All 12 pre-execution check results |
| `canaryPacket` | Packet metadata (hash, schema, safety declarations) |
| `writeResult` | Success/block status, server response, audit event |
| `lockdownConfirmation` | Adapter lock state, second-write block proof |
| `credentialCleanup` | Confirmation all credentials unset |
| `finalStatus` | `canary_write_succeeded`, `canary_write_blocked`, or `canary_write_failed` |

**Does NOT contain:** API keys, endpoint URLs, credential values, response bodies (may contain sensitive data).

## Safety Invariants

| Invariant | Status |
|-----------|--------|
| Single write only | Enforced by adapter |
| Auto-lock after write | Enforced on all outcomes |
| Credentials in code | None |
| Credentials in logs | None (values never logged) |
| Credentials in evidence | None (values never captured) |
| Governed state | false |
| Execution capability | false |
| Recurring writes | false |
| v7B.2 authorized | false |
| Auto-trading | false |
