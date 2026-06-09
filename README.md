# SFA Barbell Alpha Dashboard

**Current Phase:** v7B.0.2 — Canary Release Candidate Packet + Final Live-Write Gate  
**Prior Phase:** v7B.0.1 — Live Write Authorization Ceremony + Canary Plan  
**Earlier:** v7B.0 · v7A.7 — Governance Rehearsal · v7A.6 — Dossier · v7A.5 — Replay · v7A.4 — Simulator · v7A.3 — Readiness Spec · v7A.2 — Review Packet · v7A.1 — Safety Drill · v7A · v6 · v5.1  
**Next Phase:** v7B.1 — Open Brain Live Write (NOT YET AUTHORIZED)

**Compliance Mode:** `telemetry_and_simulation_only_no_execution`  
**Open Brain Connected:** `false`  
**Execution Capability:** `false`

---

## What This Is

A manual research and governance dashboard for the SFA (Systematic Funding Allocation) Barbell Alpha strategy. It visualizes market regime analysis across flight-to-safety and risk-on assets, with provider-backed data generation.

**This is NOT a trading bot.**  
**This does NOT execute orders.**  
**This does NOT connect to Open Brain (v7A is dry-run only, no network writes).**

---

## v6: Server-side Snapshot Generator

v6 introduces a server-side pipeline that generates AlphaSnapshot artifacts from live and manual data providers:

```
provider adapters → normalized AlphaSnapshot → validation → static JSON artifact → dashboard render
```

### Providers

| Provider | Type | Data | Limitations |
|----------|------|------|-------------|
| **CoinGecko** | Live API | Global market cap, coin prices, volume, dominance | Free tier rate limit (~30 calls/min). May timeout or return 429. |
| **DeFiLlama** | Live API | Protocol fees/revenue (24h, 7d, 30d) | API availability varies. Returns top 30 protocols. |
| **FRED** | Live API (optional) | 10-Year U.S. Treasury Constant Maturity Rate | Requires `FRED_API_KEY` env var. Falls back to mock data if no key. |
| **Unlocks** | Manual | Token unlock calendar (next 30 days) | Manually curated. Updated periodically. Not live. |
| **Reserves** | Manual | Exchange BTC/ETH reserve snapshots | Manually curated. Updated periodically. Not live. |

### Manual/Mock Provider Disclosure

Unlocks and Reserves providers are **explicitly manual** and return data with:
- `"note": "MANUAL/MOCK DATA: ... Not live. Updated periodically."`
- Status is `active` but clearly labeled as manual

FRED without an API key returns:
- Mock 10Y Treasury data (~4.42%) with error field explaining fallback

### Fail-Closed Scoring

The scoring engine enforces these principles:

- **Missing data reduces confidence** — never increases it
- **No provider = no bullish signal** — composite defaults to `unclear` or `defensive`
- **Provider degradation is visible** — provider_status shows `degraded`/`unavailable`
- **Regime does not become `risk_on` from missing data** — defaults to `uncategorized` or `flight_to_safety`
- **Confidence drops proportionally** — each missing provider reduces max confidence by ~15%

### Running the Generator

```bash
# Generate a provider-backed snapshot
npm run generate:snapshot

# Output: public/data/generated-alpha-snapshot.json
```

Optional: Set FRED API key for live Treasury data:
```bash
export FRED_API_KEY=your_key_here
npm run generate:snapshot
```

---

## v5.1 Baseline (Preserved)

v5.1 established the contract layer and remains intact:

- `data/mock-alpha-snapshot.json` — validated mock baseline
- `data/fixtures/` — 5 invalid fixtures proving fail-closed rejection
- `src/lib/validateSnapshot.ts` — runtime validator
- `docs/merge_checklist_template.md` — human merge checklist

### Mock Data Disclosure

The v5.1 mock snapshot declares `"data_mode": "mock"`. The dashboard displays:

> **Validated Mock Baseline** — This dashboard is displaying mock/demo data for governance review. It is **not live market intelligence**.

Mock data is **not subject to staleness warnings**. Only live/mixed data triggers the 24h stale threshold.

---

## Quick Start

```bash
# Install dependencies
npm install

# Run all checks (fixture validation + security scan)
npm run check

# Generate a provider-backed snapshot
npm run generate:snapshot

# Build for production
npm run build

# Preview locally
npm run preview
```

---

## Local Check Commands

