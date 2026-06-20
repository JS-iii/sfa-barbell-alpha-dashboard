# v7C.3 Operator Intelligence Packet

## Purpose

v7C.3 adds a read-only, advisory-only Operator Intelligence Packet. It synthesizes existing dashboard posture, advisory memory context, live operations context, Markov forward-test evidence, xStocks observation posture, and tactical crypto posture into one deterministic operator briefing.

This phase increases daily operator usefulness without weakening the safety model.

## Scope

Allowed:

- Read-only fixture synthesis.
- Deterministic operator packet generation.
- Validation of allowed output states.
- Firewall confirmation that the packet cannot authorize actions.
- Negative safety fixtures for critical alerts, dirty trees, runtime `.py` files, unsafe memory, unavailable Markov evidence, execution enablement, wallet enablement, and broken immutable guarantees.
- Source integrity checks for network calls, filesystem writes, credential values, and dynamic code execution.

Forbidden:

- No trading.
- No wallet use.
- No execution adapter.
- No network writes.
- No Supabase client.
- No Open Brain client.
- No governance mutation.
- No review queue clearance.
- No strategy/model/provider/threshold mutation.
- No memory promotion.
- No Markov-generated entry trigger.

## Output states

The packet emits these eight operator states:

| State | Allowed values |
|---|---|
| `systemHealth` | `healthy`, `degraded`, `blocked` |
| `marketRegime` | `risk_on`, `selective`, `hostile`, `unknown` |
| `barbellPosture` | `accumulate`, `observe`, `defensive`, `blocked` |
| `tacticalPermission` | `allowed`, `caution`, `blocked` |
| `xstocksPosture` | `observe`, `simulate`, `review` |
| `memorySignal` | `relevant`, `weak`, `none`, `excluded` |
| `markovSignal` | `supportive`, `caution`, `veto`, `unavailable` |
| `operatorAction` | `review`, `stand_down`, `investigate`, `update_watchlist` |

## Immutable guarantees

v7C.3 asserts the following guarantees:

- `packetCannotAuthorizeActions`
- `packetCannotMutateGovernance`
- `packetCannotTriggerWrites`
- `packetCannotClearReviewEntries`
- `packetCannotAlterStrategyModelProviderThreshold`
- `packetCannotEnableTradingExecutionWallet`
- `packetCannotPromoteToGovernance`
- `packetIsReadOnly`
- `memoryCannotCommandPacket`
- `markovCannotTriggerEntry`

## Validation command

```bash
npm run v7c3:operator-intelligence
```

Expected local result from the build dry run:

```text
Tests passed: 49
Tests failed: 0
Total:        49
```

## Default fixture result

The default fixture produces a defensive operator posture:

- `systemHealth`: `healthy`
- `marketRegime`: `hostile`
- `barbellPosture`: `defensive`
- `tacticalPermission`: `blocked`
- `xstocksPosture`: `simulate`
- `memorySignal`: `relevant`
- `markovSignal`: `veto`
- `operatorAction`: `stand_down`

This is intentional. The packet favors stand-down behavior under hostile tactical conditions and treats Markov as a veto/caution layer only.

## Phase boundary

v7C.3 does not authorize v7C.4 or any execution, live VPS mutation, governance change, review queue clearance, memory promotion, or trading capability. Any next phase requires a separate authorization gate.
