# Admin transient write-admission + uncertain mutation reconciliation — 2026-09-24

## Incident

Production Admin was readable but intermittently blocked all Save/Edit actions because the lightweight Apps Script `phase1Health` probe crossed the 10-second snapshot-side timeout.

Fresh Production telemetry on deployment `dpl_Bk63saxJExDtcDuGvXCnhaC3eznW` showed:

- 2026-09-24 09:52:24 ICT: `WRITE_HEALTH_TIMEOUT` at ~10.003s, `write_health_ok=false`, `stability_state=transient-no-recent-good`;
- 2026-09-24 09:53:04 ICT: the same path passed at ~8.731s;
- direct Sheet reads remained healthy with 96 events / 26 bookings / 13 current bookings / 5 assets.

The defect was therefore an admission problem: a transient health-probe timeout could force the UI into read-only even though the actual mutation proxy permits a bounded 45-second Apps Script write attempt.

## Design correction

### 1. Separate health certainty from mutation admission

Snapshot now exposes:

- `legacy_write_attempt_allowed`
- `write_admission_mode`

Modes:

- `verified`: health probe passed;
- `transient-attempt`: only `WRITE_HEALTH_TIMEOUT` or `WRITE_HEALTH_ERROR`; one real mutation attempt is allowed;
- `blocked`: deterministic/unaccepted failures remain fail-closed.

Transient admission is explicitly limited to operational write actions. Maintenance cleanup is not opened by transient health.

Deterministic failures remain blocked, including identity mismatch, invalid/missing Apps Script configuration, skipped health after a deterministic upstream failure, and deployment/auth/protocol failures.

### 2. Never auto-retry mutations

Admin still generates exactly one `request_id` for each mutation request.

Only snapshot reads may retry automatically.

Mutation requests are single-attempt because a timeout can occur after Google Sheets has already committed the write.

### 3. Booking timeout reconciliation

For `createBooking` and `updateBooking`, an uncertain transport outcome triggers one direct-Sheet snapshot readback instead of an automatic write retry.

`updateBooking`:
- finds the exact persisted booking by row number / booking id;
- verifies every supplied mutable field.

`createBooking`:
- if a row number was returned, verifies that row;
- if the response was lost, compares pre-write and post-write snapshots;
- accepts only one newly-created booking that matches the request fingerprint;
- multiple matches are reported as ambiguous and never retried;
- no match is reported as not confirmed and never retried.

### 4. Non-booking uncertain outcomes

Other write actions remain single-attempt.

If their response is lost, the UI explicitly tells the operator to Refresh and inspect persisted data before attempting another write.

### 5. Safe mutation telemetry

The Vercel proxy now emits `KK_ADMIN_MUTATION` logs containing only safe operational metadata:

- action
- request_id
- transport
- duration
- status
- error_code
- uncertain_outcome

No customer payload, PIN, API key, service-account credential, or business-row content is logged.

Legacy timeout responses now also carry:

- `mutation_outcome_uncertain=true`
- `mutation_may_have_committed=true`
- the original `request_id`

## Safety boundary

This change does not:

- weaken deterministic fail-closed checks;
- retry writes automatically;
- activate Direct Writer;
- change Google Sheet data during deployment;
- change Apps Script source/deployment;
- change Vercel secrets;
- change Scanner / Verifier / Canary / HF / Make.

Direct Writer remains the permanent architectural migration target.

## Files

- `api/kk-admin-snapshot-v5.js`
- `admin/write-policy.js`
- `admin/admin.js`
- `admin/index.html`
- `server/admin-proxy.js`
- `package.json`
- `tests/admin-write-policy.test.js`
- `tests/admin-direct-writer-phase1.test.js`
- `tests/snapshot-upstream-error.test.js`

## Acceptance requirements

Before merge:

1. syntax gate passes;
2. full regression suite passes;
3. transient timeout produces `write_admission_mode=transient-attempt`;
4. identity/protocol mismatch remains blocked;
5. legacy mutation timeout makes exactly one upstream call;
6. booking readback reconciliation tests pass;
7. Preview is READY.

After Production deploy:

1. verify deployment is READY on exact merged main;
2. inspect runtime logs for `write_admission_mode`;
3. verify no new server errors;
4. do not perform synthetic business writes merely for smoke testing; use the next legitimate Admin write as production witness and inspect its `KK_ADMIN_MUTATION` log plus persisted Sheet result.
