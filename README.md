# SFA Barbell Alpha Dashboard

**Current Phase:** v7A — Open Brain Observation Bridge (Dry-Run Contract)  
**Prior Phase:** v6 — Server-side Snapshot Generator  
**Earlier:** v5.1 — Contract Lock + Deployment Proof  
**Next Phase:** v7B — Open Brain Network Write (NOT YET AUTHORIZED)

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
public/data/
  mock-alpha-snapshot.json     # v5.1 validated mock baseline
  generated-alpha-snapshot.json # v6 provider-generated artifact
  fixtures/                    # 5 invalid + 2 degradation fixtures
scripts/
  validate-fixtures.mjs        # npm run validate:fixtures
  security-scan.mjs            # npm run scan:security
  generate-snapshot.mjs        # npm run generate:snapshot
  bridge-dry-run.mjs           # npm run bridge:dry-run
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

## v7B Future Scope (NOT YET AUTHORIZED)

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

---

*This is a manual research and governance dashboard. Not a trading bot.*
