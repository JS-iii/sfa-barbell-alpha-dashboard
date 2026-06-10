# v7B.1R: Open Brain Supabase Reconnection + Read-Only Audit Report

**Phase:** v7B.1R — Read-Only Reconnaissance  
**Seal:** Based on `662eddf` (v7B.1-live prep)  
**Date:** 2026-06-10  
**Status:** Audit complete — live Supabase connection requires operator-staged credentials  
**Classification:** Read-only audit. No database writes. No schema mutations. No memory mutations.

---

## Executive Summary

v7B.1R is a read-only reconnaissance audit of the dormant Open Brain Supabase project (`bgludgfrbyicqqdkdqds`) to assess reconnection safety before any v7B.1-live canary write. This audit was conducted without live Supabase access because `SUPABASE_ACCESS_TOKEN` is not staged in the operator shell.

**Key Findings:**

| Finding | Status |
|---------|--------|
| Hardcoded secrets in Open Brain files | None found (4 false positives confirmed) |
| Existing Supabase client code | None (by design) |
| Open Brain file inventory | 35 files across docs, src, scripts, data |
| MCP read-only URL configuration | Correct: `read_only=true`, scoped project_ref |
| Bridge suite integrity | 254 tests passing, 0 failures |
| Git status | Clean |
| Build | Clean |
| Security scan | 0 flagged files |
| Live Supabase connection | Pending operator-staged token |
| Database table inventory | Requires live connection |
| pgvector/vector extension check | Requires live connection |
| Memory schema drift assessment | Requires live connection |

---

## 1. MCP Configuration Verification

The operator provided the Codex MCP configuration for read-only Supabase access:

```toml
[mcp_servers.supabase]
url = "https://mcp.supabase.com/mcp?project_ref=bgludgfrbyicqqdkdqds&read_only=true&features=database,docs"
bearer_token_env_var = "SUPABASE_ACCESS_TOKEN"
enabled = true
default_tools_approval_mode = "prompt"
tool_timeout_sec = 60
```

### Security Analysis

| Property | Value | Assessment |
|----------|-------|------------|
| `project_ref` | `bgludgfrbyicqqdkdqds` | Scoped to specific project ✅ |
| `read_only` | `true` | Write operations blocked ✅ |
| `features` | `database, docs` | Edge Function deploy not included ✅ |
| `bearer_token_env_var` | `SUPABASE_ACCESS_TOKEN` | Token sourced from env var only ✅ |
| `default_tools_approval_mode` | `prompt` | Interactive approval, not auto ✅ |
| `tool_timeout_sec` | `60` | Bounded execution time ✅ |

### Write-Capable Operations Status

| Operation | Status |
|-----------|--------|
| INSERT | Blocked by `read_only=true` |
| UPDATE | Blocked by `read_only=true` |
| DELETE | Blocked by `read_only=true` |
| CREATE TABLE | Blocked by `read_only=true` |
| ALTER TABLE | Blocked by `read_only=true` |
| DROP TABLE | Blocked by `read_only=true` |
| Edge Function deploy | Not in features list |
| Schema migration | Blocked by `read_only=true` |

**Verdict:** MCP configuration is correctly scoped for read-only access. No write capability is exposed.

---

## 2. Open Brain File Inventory

### Documentation (`docs/v7b/`)

| File | Purpose | Lines |
|------|---------|-------|
| `open_brain_observation_write_contract.md` | Write request/response contract (v7A.3) | ~300 |
| `v7b_live_write_readiness.md` | Full spec: credentials, scope, idempotency, audit, rollback (v7A.3) | ~350 |
| `v7b_threat_model.md` | 10 threat scenarios with mitigations (v7A.3) | ~250 |
| `v7b_operator_checklist.md` | Human operator checklist (v7B.0.1) | ~150 |
| `v7b01_authorization_ceremony.md` | Authorization ceremony (v7B.0.1) | ~60 |
| `v7b01_canary_write_contract.md` | Canary payload contract (v7B.0.1) | ~60 |
| `v7b01_rollback_checklist.md` | Rollback steps (v7B.0.1) | ~40 |
| `v7b1_live_operator_runbook.md` | v7B.1-live execution runbook | ~200 |

