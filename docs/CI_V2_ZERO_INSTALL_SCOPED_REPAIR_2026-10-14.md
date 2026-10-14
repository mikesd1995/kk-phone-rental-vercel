# KK Phone Rental — GitHub Actions P0 no-cost CI repair, 14 Oct 2026

**Owner scope:** user chose GitHub CI repair only. Strictly no Booking/price/stock/owner visibility/LINE/Sheet modifications, no paid runners, no spending-limit raise, no manually retried workflow, no merge or Vercel Preview/Production deployment.

## Diagnosis — distinguish pre-run infrastructure from runnable source defect

**A. Existing recent PR #736 exact-head CI run admission remains UNRESOLVED.**
- [Visual QA 38506266901](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38506266901), job 115664380139: failure, no exposed steps; [Optional Zero-Cost 38506266902](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38506266902), job 115664380477: failure, no exposed steps. Prior log downloads 404 `BlobNotFound`.
- No evidence the workflow checked out source or ran Node tests. Do not attribute these *pre-step* failures to a JavaScript defect or claim their root cause proven.
- Historical account email 2 Oct: 2,032 / 2,000 included Actions minutes, next reset cited 1 Nov; **live account budget balance, stop-at-limit and permission settings were NOT readable** through connected GitHub app. Successful Oct13 hosted workflow [#724 run 38413734525](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38413734525) has genuine 13 job steps and success, so CI is not categorically broken for all PRs.
- GitHub official status reports a **resolved 13 Oct Actions log processing incident**, but this alone does not diagnose our zero-step failures. GitHub Actions minutes for private repos are billable beyond included allowance; safeguard the owner's $0 constraint and do NOT increase budgets.

**B. Independent, deterministic runnable CI bug in main:**
- `main d6dc3bfe4cc0c4dd6fdfec407823752da0572464` workflow `.github/workflows/ultra-deep-v2-acceptance.yml` (blob `9248f19cc3811d5ad349b1aa19cd31e3c7f787a3`) invokes `npm ci`. Both `package-lock.json` and `npm-shrinkwrap.json` return GitHub repository 404. When a runner reaches the install step, `npm ci` is incompatible with this source tree and can abort the workflow. This is **NOT the cause of the other workflow jobs failing before steps**.
- Scanner Draft PR #720 has a working zero-install alternative; genuine hosted #720/#724 CI runs on Oct13 passed on their own exact SHA. But #720 is a large discovery/scanner proposal (40 changed files); merging it solely to repair one `npm ci` would be too risky.

## Narrow isolated fix staged here (NO PR / NO runner run)

Branch `fix/ci-v2-no-install-scoped-20261014` from `main d6dc3bfe4cc0c4dd6fdfec407823752da0572464`.

Only two source paths modified:
1. `.github/workflows/ultra-deep-v2-acceptance.yml`: replace incompatible `npm ci` with *no-install* two-lockfile guard, exact SHA checkout/verify, read-only token, `persist-credentials: false`, 10-minute timeout, per-PR cancellation, preserve `npm run check` and `node --test tests/kk-ultra-deep-full-loop-v2.test.js`. Set workflow source and safety contract test paths as triggers; explicit `workflow_dispatch` remains.
2. `tests/ci-ultra-deep-v2-workflow-safety.test.js`: 6 built-in Node test cases to check exact-head readback, no executable install, existing tests, time/cancellation, triggers and test wiring. Wired as an earlier workflow check so future regression fails before running V2.

**Verification:** fetched exact-branch workflow and test files via authenticated GitHub connector, executed six contract callbacks in isolated V8 using a mocked `node:fs` reader over real source (6/6 PASS). Also ten direct static invariants PASS before the first commit. This is **NOT** a native `node --test` or hosted runner result. `git compare main...branch` shows exactly 2 changed files. No npm install was executed.

**Why no PR yet:** creating a PR can automatically trigger billable Actions minutes on this private repository. The owner's strict zero-spend constraint and the unverified current included-minute balance prohibit risking automatic runner admission. The branch and this document are available for later exact-head review without triggering a PR now. No source was merged into `main` and this patch is **NOT a current Production CI fix** until governed release.

## Zero-cost runbook / next owner-authorized step

1. Read-only check actual GitHub account [Actions billing budgets](https://github.com/settings/billing/budgets), the `Stop usage at limit` policy, remaining included minutes and reset; and [repo Settings → Actions → General](https://github.com/mikesd1995/kk-phone-rental-vercel/settings/actions). **Do not pay, add a payment method, raise limits, disable required checks, switch to expensive runners or reopen old CI retry loops.**
2. Inspect zero-step job annotations and banner in [latest Visual QA run](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38506266901); preserve exact message if visible, and report to GitHub Support if still inexplicable. GitHub's resolved log-only incident is not proof of runner recovery.
3. Once a $0 eligible runner is confirmed, open a *single scoped PR* from this branch, execute one authorized exact-head run, require `steps>0`, logs, 6/6 actual Node contract tests, `npm run check` and all Ultra Deep V2 Node test passes. Do not merge #720 for this narrow bug.
4. CI recovery alone does **not** authorize merging Storefront/AI Poster PR #736, changing business data, or releasing production: those still require their own exact-head workflows, signed-out visual QA, owner/Verifier gate and available Vercel Hobby quota.
5. If no free-minute access, leave this branch ready, CI issue #707 open, and await confirmed free reset rather than bypassing safety with a paid runner.

**Authoritative handoff:** this document and GitHub CI Issue #707. Keep exact SHA, source-vs-hosted proof and spent-vs-unverified budget clearly separate.
