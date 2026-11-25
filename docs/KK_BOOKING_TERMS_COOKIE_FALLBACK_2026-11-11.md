# KK Phone Rental — Repeat Terms UI storage bug report and cookie fallback (11 Nov 2026)

## Reproduction report and decision
Owner reported production still shows an unchecked Terms prompt every booking despite PR #859 release. This is a customer-reported failure and must not be dismissed based on green CI. Original production uses **only localStorage**, NOT a cookie, and previous browser QA only tested repeat click within the same page; browser storage may be disabled or isolated across LINE/X embedded WebViews. Root cause of owner's exact case is **not yet proven**; preserve this uncertainty.

## Candidate and isolated scope
- Separate branch `fix/booking-terms-cookie-fallback-20261111` based on production Main `4ea09b4d777d3b27c97c5c34e08bd2381b4f2277`; do not overwrite other work or #856 LINE Login.
- `assets/kk-booking-agreement.js`: retain `localStorage` version reminder and add a fallback **functional, first-party, Secure, SameSite=Lax cookie** with Path=/, Max-Age=180 days containing only `KK-TERMS-2026-11-06`; also in-page transient memory if both storage APIs denied. Read localStorage or cookie, require exact version string and explicit first confirmation; no PII, IDs, bookings, consent receipt or marketing tracking.
- `index.html`: cache-bust the script URL to fetch the changed behavior without stale asset reuse.
- `privacy/index.html`, `en/privacy/index.html`: explicitly disclose the functional cookie, data content, retention, right to clear browser data and limitations.
- `tests/storefront-booking-agreement-remember.test.js`, `tests/storefront-booking-agreement.test.js`: add regressions for blocked storage API, cookie fallback across new document, blocked both storages, stale version and explicit opt-in.
- `scripts/qa/storefront-booking-agreement-qa.cjs`: after real confirmation, test cookie present, repeat after a page reload, fresh tab with localStorage denied, stale Terms in EN, no LINE provider navigation.

## Important scope limitations
- A first-party Cookie cannot bridge different device/browser cookie jars, or reliably survive ephemeral LINE/X WebViews that discard all website state. Cross-browser/cross-device one-time consent needs authenticated LINE Login + server-side versioned acceptance receipt, separately in Draft PR #856 / Issue #855. Avoid claiming 100% cross-app behavior.
- New/cleared browser, changed Terms version, cookie and storage unavailable: first-time unchecked prompt remains by design.
- UI flag (cookie or localStorage) is **not legally authoritative Terms evidence** and never confirms a booking. The customer still must SEND the versioned LINE message and wait for shop confirmation. No edits to signed LINE webhook, Booking, Owner Locks, inventory, event data, scanner or pricing.
- A helper test that clicks a synthetic link and prevents navigation is not a real LINE booking. Never send real LINE messages as tests.

## Release gates / fallback
1. Exact-HEAD native CI tests and multi-width real browser QA must pass, including fresh-page/browser storage fallback. Check build and visual acceptance report separately; successful GitHub workflow exit code alone does not mean `release_ready:true`.
2. Independent reviewer, owner visual & source approval and protected Preview acceptance remain standard release rules. Prior owner blanket exception for PR #859 is **not automatically transferable to a new bugfix PR**.
3. After authorized merge, verify Vercel production READY exact merge SHA, main branch, public script URL, security headers, cookie behavior and error logs. Rollback to previous READY production if a failure arises; the previous code simply ignores the extra cookie.
4. If tests fail, fix root cause (possibly site-specific storage restrictions or third-party browser origin). Do not bypass gates or blindly add cookies with identifying values.

## Evidence / continuity
Canonical incident report lives in this file and PR conversation for the new branch. Source notes on #859 and #855 describe the first-stage localStorage-only mitigation. Update this document/PR with exact HEAD CI and release outcome, including failures, not just generic SUCCESS.