| Command | What It Does |
|---------|-------------|
| `npm run validate:fixtures` | Validates that good snapshot passes and 5 bad fixtures fail |
| `npm run scan:security` | Scans for credentials, secrets, execution code |
| `npm run check` | Runs both of the above |
| `npm run generate:snapshot` | Fetches providers, scores assets, writes JSON artifact |
| `npm run bridge:dry-run` | Transforms snapshot to observation draft (dry-run, no network) |
| `npm run bridge:safety-drill` | 17-test safety harness (1 valid + 16 rejection cases) |
| `npm run bridge:review-packet` | Generate review packet + human promotion gate (v7A.2) |
| `npm run bridge:write-simulator` | Local write simulator + audit chain drill (v7A.4) |
| `npm run bridge:replay` | Replay observation packets through simulator (v7A.5) |
| `npm run bridge:replay-dossier` | Generate promotion dossier + governance preflight (v7A.6) |
| `npm run bridge:governance-rehearsal` | End-to-end governance rehearsal + v7B candidate lock (v7A.7) |
| `npm run bridge:live-write-adapter` | Live write adapter contract + kill-switch scaffold (v7B.0) |
| `npm run bridge:canary-plan` | Authorization ceremony + canary plan (v7B.0.1) |
| `npm run bridge:canary-rc` | Canary RC packet + final live-write gate (v7B.0.2) |
| `npm run build` | TypeScript compile + Vite production build |

---

## File Structure

```
src/
  App.tsx                      # Dashboard UI
  types/alphaSnapshot.ts       # AlphaSnapshot contract schema
  lib/validateSnapshot.ts      # Runtime validator (fail-closed)
  providers/
    types.ts                   # Provider output types
    coingecko.ts               # CoinGecko adapter
    defillama.ts               # DeFiLlama adapter
    fred.ts                    # FRED adapter (optional key, mock fallback)
    unlocks.ts                 # Manual unlocks provider
    reserves.ts                # Manual reserves provider
  scoring/
    scoreAssets.ts             # Barbell-style asset scoring
    scoreRegime.ts             # Market regime + composite signal
  bridge/
    types.ts                   # OpenBrainObservationDraft contract
    transformer.ts             # Snapshot → observation draft
    logger.ts                  # Local JSONL dry-run logger
    review/
      types.ts                 # ReviewPacket + DecisionLedger types
      generator.ts             # Draft → review packet
      validator.ts             # Decision validation (allowed/forbidden)
      ledger.ts                # Local decision ledger (JSONL)
    v7b/
      writeRequestSchema.ts    # Future v7B write request types (no client)
      idempotency.ts           # Idempotency key + dedup tracking
      auditLog.ts              # Append-only audit log with hash chain
      localWriteSimulator.ts   # Local write simulator (v7A.4)
      replayEngine.ts          # Packet replay engine (v7A.5)
      replayDossier.ts         # Promotion dossier generator (v7A.6)
      governanceRehearsal.ts   # End-to-end governance rehearsal (v7A.7)
      v7bCandidateLock.ts      # v7B candidate lock (v7A.7)
      liveWriteAdapter.ts      # Live write adapter interface + disabled impl (v7B.0)
      killSwitch.ts            # Kill-switch scaffold (v7B.0)
      authorizationGate.ts     # Operator authorization gate (v7B.0)
      credentialPreflight.ts   # Credential absence checker (v7B.0)
      networkWriteGuard.ts     # Outbound write blocker (v7B.0)
      governedStateGuard.ts    # State creation blocker (v7B.0)
      canaryValidator.ts       # Canary payload validator (v7B.0.1)
      firstWriteAuditContract.ts # Audit event contract (v7B.0.1)
      operatorApprovalChecklist.ts # Operator approval checklist (v7B.0.1)
      canaryRCPacket.ts        # Canary release-candidate packet (v7B.0.2)
      finalLiveWriteGate.ts    # Final live-write gate (v7B.0.2)
      v7b1AuthorizationRecord.ts # v7B.1 auth record shape (v7B.0.2)
      preflightReport.ts       # Final preflight report (v7B.0.2)
docs/v7b/
  ...
  v7b01_authorization_ceremony.md  # Authorization ceremony (v7B.0.1)
  v7b01_canary_write_contract.md   # Canary payload contract (v7B.0.1)
  v7b01_rollback_checklist.md      # Rollback checklist (v7B.0.1)
docs/v7b/
  v7b_live_write_readiness.md
  open_brain_observation_write_contract.md
  v7b_threat_model.md
  v7b_operator_checklist.md
public/data/
  mock-alpha-snapshot.json     # v5.1 validated mock baseline
  generated-alpha-snapshot.json # v6 provider-generated artifact
  fixtures/                    # 5 invalid + 2 degradation fixtures
scripts/
  validate-fixtures.mjs        # npm run validate:fixtures
  security-scan.mjs            # npm run scan:security
  generate-snapshot.mjs        # npm run generate:snapshot
  bridge-dry-run.mjs           # npm run bridge:dry-run
  bridge-safety-drill.mjs      # npm run bridge:safety-drill
```

---

## Compliance & Safety

This repository does **NOT** contain:

