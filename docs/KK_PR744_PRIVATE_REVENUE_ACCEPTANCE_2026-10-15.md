# 2026-10-15 PR #744 — bounded private-revenue reconciliation (draft)

## Verified starting state and why full Gemini patch was not applied
- Repository: `mikesd1995/kk-phone-rental-vercel`; target: `chore/project-cleanup-backlog-20261014`; verified parent HEAD `643cdc1ff98719a7477a4a17be2382f8c866ad84`.
- Gemini-reported SHA `e845c134d1b5028e397235531cf06f2546012e1c` was **not found** in GitHub. The Google Drive script still targets older main `d6dc3bfe...` and contains 39 diff paths, including conflicting Router changes.
- Preserve already-staged single `.github/workflows/kk-owner-comment-command-router.yml`, exact OIDC caller pairing, Bangkok date, V2 zero-install and full-booking guard. No second Router.
- Read-only Vercel config: `git.deploymentEnabled={"*":false,"main":true}`; branch remains Draft and no Vercel deploy API called.

## Implemented in this commit
- Ported `server/core-sheet-apps-script-reader.js` and `server/core-sheet-private-reader.js` from draft #739; dedicated read-key separation, authenticated private bounded Core read, sanitized failures.
- Ported `server/rental-analytics-booked-quote.js` from draft #737: exact booking ID + event ID + status + package + positive Master X; rejects duplicate/missing/ambiguous active quotes rather than guessing.
- Existing Core and legacy Revenue handlers now route Core Sheet datasets and Master quote through approved Apps Script private reader when `KK_CORE_CANONICAL_QUOTE_PRIVATE_ENABLED=1`. Strict mode forbids falling back to `amount_received` for Future; Actual stays completed collected cash; cancelled and no_show excluded.
- Missing/invalid private reads and quote matches produce generic HTTP 503 in strict mode. With opt-in disabled, legacy dashboard behavior stays unchanged. No new public GViz Master read.
- Synthetic tests + exact-HEAD read-only zero-install PR #744 CI workflow (Node 22; no npm install, artifacts, secrets, provider writes, deployments).

## Acceptance status: **CODE STAGED / CI PENDING / PRODUCTION HOLD**
- Source code syntax/static matching and isolated V8 reconciliation smoke checks performed; native Node full test and GitHub Actions still require confirmed exact-HEAD readback.
- The Gemini 1506/1506 local test claim is NOT validated against a reachable GitHub commit.
- Production Core private-read setup, Apps Script deployment/Script Properties, Vercel env/private feature flags, Google Sheets ACL cutover, actual Rental API readback and PII checks are **not** performed here.
- The real Core Sheet remains `anyone:reader`, which is a P0 privacy concern. Coordinate #739 first, obtain owner approval for reversible Production cutover, revoke public ACL last after private-only acceptance.
- No Merge, Production/Preview deploy, Booking/Price/Stock mutation, LINE/X outbound, Google Sheets ACL change, Feature Flag change, or new paid services.

## Follow-up: exact-head Hosted CI failure and remediation, 2026-10-15
- SHA `54e43aca791273add0b8f124108ef395e127a63d` had Ultra Deep V2 PASS; PR744 focused private Revenue, exact SHA, syntax and source gates PASS; full regression FAIL: 1,523 tests, 1,502 PASS, 21 FAIL. Log: https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38672562727
- Root causes concentrated in historical tests expecting older Workflow/OIDC router structure, monthly query counts, Admin/Storefront copy, missing `path` import, and mock ledger required by current Content Bridge. `server/kk-code-intelligence.js` had real unstable equal-scored route order; file-index tie-break now restores full Inbox routing.
- Drive patch was used selectively, never wholesale. Canonical Router `.github/workflows/kk-owner-comment-command-router.yml` is preserved, no extra listener or secret privilege added. Strong Inbox read-only assertions are retained despite drift in `INBOX_ACTIONS` naming and runtime outbound-capability indicator.
- This is source/test-only remediation, no web UI/booking/pricing changes. The follow-up SHA needs independent Hosted CI readback; do not claim green before test result.

## 2026-10-15 Follow-up: required Ultra Deep recall regression
- User-required Zero-Install CI acceptance now runs `npm run test:ultradeep:recall` following existing exact SHA, no-lockfile, Node 20, syntax and focused V2 checks. No npm install, secrets or provider side effects added.
- Branch was independently updated during review: `54e43aca...` Full 1523 suite had 21 fails, `bda5866f...` reduced these to 1 fail and `7a23556a...` corrected the injected X ledger expectation. These intervening commits are preserved, not rewritten.
- Verified GitHub run evidence: [failed full regression 21 cases](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38672562727), [subsequent 1-case failure](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38673270808). New exact-head Hosted CI remains required; no claim of full PASS without its readback.
- Existing Router's exact `workflow_ref` / `job_workflow_ref` security, owner event allowlist, Bangkok `formatToParts`, full-booking guard, and strict private Revenue integration left intact. Production feature flags remain OFF, Google Sheets ACL remains unchanged; PR remains Draft / release blocked pending independent acceptance.