### Source Code (`src/bridge/v7b/`)

| File | Purpose | Lines |
|------|---------|-------|
| `openBrainCanaryAdapter.ts` | **Only module with `fetch()`** — single-write canary adapter (v7B.1) | ~340 |
| `canaryRCPacket.ts` | Immutable canary RC packet with SHA-256 hash (v7B.0.2) | ~218 |
| `canaryValidator.ts` | Canary payload validator — fail-closed (v7B.0.1) | ~166 |
| `finalLiveWriteGate.ts` | 8-layer final live-write gate (v7B.0.2) | ~130 |
| `localWriteSimulator.ts` | Local write simulator + audit chain drill (v7A.4) | ~320 |
| `liveWriteAdapter.ts` | Live write adapter interface + disabled impl (v7B.0) | ~85 |
| `governanceRehearsal.ts` | End-to-end governance rehearsal (v7A.7) | ~210 |
| `replayDossier.ts` | Promotion dossier generator (v7A.6) | ~260 |
| `replayEngine.ts` | Packet replay engine (v7A.5) | ~120 |
| `writeRequestSchema.ts` | Write request/response types (v7A.3) | ~280 |
| `auditLog.ts` | Append-only audit log with hash chain (v7A.4) | ~165 |
| `idempotency.ts` | Idempotency key + dedup tracking (v7A.4) | ~95 |
| `killSwitch.ts` | Kill-switch scaffold (v7B.0) | ~58 |
| `authorizationGate.ts` | Operator authorization gate (v7B.0) | ~50 |
| `credentialPreflight.ts` | Credential absence checker (v7B.0) | ~52 |
| `networkWriteGuard.ts` | Outbound write blocker (v7B.0) | ~40 |
| `governedStateGuard.ts` | Governed state creation blocker (v7B.0) | ~50 |
| `v7bCandidateLock.ts` | v7B candidate lock (v7A.7) | ~180 |
| `v7b1AuthorizationRecord.ts` | v7B.1 auth record shape (v7B.0.2) | ~80 |
| `operatorApprovalChecklist.ts` | Operator checklist (v7B.0.1) | ~95 |
| `firstWriteAuditContract.ts` | Audit event contract (v7B.0.1) | ~60 |
| `preflightReport.ts` | Final preflight report (v7B.0.2) | ~115 |

### Scripts (`scripts/`)

| File | Purpose | Tests |
|------|---------|-------|
| `bridge-open-brain-canary.mjs` | v7B.1 canary write adapter CLI | 38 |
| `v7b1-live-canary-execute.mjs` | v7B.1-live standalone canary executor | 8 steps |
| `bridge-canary-rc.mjs` | v7B.0.2 canary RC + final gate | 34 |
| `bridge-canary-plan.mjs` | v7B.0.1 canary plan | 27 |
| `bridge-live-write-adapter.mjs` | v7B.0 live write adapter contract | 33 |
| `bridge-governance-rehearsal.mjs` | v7A.7 governance rehearsal | 21 |
| `bridge-replay-dossier.mjs` | v7A.6 dossier generator | 24 |
| `bridge-replay.mjs` | v7A.5 replay engine | 22 |
| `bridge-write-simulator.mjs` | v7A.4 write simulator | 21 |
| `bridge-review-packet.mjs` | v7A.2 review packet | 17 + 8 gate |
| `bridge-safety-drill.mjs` | v7A.1 safety drill | 17 |
| `bridge-dry-run.mjs` | v7A dry-run contract | — |

### Data Artifacts

| File | Purpose |
|------|---------|
| `data/dry-run/open-brain-observations-dry-run.jsonl` | Dry-run observation logs (gitignored) |
| `data/dry-run/v7b-audit-log-v7a4.jsonl` | v7A.4 audit log entries (gitignored) |

