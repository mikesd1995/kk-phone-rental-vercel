# KK Vercel Deployment Storage free-tier recovery — 2026-10-11

## Scope and non-negotiable constraints
User shared official Vercel 100% Deployment Storage warning: **10 GB included Hobby tier consumed**. Zero paid upgrades/top-ups. Preserve storefront, current Production deployment, rollback, bookings, official event posters, and current business data. Do not infer that deleting deployments immediately clears GB-month consumption.

## Actual connector-backed prechange evidence
- Team: `mikesd1995s-projects`, ID `team_uaeOdVIjXMSW690ZM2wPuJyt`.
- Project: `kk-phone-rental-vercel`, ID `prj_snbAmpya7YGmOuMbv1o8T16ouxl6`.
- Production alias `kk-phone-rental.vercel.app` currently routes to READY deployment `dpl_AmYtTipVdrzuT1i5XdYBGp3wdY1L`, main commit `69390a94972b8c636317bbf00d62ab677c0cc66f`.
- Latest deployment list returned 20 results: 17 preview/non-production, 3 production. The list is paginated: **do not treat 20 as the total historical count**. Two other projects in team have zero deployments in first result, but retention can include other history.
- Git main tree: 796 entries including approx 1,857,560 bytes `docs/`, 763,378 `apps-script/`, 149,015 `.github/`, 98,560 `supabase/`, 28,563 `.agents/`, 20,740 `skills/`. These are **repository size**, not measured Vercel Deployment Storage savings.
- `package.json` executes `npm run test:ultradeep:recall && npm run test:siam-halloween:poster` in `postinstall`: do **NOT** exclude `tests/` or `scripts/` from Vercel source. `vercel.json` already has fail-closed `ignoreCommand` and `git.deploymentEnabled.main=true`.
- The Vercel `list_deployment_files` endpoint returned 404 `File tree not found` for Git-based deployments: exact output bytes and per-function sizes could not be inspected with that endpoint.
- Connected project UPDATE `previewDeploymentsDisabled:true` was accepted, but **Vercel returns a sanitized Project payload without the flag**. Treat enforcement as *unverified* until an observable recheck; keep this temporarily to avoid new Preview deployments. GitHub CI and existing Production routing remain separate.
- Connected tools offered no deployment-delete or team retention-policy update operation. No existing deployment has been deleted.
- Vercel docs updated Sep 16 2026: Hobby storage limit 10GB, retains 3 recent production + 3 recent all-type plus aliased/current production/active-branch protections; additional old deployments may be pruned automatically. Monthly 30-day rolling GB-month accumulation can lag actual deletion; inspect the team Usage chart before concluding recovery.

## Source patch
Introduce a tightly scoped root `.vercelignore` for repository-only operating evidence, `docs/`, `.github/`, `.agents/`, `skills/`, and source of independently deployed `apps-script/` and `supabase/`, plus dedicated root Audit/README files. This keeps `api/`, `admin/`, `assets/`, `server/`, `config/`, `scripts/`, `tests/`, `middleware.ts`, HTML/CSS/JS and packaging manifest available. Preserve owner-issued official poster originals/checksums; do not compress them here.

Static contract `tests/vercel-deployment-footprint.test.js` fails if excluded paths expand to runtime/test inputs or existing `postinstall`/Production config disappears. This patch only reduces **future** source size; it is NOT evidence of currently reduced 10 GB used.

## Required acceptance before merge / declaration of complete
1. Run `node --test tests/vercel-deployment-footprint.test.js tests/vercel-ignore-build.test.js` and existing postinstall on exact PR head, or record which exact-head tests are blocked by Hobby quota.
2. Check effective Vercel Preview disabled setting and verify no new unsolicited preview deployments. When usage drops and QA is needed, explicitly revert project setting `previewDeploymentsDisabled:false`.
3. Validate a new Production build's web page, `/api/kk-data`, admin auth, scanner guard, official poster artwork, and alias. Never merge if required tests or production gates are missing.
4. Check Vercel Team > Usage > Deployment Storage by project. Compare current 30-day rolling GB-month to original warning. Do not state GB reclaimed without an actual numerical readback.
5. Adjust Team Settings > Security > Deployment Retention Policy using UI if the existing policy is too long; keep current production, last production rollback and current named branch previews as required.
6. After availability recovers, consider read-only Audit to prune stale development Git branches so protected branch previews become eligible for normal retention. DO NOT delete active branches/aliases/production or create Blob storage and paid resources.
7. If current rolling usage remains at 100% despite fewer recent deployments, avoid redeploy loops and escalate to Vercel free support/community with project ID, screenshot and exact dates, not undocumented deletion claims.

## Change log / cross-chat
This note is a project-local, versioned handoff. No booking, event, price, poster, customer, business database, paid service or production alias change was requested or performed here. Project-level Preview suppression is reversible; root Vercel packaging exclusion requires a verified preview/CI before merge.