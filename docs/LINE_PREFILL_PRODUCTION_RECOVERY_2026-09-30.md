# LINE Prefill Production Recovery — 2026-09-30

## Goal
Ship PR #352 LINE booking prefill v2 to the production domain and verify deployed bytes.

## Evidence
- PR #352 merged to main at `0d101b0a4a1b11061803c5bc33725c69dc1ad2fe`.
- Admin Regression #1134 and Storefront Automated Visual QA #41 succeeded.
- A direct runtime no-op push to main did not create a new Vercel deployment.
- `vercel.json` uses `node scripts/vercel-ignore-build.js`.
- The ignore script explicitly returns exit 1 for `main` (`MAIN_ALWAYS_BUILDS`), so repository ignore logic is not the blocker.
- Production `/script.js` was fetched after merge and still served the old LINE template.
- The Vercel connector deploy action returned `Tool deploy_to_vercel not found`.
- Vercel project-detail action currently has a connector/runtime schema mismatch, preventing project Git-setting inspection through that action.
- The temporary runtime trigger marker was removed after it failed to trigger a deployment.

## Diagnosis
The blocker is outside repository runtime code: Vercel project Git integration / production deployment trigger is not creating deployments from main.

## Acceptance gate
Production is not complete until:
1. a Vercel deployment for current main exists,
2. it is READY and assigned to production,
3. production /script.js contains LINE prefill v2 including selected package price,
4. a real storefront → LINE test shows the new structured message.

No pricing, booking, inventory, or Sheet SOT write path was changed during recovery.