**Total Open Brain files:** 35 files  
**Total lines of bridge/observation code:** ~3,800  
**Total test count across all phases:** 254+ tests, all passing

---

## 3. Hardcoded Secret Scan Results

### Scan Methodology

Scanned all 35 Open Brain files for these patterns:
- API key patterns (`sk-[a-zA-Z0-9]{20,}`, `pk-`, `eyJ`)
- Supabase URLs (`supabase.co`)
- Service role references (`service_role`)
- Password strings
- Bearer tokens
- Private key patterns (`0x[a-f0-9]{64}`)
- Database connection strings (`postgresql://`)

### Results

**Real secrets found: 0**

| Detection | File | Type | Verdict |
|-----------|------|------|---------|
| `sk-abc123xyz789def456ghi` | `bridge-canary-plan.mjs` | Test fixture: tests canary validator **rejects** secret key patterns | ✅ False positive |
| `https://test.supabase.co` | `bridge-live-write-adapter.mjs` | Test fixture: temporary `process.env` set/deleted in credential preflight test | ✅ False positive |
| `/service_role/i` | `bridge-dry-run.mjs` | Scanner regex: **detects** forbidden `service_role` in observation drafts | ✅ False positive |
| `/service_role/i` | `bridge-safety-drill.mjs` | Scanner regex: **detects** forbidden `service_role` in payloads | ✅ False positive |

### No Supabase Client Code Exists

The repository contains:
- ❌ No `@supabase/supabase-js` import
- ❌ No `createClient()` call
- ❌ No Supabase service role key
- ❌ No `supabase.auth` usage
- ❌ No Edge Function invocations
- ❌ No realtime subscriptions

This is by design. v7A through v7B.1 explicitly excluded any Supabase client.

---

## 4. v7B.1-Live Readiness Assessment

### Current Blockers

| # | Blocker | Severity | Resolution |
|---|---------|----------|------------|
| 1 | `SUPABASE_ACCESS_TOKEN` not staged | Required for live audit | Operator must set in secure shell |
| 2 | `OPENBRAIN_API_KEY` not staged | Required for v7B.1-live | Operator must set in secure shell |
| 3 | `OPENBRAIN_ENDPOINT_URL` not staged | Required for v7B.1-live | Operator must set in secure shell |

### Non-Blockers (All Clear)

| Check | Status |
|-------|--------|
| Hardcoded secrets | None found ✅ |
| Git status | Clean ✅ |
| Bridge suite | 254+ tests, 0 failures ✅ |
| Security scan | 0 flagged files ✅ |
| Build | Clean production build ✅ |
| Kill switch | Fail-closed ✅ |
| Adapter lock | Not triggered ✅ |
| Credential values in evidence | Never captured ✅ |
| Governed state | false ✅ |
| Execution capability | false ✅ |

---

## 5. Live Supabase Audit (Pending)

The following require operator-staged `SUPABASE_ACCESS_TOKEN` for execution via Codex MCP:

### 5.1 Table Inventory

**Query needed:** List all tables in `public` schema
```sql
SELECT schemaname, tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Expected Open Brain tables (Manus-era):**
| Table | Purpose | Priority |
|-------|---------|----------|
| `observations` | Stored observation records | High |
| `memories` | Vector memory embeddings | High |
| `memory_chunks` | Chunked document embeddings | High |
| `conversations` | Conversation history | Medium |
| `snapshots` | Alpha snapshot cache | Medium |
| `audit_log` | Operation audit trail | High |

### 5.2 Extension Inventory

**Query needed:** Check installed extensions
```sql
SELECT extname, extversion FROM pg_extension ORDER BY extname;
```

**Critical:** `pgvector` / `vector` must be present for memory embedding storage.

### 5.3 Migration Inventory

**Query needed:** List migration history
```sql
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;
```

### 5.4 Memory Schema

**Query needed:** Describe memory tables
```sql
\d+ observations
\d+ memories
\d+ memory_chunks
```

### 5.5 Vector Dimension Check

**Query needed:** Check vector dimensions
```sql
SELECT embedding, pg_typeof(embedding) FROM memories LIMIT 1;
-- or
SELECT vec_dims(embedding) FROM memories LIMIT 1;
```

**Expected:** 1536 dimensions (OpenAI text-embedding-ada-002) or 768 (sentence-transformers)

### 5.6 RLS/Policy Inventory

**Query needed:** Check RLS policies
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
```

