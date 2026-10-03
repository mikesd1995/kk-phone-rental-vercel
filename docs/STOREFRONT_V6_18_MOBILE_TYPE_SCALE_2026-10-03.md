# Storefront V6.18 — mobile typography normalization — 2026-10-03

Owner review found the mobile catalogue readable hierarchy too compressed, with several customer-facing labels at 9–11px.

## Change
Normalize mobile type without changing the two-column catalogue geometry: event title 14px, price 13.5px, date/venue/status/CTA around 12px, badges 11.5px, and lower-page/supporting copy 11–14px. <=359px receives a slightly tighter but still readable scale.

## Preserved
Poster/card geometry, two-column layout, V6.17 red full-state treatment, V6.16 exact modal scroll restoration, prices, inventory, booking, waitlist, availability, LINE and production-write semantics are unchanged.


## Production promotion follow-up
- Merge SHA: `b178b66745e7e142adb41d12e20ee220edafa811`.
- Git-triggered Vercel deployment did not materialize in the project deployment list on the first verification pass.
- No GitHub workflow runs were returned for the merge SHA on that pass.
- Attempted the available Vercel deploy action as fallback; the connector returned `Tool deploy_to_vercel not found`, so no duplicate/untracked deployment was created.
- Production must not be reported as V6.18 until a deployment for the merge SHA exists and the canonical domain serves the V6.18 marker.


## Production recovery escalation — pass 2
- Rechecked deployment inventory: no deployment exists for main recovery SHA `8acf2f0d01decfa8bba359d1796a2ab4691c8706`; no GitHub workflow run exists for that SHA.
- Last healthy storefront production remains V6.15 (`633df565dcf6ec9cf66d3d784245a4badff961ab`).
- Three newer main production deployments from Ultra Deep V26 are ERROR, while branch previews continue to build READY. This isolates the failure to the production/Git promotion path rather than the storefront build itself.
- Created isolated recovery branch `deploy/storefront-v618-production-recovery-20261003` with runtime marker r3 at `5ee593269533301860ab1646e992c9a8d58d0fe5` to test whether a fresh branch event restores Git deployment creation. No deployment record materialized on the verification pass.
- No business-data or production-write semantics were changed.


## Production recovery — PASS
- Root cause evidence from failed V26 deployments: Hobby function-count limit (more than 12 Serverless Functions) on earlier commits, followed by an `unused_function` configuration mismatch for removed `api/kk-ultra-deep-machine.js`.
- Current main contains only the consolidated API surface and no stale `kk-ultra-deep-machine.js` functions pattern in `vercel.json`.
- Triggered a clean main production deployment with storefront marker r4 at commit `5d3e1120f9a0943b379e1eadad190da76d5be16c`.
- Vercel deployment `dpl_GGWV71TkVccvXj3DWpMtAvC9mbhJ` reached `READY`, target `production`, with canonical aliases and no alias error.
- Canonical storefront returned HTTP 200 and served marker `20261003-v618-mobile-type-scale-r4` plus V6.16 script marker `storefront-v616-exact-scroll-return-20261003`.
- Production CSS returned HTTP 200 and contains the V6.18 mobile typography rules, including 14px event titles and 12px CTA text.
- No pricing, booking, inventory, event-visibility or production business-write semantics were changed by this storefront recovery.


## Final production readback — PASS
- Re-read production deployment `dpl_GGWV71TkVccvXj3DWpMtAvC9mbhJ`: `READY`, target `production`, commit `5d3e1120f9a0943b379e1eadad190da76d5be16c`, canonical aliases attached, `aliasError=null`.
- Canonical homepage HTTP 200 and still serves V6.18 r4 + V6.16 markers.
- Canonical CSS HTTP 200 and contains V6.18 type scale (14px event title, 12px CTA) plus V6.17 full-state red styling.
- Canonical JS HTTP 200 and contains V6.16 `exactScrollRestore()` with multi-frame reassertion.
- No GitHub workflow run exists for the exact production commit, so automated rendered-device/visual-agent acceptance is not claimed. Production source/readback acceptance is PASS; owner real-iPhone visual/gesture acceptance remains the only unproven layer.
