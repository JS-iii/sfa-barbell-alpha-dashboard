# AlphaSnapshot Fixtures

**Purpose:** Test fixtures for the SFA Barbell Alpha Dashboard validation pipeline.

**Important:** These fixtures are **synthetic test data**. They are designed to exercise
specific validation code paths (invalid values, stale data, provider degradation). They
do not represent real market snapshots and their timestamps are periodically refreshed
to prevent false "stale data" failures during test runs.

## Fixture Categories

| Fixture | Type | Purpose |
|---------|------|---------|
| `mock-alpha-snapshot.json` | Valid baseline | Reference snapshot for dashboard rendering |
| `invalid-confidence.json` | Invalid | Confidence out of range [0,1] — tests range validation |
| `invalid-provider-status.json` | Invalid | Invalid provider status enum — tests enum validation |
| `invalid-score-range.json` | Invalid | Score out of range [-100,100] — tests range validation |
| `missing-provenance.json` | Invalid | Missing provenance fields — tests required field validation |
| `stale-snapshot.json` | Invalid | GeneratedAt > 24h ago — tests staleness threshold |
| `provider-degraded-coingecko.json` | **Synthetic degradation** | 1 degraded provider — tests graceful degradation |
| `provider-all-degraded.json` | **Synthetic degradation** | All providers degraded — tests fail-closed behavior |

## Synthetic Degradation Fixtures

The two degradation fixtures (`provider-degraded-coingecko.json` and
`provider-all-degraded.json`) are **explicitly synthetic**. They:

- Use manually crafted provider status arrays
- Have timestamps that are refreshed when they age past 24h
- Are **NOT** generated from live provider API calls
- Exist solely to test the degradation handling code path

### Timestamp Refresh Policy

When a degradation fixture's `generatedAt` timestamp is > 24h old, the fixture
validator will flag it as stale (which is a **test failure**, not expected behavior).
In this case, the fixture timestamps should be refreshed to a recent value.

This refresh is **only** for the synthetic degradation fixtures. The `stale-snapshot.json`
fixture is intentionally stale and must NEVER have its timestamp refreshed.

### How to Refresh

```bash
# Refresh degradation fixture timestamps to now
node -e "
const fs = require('fs');
const now = new Date().toISOString().replace('T', 'T').slice(0, 19) + 'Z';
['provider-degraded-coingecko.json', 'provider-all-degraded.json'].forEach(f => {
  const path = 'public/data/fixtures/' + f;
  const content = fs.readFileSync(path, 'utf-8');
  // Update all ISO timestamps to current time
  const updated = content.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g, now);
  fs.writeFileSync(path, updated);
  console.log('Refreshed:', f);
});
"
```

## Never Refresh

- `stale-snapshot.json` — intentionally stale for staleness threshold testing
- `mock-alpha-snapshot.json` — use `npm run generate:snapshot` for fresh data
