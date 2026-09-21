# GitHub OIDC Witness Timestamp Precision Fix — 2026-09-21

## Classification

ROOT_CAUSE_PROVEN / FAIL_CLOSED / ZERO BUSINESS WRITES

## Triggering incident

v4.9.21 and v4.9.22 natural witness windows produced no rows in `public.kk_runtime_expectations` even though:

- the GitHub-OIDC witness Edge Function was ACTIVE;
- deployed Edge source matched repository source;
- the database kill switch was TRUE;
- native Scanner/Verifier/Canary/HF remained OFF;
- the runtime ledger was otherwise clean.

The v4.9.22 schedule was already moved from minute `:00` to `:07`, but the first eligible post-change slot still produced no ledger row.

## Proven root cause

The workflow helper rendered Bangkok timestamps by:

```js
new Date(ms + BANGKOK_OFFSET_MS).toISOString().replace('Z', '+07:00')
```

`Date.prototype.toISOString()` includes milliseconds, so the represented top-of-hour value was:

```text
2026-09-21T22:00:00.000+07:00
```

The Edge Function's fail-closed contract accepts exactly:

```text
YYYY-MM-DDTHH:00:00+07:00
```

with no fractional seconds. Therefore `readTrigger()` rejected the payload as `TRIGGER_SCHEDULE_INVALID` before any expectation insert.

## Repair

The workflow now strips the millisecond component explicitly:

```js
toISOString().replace(/\.\d{3}Z$/, '+07:00')
```

and performs a local workflow-side `TOP_HOUR_BANGKOK` guard before sending the request.

A regression test executes the exact helper expression extracted from the workflow and requires:

```text
2026-09-21T22:00:00+07:00
```

for the deterministic 15:00Z fixture.

## Safety

Before staging the patch the canonical control row `github_oidc_witness_v1` was set FALSE with exact readback.

The repair does not:

- backfill any missed natural slot;
- create synthetic witness credit;
- enable Scanner, Verifier, Canary or HF;
- authorize Scanner business runtime;
- mutate Candidate, event truth, pricing, booking, inventory, notification, provider or customer state;
- weaken GitHub OIDC claim validation;
- add secrets or paid dependencies.

Witness certification remains 0/6 until a later valid natural scheduled occurrence is observed after controlled re-activation.

## Re-activation gate

Do not set the kill switch TRUE until:

1. exact-head CI passes the executable timestamp regression;
2. the patch is merged to current main;
3. current main CI passes;
4. workflow remains schedule-only at `:07`;
5. Edge source/identity remain unchanged and healthy;
6. native Scanner/Verifier/Canary/HF remain OFF;
7. ledger remains clean with no synthetic/backfilled row;
8. the current Machine-SOT policy explicitly adopts the timestamp-format repair.

After activation, only the first valid natural post-repair scheduled row may start the new 0/6 -> 6/6 certification streak.