- ❌ Exchange credentials or API keys (hardcoded)
- ❌ Wallet secrets or seed phrases
- ❌ Trading or order execution code
- ❌ Open Brain integration or private memory access
- ❌ Browser-side API secrets
- ❌ Auto-merge, auto-deploy, or auto-seal capability

The FRED provider reads `FRED_API_KEY` from environment variables only. No key is bundled.

---

## v7A: Open Brain Observation Bridge (Dry-Run Contract)

v7A exists and is the **current phase**. It transforms validated AlphaSnapshots into Open Brain observation drafts, validates them, and logs them locally as JSONL. **No network writes occur.**

```
validated AlphaSnapshot → OpenBrainObservationDraft → validation → local JSONL dry-run log
```

### What v7A Does

- Transforms snapshots into `OpenBrainObservationDraft` with preserved provenance
- Validates safety flags: `notExecutionAuthority=true`, `containsTradeOrders=false`, etc.
- Scans for forbidden patterns (execution, wallet, credential references)
- Logs locally to `data/dry-run/open-brain-observations-dry-run.jsonl`
- **Never writes to any network service**

### What v7A Does NOT Do

- ❌ Connect to Open Brain
- ❌ Perform network writes
- ❌ Use API credentials
- ❌ Create governed state
- ❌ Authorize execution

### Running the Bridge (Dry-Run)

```bash
npm run bridge:dry-run
```

This loads the default mock snapshot, transforms it, validates the draft, and appends a log entry. No data leaves your machine.

---

## v7A.1: Bridge Safety Drill + Rejection Harness

v7A.1 proves the observation bridge correctly rejects malformed, unsafe, or authority-escalating drafts. It does not add any network, credential, or execution capability.

### What the Safety Drill Tests

17 inline fixtures (no external files):

| # | Test | Expected |
|---|------|----------|
| 1 | Valid AlphaSnapshot → valid OpenBrainObservationDraft | **Pass** |
| 2 | Missing provenance | **Reject** |
| 3 | Inflated confidence | **Reject** |
| 4 | Snapshot score changed during transform | **Reject** |
| 5 | Provider status removed | **Reject** |
| 6 | notExecutionAuthority = false | **Reject** |
| 7 | containsTradeOrders = true | **Reject** |
| 8 | containsExecutionInstructions = true | **Reject** |
| 9 | containsWalletReferences = true | **Reject** |
| 10 | containsCredentials = true | **Reject** |
| 11 | isGovernedState = true | **Reject** |
| 12 | requiresHumanReview = false | **Reject** |
| 13 | networkWriteStatus ≠ dry-run-local-only | **Reject** |
| 14 | Payload with execution language | **Reject** |
| 15 | Payload with wallet language | **Reject** |
| 16 | Payload with credential language | **Reject** |
| 17 | Draft attempting governed state for agent reading | **Reject** |

### Running the Safety Drill

```bash
npm run bridge:safety-drill
```

All 17 tests must pass. Any failure blocks v7B consideration.

---

## v7A.2: Observation Review Packet + Human Promotion Gate

v7A.2 introduces a human-reviewable packet and promotion gate between the observation draft and any future Open Brain write. It transforms validated observation drafts into structured review packets with risk flags, key findings, and a human decision workflow.

```
OpenBrainObservationDraft → ReviewPacket → Human Decision → Local Ledger
```

### What v7A.2 Does

- Generates a **ReviewPacket** from any validated `OpenBrainObservationDraft`
- Creates human-readable **summary** with signal, confidence, regime, asset count
- Identifies **risk flags** (mock data warning, low confidence, provider degradation)
- Enforces a **human promotion gate** with explicit allowed/forbidden decisions
- Records decisions to a **local JSONL ledger** (gitignored, no network write)

### Allowed Decisions

| Decision | Meaning | v7B Eligible |
|----------|---------|-------------|
| `accept_for_future_observation_write` | Draft is sound, eligible for v7B write when authorized | ✅ Yes |
| `reject` | Draft has issues, do not write | ❌ No |
| `needs_revision` | Draft needs changes before reconsideration | ❌ No |
| `defer` | Decision postponed, remain in dry-run state | ❌ No |

### Forbidden Decisions (Blocked)

These decisions are **rejected** and will not create a ledger entry:

- `approved_for_execution`
- `trade_ready`
- `governed_state`
- `live_write_ready`

### Fail-Closed Safety

- Unsafe drafts (execution authority, governed state, live-write status) **cannot create review packets**
- Forbidden decisions are **rejected at validation time**
- The decision ledger preserves safety declarations on every entry
- Unknown/unrecognized decisions are rejected

### Running the Review Packet

```bash
npm run bridge:review-packet
```

This loads the default mock snapshot, transforms it, generates a review packet, simulates all allowed/forbidden decisions, runs 17 embedded safety tests, and records example decisions to the local ledger.

