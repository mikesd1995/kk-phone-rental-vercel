# KK Phone Rental — Admin Upstream Resilience Hardening

Date: 2026-09-18  
Branch: `admin-upstream-resilience-20260918`  
Scope: Admin read-path / System Guard / Apps Script upstream diagnostics only

## Incident observed

The Admin System Guard reported one upstream failure:

- `Apps Script JSON Response = FAIL`
- Snapshot `events`, `bookings`, `current_bookings`, and `assets` became unavailable/null.
- Snapshot validation then failed as a downstream consequence.
- Public Event Feed, Public Package/Price Feed, and Override Feed were still healthy.

Vercel production runtime logs independently showed intermittent `POST /api/kk-admin` HTTP 502 responses during the same operating window, mixed with successful 200 responses. This confirms a real intermittent Admin upstream/read-path failure rather than only a UI rendering issue.

## Root-cause boundary

The code path confirms that Admin snapshot/system-health depends on `KK_ADMIN_SCRIPT_URL` returning JSON from the deployed Apps Script Web App.

The current connected Vercel tooling does not expose project environment-variable values or mutation, and the available connectors do not expose Apps Script deployment/access configuration. Therefore this hardening does **not** claim that the live `KK_ADMIN_SCRIPT_URL` or Apps Script Web App permission was repaired.

The remaining production configuration check is:

1. Verify the active Apps Script Web App `/exec` URL in **Deploy > Manage deployments**.
2. Open that `/exec` URL in an incognito browser and confirm it does not require Google sign-in and returns the expected API response.
3. If the deployment URL changed, replace `KK_ADMIN_SCRIPT_URL` in Vercel production and redeploy.
4. Run System Guard again and require a healthy Apps Script JSON response and valid snapshot.

Do **not** overwrite the observed deployed Apps Script 9_5_9 behavior with stale repository Apps Script source.

## Changes

### `server/upstream-response.js` — new

Introduces one shared upstream response classifier:

- `GOOGLE_AUTH_HTML`: Google login/auth page returned instead of JSON.
- `GOOGLE_DRIVE_DOCS_HTML`: Drive/Docs/Sheets document page returned instead of JSON.
- `GENERIC_HTML_RESPONSE`: other HTML response.
- `NON_JSON_RESPONSE`: opaque non-JSON response.

Also adds a safe protocol-log formatter that records only:

- failure code
- HTTP status
- content type
- host
- action

It deliberately does not log API keys, PINs, request bodies, response bodies, Sheet rows, or customer data.

### `api/kk-admin.js`

System Health and general Admin proxy now use the shared classifier.

Improvements:

- Stops collapsing all Google HTML into a generic “Drive/Docs” diagnosis.
- Distinguishes Google sign-in/access failures from an actually wrong Drive/Docs URL.
- Includes a machine-readable failure class and upstream HTTP status.
- Emits only sanitized protocol metadata to runtime logs.
- Gives a failure-specific recovery suggestion.

### `api/kk-admin-snapshot-v5.js`

Snapshot upstream failures now preserve protocol context:

- `SNAPSHOT_UPSTREAM_NON_JSON`
- `upstream_failure_class`
- `upstream_status`
- actionable `suggestion`

JSON upstream failures also expose `retryable=true` only for transient HTTP classes such as 408, 429, and 5xx.

No internal 55-second snapshot re-fetch loop was added because the Vercel function budget is 60 seconds; a second full server-side attempt could violate the execution budget.

### `admin/admin.js`

#### Bounded retry

Snapshot remains capped at two browser attempts. Retry now covers transient failures in addition to timeout:

- upstream timeout
- upstream transport error
- explicitly retryable upstream response
- HTTP 408
- HTTP 429
- HTTP 5xx

Known configuration/protocol failures are not converted into an unbounded retry loop.

#### System Guard dependency classification

Previously a single Apps Script upstream failure produced multiple red FAIL rows:

- Apps Script JSON
- Snapshot events
- Snapshot bookings
- Snapshot current_bookings
- Snapshot assets
- Snapshot validation
- Snapshot latency

That made one root cause look like several independent failures.

Now, when an upstream root failure is detected, the Apps Script/root row remains **FAIL** while snapshot-dependent checks become **WARN / blocked by upstream root cause**. The operator is instructed to repair the upstream once and re-run the check.

Existing Last Known Good behavior and stale-write blocking remain intact: a failed refresh does not silently replace valid in-page operational context with empty/null data, and writes are blocked while the snapshot is stale.

### `package.json`

Adds `server/upstream-response.js` to `npm run check` syntax validation.

## Regression coverage

### `tests/upstream-response-classification.test.js` — new

Covers:

- Google auth/login HTML
- Drive/Docs HTML
- generic HTML
- non-JSON text
- sanitized logging with no response-body leakage

### `tests/snapshot-upstream-error.test.js`

Strengthened to assert that sign-in HTML is classified as `GOOGLE_AUTH_HTML` and produces the access/deployment-specific recovery instruction.

### `tests/snapshot-health.test.js`

Adds a System Guard regression ensuring that one upstream failure remains one root FAIL and dependent snapshot checks are warnings rather than duplicated independent failures.

## Safety / non-changes

This hardening does not:

- modify Google Sheet business rows
- modify bookings, events, prices, assets, inventory, or customer data
- deploy Apps Script
- change Scanner, Verifier, or Canary
- change Machine SOT policy
- expose or record API keys or Admin PINs
- automatically rewrite Vercel environment variables

## Expected operational improvement

Before:

`Apps Script HTML/non-JSON -> snapshot unavailable -> multiple indistinguishable FAIL rows -> operator may chase several false root causes`

After:

`Apps Script response classified -> one explicit root cause -> downstream checks marked blocked -> bounded transient retry -> Last Known Good retained in browser -> writes remain fail-closed while stale`

This reduces misleading diagnostics and makes intermittent transport failures more recoverable without weakening write safety.

## Remaining acceptance gate

The code hardening can pass CI/preview independently, but production Admin cannot be declared healthy until the live Apps Script Web App endpoint/access configuration is verified and System Guard returns:

- Apps Script JSON Response: OK
- Snapshot required arrays: valid
- Snapshot validation: OK
- backend/spreadsheet identity checks: acceptable

## Rollback

All changes are isolated to this branch/PR. Rollback is a normal Git revert of the hardening PR. No Sheet/App Script data migration is involved.


## Validation status

- Pull request: #54 (draft during acceptance).
- GitHub reports the branch cleanly mergeable with `mergeable_state=clean`.
- Vercel preview deployment `dpl_46YpnH7VNsMQopoQDmg68feTVegG` completed successfully and reached `READY`.
- The commit status for the branch head is `success` from Vercel.
- The preview Admin login page returned HTTP 200 with the expected no-store/security headers.
- No GitHub Actions workflow run exists for this commit, so this record does **not** claim that the repository's full `npm test` suite ran in CI. Production merge remains gated on explicit test/acceptance evidence or review.
- Production was not changed by this PR at the time of this record.
