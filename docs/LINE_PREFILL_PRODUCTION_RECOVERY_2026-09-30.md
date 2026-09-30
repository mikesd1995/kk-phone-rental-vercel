# LINE Prefill Production Recovery — 2026-09-30 / verified 2026-10-01

## Goal
Ship PR #352 LINE booking prefill v2 to the production domain and verify deployed bytes.

## Timeline and evidence
- PR #352 merged to main at `0d101b0a4a1b11061803c5bc33725c69dc1ad2fe`.
- Admin Regression #1134 and Storefront Automated Visual QA #41 succeeded.
- Immediately after that merge, production still served the old LINE template and a no-op main push did not create a deployment.
- Repository ignored-build logic was inspected: `main` returns exit 1 / `MAIN_ALWAYS_BUILDS`, so the repo ignore script was not the blocker.
- The advertised direct Vercel deploy connector action returned `Tool deploy_to_vercel not found`; the temporary trigger marker was removed.
- Subsequent Git→Vercel production deployments resumed. Production deployment `dpl_D3KDWLNj8v51XG693Hy2xC6KHS48` is READY, target=production, source `main@798627b87c55cf91f5bd3e656d46275a6c32021f`.
- On 2026-10-01, the production domain's `/script.js` was fetched and contains all LINE prefill v2 markers: event 🎫, date 📅, venue 📍, model 📱, price 💰, pickup ⏰, nickname 👤, phone 📞.
- Therefore PR #352 is deployed and ready for a real storefront→LINE acceptance test.

## Current status
### LINE prefill v2
Deployment-level acceptance: PASS.
A real user-path storefront→LINE send remains the final UI acceptance step.

### Repository-wide production parity
Separate concern: current `main` is `1894b59147b9f6e236d1a4f3f15a10d45fc39871`, while the newest READY production deployment observed is `798627b87c55cf91f5bd3e656d46275a6c32021f`.
Do not interpret LINE v2 success as proof that every later main commit is deployed.
This production drift requires a separate Vercel/Git integration investigation.

## Safety / scope
No pricing, booking, inventory, canonical Booking ID, or Sheet SOT write path was changed during this recovery.
No second LINE/request booking ID was introduced.
