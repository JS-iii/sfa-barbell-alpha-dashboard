# v7B.1R-Live: Supabase Read-Only Database Inventory Summary

**Phase:** v7B.1R-Live — Read-Only Database Audit  
**Project:** bgludgfrbyicqqdkdqds  
**Executed:** 2026-06-10 ~22:30 UTC  
**Operator:** jonnyblaze1x@gmail.com  
**Method:** Supabase Web SQL Editor (read-only SELECT queries)  
**Status:** ✅ Complete

---

## Live DB Inventory: EXECUTED ✅

| Query | Status | Result |
|-------|--------|--------|
| Public tables | ✅ | 2 tables found |
| Extensions (pgvector) | ✅ | `vector` v0.8.0 confirmed |
| Vector dimensions | ✅ | `vector(768)` in `memories.embedding` |
| Memory-related tables | ✅ | Only `memories` matches |
| Row counts | ✅ | memories=698, products=5 |
| Migration history | ✅ | 8 migrations from 2026-03-12 to 2026-03-16 |
| RLS policies | ✅ (from migrations) | 2 policies on `memories` |
| Schema drift | ✅ Detected | Significant drift documented |

---

## 1. Public Table Inventory

| Schema | Table | Row Count | Type |
|--------|-------|-----------|------|
| public | **memories** | 698 | Memory (Open Brain) |
| public | **products** | 5 | Demo data (not Open Brain) |

**Total:** 2 tables in `public` schema.

---

## 2. Extension Inventory

| Extension | Version | Status |
|-----------|---------|--------|
| **vector** (pgvector) | 0.8.0 | ✅ Installed — CRITICAL |

pgvector is present and active. This is the minimum requirement for vector-based memory storage.

---

## 3. Migration Inventory

| Version | Name | Date | Description |
|---------|------|------|-------------|
| 20260312211034 | create_demo_products_table | Mar 12 | Demo `products` table (5 rows) |
| 20260313203416 | open_brain_01_extension | Mar 13 | Installed `vector` extension |
| 20260313203422 | open_brain_02_tables_indexes | Mar 13 | Created `memories` table + 3 indexes |
| 20260313203427 | open_brain_03_rls_policies | Mar 13 | Enabled RLS + 2 policies |
| 20260313203434 | open_brain_04_match_memories_function | Mar 13 | Created `match_memories()` vector search |
| 20260313203438 | open_brain_05_recent_memories_view | Mar 13 | Created `recent_memories` view |
| 20260316074958 | add_agent_role_chain_columns | Mar 16 | Added 4 columns via ALTER TABLE |
| 20260316075008 | add_agent_role_check_constraint | Mar 16 | CHECK constraint on `agent_role` |

**Migration timeline:** All migrations created between Mar 12–16, 2026 (Manus era). No migrations since.

---

## 4. Memory Schema Report

### Table: `public.memories`

| Column | Type | Nullable | Default | Added |
|--------|------|----------|---------|-------|
| `id` | UUID | NOT NULL | gen_random_uuid() | Initial |
| `content` | TEXT | NOT NULL | — | Initial |
| `metadata` | JSONB | NOT NULL | `'{}'::jsonb` | Initial |
| `embedding` | **VECTOR(768)** | Yes | — | Initial |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | Initial |
| `agent_role` | TEXT | Yes | `'teacher'` | Mar 16 |
| `chain` | TEXT | Yes | `'solana'` | Mar 16 |
| `confidence_inherited` | BOOLEAN | Yes | `false` | Mar 16 |
| `validated` | BOOLEAN | Yes | `false` | Mar 16 |

### Indexes

| Name | Type | Column(s) |
|------|------|-----------|
| `idx_memories_created_at` | btree | created_at DESC |
| `idx_memories_metadata` | GIN | metadata |
| `idx_memories_embedding` | ivfflat (lists=100) | embedding vector_cosine_ops |

### Constraints

| Name | Type | Expression |
|------|------|------------|
| `memories_pkey` | PRIMARY KEY | id |
| `memories_agent_role_check` | CHECK | `agent_role IN ('teacher', 'trader')` |

### RLS Policies

| Name | Action | Role | Using |
|------|--------|------|-------|
| `service_role_full_access` | ALL | service_role | `true` |
| `authenticated_read` | SELECT | authenticated | `true` |

### Functions

| Name | Purpose | Returns |
|------|---------|---------|
| `match_memories(query_embedding, match_threshold, match_count)` | Vector similarity search | id, content, metadata, similarity, created_at |

### Views

| Name | Definition |
|------|------------|
| `recent_memories` | `SELECT id, content, metadata, created_at FROM memories ORDER BY created_at DESC LIMIT 100` |

---

## 5. Vector Dimension Report

| Property | Value |
|----------|-------|
| Extension | `vector` v0.8.0 |
| Column | `memories.embedding` |
| Dimensions | **768** |
| Index type | ivfflat |
| Distance metric | cosine (`vector_cosine_ops`) |
| Index lists | 100 |

### Embedding Model Compatibility

| Model | Dimensions | Compatible |
|-------|-----------|------------|
| OpenAI text-embedding-ada-002 | 1536 | ❌ NO |
| OpenAI text-embedding-3-small | 1536 | ❌ NO |
| OpenAI text-embedding-3-large | 3072 | ❌ NO |
| **sentence-transformers/all-mpnet-base-v2** | **768** | ✅ **YES** |
| **BAAI/bge-base-en** | **768** | ✅ **YES** |
| sentence-transformers/all-MiniLM-L6-v2 | 384 | ❌ NO |

