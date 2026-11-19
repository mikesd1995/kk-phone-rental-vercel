# KK Phone Rental — Operations Dashboard V4, third source-only audit

Date: **2026-11-07 (Asia/Bangkok)**. Status: **DRAFT / RELEASE HOLD / NOT DEPLOYED**. Scope: PR [#851](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/851), branch `feat/ops-dashboard-readonly-v4-20261107`.

## Material verified findings from existing production-source contracts

1. **Stock mismatch**: Prior client logic could mark `phoneReady=true` when `09_Web_Packages` claimed a positive phone/bundle count while `08_Web_Ready.available_phone_count=0`. This misleadingly displayed phones as ready. The updated client now requires a **positive integer phone count from both source views** to consider a phone package ready; lens-only availability cannot reopen a phone rental.
2. **Primary Apps Script snapshot has NO `visibility_locks` array**: Confirmed from repository `apps-script/Code.gs`, function `kkApiSnapshot_`, where the `data` response contains events, web_ready, web_packages, bookings, etc., but not visibility_locks. The V4 client previously threw `SOURCE_INCOMPLETE:visibility_locks` and showed nothing. Fixed: require the four core arrays; if locks are absent, render the calendar/table/QA in degraded **read-only** mode, expose `meta.locksAvailable=false`, show a clear warning, and mark **every event's Owner Lock verification as UNKNOWN/HOLD**. No event can be automatically accepted for X posting.
3. **Apps Script `generated_at` is timezone-less**: Confirmed `kkApiDateTime_` uses `Session.getScriptTimeZone()` and emits `yyyy-MM-dd'T'HH:mm:ss`. Prior independently documented bound-script timezone on 2026-10-09 is `Asia/Bangkok` (see `docs/APPS_SCRIPT_DATE_HOTFIX_2026-10-09.md`). The updated client parses offset-less timestamp with `+07:00` to prevent viewer-browser timezone errors. A future Script timezone change would require revisiting this assumption; do **not** change the script or spreadsheet timezone as part of this UI change.

## Red-to-green reproduction and test evidence

- A new regression with Web Ready phone count 0 but positive `available` package counts **failed** before the patch (15 PASS / 1 FAIL), then passed.
- Two new tests reproducing absent owner locks and timezone-less generated_at **failed** before their patches (16 PASS / 2 FAIL), then passed.
- Final scoped `node --check admin/operations-dashboard.js`: **PASS**.
- Final scoped `node --test tests/operations-dashboard-readonly.test.js`: **18/18 PASS**.
- Existing Chromium mock-auth/browser fixture: **11/11 PASS**, no page errors; width 390px without page-level horizontal overflow.
- Added independent local browser scenario for Apps Script primary shape without visibility_locks: **4 checks PASS** (dashboard renders, warning/HOLD, contradictory stock, X draft gate blocked), no page errors.
- All browser tests use synthetic fixtures; local file-based rendering modifies CSP only in the test harness. **No hosted signed-cookie validation or actual production-data acceptance is implied.**

## Exact-source readback

- `admin/operations-dashboard.js` Git blob SHA: `e801d0b2e87198711d6fb47aecea0c3b3f3995cd`; file SHA-256 to be recorded with the handoff ZIP.
- `tests/operations-dashboard-readonly.test.js` Git blob SHA: `83b9bd9e218142e870edccab31300fe7d8075fba`.
- This round changes only these two preexisting PR paths plus this documentation. No edits to `main`, `api`, `middleware.ts`, `server`, pricing, inventory, booking data, Owner Locks, X or ACL.
- Previously checked `main` SHA: `d4bd11f6ff78f67f41b79a26448d036007737701`.
- Contemporaneous Vercel branch query returned **0 Preview deployments** for the PR's branch; do not claim a live URL.

## Privacy and trust limitations

- **Critical precision**: The UI does not render or persist customer names/phones/payment amounts; **however it reads the existing authenticated full Admin snapshot, so the raw response does reach the authorized browser in memory/network tools**. Do not claim the transport is PII-redacted. A future least-privilege server-side aggregated adapter would require separate security review and tests before deployment.
- This is not a live-proof of storefront or Google Sheets. No public-GViz fallback is added. No `18_X_Post_Log` is in the snapshot; **no real X-post authorization** is possible from this dashboard.
- A missing lock dataset is *never* interpreted as no locks. Unknown status is HOLD; booking integrity and stock conflicts still block draft approval.

## Unresolved gates — strict release hold

1. Registered `storefront_ux_review` preimplementation evidence and `storefront_visual_qa` postimplementation evidence **not present**. Local screenshots are not a substitute.
2. Exact-head complete repo `npm run code:context`, `npm run code:test`, full `npm test`, `npm run check` and GitHub Actions CI **not run**. Local `git ls-remote` failed with DNS `Could not resolve host: github.com`; code changes instead used authenticated GitHub connector and byte-identical readback.
3. No independent Reviewer approval; no hosted Preview cookie/CSP tests, mobile Safari, Core private-source acceptance, real Booking/Owner Lock/X Log reconciliation, or production release readback.
4. Concurrent Admin/stock PRs **#744** and **#813** remain open/Draft (as last observed); check exact HEAD/current status before further writes.
5. Obtain owner-controlled release approval only after gates. No new spend, merge/deploy, Production write, Sheet write, customer action, or scheduled task was performed.

## Continuity and rollback

Read this document **after** `docs/OPERATIONS_DASHBOARD_ADMIN_INTEGRATION_2026-11-07.md` and `docs/OPERATIONS_DASHBOARD_ADMIN_FOLLOWUP_2026-11-07.md`. Preserve earlier V3/V4 Library copies. Next steps: registered UX Gateway review, independent source reviewer, authorized exact-head CI and authenticated Preview; if blocked keep Draft. Any rollback is isolated to the unmerged PR branch; existing Production remains untouched.
