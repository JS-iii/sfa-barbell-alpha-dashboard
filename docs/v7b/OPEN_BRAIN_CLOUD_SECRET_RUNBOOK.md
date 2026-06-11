# Open Brain Cloud Secret Runbook

**Phase:** v7B.1.1 — Corrected Endpoint Canary  
**Scope:** Cloud-safe credential handling for Supabase Management API token  
**Principle:** Secrets live only in env files (gitignored), never in shell history, never in chat.

---

## Cloud-Safe Env-File Workflow (Preferred)

### Step 1: Create the env file from template

```bash
cd /mnt/agents/output/app
cp .env.openbrain.example .env.openbrain
chmod 600 .env.openbrain
```

### Step 2: Edit with your rotated key

```bash
# Use an editor — do NOT type the key in a command that goes to shell history
nano .env.openbrain
# or
vi .env.openbrain
```

Replace the placeholder:
```
OPENBRAIN_API_KEY=sbp_your-new-rotated-key-here
```

With your **new rotated** Supabase service_role key.

### Step 3: Disable shell tracing

```bash
set +x
set +o history  # optional: disable history for this session
```

### Step 4: Run the canary

```bash
OPENBRAIN_ENV_FILE=.env.openbrain npx tsx scripts/v7b1.1-live-canary-execute.mjs
```

The script:
- Loads `.env.openbrain` automatically
- Redacts token-like values in output
- Refuses missing or placeholder secrets
- Requires `V7B1_CANARY_AUTHORIZED=true`
- Requires `OPENBRAIN_WRITE_DISABLED=false`

### Step 5: Immediate cleanup

```bash
unset OPENBRAIN_API_KEY V7B1_CANARY_AUTHORIZED OPENBRAIN_ENV_FILE
export OPENBRAIN_WRITE_DISABLED=true
rm -f .env.openbrain
```

### Step 6: Verify cleanup

```bash
echo "API key: ${OPENBRAIN_API_KEY:-CLEAN}"
echo "Auth: ${V7B1_CANARY_AUTHORIZED:-CLEAN}"
echo "Kill switch: ${OPENBRAIN_WRITE_DISABLED}"
ls .env.openbrain 2>/dev/null || echo "Env file: REMOVED"
```

---

## Direct-Export Fallback (Not Recommended)

Only use if env-file workflow is unavailable. This exposes the key in shell history.

```bash
# 1. Disable history
set +o history

# 2. Export directly (key visible in history — rotate after)
export OPENBRAIN_API_KEY='sbp_your-new-rotated-key-here'
export V7B1_CANARY_AUTHORIZED=true
export OPENBRAIN_WRITE_DISABLED=false

# 3. Run
npx tsx scripts/v7b1.1-live-canary-execute.mjs

# 4. Clean up
unset OPENBRAIN_API_KEY V7B1_CANARY_AUTHORIZED
export OPENBRAIN_WRITE_DISABLED=true

# 5. Clear history (bash)
history -c
history -w
```

---

## Security Checklist

| Check | Status |
|-------|--------|
| `.env.openbrain` is gitignored | ✅ |
| `.env.openbrain` has chmod 600 | Required |
| `.env.openbrain` deleted after use | Required |
| `set +x` before credential export | Required |
| Key is the **new rotated** key (not the old exposed one) | Required |
| `unset` all env vars after execution | Required |
| `OPENBRAIN_WRITE_DISABLED=true` after execution | Required |
| No key in shell history | Required |
| No key in chat/logs | Required |
| No key committed to repo | Required |

---

## What Never to Do

| Don't | Why |
|-------|-----|
| Type key in chat (including this one) | Chat logs store the key |
| Commit `.env.openbrain` | It's gitignored for a reason |
| Use the old exposed key | It was rotated for a reason |
| Leave `.env.openbrain` after execution | File cleanup is mandatory |
| Skip `unset` after execution | Env vars persist in the shell |

---

*Cloud-safe credential handling for v7B.1.1 corrected endpoint canary.*