### Review Packet Output

```
✅ Packet generated: open-brain-review-packet-v7a2
📊 Signal: defensive (76%)
🚩 Risk flags: 2
   🟡 [data_source] Snapshot is mock data
   🔵 [governance] For observation review only
✅ ALLOWED: "accept_for_future_observation_write"
✅ BLOCKED: "approved_for_execution"
✅ BLOCKED: "governed_state"
```

### What v7A.2 Does NOT Do

- ❌ Create governed state
- ❌ Authorize execution or trading
- ❌ Write to Open Brain or any network service
- ❌ Use credentials
- ❌ Enable live network writes

---

## v7A.3: Live Write Readiness Spec + Threat Model

v7A.3 is a **documentation-only** phase that specifies the security, operational, and architectural requirements for a hypothetical v7B live Open Brain observation write. It adds **no live write capability**, no network clients, and no credentials.

### Deliverables

| Document | Purpose |
|----------|---------|
| `docs/v7b/v7b_live_write_readiness.md` | Full spec: credentials, scope, idempotency, audit, rollback, rate limiting, least-privilege |
| `docs/v7b/open_brain_observation_write_contract.md` | Write request/response contract with validation rules and error codes |
| `docs/v7b/v7b_threat_model.md` | 10 threat scenarios with mitigations, blast radius analysis, defense-in-depth matrix |
| `docs/v7b/v7b_operator_checklist.md` | Human operator checklist required before v7B authorization |
| `src/bridge/v7b/writeRequestSchema.ts` | TypeScript types for future write request shape (types only, no network client) |

### What v7A.3 Specifies

- **Credential boundary**: Server-side env vars only, never bundled, 90-day rotation
- **Write scope**: Observation drafts only; governed_state, execution, trade instructions are **forbidden**
- **Idempotency**: UUID v4 keys with 24-hour server-side retention window
- **Replay protection**: Timestamp window + idempotency key + payload hash binding
- **Audit logging**: Every operation logged locally with integrity chain
- **Human review dependency**: v7A.2 `accept_for_future_observation_write` decision is **mandatory**
- **Kill switch**: `OPENBRAIN_WRITE_DISABLED=true` blocks all writes without code changes
- **Circuit breaker**: Opens after 5 consecutive failures
- **Rate limiting**: Max 288 writes/day, client-side token bucket
- **Least-privilege**: API key has `observation:write` only

### What v7A.3 Does NOT Add

- ❌ No Open Brain client library
- ❌ No Supabase client
- ❌ No credential values
- ❌ No network write code
- ❌ No `fetch()` calls to Open Brain
- ❌ No environment variable reads
- ❌ No execution capability
- ❌ No governed state creation

### v7A.3 Explicit Statement

```
Open Brain connected:      false
Network writes:            false
Credentials present:       false
Execution capability:      false
v7B authorized:            false
This phase adds:           documentation and types only
```

---

## v7A.4: Local Write Simulator + Audit Chain Drill

v7A.4 implements the v7B readiness spec as a **local-only simulator**. It exercises idempotency, audit logging, kill switch behavior, circuit breaker logic, human review dependency, and scope enforcement — all without any network calls.

```
ReviewPacket (accepted)
  → simulated write request
  → idempotency key + payload hash
  → local simulated server response
  → audit log entry (hash chain)
  → circuit breaker / kill switch state check
```

### What the Simulator Tests (21 tests — authorized minimum: 20; expanded to 21 after adding explicit boundary enforcement)

**Write validation (13 tests):**
- Valid accepted packet → simulated success
- Missing human review → reject
- Decision not `accept_for_future_observation_write` → reject
- Forbidden decisions (`governed_state`) → reject
- Safety declaration mismatch → reject
- `notExecutionAuthority=false` → reject
- `containsTradeOrders=true` → reject
- `containsExecutionInstructions=true` → reject
- `containsWalletReferences=true` → reject
- `containsCredentials=true` → reject
- Duplicate key + same payload → duplicate (idempotent)
- Duplicate key + different payload → reject (collision)
- Stale human review (>7 days) → reject

**Kill switch & circuit breaker (4 tests):**
- Kill switch active → all writes blocked
- Circuit breaker opens after 5 consecutive failures
- Audit log hash chain verifies (tamper detection)
- Tampered audit log fails verification

**Boundary enforcement (4 tests):**
- Simulator never creates governed state
- Simulator never emits execution authority
- No `fetch()` calls in code
- No credential values in code

### Running the Simulator

```bash
npm run bridge:write-simulator
```

All output is local JSONL in `data/dry-run/` (gitignored).

### What v7A.4 Does NOT Do

- ❌ Make real network calls
- ❌ Connect to Open Brain
- ❌ Use credentials
- ❌ Create governed state
- ❌ Authorize execution

