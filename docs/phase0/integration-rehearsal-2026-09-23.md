# Phase 0 integration rehearsal — 2026-09-23

## Purpose and scope

Combine the validated governance/Phase-0 history with current main on an isolated review branch, resolve the package conflict, and validate the complete resulting source. This is an integration candidate, not production acceptance or permission to merge. The original Draft PRs #152 and #175 remain unchanged.

## Exact inputs

| Input | Commit |
| --- | --- |
| Common ancestor | `9588391d8caa7e40eb1381dc98e86b6873f155ae` |
| Initial main at preparation | `bd42408bbdca1d6514c2ccdc877cb1f63fcf4f7e` |
| Refreshed main before publication | `c04a34fb8735e97dea741b226e4f01efc178af8c` |
| PR #152 foundation | `0bb2c07522c706d02f1edcf6bb9cfb5c74dd96b0` |
| PR #175 Phase 0 | `634885eead82cdd54c9c77151c6f3b04f4b6ff47` |
| Initial local integration commit | `56c3aeae366612783afab38bb88ee1b2cba5c36a` |
| Refreshed local integration commit | `6b48b94fe5eb8128a144cdfdf51dd8e8a4cb514f` |

Branch: `ai-platform-phase0-integration-20260923`. The first integration commit has the exact Phase-0 and initial-main SHAs as its two parents; the refresh adds the newly advanced main without rewriting either history. No rebase, squash, force push, original-PR retarget, main merge, or rewrite of the validated histories is needed for this rehearsal.

Main had advanced by 18 commits from the common ancestor. These include Admin read/outage handling, staged direct-writer routing, Rental Analytics route repair, storefront updates, a Preview build-budget guard, and production watch/recovery workflows. Their presence is existing main behavior, not a new feature delivered by this integration task.

The final pre-push refresh found four additional main commits: Rental Analytics revenue split (#176), Verifier no-drop reconciliation (#178), Admin write-health anti-flap (#179), and Direct Writer control plane (#180). These 28 changed paths, including existing Supabase migration artifacts, were inspected and retained. No live/shared database migration was executed.

## Conflict and resolution

Git's three-way integration found exactly one content conflict: the `scripts.check` line in `package.json`.

- Final main's syntax checks: 55.
- Original Phase-0 branch's syntax checks: 50.
- Combined unique checks: 57 (the initial integration had 54).
- Retained main-only checks: `server/rental-dashboard-core.js`, `server/admin-direct-writer.js`, `server/admin-direct-writer-phase1.js`, `scripts/vercel-ignore-build.js`, `server/admin-write-control-oidc.js`, `api/lib/admin-google-sheets-writer.js`, and `server/verifier-no-drop-reconciliation.js`.
- Retained foundation-only checks: `server/agent-governance-contract.js` and `server/capability-improvement-contract.js`.
- Retained Phase-0 scripts: `check:platform` and `test:platform`.
- All other scripts, dependencies, package metadata, and `engines.node` are unchanged from the compatible inputs.

Choosing either side of the conflicted line wholesale would lose coverage from the other side. The resolution preserves the complete command union without changing runtime behavior.

## Source-preservation evidence

Final main contains 278 files. The candidate preserves 275 with identical Git blobs and modes; the three explicit exceptions are `package.json`, the one-line Verifier helper repair described below, and its regression-test file. All 47 newly added foundation/Phase-0 files match the original Phase-0 head exactly. The former `api/kk-rental-dashboard.js` path stays absent; the route repair under `server/rental-dashboard-core.js` is retained.

Existing operational workflows, `vercel.json`, production/API/Admin source, Scanner/Canary contracts, runtime ledger, Apps Script, Supabase files, and all existing test assertions are preserved. The current-main Verifier skill is preserved exactly; only the zero-write helper is narrowed to follow that skill's explicit identity rule. New Phase-0 code is still excluded from production import graphs; the KK Project Pack keeps all activation flags off.

Of 13 Project Pack references, 12 current target files still match their historical baseline. The Verifier skill now includes main's 17-line no-drop reconciliation section. The pack pins remain unchanged because their documented meaning is historical governance metadata, not executable artifact hashes. Loading does not execute a referenced file or certify its content; future activation requires a separately verified artifact registry.

## Narrow inherited-main defect repaired

Independent review found that `joinCandidate()` in the new main helper could receive a nonblank Show ID with no exact match, then select a different show sharing family/date. That contradicts the current-main Verifier skill, which allows family/date fallback only when Show ID is unavailable.

The repair adds one early return for zero exact Show-ID matches: no candidate, method `SHOW_ID`, debt `CANDIDATE_PAIR_MISSING`. It reuses the existing debt code and does not add authority, change policy, wire an executor, or write data. Exact matches and missing-ID fallback retain their existing behavior.

Three targeted tests cover mismatched nonblank IDs, a missing ID with one family/date match, and a missing ID with multiple matches. Before the code repair the new mismatch test failed (6/7 passed); after the one-line repair all 7 focused tests passed. The full suite incorporates these three additional cases. This is the only behavioral change introduced by this integration work beyond bringing the existing stack onto main.

## Validation and limits

Local rehearsal used Node 24.13.1 on Windows:

- `npm run check`: passed, all 57 existing/foundation source syntax checks.
- `npm run check:platform`: passed.
- `npm run test:platform`: 130 passed, 0 failed, 0 skipped, including real disposable SQLite migrations, rollback/reopen, transaction failure atomicity, and transitive production import isolation.
- `npm test`: 561 passed out of 562, 0 skipped. The unchanged Admin symlink escape test failed because Windows denied fixture symlink creation with `EPERM`; this is not reported as a passing local suite.
- Integration-only whitespace/conflict checks passed. The full main-to-candidate diff retains five inherited Markdown hard-break spaces in the two PR #152 foundation documents; these were not silently rewritten.
- Exact tree-preservation assertions account for the three named main-file exceptions and all 47 unchanged stack additions.

The Draft PR must obtain fresh Linux results for the complete 562-test existing/foundation suite on Node 20 and the 130-test Phase-0 suite on Node 24.13.1. The existing `AI Platform Phase 0` workflow checks out and verifies the exact PR source SHA. `Admin Regression` additionally tests GitHub's synthetic PR merge revision. Record each workflow's actual source identity, conclusion, and URL in the delivery evidence; do not reuse the older 611-test result as acceptance for this integrated source.

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
