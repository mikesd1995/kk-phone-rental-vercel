# KK Vercel Hobby Deployment Storage — 2026-10-11

## Owner constraints / scope

- **No Pro upgrade, paid credits, new paid services, or destructive Production operations**.
- Scope: `mikesd1995s-projects` (team `team_uaeOdVIjXMSW690ZM2wPuJyt`), project `kk-phone-rental-vercel` (`prj_snbAmpya7YGmOuMbv1o8T16ouxl6`).
- On 2026-10-10 at 23:19 Thailand time, Vercel email explicitly warned **Hobby Deployment Storage 10 GB / 10 GB (100%)**. This is a timestamped alert, **not** a verified live Usage reading after cleanup. Distinguish Deployment Storage from Functions Storage and Bandwidth.

## Read-only findings (2026-10-11)

- Vercel alias `kk-phone-rental.vercel.app` => `dpl_AmYtTipVdrzuT1i5XdYBGp3wdY1L`, `READY`, main SHA `69390a94972b8c636317bbf00d62ab677c0cc66f`. **Do not delete**.
- Last 20 KK Vercel deployment objects returned 17 nonproduction and 3 production, including multiple repeated builds on `fix/oct2026-demand-pricing-isolated-20261010`. This is a *sample*, not the account's full deployment history.
- Team has 3 projects: `kk-phone-rental-vercel`, `v0-accounting-dashboard-ui`, `project-75ee2`; the latter two returned zero deployments in the inspected first page.
- Main Git tree is 753 tracked blobs, approximately 5 MB under `assets/`, 1.9 MB under `docs/`, about 1 MB under `tests/`, and under 1 MB in `server/`. These are **tracked source** sizes, not Vercel Function bundles or measured deployment storage; do not infer source files alone explain 10 GB.
- `vercel.json` already had `ignoreCommand: node scripts/vercel-ignore-build.js`. Old code ignored documentation-only diffs but **built every runtime commit on every Preview branch**, or built on missing SHA/diff. This was an avoidable multiplier under Hobby.
- `.vercelignore` not present in current main. Deliberately **not** adding an unvalidated exclude rule: Vercel `postinstall` runs repository tests and runtime tools can read project files, so exclude candidates need test evidence first.
- Vercel source-file-tree endpoint for Git-backed deployments returned `404 File tree not found`; does not quantify bundle size.
- No exposed authenticated tool to view team Usage's exact GB, change retention, or delete old deployments. No historical deployment deleted. **Storage reduced by this change: not yet measurable/verified.**

## Emergency live Vercel setting — 2026-10-11

- Submitted an authorized no-cost project PATCH to Vercel `prj_snbAmpya7YGmOuMbv1o8T16ouxl6`, **`previewDeploymentsDisabled=true`**. API returned success (no error) for the correct project/team. This is an **immediate temporary freeze of ALL new Preview deployments**, independent of the unmerged source branch. It does **not** modify Production or delete old builds.
- Post-PATCH readback: Production alias `kk-phone-rental.vercel.app` still maps to `dpl_AmYtTipVdrzuT1i5XdYBGp3wdY1L`; project retains all four expected domains. Vercel tool's GET-project projection **does not expose** `previewDeploymentsDisabled`, so we **cannot independently attest that the configuration persisted**; confirm in the authenticated project Settings UI or a full Vercel API response before calling this verified.
- **Recovery / reversal:** call Vercel project PATCH `previewDeploymentsDisabled=false` for the same project, and verify. Preview/ and release/ opt-in branches in the draft script will not be able to deploy while the emergency freeze remains enabled. Re-enable previews only for a necessary acceptance window after ensuring available quota, then turn freeze back on if needed.
- This may block PR visual validation for unrelated work; coordinated explicit reactivation is required. GitHub source/test workflows remain available.

## Safe source remediation — draft branch (not live until merged and accepted)

Branch `fix/vercel-hobby-storage-preview-gate-20261011`.

1. In `scripts/vercel-ignore-build.js`, before git subprocesses/SHA checks:
   - `main` keeps its existing fail-open-on-unknown behavior and builds runtime changes.
   - All unrequested non-main branches (`fix/*`, `feat/*`, `chore/*`, etc.) exit code **0** with `PREVIEW_OPT_IN_REQUIRED`, avoiding new Vercel Preview builds even on a first commit without previous SHA.
   - `preview/<name>` and `release/<name>` branches are the explicit opt-in QA lanes; the existing content/diff-aware logic and fail-open protection apply there.
   - Unknown empty branch remains fail-open, rather than risk suppressing an unknown production build.
2. Updated `tests/vercel-ignore-build.test.js` with opt-in, non-opt-in, main-protection, missing-SHA and CLI zero-exit regressions. No change to source prices, booking, event visibility, official posters, protected APIs or production routing.
3. This reduces **future** storage growth; it does not directly delete older deployments or immediately free 10 GB. Without exact-head green GitHub Actions, no production deployment should be claimed.

## Vercel retention and manual cleanup — still pending authenticated access to Usage / retention

Official Vercel 2026-09-16 Hobby change: 3 newest production deployments + 3 newest deployments of any type are preserved, and active production, aliases, and latest previews from active branches may remain protected. Above 10 GB, eligible older deployments may delete earlier than 30 days. Read https://vercel.com/changelog/hobby-projects-now-retain-fewer-deployments-to-free-up-storage and https://vercel.com/docs/deployment-storage/optimize.

Required Vercel account-side follow-up:

1. Inspect team **Usage → Deployment Storage and Functions Storage**, grouped by project, with **GB and date** readback. Do not claim success from alert alone.
2. Inspect Deployment Retention Policy for preview, failed/canceled and production; shorten only within Hobby options while preserving current Production, active aliases, most recent safe rollback and needed acceptance previews.
3. Identify old protected branches and aliases. Close only PRs proven obsolete and safe; **do not bulk close business work** merely to free space.
4. Re-read storage after policy cleanup; Vercel may update accounting asynchronously. If high usage persists after eligible deletions, report orphaned objects to Vercel support.
5. After exact-head CI and required preview/production acceptance, merge branch; verify the new ignore guard is present in main and test a `fix/*` change that produces **no** new READY Preview while Production routing stays READY. To intentionally request a Preview, create `preview/<test-id>` or `release/<test-id>` branch pointing at the candidate SHA.

## Acceptance checklist / truthful status

- [x] Team and Production alias identified and protected (read-only).
- [x] Representative deployments, source repository structure and existing build guard inspected.
- [x] Draft source guard and regression tests committed on separate branch.
- [x] Vercel project preview-disable PATCH submitted successfully; Production alias preserved; PATCH setting itself not visible in GET-project projection.
- [x] Exact source Git blob SHA `f037306a234b5d15bf00ced95bed456d71090d34` mirrored locally; Node syntax passed and 11 targeted behavior subtests passed.
- [ ] Exact-head CI regression verified.
- [ ] Main/release promotion approved under project gates.
- [ ] Verified Vercel old-deployment retention or cleanup happened.
- [ ] Verified live Usage falls below 10 GB and deployment can succeed.
- [ ] Verified production and last rollback still serve correctly.

**Do not mark storage issue CLOSED while the last four material acceptance gates remain open.**