---

## v7A.5: Replay Existing Observation Packets Through the Local Write Simulator

v7A.5 replays realistic observation packets through the v7A.4 local write simulator to prove deterministic accept/reject behavior, audit continuity across multi-packet replay, and boundary enforcement at scale.

```
Historical observation packets
  → v7A.4 local write simulator
  → deterministic accept / reject
  → audit log entry (hash chain)
  → continuity verification
```

### What the Replay Tests Cover (22 tests — authorized minimum: 15)

**Historical packet replay (4 tests):**
- Realistic observation packet → simulated success
- Low-confidence packet with valid human review → accepted
- Multi-packet replay: 3 valid packets → all success
- Mixed decisions: accept + reject + defer sequence

**Determinism (2 tests):**
- Same packet replayed twice → same status
- Unsafe packet replayed twice → rejected both times

**Rejection coverage (5 tests):**
- Missing human review → reject
- Stale human review (>7 days) → reject
- Wrong approval type (needs_revision) → reject
- Malformed safety declarations → reject
- Execution authority claim → reject with execution flag

**Audit continuity (2 tests):**
- Multi-packet replay (5 packets) → valid hash chain
- Mixed success/rejection replay → audit chain valid

**Tamper proof (1 test):**
- Tampered audit log → verification fails

**Idempotency across replay (2 tests):**
- Same key + same payload → duplicate
- Same key + altered payload → collision

**Boundary enforcement (6 tests):**
- No `fetch()` calls
- No credential values
- Multi-packet replay never creates governed state
- Multi-packet replay never emits execution authority
- Circuit breaker tracked across replay
- Audit entry count equals replay count

### Running the Replay

```bash
npm run bridge:replay
```

### What v7A.5 Does NOT Do

- ❌ Make real network calls
- ❌ Connect to Open Brain
- ❌ Use credentials
- ❌ Create governed state
- ❌ Authorize execution
- ❌ Authorize v7B

---

## v7A.6: Replay Promotion Dossier + Governance Preflight

v7A.6 converts replayed observation packets into human-reviewable **promotion dossiers** — the final checkpoint before any v7B consideration. It aggregates replay results, audit chain status, determinism verification, and boundary checks into a single operator-reviewable document.

```
Replayed packet
  → promotion dossier
  → state: promotion_candidate | rejected | blocked | needs_review | replay_verified
  → operator decision placeholder
  → v7B promotion eligibility check
```

### Dossier States

| State | Meaning | Can Promote to v7B? |
|-------|---------|-------------------|
| `promotion_candidate` | All checks passed, ready for operator review | ✅ Yes (with operator approval) |
| `rejected` | Replay failed validation | ❌ No |
| `blocked_boundary_violation` | Safety/governance boundary would be violated | ❌ No |
| `needs_operator_review` | Ambiguous result (bad audit chain, non-deterministic) | ❌ No (pending review) |
| `replay_verified` | Duplicate replay, already processed | ❌ No (no action needed) |

### What the Dossier Tests Cover (24 tests — authorized minimum: 15)

**State determination (8 tests):**
- Valid success → `promotion_candidate`
- Rejected (safety violation) → `rejected`
- Governed state would be created → `blocked_boundary_violation`
- Kill switch blocked → `blocked_boundary_violation`
- Invalid audit chain → `needs_operator_review`
- Non-deterministic → `needs_operator_review`
- Duplicate → `replay_verified`
- Unknown status → `needs_operator_review` (fail-closed)

**Decision validation (4 tests):**
- `promote_to_v7b_candidate` allowed for promotion_candidate
- `auto_promote` → rejected (forbidden)
- `create_governed_state` → rejected (forbidden)
- `promote_to_v7b_candidate` disallowed for rejected dossier

**Promotion eligibility (3 tests):**
- promotion_candidate → can promote
- rejected → cannot promote
- blocked → cannot promote

**Field & safety (5 tests):**
- Packet hash present (SHA-256)
- Idempotency key preserved
- notExecutionAuthority=true
- humanReviewRequired=true
- noCredentialsPresent + noNetworkCallsMade

**Boundary enforcement (4 tests):**
- No `fetch()` calls
- No credential values
- Correct schema version
- Deterministic packet hashing

### Running the Dossier Generator

```bash
npm run bridge:replay-dossier
```

### What v7A.6 Does NOT Do

- ❌ Create governed state
- ❌ Authorize v7B
- ❌ Make network calls
- ❌ Use credentials
- ❌ Authorize execution

---

## v7A.7: End-to-End Governance Rehearsal + v7B Candidate Lock

v7A.7 is the final governance phase before v7B consideration. It proves the full offline governance path from observation packet to v7B candidate lock:

