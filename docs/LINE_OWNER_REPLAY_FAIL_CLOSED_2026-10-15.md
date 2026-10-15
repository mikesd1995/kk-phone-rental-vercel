# LINE Owner Postback — Fail-closed Replay/Notification Safety (2026-10-15 ICT)

**Scope:** Existing Draft PR #742 (branch `fix/line-owner-decision-replay-20261014`), source base `c31da558914af401574f3f5907e342bf8f803239`. No modification to Gemini-owned PR #744, no main merge, deployment, customer message, booking/stock/price/ACL mutation or paid services.

## Root cause / comparison
- Branch #742 already rejects mismatched canonical booking ID, stops duplicate sends for literal `idempotent_replay:true`, and sends customer before owner acknowledgement.
- **P0 gap:** Missing/non-boolean canonical replay flag previously allowed an extra LINE push. This includes string `"true"` and absent flag; ambiguous prior sends must never be guessed.
- Existing replay handling reported a normal CONFIRMED/CANCELLED outcome even though the previous provider delivery has no durable receipt.
- #706 adds separately gated V2 version/expiry challenge and Apps Script writer; NOT cherry-picked without canonical source acceptance. #700 uses durable outbound delivery/inbox persistence; requires independently reviewed Supabase and LINE integration. Three branch versions of `server/line-booking-owner-approval.js` are distinct (not interchangeable).

## Minimal fix on #742
1. Require literal boolean `idempotent_replay` after matching booking ID and status, before any LINE API send. Non-boolean fails with `LINE_OWNER_DECISION_REPLAY_READBACK_REQUIRED`.
2. On true: return `ALREADY_APPLIED` with `decision_status`, `requires_manual_delivery_review:true`, and zero notification counts; this is not a delivery receipt. Customer contact is not required to suppress a proven replay.
3. On false: retain canonical customer contact requirement, customer push **before** owner reply. No automatic resends after provider-ambiguous failure.
4. Update old test fixture to explicit false and replay expectation; add focused no-network tests for invalid flags, approve/reject replay, missing customer contact, authorization and order.

## Verification and outstanding gates
- Isolated exact-source JavaScript V8 preflight: **22/22 assertions PASS**, synthetic crypto/LINE/App Script mocks, network calls only to mocks; source/new test syntax evaluated. Not Node `npm test`, hosted CI, Apps Script write or real LINE receipt.
- Need owner-controlled native Node 20+ full tests and review of webhook replay/authorization and an independently verified Apps Script `idempotent_replay` boolean readback before future merging.
- A locked booking decision can still lose customer delivery after a provider/network failure. **Exactly-once delivery is NOT solved** until a durable outbox and provider receipt are admitted. Never send a second message solely on retry.

## Other independent PR collisions (READ-ONLY)
- Storefront #727 / #725 / #722 / #711 share source/scripts/CSS; #727 is proposed integration of hero+poster but is not accepted without exact-head viewport TH/EN Dark/Light, booking prices, owner hidden events, and poster load/crop QA. Do not blanket merge/close old PRs.
- Scanner #720 / #732 / #695 all touch `server/kk-ultra-deep-runtime-runner.js` with distinct blobs and different PR bases; reconcile known-miss official source/date handoff, timeouts and zero-write/owner-day guards before a bounded candidate can be promoted.
- Gemini owns #744 Private Core/Revenue/Workflow work; keep it separate.

## Rollback
Revert this isolated commit on #742 only; leave main, #744, #700, #706, #727, #720, all Production deployments and private business state unchanged.


## Follow-up exact GitHub HEAD evidence (2026-10-15)

**Pushed and fetched** at commit [`14e36851a2a3b587a622e7b892c9161ef9ca8c78`](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/14e36851a2a3b587a622e7b892c9161ef9ca8c78), PR #742 Draft/Open. Verified changed file set since prior PR head: source, pre-existing test adjustment, new isolated regression file and this evidence document.

**Independent exact-source test readback:** fetched `server/line-booking-owner-approval.js` blob `4f70fe2ff67cda5b6e5b6e0928df4738c8a49d56` and `tests/line-booking-owner-approval-replay-failclosed.test.js` blob `ca8ca1c3b1b8d6da95a33d880cd31e56d88c289d`. Executed **4/4 authored Node-style callbacks / 33 assertions PASS** in an isolated JavaScript V8 executor with mocked `node:test`, assert, HMAC/Buffer, Apps Script and LINE fetch; no network or production writes. Earlier pre-commit manually authored preflight: 22 assertions PASS. These checks **DO NOT replace** native Node full suite, actionlint or hosted CI, which remain unverified. The latest GitHub PR-triggered workflow-run check returned none; this does not prove universal runner/billing silence.

**Canonical source compatibility readback:** current `main` `apps-script/Code.gs` Git blob `6f923036855cd13e58a0ed9c1154fef746ca1ad8` defines `kkApiDecideLineBookingPending_`; both the same-decision replay branch and pending-to-decision branch emit literal `idempotent_replay:true` / `false`, respectively, under document lock and with readback. Thus exact Boolean contract is consistent with source as inspected, though deployed Apps Script version and live runtime have **NOT** been independently verified.

**Storefront P0 finding, no UI mutation:** on draft #727 source `script.js` blob `d0ceccea7fb8af035f65662c2ec6549c8a27884d`, `startingPriceFor()` still considers sold-out `p.avail=false` packages and `buildBookingMsg()` still has a hardcoded Thai introduction and model label. Exact #711 patch fixes both, but #727 has substantial unrelated hero/poster changes, so port only these two source adjustments with targeted tests **after registered `storefront_ux_review` and visual QA gates**. Do not mass-merge #711 into #727 or change price SOT. Source-only discovery, not a rendered/browser QA PASS.

**Scanner integration finding, no runtime mutation:** shared `server/kk-ultra-deep-runtime-runner.js` has three distinct blobs on #720 (`6b23b9d1cacc93c00c3275daf55ebcd42a12715f`), #732 (`682f90b5462078d41154df363692895d50f90818`) and #695 (`404b70b65e9d2ae82f2b7c78b68b9dc88df0e112`). #720 is main-based, while #732 and #695 are stacked onto different parent branches. Preserve each branch's date/source recall, source availability, timeout, booked-day, owner-hidden and `production_writes=0` contracts. Do not automatically merge source merely on overlapping filenames.

**Release gates still HOLD:** no owner-approved merge, no Production/Preview Deploy, no direct LINE webhook test, no live owner postback, no Google Sheets/Booking/ACL write, and no new paid service. Preserve Gemini-owned #744 HEAD independently.
