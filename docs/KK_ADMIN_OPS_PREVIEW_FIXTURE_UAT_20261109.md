# KK Phone Rental — isolated Admin Operations Preview UAT (2026-11-09 ICT)

**Status: PREVIEW READY / SOURCE CI PASS / HOSTED SIGNED-SESSION UAT NOT YET VERIFIED / PRODUCTION RELEASE HOLD.**

This runbook belongs to [stacked Draft PR #854](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/854) and must never be used to certify the separate parent [PR #851](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/851) as ready for Production.

## Exact source & deployments

- Parent PR #851 pinned source: `a99a76c0fb5047a596803db318d459bf4cc80f8a`.
- Full CI example for this branch: [run 42575212700](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/42575212700) — full repo tests **2,618 passed**, focused **53 passed**, additional **29 passed**, zero failed. Rerun on newer HEAD before acceptance.
- Preview generated after branch-scoped test variables were created: `dpl_6uJSKxNkxr8roHFo86mht6i6GHuH`, SHA `b18698aaa7edd1e50c5ea13858ed3c3cbbb62a00`, READY. Test URL: https://kk-phone-rental-vercel-d5azcjytd-mikesd1995s-projects.vercel.app/admin/operations-dashboard.html
- A separate earlier `staging` build `dpl_CRujbsqun5LoH6FF8FTezJodpkcS` passed on `e1c1cb0...`; it preceded the branch-scoped test environment and should not be used for final login UAT.
- Production untouched: `kk-phone-rental.vercel.app` deploy `dpl_FEkswA3MqkxamjMeRPFeKRw3ekZN` at SHA `eec14200cb087173ca555fa0c21b99e54c1c3961` (recheck before release).

## Isolation / controls

Exactly four **branch-scoped Preview** Vercel environment entries were created for `feat/ops-preview-fixture-uat-20261109` and their metadata independently read back: `KK_ADMIN_OPS_PREVIEW_FIXTURE` (plain flag), `KK_ADMIN_OPS_PREVIEW_FIXTURE_BRANCH` (plain exact branch), `KK_ADMIN_OPS_PREVIEW_TEST_PIN` (**sensitive**, freshly generated), `KK_ADMIN_SESSION_SECRET` (**sensitive**, separate fresh signing key). Never copy Production `KK_ADMIN_PIN`, Apps Script or Google Sheet credentials here. Do not expose or commit the test PIN or session secret into tickets, logs, screenshots or source.

The synthetic branch validates all conditions at runtime: `VERCEL_ENV==='preview'`, `KK_ADMIN_OPS_PREVIEW_FIXTURE==='1'`, exact branch variable matching Vercel's Git commit ref. Signed Admin cookie is still mandatory. The synthetic route denies every legacy Admin snapshot, health, Make or write action with HTTP 403 while retaining sign-in and authenticated static assets. No real Sheets/Booking/LINE/X read/write is ever needed for synthetic Operations projection; direct Admin guard remains closed without `KK_ADMIN_PIN`.

## Owner-hosted UAT checklist (do not claim done until real network evidence)

1. The owner with legitimate Vercel Deployment Protection access opens the exact Preview domain. Vercel Authentication stays ON. Use the Preview-only testing PIN stored as a **sensitive** environment variable in the project's **Preview / exact Git branch** environment; this is not the Production PIN.
2. Open `/admin` and authenticate via `/api/kk-admin-auth` using that test PIN, then navigate to `/admin/operations-dashboard.html`. Confirm HTTP 200 for signed protected assets, and a cookie with `HttpOnly; Secure; SameSite=Strict`.
3. Browser must show only two **SYNTHETIC** event rows, including one `phone=0, lens=1` displayed as `show_full`; each must remain HOLD for any post/booking decision. Check calendar, table, filters, mobile 320/390 CSS and no PII in actual network responses. Response should include `X-KK-Ops-Data-Class: synthetic-preview-only`.
4. Confirm unsigned `GET /api/kk-admin?action=operationsSnapshot` returns 401; tampered cookie and PIN-only API request also fail; every nonfixture Admin API action returns 403. Do not accidentally send the signing key or PIN in browser/network exports.
5. Close this fixture acceptance as **synthetic transport-only**. It is not evidence of real Google Sheet reader correctness, Core Booking parity, public storefront, or Production. Independently test a least-privilege private read-only source before #851 release.

## Rollback and cleanup

- To disable instantly, remove/disable the exact branch Preview flag `KK_ADMIN_OPS_PREVIEW_FIXTURE` and redeploy; all fixture-only routes fail closed if the Preview-only PIN remains but no `KK_ADMIN_PIN` is configured.
- After UAT, delete the four branch-scoped Preview environment entries, revoke the isolated test identity, and close #854 without merging into main if no longer required.
- Never merge the synthetic fixture flags/passwords into Production or disable Vercel Authentication.
- Maintain the parent #851 Release HOLD pending independent Reviewer, final exact-main CI + real-source PII wire UAT + rollback acceptance. P0 Core anybody-reader, poster anyone-writer and WebReady phone-zero-open defects are separate gates.

## Evidence hygiene

Record only SHA, deployment ID/status, HTTP status codes, security-header existence, source/projection version, row counts, pass/fail and bounded screenshots with all credentials redacted. Do not save customer identifiers, auth cookies, bearer tokens, test PIN or raw private JSON in GitHub.