```
Observation Packet
  → Local Write Simulator (v7A.4)
  → Replay Verification (v7A.5)
  → Promotion Dossier (v7A.6)
  → Operator Decision
  → v7B Candidate Lock (review-only, non-executable)
  → EXPLICIT BLOCK: v7B cannot be activated
```

### What the Rehearsal Tests Cover (21 tests — authorized minimum: 15)

**End-to-end happy path (3 tests):**
- Full E2E: packet → simulator → replay → dossier → candidate lock
- E2E with reject → `candidate_rejected`
- E2E with defer → `v7b_not_authorized`

**Blocked states (5 tests):**
- Boundary violation → blocked at `boundary_check`
- Determinism failure → blocked at `determinism` step
- Audit chain failure → blocked at `audit_chain` step
- Forbidden decision (`auto_promote`) → blocked at `decision_validation`
- Safety violation in packet → blocked at `boundary_check`

**v7B activation block (3 tests):**
- v7B **cannot** be activated from candidate lock (always false)
- `v7bAuthorization.authorized` is **ALWAYS false**
- Unlock requirements documented and enforced

**Candidate lock properties (4 tests):**
- Correct schema version
- Packet hash preserved from dossier
- Not expired at creation
- 90-day expiration set

**Step-by-step verification (3 tests):**
- All 7 steps completed on happy path
- Packet creation always succeeds
- Simulator step always runs

**Boundary enforcement (3 tests):**
- No `fetch()` calls
- No credential values
- No governed state created by any path

### v7B Candidate Lock

The candidate lock is a **review-only, non-executable** governance object that:
- Records the dossier reference and operator decision
- Explicitly states `v7bAuthorization.authorized: false`
- Has `v7bActivationBlocked: true` (hardcoded safety flag)
- Documents unlock requirements (operator auth, credentials, security review, checklist)
- Expires after 90 days

**The lock CANNOT activate v7B.** Separate explicit authorization is required.

### Fixture Timestamp Documentation

Synthetic degradation fixtures (`provider-degraded-coingecko.json`,
`provider-all-degraded.json`) have timestamps that may be refreshed when they
age past 24h. This is documented in `public/data/fixtures/README.md`.
The `stale-snapshot.json` fixture is intentionally stale and must never be
refreshed.

### Running the Rehearsal

```bash
npm run bridge:governance-rehearsal
```

### What v7A.7 Does NOT Do

- ❌ Activate v7B (explicitly blocked)
- ❌ Create governed state
- ❌ Make network calls
- ❌ Use credentials
- ❌ Authorize execution
- ❌ Authorize live writes

---

## v7B.0: Live Write Adapter Contract + Kill-Switch Scaffold

v7B.0 is the first v7B phase. It introduces the **live-write adapter surface** as a disabled, credentialless, non-networked contract layer. This phase defines the interface but keeps all writes blocked.

### Architecture: 6 Guard Layers

Every attempted write passes through these layers (all blocking in v7B.0):

```
Write Request
  → Layer 1: Kill Switch (default: disabled)
  → Layer 2: Authorization Gate (authorized: false)
  → Layer 3: Credential Preflight (credentials: absent)
  → Layer 4: Governed State Guard (creation: blocked)
  → Layer 5: Network Write Guard (outbound: blocked)
  → Layer 6: Disabled Adapter (always returns ADAPTER_DISABLED)
  → BLOCKED — audit event recorded
```

### Modules

| Module | File | Purpose |
|--------|------|---------|
| Live Write Adapter | `liveWriteAdapter.ts` | Interface contract + `DisabledLiveWriteAdapter` that always fails closed |
| Kill Switch | `killSwitch.ts` | `OPENBRAIN_WRITE_DISABLED` env var check, default blocked |
| Authorization Gate | `authorizationGate.ts` | Hardcoded `authorized: false`, requires future operator approval |
| Credential Preflight | `credentialPreflight.ts` | Scans env vars for credentials, expects clean in v7B.0 |
| Network Write Guard | `networkWriteGuard.ts` | Blocks all outbound network write attempts |
| Governed State Guard | `governedStateGuard.ts` | Pattern-matches payload for governed state creation attempts |

### What the Tests Cover (33 tests — authorized minimum: 20)

**Disabled adapter (4 tests):**
- `isEnabled` is false
- `write()` returns `ADAPTER_DISABLED`
- `isReady()` returns false
- Status shows all guards blocking

**Kill switch (4 tests):**
- Default blocks writes
- `OPENBRAIN_WRITE_DISABLED=true` blocks
- `OPENBRAIN_WRITE_DISABLED=false` still blocks (v7B.0)
- Unset env blocks

**Authorization gate (3 tests):**
- `authorized` is false by default
- All authorization fields are null
- Reason mentions v7B.0 scaffold

