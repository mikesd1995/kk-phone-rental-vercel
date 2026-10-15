# KK Phone Rental — Premium Storefront Hero + Poster integrated candidate (2026-10-14 ICT)

## Objective / decision
Task #05A–C continuation from owner request. Prepare a safe combined source without business writes or spending. **Not** authorization to waive owner screenshot-review, merge/deploy, enable paid Vercel previews or change Booking/pricing/inventory/event visibility.

## Baselines / provenance
- Production READY: Vercel `dpl_7TYLb87ir9qNzXRtkeb49543dwVm`, main `d6dc3bfe4cc0c4dd6fdfec407823752da0572464` (must remain unchanged until acceptance).
- Parent tested hero: Draft PR #725 `93204e594dbf51bd97533095c701c5beb1d124bc`. GitHub run 38420212171: registered visual/UX/Design Council executed, 8/8 viewport technical scores 100, zero P0/P1/P2, 94 clicks, runtime errors 0, no customer writes; **overall workflow FAILURE due owner_visual_acceptance=BLOCKED / screenshot_review=BLOCKED for frontend digest.** Previous accepted digest is not applicable.
- Poster safe-port: Draft PR #722 `0c3fd709ff6a361a3227e8acd79851bb269e3e3c`, NOT legacy PR #673 (stale base). Used as a source of minimal fixes; not merged independently.
- Hero asset currently in branch: `assets/kk-hero-product-20261013.webp` **240x170, 4618 B**, a rendered illustration not a literal equipment photograph.
- Verified pre-existing approved optimized asset from original concept: **560x396 WEBP, 17,504 B, SHA256 `3e3e0087d27bc98795bb54e6e1368be650f80ae072423093411d948897f2ab58`**, conversation Library named `kk-hero-premium-560.webp`, located in temporary workspace `/mnt/data/kk-ui-work/kk-hero-premium-560.webp`. Original source is available but not yet present as a Git blob on this branch; **do not claim image upgrade complete until GitHub readback**.

## Scoped changes in this integration branch
1. `script.js`: retain parent #725 cached image `onLoaded` positive-pixel treatment; add **exact event + exact URL** recognition for 15 Oct LE7EL temporary *artist profile* image, customer-visible temporary label and accurate TH/EN alt text. No official art substitutions or business data edits.
2. `scripts/storefront-evidence.cjs`: retain #725 escaped-card diagnostics, centered-modal checks, poster background treatment. Integrate #722 actual computed `objectFit` witnesses for loaded cards and future modal poster, plus `POSTER_IMAGE_LOAD_FAILED` fail-closed evidence. No disabling P0/P1 gates.
3. `assets/kk-storefront-v5.css`, `style.css`: #722 effective base `object-fit:contain` and no hover image zoom; full artwork remains visible. Preserve compact modal intentionally hiding artwork.
4. `tests/storefront-poster-dom-runtime.test.js` updated exact image/source regression; `tests/storefront-poster-fit-contract.test.js` new seven-case witness/contract suite.
5. `.github/workflows/storefront-visual-qa.yml` adds poster tests to exact-head Node step *before* Chromium/registered reviewers.

## Business and UI invariants
- Do not touch `09_Web_Packages`, `08_Web_Ready`, Booking, pricing, stock, LINE messages, owner-hidden/tombstone state or event poster URL truth.
- Preserve centered mobile event/FAQ modal **including focus and viewport containment**; never force bottom sheet.
- Preserve mobile Card full content, price wrapping, first-24-cards actual height, first-fold compact Hero and TH/EN/Dark/Light.
- Leave Vercel Hobby `git.deploymentEnabled: {"*":false,"main":true}`; no automatic Preview or paid services.

## Acceptance gates — fail closed
- [x] Hero technical QA on old exact head: 8/8 viewports, 94 interactions; applies **only to source before integration**.
- [x] Read through overlapping source hunks and stage integrated minimal diff without overriding previous card/modal fixes.
- [ ] **Source asset**: replace 240x170 WEBP with verified 560x396 original derivative via binary-capable GitHub upload; verify decoded dimensions/byte SHA after upload, ensure no flattening of headline/buttons.
- [ ] **Exact integrated HEAD**: zero-cost node source tests + full relevant regression, and mandatory hosted registered `storefront_ux_review` / `storefront_visual_qa` at widths 320,375,390,430,480,768,1024,1440 with TH/EN & Light/Dark.
- [ ] **Real images**: verify actual `img.complete`, `naturalWidth>0`, computed `objectFit=contain`, all poster edges, temporary artwork label and failure conditions; no unverified replacements.
- [ ] Independent code/design reviewer with new screenshots and owner visual acceptance checksum-bound to new frontend digest; **never replay old acceptance or mark green from score alone**.
- [ ] Owner-approved release gates, Vercel quota verification, approved merge, Production READY exact SHA and HTTP/browser readback; rollback candidate protected.
- [ ] Related distinct Storefront P0 price/LINE locale Draft PR #711 is NOT part of this UX release and needs separate acceptance; do not silently combine.

## Historical and current statuses
- Prior #725 source-only 8/8 technical scorecards = VERIFIED HISTORICAL, NOT Production Acceptance.
- This branch = **source-integrated / candidate only** until exact-head checks.
- #722 = still Draft, do not blind merge in parallel.
- Last known Production remains original main `d6dc3bfe`.
- Owner review remains required for the final image. User's general instruction to implement does not equal a screenshot-digest acceptance receipt.

## Suggested recovery if validation fails
1. Inspect exact-head Actions step logs and artifact for failures, not generic status alone.
2. If computed poster `contain` detector flags real crop, inspect active cascade ordering, lazy loading, image success/error state, and source validity; modify CSS only with exact visual evidence.
3. If CI is blocked by account spending/minutes, do not pay or spam rerun; keep candidate Draft and use approved zero-cost full-source checks where available.
4. If 560px asset cannot be transported by connected binary tools, preserve verified asset path/hash for next Work local Git environment; **do not fake GitHub upload or use a low-quality upscale.**

## 2026-10-14 — high-resolution asset binary GitHub readback (supersedes prior pending 05A)
- **05A source-asset upload DONE on Draft integration branch**: base old artwork 240x170/4,618 B replaced at unchanged URL path `assets/kk-hero-product-20261013.webp` with **560x396 WEBP / 17,504 B**, exact Git blob `fb05590ab37f576c0049d213fd0ec67fcc12bb9b`.
- Optimized source from original approved concept has SHA-256 `3e3e0087d27bc98795bb54e6e1368be650f80ae072423093411d948897f2ab58` (verified with local Python prior to upload). GitHub `fetch_file encoding=base64` returned an **exact byte-for-byte equal base64** to the original archived source, length 23,340 encoded characters. No alias/filename change; existing CSS URL remains valid.
- `tests/storefront-hero-premium-20261013.test.js` now asserts RIFF/WEBP/VP8 marker AND exactly `560x396` decoded VP8 frame dimensions, preventing regression back to 240x170.
- **05B candidate source integrated**: #725 source baseline plus #722 crop/fallback/image-source fixes, preserved centered modal and cached pixel background. Added poster contract+DOM tests to the established official visual workflow.
- Important: asset upload and code integration are GitHub **Draft branch only**. Prior 8/8 screens apply to earlier #725 SHA and must be repeated on final integrated commit; no Production deployment or price/Booking/data writes.
- Still HOLD: independent reviewer, full CI / 8-width rendered TH/EN Dark/Light QA on new exact head, owner screenshot-digest acceptance, Vercel headroom, release/rollback evidence. Previous checklist image pending is now completed **as source upload**, not as release acceptance.
