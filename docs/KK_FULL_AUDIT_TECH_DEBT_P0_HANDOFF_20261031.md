# KK Phone Rental — Full Audit / Technical Debt P0 Repair Checkpoint (31 Oct 2026 ICT)

> **Status: SOURCE-ONLY REPAIR STAGED; RELEASE HOLD.**
> This document is a durable cross-chat handoff. No merge, deployment, customer/booking/stock/price/owner-lock data change, Google Drive ACL change, scheduler activation, Supabase SQL write, or paid service was authorized or executed in this remediation pass.

## Authority / exact baseline
- Repository: `mikesd1995/kk-phone-rental-vercel`
- Independently observed `main` at start: `30425dd2486d5bd979aded89cfa4984b30af142f` (30 Oct 2026 01:34:42 UTC).
- GitHub `main` branch protection: `protected=false`; release gate must not rely on required checks being enforced by GitHub until this is corrected separately.
- Open pull requests: **59** when queried on 31 Oct 2026 (count from GitHub search; not a merged/deployed count).
- Vercel Production listing: latest attempted `dpl_EqcxvWKLmzDSgc3yh4oc2Lcd99bW` was `CANCELED` for the above `main` SHA. Most recent listed `READY` was `dpl_9banmKT1eUQYcnjUoGWKVbi2B4Kn` for `259bc03b6df65fe8c91f07ae2d21ca262c5e2266`. A READY deployment being older does not prove domain association/browser E2E.
- Read-only Analytics Production Watch run `41103101775` failed with `CURRENT_MAIN_DEPLOYMENT_FAILED` because the current main attempt was CANCELED; this is **evidence of release mismatch**, not a check to bypass.
- Related release hold: issue #49; older full audit on 29 Oct was `main=12529abb...`, now superseded.

## Safe P0 source repair staged on current-main independent branch
- Branch: `fix/p0-booking-webpackage-current-main-20261031`, initialized from the exact main SHA above. This is a fresh targeted port of previously staged PR #796, **not** a merge of its obsolete base, and does not modify the existing PR #796 branch.
- `apps-script/Code.gs`: in `kkAssertWebPackageBookable_(eventId, templateId)`, replace `if (!eventRows.length) return;` with an explicit exception. Only the missing-derived-packages case is changed; existing package status, price, availability and identity guards remain untouched. Intended invariant: no canonical Booking write when `09_Web_Packages` has no matching rows. The caller's existing `DocumentLock` must also be verified in exact-head and deployed GAS acceptance.
- `tests/apps-script-web-package-fail-closed.test.js`: port the 10-case exact-source test suite from PR #796 HEAD `5e5f07f1b09fb3730a15187fcac05051ed01eb52`. This covers missing rows, different-event rows, healthy availability, hidden lens, zero stock, zero price, wrong template, full package ID normalization, unknown status and malformed numerics.
- `.github/workflows/booking-e2e-acceptance.yml`: add the test to changed-path triggers and the targeted Node test command. Existing checkout SHA guard, zero-write assertion and remaining regression cases are retained.
- GitHub post-write readback confirmed the targeted Apps Script guard and workflow test inclusion on branch. **Actual Node test execution, complete CI, independent code review, GAS deployment parity and Booking E2E have NOT been claimed here.** Confirm the exact PR HEAD and checks before any release.

## P0 blockers independently rechecked via connected owners' systems
1. **Core workbook ACL:** canonical `KK Phone rental backend`, ID `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`, still shows `anyone:reader` (allowFileDiscovery false) in a live Drive metadata read on 31 Oct. This is link-reader privacy exposure, not proof of an exfiltration incident. Related issue #738 / Draft #739. Do **not** remove access before 13-dataset private Apps Script reader parity and Admin/LINE/Booking negative-auth/E2E.
2. **Poster ACL:** one live referenced BTS poster file `1oIzFoFiN3fz4mWUBaP82rtWrgLxptX2z` still shows `anyone:writer`. Scope-limited new check does **not** re-count the historical 242-image/4-folder finding (issue #718). Resolve with owner-only manifest/fingerprint, mock/dry-run, explicit permission approval and signed-out image readback.
3. **Phone availability misclassified as lens availability:** source `08_Web_Ready!A37:J38` shows BTS 03 and 05 Dec 2026 with `phone_count=0`, `lens_count=1`, `booking_status=เปิดจอง`, `web_action=show`. Formula `MAX(G,H)>0` causes this bug in columns I/J; Draft #813 holds the proposed fix. Never reinterpret lens-only stock as available phone rental, and never change live formulas without date-wide booking/owner locks and 3-surface verification.
4. **Production release state:** present main commit does not have a confirmed READY production deployment. Resolve deployment failure/cancellation or explicitly review an existing production target under release gates; do not force deploy/merge without owner release acceptance and exact build/browser evidence.

## Additional technical debt tracking
- Existing Draft PR #809 supplies a read-only Technical Debt baseline. Avoid duplicate baseline implementation; verify and integrate only after exact-head tests and conflict checks.
- Scanner runtime/ledger: issue #777 describes 2 stale QUEUED commands and zero observations as of prior audit. Do not replay; recheck current runtime flags, TTL and fence before changes.
- Commercial pricing: Draft #807 separates phone-only and phone+lens competitor market offers. Do not label inferred numbers as a real quoted median.
- UX / internal notes: Draft #804 / #800 require visual QA before release.
- PR cleanup: 59 open PRs; create a dependency/supersedence inventory before closing or merging them. Keep #796 open until the fresh port is accepted and obsolete work can be closed with verified parity.

## Release and review order (no shortcut)
1. Exact-current-main check, independent diff review, `node --check`, targeted 10-case test + existing Booking tests, full `npm test`, `npm run check`, and code integrity.
2. Exact-HEAD GitHub CI (including `booking-e2e-acceptance.yml`), confirm runner quota/no additional charges and Vercel preview isolation.
3. Deployed Apps Script source/identity check, owner-signed read-only or explicitly approved staging E2E, collision dates, DocumentLock/fencing/idempotency, no fake customer Bookings.
4. Controlled approval before any source/Apps Script rollout, current Production readback, all customer screens and LINE CTA confirmation, rollback available.
5. Independently pass ACL/private reader, phone/lens derived sheet, branch governance and production release gates prior to Stable Business V1 closure.

**Explicit non-achievements:** no complete line-by-line scan of 925 source files in this pass, no full test suite execution, no real customer Booking test, no Production deployment, no security ACL remediation. The technical debt and security findings remain OPEN, not silently fixed by the source-only patch.