**Credential preflight (3 tests):**
- Passes with no env vars (clean)
- Detects `OPENBRAIN_API_KEY`
- Detects multiple credentials

**Network write guard (2 tests):**
- Blocks all writes
- Reason mentions v7B.0

**Governed state guard (4 tests):**
- `governed_state: true` blocked
- Normal payload passes
- `isGovernedState: true` in safety blocked
- `isGovernedState: false` passes

**Integration (3 tests):**
- `attemptLiveWrite` blocked by kill switch (first layer)
- Blocked write produces audit event
- Governed state payload detected by direct guard check

**v7A.7 → v7B.0 boundary (2 tests):**
- Candidate lock cannot activate v7B.0 adapter
- All guard layers must pass — v7B.0 blocks at first layer

**Boundary enforcement (4 tests):**
- No `fetch()` calls
- No credential values
- No Open Brain connection
- Adapter write returns `ADAPTER_DISABLED` (duplicate coverage for emphasis)

### Running the Adapter Test

```bash
npm run bridge:live-write-adapter
```

### What v7B.0 Does NOT Do

- ❌ Connect to Open Brain
- ❌ Perform network writes
- ❌ Use credentials
- ❌ Create governed state
- ❌ Authorize execution
- ❌ Enable live writes (adapter is disabled)
- ❌ Allow v7B activation (authorization gate blocks)

---

## v7B.0.1: Live Write Authorization Ceremony + Canary Plan

v7B.0.1 is the **planning/preflight** phase before any canary write. It defines the operator authorization ceremony, canary payload contract, rollback checklist, and first-write audit expectations while keeping all writes disabled.

### Deliverables

| Document/File | Purpose |
|---------------|---------|
| `docs/v7b/v7b01_authorization_ceremony.md` | Step-by-step operator authorization ceremony |
| `docs/v7b/v7b01_canary_write_contract.md` | Canary payload schema + validation rules |
| `docs/v7b/v7b01_rollback_checklist.md` | Rollback steps + emergency contacts |
| `src/bridge/v7b/canaryValidator.ts` | Canary payload validator (fail-closed) |
| `src/bridge/v7b/firstWriteAuditContract.ts` | Audit event shape for blocked canary attempts |
| `src/bridge/v7b/operatorApprovalChecklist.ts` | Operator checklist (cannot itself authorize) |

### What the Tests Cover (27 tests — authorized minimum: 20)

**Canary payload validation (9 tests):**
- Valid canary payload passes
- Missing writeType rejected
- Wrong schema version rejected
- governed_state: true rejected
- operator authorized: true rejected
- v7bAuthorized: true rejected
- networkWriteStatus: v7b-live-write rejected
- execute_trade in payload rejected
- Secret key pattern rejected

**Authorization ceremony (5 tests):**
- Ceremony cannot authorize v7B.1
- Checklist starts incomplete
- canAuthorizeV7B is false
- All required items complete still cannot authorize
- v7A.7 candidate lock cannot activate v7B.0.1

**Audit event contract (3 tests):**
- Blocked event has correct schema
- v7bAuthorized: false in audit
- Safety declarations correct

**Rollback checklist (3 tests):**
- Rollback doc exists
- Authorization ceremony doc exists
- Canary write contract doc exists

**Credential & safety (3 tests):**
- No credentials in environment
- Kill switch fail-closed
- v7B.0.1 scaffold blocks writes

**Boundary enforcement (4 tests):**
- No fetch() calls
- No credential values
- No executable live write path
- Correct schema version

### Running the Canary Plan

```bash
npm run bridge:canary-plan
```

### What v7B.0.1 Does NOT Do

- ❌ Authorize v7B.1 live writes
- ❌ Execute canary writes
- ❌ Stage credentials in code
- ❌ Connect to Open Brain
- ❌ Enable the live write adapter
- ❌ Create governed state

---

## v7B.0.2: Canary Release Candidate Packet + Final Live-Write Gate

v7B.0.2 is the **final pre-live-write staging** phase. It creates the exact immutable canary release-candidate packet and final live-write gate that would be used for v7B.1, while proving the packet cannot execute in v7B.0.2.

### Deliverables

| Module | Purpose |
|--------|---------|
| `canaryRCPacket.ts` | Immutable canary RC packet with deterministic SHA-256 hash |
| `finalLiveWriteGate.ts` | 8-layer gate that always returns blocked |
| `v7b1AuthorizationRecord.ts` | Auth record shape, hardcoded unauthorized |
| `preflightReport.ts` | Final safety invariant report (10 invariants) |

### 8-Layer Final Live-Write Gate

```
Canary RC Packet
  → Layer 1: Kill Switch (fail-closed)
  → Layer 2: v7B.1 Authorization (false)
  → Layer 3: Credential Preflight (absent)
  → Layer 4: Governed State Guard (blocked)
  → Layer 5: Network Write Guard (blocked)
  → Layer 6: Packet Hash Integrity (verified)
  → Layer 7: Operator Signoff (missing)
  → Layer 8: Packet Freshness (verified)
  → BLOCKED — reason reported
```

