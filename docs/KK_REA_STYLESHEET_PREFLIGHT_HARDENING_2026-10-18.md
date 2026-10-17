# KK REA pilot: effective stylesheet source gate — 2026-10-18

## Why this was necessary
The existing offline REA preflight checked whether CSS files were present, but **did not block** a source HTML document that failed to load both primary screen stylesheets. An apparently ready source could therefore omit or reverse the active CSS links. This is a verified diagnostic false-green risk, **not evidence that KK's live site is broken**.

## Work done — research branch only
- Added `scripts/kk-rea-stylesheet-safety.cjs` to statically verify exact active primary CSS ordering:
  1. `style.css`
  2. `/assets/kk-storefront-v5.css`
- Ignores comments, recognizes attribute order/case and URL cache-busters, and excludes disabled/alternate, print and conditional/unverifiable media cases from an unconditional screen-CSS readiness claim.
- Integrated the gate into `scripts/kk-rea-readonly-preflight.cjs`. Missing or invalid CSS produces blocker `PRIMARY_STYLESHEET_SOURCE_CONTRACT_FAILED` and `status=BLOCKED` rather than false READY.
- Updated the preflight's synthetic ready fixture and added an assertion that removing the second stylesheet correctly blocks. Added `tests/kk-rea-stylesheet-safety.test.js` with 5 focused tests.
- **No** package.json, HTML, CSS, APIs, customer data, Google Sheets, booking, LINE, permissions, Vercel config, Production, automation or build/deploy change.

## Verified results, exact scope
- Local Node v22.16.0 built-in `node --check` and `node --test tests/kk-rea-stylesheet-safety.test.js`: **5/5 PASS**, zero dependencies and network requests. Test covered correct order, missing/duplicated/swapped links, disabled/alternate/print/conditional media, comments/case/query, remote lookalikes.
- Exact saved GitHub blobs independently equal local test input bytes:
  - `scripts/kk-rea-stylesheet-safety.cjs` = `d62b32c75f2df4693c3678d446ed70e28b84d2d2`
  - `tests/kk-rea-stylesheet-safety.test.js` = `797642ffaffe17c8c53d921170a6acec9a4660f2`
- Compiled the integrated preflight and test JavaScript sourced *directly* from the research branch (V8 syntax check). Ran **7/7 PASS simulated in-memory integration scenarios** using fake files/URL; these are explicitly **not** Node's standard test runner, real browser/CDP, or deployed-app acceptance.
- Compared source HTML as fetched from both `main` and deployed Git commit `44de0066f0c7edd59e153b2d31c22d65b84de5af`. Both include the two active CSS sources in the correct order and return static contract `PASS`. Source blobs: main `70c7b53336ea12478a00a0dec1359a01776c49ff`, deployed `73acb944d20e8257048da64b66e7c8f5b1eac9ee`. This is **source** verification; it does not prove the browser received the CSS or that computed styles are right.
- The historical existing 11-test suite was previously run on the earlier version; **the updated integrated suite was NOT rerun through Node's test runner on a full repo checkout in this turn**. No full KK CI or iOS Safari acceptance is claimed.

## Remaining blockers — do not declare REA or P0 complete
1. This environment only has Node 22.16.0; REA's Node 22 minimum is 22.19.0. GitHub/npm DNS is unavailable, so no official REA installation or real REA execution is possible here without a suitable free separate runtime.
2. Browser attachment to the live KK site, production screenshots/computed CSS, API/booking/customer state, and iOS Safari were not tested; there is no proven customer-facing fix to ship.
3. Existing `main` differs in `index.html` and storefront CSS from the exact deployed commit. Do not apply main-branch visual conclusions to Production without refreshing both refs.
4. Before any production release, run complete exact-head tests, Storefront Visual Acceptance with actual browser network, necessary owner approvals and Safety Gates. No Merge/Deploy permitted in this research phase.

## Reproduce when a complete checkout is available
```sh
node --check scripts/kk-rea-readonly-preflight.cjs
node --check scripts/kk-rea-stylesheet-safety.cjs
node --test tests/kk-rea-readonly-preflight.test.js tests/kk-rea-source-parity.test.js tests/kk-rea-stylesheet-safety.test.js
node scripts/kk-rea-readonly-preflight.cjs
```
An offline preflight exit 2 means a deliberately blocked condition; it is not an actual REA runtime result. Use a supported Node version for any actual REA trial.

## Cross-chat continuation
This file complements `docs/KK_REA_READONLY_PILOT_2026-10-17.md` and GitHub Issue #765. Research branch: `research/kk-rea-readonly-preflight-20261017`. Release acceptance remains **NOT EVALUATED**. No new paid resources, client data changes, deployment, Merge, approval bypass or automation action.
