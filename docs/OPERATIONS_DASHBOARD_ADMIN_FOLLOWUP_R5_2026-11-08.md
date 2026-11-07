# KK Phone Rental — Admin Operations Dashboard R5: server-side privacy boundary

**Date:** 2026-11-08 (Asia/Bangkok)  
**State:** **DRAFT / RELEASE HOLD / NOT DEPLOYED**. PR [#851](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/851), branch `feat/ops-dashboard-readonly-v4-20261107`.

## Objective and outcome

The previous V4/R4 client used `GET /api/kk-admin?action=snapshot`, which transported the complete authenticated Admin snapshot to the browser, including raw Booking customer identifiers and payment fields. The UI merely hid those fields. **R5 creates a server-side whitelist boundary** and switches the client to `GET /api/kk-admin?action=operationsSnapshot`. The new route reuses the existing Admin security gate and V5 read-only snapshot service, but requires a **valid signed Admin session cookie**, rejecting legacy-PIN-only access. The old Admin snapshot API and its existing consumers are preserved.

### Before → after

| Boundary | Before R5 | After R5 (tested with fixtures only) |
|---|---|---|
| Browser network response | Raw full Admin snapshot (customers, contact, payment fields present) | Server allowlisted Events, Web Ready, package pricing/stock and minimal Owner Lock fields only |
| Booking identifiers | Raw `booking_id`, customer name/phone/payment fields | Ephemeral per-response HMAC pseudonyms of booking IDs, event ID and booking status; duplicate-ID checks retained, no original IDs transmitted |
| Authentication | Existing Admin snapshot accepts signed session or legacy Admin PIN | Dedicated `operationsSnapshot` action requires **signed session**; legacy PIN alone receives 401 |
| Untrusted raw API response | Would be accepted by the dashboard client if structurally valid | Client demands `projection_version=kk-admin-ops-projection-v1`; otherwise HOLD with hidden UI |
| Error handling | Upstream errors could be exposed in Admin snapshot responses | New dedicated projection returns generic error codes; raw upstream body is discarded on errors |
| Business writes | None | Still none. No changes to Booking/Price/Stock/Visibility/X/ACL |

## Changed files, isolated on PR #851 only

1. `server/kk-admin-ops-projection.js` (new): pure allowlist, maximum dataset bounds, ephemeral HMAC pseudonymization, fail closed for missing required arrays and malformed rows.
2. `api/kk-admin-snapshot-v6.js` (updated): signed-session-only `operationsSnapshot` GET action, internally delegates to existing V5 snapshot. Projects response **before** sending bytes; no new public API endpoint or DB, and preserves other actions.
3. `admin/operations-dashboard.js` (updated): reads dedicated projection action; rejects any unprojected raw Admin snapshot.
4. `tests/kk-admin-ops-projection.test.js` (new): PII/secret exclusions, duplicate preservation and pseudonym rotation, completeness/size, server → UI contract.
5. `tests/kk-admin-ops-route.test.js` (new): cookie requirement, V5 query handling, upstream error sanitization, rejection without API authorization, path restoration.
6. `tests/operations-dashboard-readonly.test.js` (updated): fixtures represent projected data and raw Admin response refusal.
7. This dated R5 handoff.

**No changes** to `middleware.ts`, `vercel.json`, live Apps Script, Admin session implementation, main branch, PR #744, PR #813, Google Sheets, customer records or production runtime. No new dependency or runner.

## Test evidence — scoped, synthetic, not release acceptance

- Node syntax checks for all changed JavaScript: PASS.
- `node --test tests/*.test.js` on this isolated candidate: **38/38 PASS**, covering privacy projection and both the existing UI normalizer and new handler route.
- Chromium via synthetic local harness: **11/11 general Admin**, **5/5 Core visibility**, **4/4 Apps Script degraded**, and **1/1 raw-projection-denial** tests PASS. Total **21 browser checks**, no observed JavaScript errors. Mobile viewport 390px did not overflow in the earlier mock-UI suites.
- Source blobs in GitHub verified exact after each write. `git hash-object` values available in `manifest-r5.json`.
- **Important limitation:** these tests do not exercise a hosted Vercel function, real signed cookies on a Preview, real private Sheets data authorization, actual cross-origin headers, live Vercel deployment or full native-repo CI.
- `git ls-remote` from local runtime failed DNS (`Could not resolve host: github.com`), so native `npm run code:context`, `npm run code:test`, full `npm test`, `npm run check` **could not be executed from a full repo checkout**. Do not misrepresent the scoped Node tests as full CI.

## Security and reviewer observations (not independent approval)

- Privacy assertion pertains only to the **new Operations response**. The existing full Admin snapshot action remains available to already-authorized Admin users for legacy operations. This PR does not revoke those privileges or claim system-wide data minimization.
- Per-booking event/status entries and unstable pseudonyms are still internal operational data, so the endpoint must remain authenticated with `Cache-Control: no-store`; do not expose to public storefront.
- The handler temporarily changes `req.url` only for the duration of the awaited V5 read, restores it afterwards, captures V5's one-shot JSON response via `res.end`, and emits only allowlisted JSON. This is tested with a V5 mock, **not yet proven against the hosted runtime**.
- The proxy fails closed on malformed input, missing arrays, invalid row shape, huge source arrays and non-200 upstream status. Unexpected `res.write` streaming outside V5's current JSON contract has not been evaluated in hosted runtime.
- The Dashboard still treats missing Owner Locks, historical data, public GViz fallback, pricing ambiguity, stock mismatch and lack of verified Production + X Post Log as HOLD.
- R4 source reconciliation (read-only): `01_Events` 438, `08_Web_Ready` 438 with 93 `show`, `09_Web_Packages` 1,314 rows. BTS World Tour Arirang 2026-12-03 and 2026-12-05 remain `show` despite phone_count=0 and lens_only=1. No change to the governed Sheets/stock truth.
- **Independent Reviewer requirement not met.** The above is an implementer-side safety audit, not a sign-off.

## Release gates that MUST remain closed

1. Registered `storefront_ux_review` (pre-implementation) and `storefront_visual_qa` (post-implementation) under the Agent Gateway, including persistent evidence and mobile visual acceptance, remain unverified. Screenshot/mock tests are insufficient.
2. Independent security/engineering Reviewer must inspect the API transport change and sign off. Any P0/P1 must be remediated.
3. Exact-HEAD code-context selection, targeted and full repo CI, browser Safari/Chrome, hosted Preview signed-session negative auth, CSP, caching and real redacted-response inspection must pass. The connected GitHub/Vercel tools reported no Actions runs/statuses/reviews/Preview on the preceding R4 HEAD; re-check the final R5 HEAD.
4. Verify project source of truth and current Codex changes, including open Draft PR #744 and PR #813, and independently assess any private reader/cookie rotation.
5. Production release requires owner-controlled approval, zero added spend, explicit rollback plan, and exact live readback. **Do not merge or deploy on this document alone.**

## Rollback and cross-chat resumption

- R5 changes are isolated to Draft PR #851. To restore prior state, revert the R5 commits in that isolated branch or close the unmerged PR. No Production rollback is needed because this work has not been deployed.
- Read `AGENTS.md`, `docs/OPERATIONS_DASHBOARD_ADMIN_INTEGRATION_2026-11-07.md`, R3, R4, then this R5 handoff first. Verify live PR HEAD, repo main, all CI/reviews and Vercel state afresh.
- Historical V3 offline and V4/R4 ZIP files remain in ChatGPT Library `/kk phone rental/dashboard/admin-v4/`. R5 package contains sanitized source, synthetic fixtures and test evidence, not customer spreadsheet data.
- This handoff is a factual readback of completed code and tests. **Current business status: Admin legacy exists; Operations Dashboard V4/R5 is not yet reachable on Production.**
