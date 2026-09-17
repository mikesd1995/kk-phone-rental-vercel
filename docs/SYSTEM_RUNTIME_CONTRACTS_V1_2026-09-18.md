# KK System Runtime Contracts V1

Date: 2026-09-18
Branch: `system-runtime-contracts-v1-20260918`
Baseline: `d8336eefdfce5dfb2a74da7c8ebe30597e860e32`

## Objective

Convert recurrent KK Phone Rental production incidents into executable repository contracts without adding a new scheduler, writer, queue, or production integration.

This change is intentionally zero-production-write.

## Added contracts

### Control Plane

`server/control-plane-contract.js` codifies the acceptance distinctions that were previously enforced mainly by runtime policy:

- task ON before the natural boundary;
- launcher metadata advancement is not runtime proof;
- exact-one `CORE_SHARED_WRITER` + role-lock boundary;
- exact-one role Manifest;
- terminal Manifest;
- exact lock RELEASED state;
- no unresolved PREPARED/COMMITTING transaction;
- canonical task remains ON after runtime;
- only then is a natural occurrence an acceptance candidate.

It also freezes the canonical 22-column Manifest and 23-column Write Transaction header contracts, checks strict `MAX+1` fencing, and rejects partially appended lock rows as malformed evidence rather than treating them as valid active writers. This regression was added after the 2026-09-18 04:30 Verifier occurrence left only the CORE scope/run identity without status, lease, fence, role lock, Manifest, or transaction.

### Event Bridge replay

`server/event-lineage-replay.js` performs repeated zero-write replay through the existing `tracker-core-lineage-v1.1` contract.

It verifies deterministic records while preserving these invariants:

- Core IDs are opaque;
- SHOWSET is date-scoped;
- one show instance maps to one Core event;
- one Core event maps to one show instance;
- resolver uses explicit mappings only;
- replay performs zero production writes.

The regression fixture deliberately includes PLAVE with a Core ID containing the historical `20261026` text while the authoritative event date is `2026-10-10`.

## Audit CLI

Run:

```bash
npm run audit:system -- ./snapshot.json
```

The CLI accepts exported evidence only. It does not connect to Google Sheets, task registry, Vercel, Make, or providers, and it performs no writes.

A non-acceptance Control Plane occurrence exits with code 2 so CI/manual audit wrappers can fail closed.

## Regression coverage

New tests cover:

- task-off before boundary;
- launcher-only / missing Machine-SOT runtime;
- missing Manifest;
- task turning OFF after a real runtime;
- half-materialized runtime lock records (for example CORE lock identity written without status/lease/fence);
- unresolved transaction;
- duplicate runtime identity;
- acceptance counting;
- 25-cycle deterministic Event Bridge replay;
- opaque PLAVE Core ID behavior;
- zero-write resolver;
- duplicate Core mapping refusal.

## Safety boundaries

- No Apps Script edit/deploy.
- No production Sheet mutation.
- No Scanner/Verifier/Canary task mutation.
- No Event Bridge production writer.
- No Make/provider send.
- No secret or Vercel environment-variable changes.

This is executable safety/diagnostic code only. Passing repository tests is not production runtime acceptance.
