# Storefront production drift recovery — 2026-09-28

## Incident
Production was serving commit `3d6d46ccb93c0f31971d258a719f7b0d6c0fb9e5` while main had advanced through `cb7e794c12809b82207ca5fef3bc261f82c12aba`.

The production `script.js` still contained the poster failure path that removed the entire event card. This caused valid Web_Ready events (including MizuMi x PP KRIT – THE PINK AURA) to disappear when poster delivery failed.

## Recovery
- PR #257 changed poster failure behavior from removing the event card to replacing only the failed image with a local placeholder.
- Valid event data, package pricing, availability and booking CTA remain visible when a poster host fails.
- This commit intentionally touches main to trigger the normal zero-cost GitHub → Vercel deployment path after production drift was confirmed.

## Acceptance gates
1. Production deployment SHA is this commit or a descendant containing PR #257.
2. Production /script.js contains the poster-preservation logic and no longer uses card.remove() in posterFailure.
3. MizuMi remains in 08_Web_Ready with action=show.
4. No duplicate event/business-data writes are made as part of deployment recovery.

Actor: ChatGPT owner-authorized recovery

## Poster asset recovery — second pass
- Owner-supplied MizuMi and MIN MIN posters were resized to 900x900 progressive JPEG before upload.
- MizuMi: 76,543 bytes, Drive file 10hUBzDF1p46WIr-shEF-6CWjwPlx4U-O.
- MIN MIN: 115,297 bytes, Drive file 1a28E5AqaBC8QACZBcR9zgaE0stnw_zcS.
- 08_Web_Ready readback: both action=show, stock phone/lens=2/2.
- 09_Web_Packages readback: both 590/100/690 and available.
- Production API readback contains both new Drive IDs.
- Cache-bust commit 7a3bd847 was not observed in Vercel deployment history at verification time; this documentation commit intentionally retriggers the normal Git integration without mutating business data.