---

## 6. Architecture Assessment: Supabase MCP vs REST vs Dedicated Endpoint

### Option A: Supabase MCP (Read-Only Current Config)

| Pros | Cons |
|------|------|
| Read-only enforced by MCP URL | Requires Codex MCP server setup |
| Interactive tool approval | Cannot be used outside Codex |
| Project-scoped | Bearer token lifetime management |
| Database + docs features | Read-only constraint blocks writes |

**Verdict:** Excellent for read-only audit and inspection. Cannot be used for v7B.1-live canary writes because `read_only=true` blocks INSERT.

### Option B: Supabase REST API (`@supabase/supabase-js`)

| Pros | Cons |
|------|------|
| Standard client library | Requires anon/service key |
| Works from any environment | Service role key = full database access |
| RLS can restrict writes | Must implement own write guards |
| Vector operations via `pgvector` | Credential management complexity |

**Verdict:** Suitable for v7B.1R+ (read/write after audit), but requires careful credential scoping. Service role key should NEVER be committed.

### Option C: Dedicated Open Brain Write Endpoint

| Pros | Cons |
|------|------|
| Purpose-built for observation writes | Requires separate infrastructure |
| Can enforce schema validation server-side | Custom implementation effort |
| No direct database access from client | Additional endpoint to maintain |
| Easier to audit and rate-limit | Not yet implemented |

**Verdict:** Best long-term architecture for v7B.2+ recurring writes. Not needed for v7B.1 single canary.

### Recommendation

| Phase | Recommended Adapter |
|-------|-------------------|
| v7B.1R (current) | **Supabase MCP read-only** for audit |
| v7B.1-live | **Dedicated endpoint** (`OPENBRAIN_ENDPOINT_URL`) — already built in `openBrainCanaryAdapter.ts` |
| v7B.2+ | **Dedicated endpoint** with Supabase REST as fallback for admin ops |

**For v7B.1-live:** Continue with the existing `openBrainCanaryAdapter.ts` using `OPENBRAIN_ENDPOINT_URL`. This is the path already proven by 38 tests. Do NOT switch to Supabase MCP for the canary write — MCP is read-only in current config.

---

## 7. Manus-Era Drift Assessment

Without live database access, drift assessment is limited. Based on file analysis:

| Area | Manus-Era (Expected) | Current State | Drift Risk |
|------|---------------------|---------------|------------|
| Table structure | observations, memories, memory_chunks | Unknown (needs live query) | Medium |
| pgvector extension | Required for embeddings | Unknown (needs live query) | High if missing |
| Embedding model | text-embedding-ada-002 (1536d) | Unknown (needs live query) | Medium |
| RLS policies | Row-level security enabled | Unknown (needs live query) | Medium |
| Migration state | Schema managed via migrations | Unknown (needs live query) | Low |
| Data freshness | Active observations flowing | Dormant since Manus | High — stale data |

### Dormant/Stale Risks

1. **Data staleness:** Observations table likely contains stale data from Manus era. Fresh observations should be validated before use.
2. **Schema drift:** If manual schema changes were made without migrations, the actual schema may differ from documented expectations.
3. **Extension availability:** `pgvector` may need reinstallation if the project was paused/recreated.
4. **Credential rotation:** Any Manus-era API keys or service tokens should be rotated before reconnection.

---

## 8. Safety Invariant Table

