# Phase 0 integration rehearsal — 2026-09-23

## Purpose and scope

Combine the validated governance/Phase-0 history with current main on an isolated review branch, resolve the package conflict, and validate the complete resulting source. This is an integration candidate, not production acceptance or permission to merge. The original Draft PRs #152 and #175 remain unchanged.

## Exact inputs

| Input | Commit |
| --- | --- |
| Common ancestor | `9588391d8caa7e40eb1381dc98e86b6873f155ae` |
| Current main at preparation | `bd42408bbdca1d6514c2ccdc877cb1f63fcf4f7e` |
| PR #152 foundation | `0bb2c07522c706d02f1edcf6bb9cfb5c74dd96b0` |
| PR #175 Phase 0 | `634885eead82cdd54c9c77151c6f3b04f4b6ff47` |
| Local integration commit | `56c3aeae366612783afab38bb88ee1b2cba5c36a` |

Branch: `ai-platform-phase0-integration-20260923`. The integration commit has the exact Phase-0 and current-main SHAs as its two parents. No rebase, squash, force push, original-PR retarget, main merge, or rewrite of the validated histories is needed for this rehearsal.

Main had advanced by 18 commits from the common ancestor. These include Admin read/outage handling, staged direct-writer routing, Rental Analytics route repair, storefront updates, a Preview build-budget guard, and production watch/recovery workflows. Their presence is existing main behavior, not a new feature delivered by this integration task.

## Conflict and resolution

Git's three-way integration found exactly one content conflict: the `scripts.check` line in `package.json`.

- Main's syntax checks: 52.
- Original Phase-0 branch's syntax checks: 50.
- Combined unique checks: 54.
- Retained main-only checks: `server/rental-dashboard-core.js`, `server/admin-direct-writer.js`, `server/admin-direct-writer-phase1.js`, and `scripts/vercel-ignore-build.js`.
- Retained foundation-only checks: `server/agent-governance-contract.js` and `server/capability-improvement-contract.js`.
- Retained Phase-0 scripts: `check:platform` and `test:platform`.
- All other scripts, dependencies, package metadata, and `engines.node` are unchanged from the compatible inputs.

Choosing either side of the conflicted line wholesale would lose coverage from the other side. The resolution preserves the complete command union without changing runtime behavior.

## Source-preservation evidence

Exact Git blob and mode comparison of the integration tree against the pinned main found 265 main files, with 264 identical files and only `package.json` changed. All 47 newly added foundation/Phase-0 files match the original Phase-0 head exactly. The former `api/kk-rental-dashboard.js` path stays absent; the route repair under `server/rental-dashboard-core.js` is retained.

Existing operational workflows, `vercel.json`, production/API/Admin source, Scanner/Verifier/Canary contracts, runtime ledger, Apps Script, and existing test assertions are preserved. The additional integration note is documentation only. New Phase-0 code is still excluded from production import graphs; the KK Project Pack keeps all activation flags off.

## Validation and limits

Local rehearsal used Node 24.13.1 on Windows:

- `npm run check`: passed, all 54 existing/foundation source syntax checks.
- `npm run check:platform`: passed.
- `npm run test:platform`: 130 passed, 0 failed, 0 skipped, including real disposable SQLite migrations, rollback/reopen, transaction failure atomicity, and transitive production import isolation.
- `npm test`: 541 passed out of 542, 0 skipped. The unchanged Admin symlink escape test failed because Windows denied fixture symlink creation with `EPERM`; this is not reported as a passing local suite.
- Source whitespace/conflict checks and exact tree-preservation assertions passed.

The Draft PR must obtain fresh Linux results for the complete 542-test existing/foundation suite on Node 20 and the 130-test Phase-0 suite on Node 24.13.1. The existing `AI Platform Phase 0` workflow checks out and verifies the exact PR source SHA. `Admin Regression` additionally tests GitHub's synthetic PR merge revision. Record each workflow's actual source identity, conclusion, and URL in the delivery evidence; do not reuse the older 611-test result as acceptance for this integrated source.

## CI and deployment boundaries

Opening a Draft PR against main triggers the existing Admin Regression and AI Platform Phase 0 checks. Neither workflow requests production secrets, deployment authority, or business writes. The branch push is not a main push and no manual production/UAT workflow is dispatched.

Existing scheduled witness/watch workflows operate from the repository's default branch; this rehearsal does not create a second runner or alter their schedule. The production recovery and bounded-acceptance workflows require their existing explicit triggers; no trigger comment or dispatch is sent. Existing Vercel Git integration may create a Preview for the branch. A Preview status is separate from CI and is not runtime/business acceptance.

## Review and handoff

1. Confirm exact source SHAs and retain current-main changes by content, not by historical document assumptions.
2. Require fresh green Linux CI on the final integration head, independent review, no unexpected protected-file diff, and a clean worktree.
3. Refresh main and both original PR heads before any owner-approved integration action. If an input advances, the present evidence applies only to the pinned source and must be reconsidered.
4. The owner must choose how to land the accepted work: an approved update of the original stack, or an explicitly approved combined PR strategy. This rehearsal does not automatically supersede, retarget, close, or merge #152/#175. Do not blindly apply both delivery paths.
5. Before any main merge/deployment, inspect current live Machine SOT, highest compatible active policy, deployment state, and the deployment effects of merging. No business-policy change is part of this candidate.
6. Phase 1 remains a separate, bounded read-only pilot after foundation acceptance. Host authentication, real sandbox/broker enforcement, executable tools/providers, and runtime acceptance are not provided by this integration.

Rollback before adoption is simply to leave the isolated Draft PR unmerged. No production rollback or database down migration is required because this rehearsal applies neither. Preserve the commit history and action/evidence log for review.