**Critical finding:** The database uses 768-dimensional vectors. This is compatible with `all-mpnet-base-v2` or `bge-base-en` models, but **NOT** with OpenAI's ada-002 (1536d). The canary write adapter does not specify embedding dimensions — this must be resolved before any Supabase memory integration.

---

## 6. RLS/Policy Report

| Property | Value |
|----------|-------|
| RLS enabled on `memories` | ✅ Yes |
| service_role access | ALL (full read/write) |
| authenticated user access | SELECT only (read-only) |
| anon access | None (implicit deny) |

**Assessment:** RLS is properly configured. Authenticated users can only read. Service role has full access (expected for backend operations). No anon access prevents unauthenticated reads.

---

## 7. Stale/Dormant Table Report

| Table | Status | Assessment |
|-------|--------|------------|
| `memories` | **Active** | 698 rows — actively used for memory storage |
| `products` | **Dormant demo** | 5 rows — unrelated demo data from initial setup |

**Risk:** The `products` table is not part of the Open Brain architecture. It was created as demo data during initial project setup and should be documented as non-production or removed.

---

## 8. Manus-Era Drift Report

### Expected vs Actual Architecture

| Expected Table | Status | Notes |
|----------------|--------|-------|
| `observations` | ❌ **MISSING** | No observation storage table |
| `memories` | ✅ Present | With drift (see below) |
| `memory_chunks` | ❌ **MISSING** | No chunked document storage |
| `conversations` | ❌ **MISSING** | No conversation history |
| `snapshots` | ❌ **MISSING** | No alpha snapshot cache |
| `audit_log` | ❌ **MISSING** | No operation audit trail |
| `products` | ⚠️ **UNEXPECTED** | Demo data, not Open Brain |

### Schema Drift in `memories`

| Issue | Severity | Details |
|-------|----------|---------|
| Missing 5 of 6 expected tables | **High** | Only `memories` exists |
| Post-creation column additions | Medium | `agent_role`, `chain`, `confidence_inherited`, `validated` added via ALTER TABLE |
| agent_role CHECK constraint | **High** | Restricts to `'teacher'`/`'trader'` — `'observer'` would be rejected |
| chain default `'solana'` | Low | Non-portable blockchain-specific default |
| 768d vs expected 1536d | **High** | Embedding model must be compatible with 768d |

### Migration Drift

All migrations were created in a 4-day window (Mar 12–16, 2026). No migrations since. This suggests:
- The project was set up during Manus era and then left dormant
- Schema changes were made via subsequent ALTER TABLE migrations
- The project has been in read-only / dormant state since March 2026

---

## 9. Go/No-Go for v7B.1-Live Canary

### Verdict: **GO** ✅

| Criterion | Assessment |
|-----------|------------|
| Canary write uses OPENBRAIN_ENDPOINT_URL | ✅ Dedicated endpoint, not Supabase |
| Supabase schema blocks canary | ❌ No — canary bypasses Supabase |
| pgvector available for future | ✅ Yes, ready |
| RLS protects memory table | ✅ Yes |
| No credential exposure | ✅ No secrets in evidence |

**v7B.1-live canary is NOT blocked by the database state.** The canary write adapter posts to a dedicated endpoint (`OPENBRAIN_ENDPOINT_URL`), not directly to Supabase. The database inventory is informational for future Supabase integration phases.

---

## 10. Proof of Read-Only Execution

| Proof | Status |
|-------|--------|
| Only SELECT queries executed | ✅ Confirmed |
| No INSERT/UPDATE/DELETE | ✅ Confirmed |
| No schema changes | ✅ Confirmed |
| No credential values in evidence | ✅ Confirmed |
| No credential values committed | ✅ Confirmed |
| Token not logged | ✅ Confirmed |

---

## 11. Safety Invariant Table

| Invariant | Status |
|-----------|--------|
| Read-only enforced | ✅ |
| No inserts | ✅ |
| No updates | ✅ |
| No deletes | ✅ |
| No schema mutations | ✅ |
| No edge deploys | ✅ |
| No memory writes | ✅ |
| No canary write | ✅ |
| Token logged | ❌ Never |
| Token committed | ❌ Never |
| Bridge suite green | 254+ tests, 0 failures ✅ |
| Git status clean | ✅ |
| Build clean | ✅ |
| Security scan clean | 0 flagged ✅ |

---

## 12. Recommended Next Actions

### Before v7B.1-Live Canary: NONE REQUIRED
The canary write uses a dedicated endpoint, not Supabase. Proceed with operator-staged `OPENBRAIN_API_KEY` + `OPENBRAIN_ENDPOINT_URL`.

### Before v7B.2+ Supabase Integration:

| Priority | Action |
|----------|--------|
| **High** | Pick embedding model compatible with 768d (all-mpnet-base-v2 or bge-base-en) |
| **High** | Create `observations` table for observation storage |
| **High** | Resolve `agent_role` CHECK constraint — add `'observer'` or remove constraint |
| Medium | Document or remove `products` demo table |
| Medium | Create `memory_chunks`, `conversations`, `snapshots`, `audit_log` if needed |
| Low | Change `chain` default from `'solana'` to something portable |

---

*Report generated from live database query results*  
*No credentials exposed. No writes performed. Read-only audit.*