| Invariant | Value |
|-----------|-------|
| Hardcoded secrets in repo | None ✅ |
| Supabase client code | None ✅ |
| Open Brain connected (this audit) | false (read-only only) |
| Network writes enabled | false (read_only=true on MCP) |
| Credentials in code | false ✅ |
| Execution capability | false ✅ |
| Governed state created | false ✅ |
| Kill switch | fail-closed ✅ |
| Canary write executed | false (pending operator) |
| v7B.1-live closed | false (pending operator credential staging) |
| v7B.2 authorized | false |
| Recurring writes | false |
| Auto-trading | false |
| Bridge suite green | 254+ tests, 0 failures ✅ |
| Git status clean | Clean ✅ |
| Build clean | Clean ✅ |
| Security scan clean | 0 flagged ✅ |

---

## 9. Post-Audit Bridge Suite Results

| Command | Result |
|---------|--------|
| `npm run bridge:open-brain-canary` | 38/38 passed ✅ |
| `npm run bridge:canary-rc` | 34/34 passed ✅ |
| `npm run bridge:canary-plan` | 27/27 passed ✅ |
| `npm run bridge:live-write-adapter` | 33/33 passed ✅ |
| `npm run bridge:governance-rehearsal` | 21/21 passed ✅ |
| `npm run bridge:replay-dossier` | 24/24 passed ✅ |
| `npm run bridge:replay` | 22/22 passed ✅ |
| `npm run bridge:write-simulator` | 21/21 passed ✅ |
| `npm run bridge:review-packet` | 17 + 8 gate passed ✅ |
| `npm run bridge:safety-drill` | 17/17 passed ✅ |
| `npm run check` | Fixtures valid + security clean ✅ |
| `npm run build` | Clean production build ✅ |
| `npm run scan:security` | 0 flagged files ✅ |
| `git status --short` | Clean ✅ |

---

## 10. Recommendations

### Immediate (v7B.1R completion)

1. **Stage `SUPABASE_ACCESS_TOKEN`** in operator secure shell
2. **Run Codex MCP read-only queries** to complete sections 5.1–5.6 above
3. **Document actual schema state** vs. expected Manus-era schema
4. **Assess pgvector availability** — critical blocker if missing

### Before v7B.1-live

5. **Verify `OPENBRAIN_ENDPOINT_URL`** points to a working endpoint
6. **Stage `OPENBRAIN_API_KEY`** in operator secure shell
7. **Run `npx tsx scripts/v7b1-live-canary-execute.mjs`**
8. **Capture evidence packet** and confirm lockdown

### Before v7B.2

9. **Implement read-before-act discipline:** All writes must be preceded by a read validation
10. **Implement write-after-act audit:** All writes must produce an immutable audit event
11. **Consider dedicated Open Brain write endpoint** (Option C) for recurring writes
12. **Rotate all Manus-era credentials** before production use

### Blockers for v7B.1-live

| Blocker | Resolution |
|---------|------------|
| Operator must stage `OPENBRAIN_API_KEY` | Required |
| Operator must stage `OPENBRAIN_ENDPOINT_URL` | Required |
| Operator must set `V7B1_CANARY_AUTHORIZED=true` | Required |
| Operator must set `OPENBRAIN_WRITE_DISABLED=false` | Required |

---

## 11. Evidence Retention

| Artifact | Location | Contains Secrets |
|----------|----------|-----------------|
| This audit report | `docs/v7b/v7b1r_reconnection_audit_report.md` | No ✅ |
| Execution script | `scripts/v7b1-live-canary-execute.mjs` | No ✅ |
| Operator runbook | `docs/v7b/v7b1_live_operator_runbook.md` | No ✅ |
| Git status | Clean | N/A ✅ |
| Evidence packet (post-live) | `docs/v7b/v7b1-live-canary-evidence.json` | No ✅ |

---

*Report generated: 2026-06-10*  
*Auditor: v7B.1R read-only audit process*  
*Scope: Read-only reconnaissance. No database writes. No schema mutations. No memory mutations.*