### What the Tests Cover (34 tests — authorized minimum: 20)

**Canary RC packet (8 tests):**
- Valid packet generated with correct schema
- Hash is 64-char hex (SHA-256)
- Hash verification passes for untampered packet
- Tampered packet fails hash verification
- Fresh packet not stale
- Packet without operator signoff detected
- All safety invariants false

**Final live-write gate (6 tests):**
- Always returns allowed=false
- Returns blockedBy for any packet
- Has exactly 8 layers
- Hash integrity layer passes for valid packet
- Operator signoff layer fails (not signed)
- Freshness layer passes

**v7B.1 authorization (3 tests):**
- Auth record is unauthorized
- cannotActivateV7B1 is false
- All prerequisites true still unauthorized

**Cross-phase boundary (3 tests):**
- v7A.7 candidate lock cannot activate v7B.1
- v7B.0.1 ceremony cannot activate v7B.1
- v7B.0.2 final gate cannot activate v7B.1

**Preflight report (4 tests):**
- Report generated with 10 invariants
- All invariants satisfied
- v7B.1 authorization false in report
- 14 phases sealed

**Credential & kill switch (3 tests):**
- Credentials absent
- Kill switch fail-closed
- Credentials would be rejected

**Safety invariants (3 tests):**
- Governed state creation blocked
- Network write blocked
- Audit event blocked/planned only

**Boundary enforcement (4 tests):**
- No fetch() calls
- No credential values
- No executable live write path
- Correct schema version

### Running the Canary RC

```bash
npm run bridge:canary-rc
```

### What v7B.0.2 Does NOT Do

- ❌ Execute canary writes
- ❌ Authorize v7B.1
- ❌ Stage credentials
- ❌ Connect to Open Brain
- ❌ Enable live write adapter
- ❌ Create governed state

---

## v7B.1 Future Scope (NOT YET AUTHORIZED)

v7B would introduce live Open Brain observation writes:

```
validated AlphaSnapshot → private server-side bridge → Open Brain observation write → human review → governed state promotion
```

**v7B has not been authorized.** No live network write capability exists. No Open Brain credentials are present in this repository. No Supabase client. No service role key.

v7B would require:
- Server-side-only Open Brain credentials (env var, never bundled)
- Write scope limited to observation drafts (not governed state)
- Dry-run parity: v7A output must match v7B write format exactly
- Idempotency, audit logging, and revocation plan
- Separate security review and operator authorization

---

## Seals

Canonical seals are git tags. Verify current commit with:
```bash
git show-ref --tags | grep sfa-barbell-dashboard
```

| Seal Tag | Description |
|----------|-------------|
| `sfa-barbell-dashboard-v5.1-contract-lock` | v5.1 Contract Lock + Deployment Proof |
| `sfa-barbell-dashboard-v6-snapshot-generator` | v6 Server-side Snapshot Generator + Hardening |
| `sfa-barbell-dashboard-v7a-bridge-contract` | v7A Open Brain Observation Bridge Dry-Run Contract |
| `sfa-barbell-dashboard-v7a1-bridge-safety-drill` | v7A.1 Bridge Safety Drill + Rejection Harness |
| `sfa-barbell-dashboard-v7a1-hygiene` | v7A.1 Hygiene: gitignore dry-run JSONL logs |
| `sfa-barbell-dashboard-v7a2-review-packet` | v7A.2 Observation Review Packet + Human Promotion Gate |
| `sfa-barbell-dashboard-v7a3-live-write-readiness` | v7A.3 Live Write Readiness Spec + Threat Model |
| `sfa-barbell-dashboard-v7a4-local-write-simulator` | v7A.4 Local Write Simulator + Audit Chain Drill |
| `sfa-barbell-dashboard-v7a5-replay-packets` | v7A.5 Replay Existing Observation Packets |
| `sfa-barbell-dashboard-v7a6-replay-dossier` | v7A.6 Replay Promotion Dossier + Governance Preflight |
| `sfa-barbell-dashboard-v7a7-governance-rehearsal` | v7A.7 End-to-End Governance Rehearsal + v7B Candidate Lock |
| `sfa-barbell-dashboard-v7b0-live-write-adapter` | v7B.0 Live Write Adapter Contract + Kill-Switch Scaffold |
| `sfa-barbell-dashboard-v7b01-canary-plan` | v7B.0.1 Live Write Authorization Ceremony + Canary Plan |
| `sfa-barbell-dashboard-v7b02-canary-rc` | v7B.0.2 Canary Release Candidate + Final Live-Write Gate |

---

*This is a m