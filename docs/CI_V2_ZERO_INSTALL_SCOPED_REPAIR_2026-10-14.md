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


## 2026-10-14 follow-up: native Node regression with exact Git blobs

**Independent offline acceptance upgrade (no GitHub Actions or Vercel credits):**

- Fetched existing scoped branch `fix/ci-v2-no-install-scoped-20261014` and immutable main via GitHub connector. Main source `.github/workflows/ultra-deep-v2-acceptance.yml` has blob `9248f19cc3811d5ad349b1aa19cd31e3c7f787a3`. Scoped fix has workflow blob `087ddebfd201843f7745e211a5276da80c41ba4f`, regression test blob `b6461187da7a383bfa5b6d0b81466138db330b98`. A recursive 812-entry HEAD tree has **zero** `package-lock.json` or `npm-shrinkwrap.json`.
- Reconstructed the exact workflow and regression test in a local isolated container; verified all Git SHA-1 blob hashes against GitHub, byte-for-byte, BEFORE tests. Node `v22.16.0`, no dependency installation.
- `node --check tests/ci-ultra-deep-v2-workflow-safety.test.js`: **exit 0**.
- `node --test tests/ci-ultra-deep-v2-workflow-safety.test.js` on scoped fixed workflow: **exit 0, 6/6 PASS, 0 FAIL**, TAP elapsed approximately 55–79ms in separate runs.
- **Negative control:** replaced only the temporary local workflow with the original `main` blob, confirmed exact `9248f19c...` SHA, ran the same 6-test suite: **exit 1; 1 PASS / 5 FAIL**. Restored the exact fixed workflow and reran: **exit 0; 6 PASS / 0 FAIL**. Final restored local blob SHA reverified `087ddebfd...`.
- Parsed the restored fixed YAML using `ruamel.yaml` safe parser: **PASS**; top-level `on` includes `workflow_dispatch` and `pull_request`, one `v2-acceptance` job with six steps. No `actionlint` binary available; do **not** present YAML parsing as official actionlint or GitHub runner acceptance.
- Live GitHub zero-step failure `38506266901` job `115664380139`: still **0 exposed steps**; genuine Oct 13 successful `38413734525` job `115352505381`: **13 executed steps**. This confirms the two very different failure/success classes; source `npm ci` defect is not the cause of a zero-step job.

**What improved:** the staged no-install repair is now **native Node-verified**, with an original-main negative control rather than only a mocked V8 test. No modifications to the executable fix were necessary during this follow-up; do not create a duplicate branch/PR for the same correction.

**Still blocked:** the branch is NOT merged to `main`, source has NOT run in a newly admitted GitHub-hosted runner, current GitHub included minutes / spending budget are NOT exposed by the installed connector, and no official actionlint/full repo test result exists. Opening a PR may trigger automatic GitHub Actions in this private repo, so keep this branch isolated under the owner's zero-spend constraint until a **read-only** billing/budget and workflow admission check confirms a free route. No hosted re-run, billing change, paid service, merge, deploy or production write occurred.

**How to resume:** read this exact HEAD/branch, issue [#707](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/707), and [Vercel quota #692](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/692); verify owner GitHub Billing → Budgets / Actions usage and then execute exactly one approved free exact-head CI canary (require >0 runner steps, logs, `npm run check`, regression PASS). Separate the source fix from capacity recovery.
