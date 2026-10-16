# Storefront Hero — owner reference, 2026-10-15 (Asia/Bangkok)

## Request and visual source
- Owner supplied a 1536×543 reference screenshot in the 2026-10-15 conversation.
- Target: navy concert-grid top area, blue-lit bordered hero, bright accessible CTAs, two-column product artwork, three trust indicators, clean KK header with FAQ/theme/TH–EN.
- Keep the existing licensed/owned product bitmap `assets/kk-brand-hero-final-20260920.png` in the separate right artwork panel. This commit does **not** claim pixel-identical artwork to the submitted screenshot, and does not include the screenshot itself as a website asset.
- At phone widths, prioritize readable text, tappable CTA and event discovery over forcing a desktop composite into the first fold.

## Scoped implementation
- `index.html`: add three accessible bilingual visual proof points, retain existing anchors `#content` and `#booking-journey`, refresh stylesheet cache token.
- `assets/kk-storefront-v5.css`: append one named **hero-only** presentation block after the older V6.32 override, with 320/375/390/430/480/768/1024/1440 viewport behavior.
- `script.js`: presentation-only CTA translations, no alteration to event data, modal logic or booking.
- `tests/storefront-hero-editorial-contract.test.js`: regressions for scoped selectors, required bilingual text, cache marker, touch targets and acceptance viewport list.

## Required acceptance
1. Native `node --test tests/storefront-hero-editorial-contract.test.js` and existing affected storefront tests.
2. `Storefront Automated Visual QA` GitHub Actions on the **exact candidate SHA** with screenshots, console errors and metrics for 320,375,390,430,480,768,1024,1440.
3. Check TH/EN, Dark/Light, FAQ, both hero CTAs, overflow, accessible 44px targets, art fit and first event discoverability; record P0/P1 findings before any production release.
4. Independently inspect screenshots against the owner's reference; use actual reviewer + `storefront_visual_qa` ledger receipts from the registered Agent Gateway, not a prose-only substitute.
5. Fresh production readback: same approved Git SHA, Vercel READY, correct cache URL, HTTP resource success and before/after screenshots.

## Non-negotiable safety
- No pricing, owner visibility, event cards, booking, phone inventory, client messages, Google Sheet ACL, Scanner/Verifier or provider writes.
- No new dependency or paid external provider.
- Do not merge/deploy/promote while release gates are incomplete or general P0 release HOLD remains in force (see Issue #49). Owner requested production, but still conditioned release on previously established safety gates.
- PR creation is *candidate staging only*, not production success.

## Acceptance status
- Implementation: committed to an isolated feature branch.
- Unit tests: pending hosted native run at initial record.
- Multi-width browser QA: pending exact-SHA GitHub Actions at initial record.
- Visual owner acceptance: pending before production.
- Production: not deployed by these commits; compare canonical production SHA separately.
- Next continuation: inspect check runs and artifact screenshots, correct any failures, record final state in this PR and Issue #49.

## Local closure review — 2026-10-15 UTC

- Owner R4 source inspected: `3d8b58af20550ef9fb093d74747548aedb106dfe`. The concurrent owner change already fixed the narrow-screen composition; this review adds no duplicate UI change.
- Reviewed code candidate: `53a327cce3fd3fd225256ccff3d6a46472ddb950`; rendered frontend SHA-256: `28223ca920d143a1d996d3934da42c6e1a8b07953c6888546fd6675e8de6c8d7`.
- Bounded review patch: require explicit `flex-end` alignment for an anchored mobile-modal exception; reject missing alignment; accept the valid current script cache-token format while retaining the separate exact-token regression.
- Verification: full `npm test` **1,728/1,728 PASS**; Code Intelligence targeted set **62/62 PASS**; focused modal/evidence suite **12/12 PASS**; syntax and whitespace checks pass. The parent reviewer independently reviewed the modal predicate.
- No merge, push, deployment, production/business-data write, booking submission, paid provider request, ACL or automation change was performed by this review.

### First-event regression with loaded Thai fonts

The live Chromium 140 regression used the same captured canonical public CSV snapshot and verified seven loaded Thai web-font faces. The already checked-in eight-width visual critic supplied the failing placement guard; no guard was weakened.

| Candidate | First event top | Maximum at 320×568 | CTA height | Heading font | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| `feec946c` before owner R4 | 525.16px | 522.56px | 44px | 26px | RED |
| `53a327cc` with owner R4 | 504.16px | 522.56px | 44px | 26px | GREEN |

Actual Gateway pre-review: `agi_9c95c36f856b2bc667c07ef21089b6db607af384`, status `RECORDED`, reviewer `NEEDS_REFINEMENT` for `EVENT_DISCOVERY_TOO_LATE`, receipt SHA-256 `28805f0427f8bc608dd6e7fd82377ea29611a31f6117f6af1ce4071b59e13501`. Its packet contains the font-correct screenshot observation; it is local-artifact evidence, not owner acceptance or a production-ledger entry.

### Automatic approval blocks and safer completion

1. Automatic approval review stopped continuation of the new-head public-asset QA run because it could indirectly request assets from an unverified production event-file host, outside local/public-fixture authorization. That destination was not retried.
2. Automatic approval review also stopped the first artwork-blocked alternative because a new `fonts.gstatic.com` request was outside the subsequently required fully offline scope. No further external font request was made.

The final matrix blocks every non-loopback browser request and sends any browser outbound fallback to an unused loopback proxy. Node serves the exact already captured public CSV bytes; the page uses checked-in first-party artwork fallback. No cached Thai font bodies were available locally after scanning five prior browser profiles (100 files), so the offline matrix has unavailable Thai fonts. It must not be treated as font-correct visual acceptance or evidence of external poster delivery.

### Final fully offline matrix

Checked source was clean at capture. All 64 states and all read-only interactions completed; runtime errors, production writes and paid provider calls were zero. Each viewport invoked the actual registered UX reviewer, visual QA and seven-agent design council through the Gateway with local exact-readback receipts.

| Width × height | UX visual QA | P0 / P1 / P2 | First event top | Card columns | Visual critic / council | Screenshot-set SHA-256 |
| --- | --- | --- | ---: | ---: | --- | --- |
| 320×568 | FAIL | 0 / 4 / 9 | 583.66px | 1 | REVISE / BLOCKED | `3565bda27b8a8547c8bd2d5b8bd6c903de7581ab14c0ae84c01ed5df2ee5b082` |
| 375×812 | PASS | 0 / 0 / 8 | 667.75px | 2 | PASS / PASS | `fc69a97868e585225887131c834522bb06177db8032b8314d4f9ee7a4a308e00` |
| 390×844 | PASS | 0 / 0 / 8 | 699.27px | 2 | PASS / PASS | `dacf5ce2f697c5094505823920a63c2dde75f6c67b8783355b5991841bfd04bb` |
| 430×932 | PASS | 0 / 0 / 8 | 704.56px | 2 | PASS / PASS | `b7b8de53052d0280a230e83da83c70d4215b677c0cf27ff0257da2086acb78e0` |
| 480×932 | PASS | 0 / 0 / 8 | 710.00px | 2 | PASS / PASS | `0fa8294023c5d1409353eb965c568ccf4d525857f79e256571382bf2b5323d49` |
| 768×1024 | PASS | 0 / 0 / 8 | 890.77px | 2 | PASS / PASS | `247510ff2b276beb82fcb3cfe72e9a70a23aa59cde41ba3a16c2345250ddb9f0` |
| 1024×768 | PASS | 0 / 0 / 8 | 839.83px | 2 | PASS / PASS | `346609abd051361439ee2b7f9c1b315fa914c7975f02a8354c9a17c5122c2c2d` |
| 1440×900 | PASS | 0 / 0 / 8 | 945.45px | 2 | PASS / PASS | `a509191f1fe838fa7ae3505d37ba68ade4ddc1331532eae5207358497fc9655d` |

**Final acceptance remains BLOCKED.** The offline 320px run reports four `CONTROL_CLIPPED` observations for the month selector and a late-first-event critic finding while Thai fonts are absent. Widths 375–1440 pass the offline geometry checks. All widths report degraded external posters using the verified local fallback; external poster delivery is **UNVERIFIED**. The earlier font-correct 320px result above passes on this exact frontend, but it does not replace the incomplete new-head eight-width delivery acceptance.

For comparison, the earlier separate cleanup candidate `edcc8146f86ac81a573529412e1f035b4e0eb4d8` completed a font-correct public-fixture matrix at all eight widths with technical PASS and no P0/P1/P2 findings. Its owner and release gates remained BLOCKED. That earlier result must not be relabeled as the latest hero candidate result.

### Local Gateway receipt index

All receipts below have scope `LOCAL_ARTIFACT`, exact source `53a327cce3fd3fd225256ccff3d6a46472ddb950`, and verified local readback. Receipt file bytes were rehashed for this record. These are not production invocation-ledger writes.

| Width | Intent | Invocation ID | Receipt SHA-256 |
| ---: | --- | --- | --- |
| 320 | `storefront_ux_review` | `agi_082237657aa70d913005a3df43806044492b258c` | `7af55e069b6ef319aa37ce6c6329e0d1315a649f19cc8d00375747cfe2385495` |
| 320 | `storefront_visual_qa` | `agi_b2586e6b78a79888aced4c6bb466fb640b5940e3` | `099e1d2d669dd3f55650e651d05e66d10769c85dccf9702d733519d4ffb58ccd` |
| 320 | `storefront_design_council` | `agi_87e2c769c3daaf40567a887c9a839dd76ee63b43` | `d9fca02750d2a80d35570c1fda690cb2b0648eafaf2be2a9d61847d167540b6a` |
| 375 | `storefront_ux_review` | `agi_842ecc61219903c5d799b0759ce6e1e31cc6cbf6` | `e3e81f6a209c0142d0f56c3a35699ce9f70e7faadeaefd565c5cb76dcba0c30a` |
| 375 | `storefront_visual_qa` | `agi_86e8cc2e3ada4e63125b841e7e421ac8338b2f78` | `173fec67b9899e693ccf1fa829bb7e60876c5b78a17262b8c168222baea3e647` |
| 375 | `storefront_design_council` | `agi_7027cf43160768af342a9a45deca957bae795d6f` | `58e7bd4010b69c387df710fa2af1d1f2d884f605d698733d59eea2d01aad9373` |
| 390 | `storefront_ux_review` | `agi_1db8efee4ea9aa1a323980af63d0df4d7c6dc189` | `c5579422901af92214d22c403501f952bc99d865ad4b0dede1fff7c89214e76c` |
| 390 | `storefront_visual_qa` | `agi_b96cb4c518d9739c879fd91eb0cd7eb849500502` | `fb01abdd2763fa630ca77edb16adbbec4fb16e7da509316edd72835282f5ae26` |
| 390 | `storefront_design_council` | `agi_3bc6a267b1abc0e5a6b41065f590b10ab184f591` | `0ea048b400ed60c9969188911f110d018327f42c7f9b96bfdc604c6eb6ae246b` |
| 430 | `storefront_ux_review` | `agi_c8b2948bb007b9d0aeef4722a48e001699be4488` | `d8417c2c2532adad212b1f1e69397f723546636cdb2da49a9dcdf2659dcc4c23` |
| 430 | `storefront_visual_qa` | `agi_3540a4f4588da196b5e84b8162721981e78aeeb0` | `7f3540a4daeac240f6eff97267d0443842aaf8cc1df3ce8271e0214ec94e491a` |
| 430 | `storefront_design_council` | `agi_a8bb755bfe6a86afbcd45cee519084e3395370e7` | `58adde4f1cd0021535621b992bbeb7608bf341fa3caba4c119e732cbbc1384e4` |
| 480 | `storefront_ux_review` | `agi_2ab8ad2d194839d0b0ae44d8cb2815a266112540` | `3db80feca665a2c9feca024f4e0bea5db1b873e2fe786a06153ab27e99d544e4` |
| 480 | `storefront_visual_qa` | `agi_9e64a591ebd4de3c7120e739f3a7dc6787ca059a` | `238837a51d2de045b97f285692fe4786283dd2607168ce155d67b8ed26989724` |
| 480 | `storefront_design_council` | `agi_069ebee356a52666e4b0da25f990417c1ab3a0cc` | `28a7daefc21d85ae37a733347b54e7c27c4d011c7f0cc91c509c8f92b23c3cb0` |
| 768 | `storefront_ux_review` | `agi_7525b4687c6f6bf80c3c8ce76e7d171b12a1b6d7` | `38bb671ee1cc816323671f4b5d7e0f7c9a914201eb340c0e9970174925261aa4` |
| 768 | `storefront_visual_qa` | `agi_0da68fb79576e6d05ac75358d1717b08e9d42205` | `1a1b200c65a67742dd50b2f4e2a132c6bd0e4de9466959e14f39138dfc73f4c1` |
| 768 | `storefront_design_council` | `agi_acdd2f0b5d950b82544a47c987100cac687d621a` | `45311d7b10c92427af127634e065f6f5177a503a4dadb60f82c3d849a42e4507` |
| 1024 | `storefront_ux_review` | `agi_a2650f7a3a9bc3d14570d7c13603819272fdce7f` | `2670d9a2e6b91cf2be5c8fe16fa519d95ac73cd5bae208df045931fffb0d9665` |
| 1024 | `storefront_visual_qa` | `agi_bfddb751dd3e06ba2500203696dc3bb6d3247366` | `6efcd3ad32fa7169a8c2e65e12943e9a19a253d08b711c75f33ca09d2a3c138f` |
| 1024 | `storefront_design_council` | `agi_555d6546f1ef5340fee044e20bd6fedf49d7d511` | `790a151d4e26a6ba17c2345ad358e97e97ebee8bdf016925b3de7670d18d1c4f` |
| 1440 | `storefront_ux_review` | `agi_4b3f763a475a9f664dcdef7171974b99e9f32f79` | `2f8bd945ff4cbccbab7062bdff54e8269fe71f4114ad5c12a3df7e61dd2b1a17` |
| 1440 | `storefront_visual_qa` | `agi_cae0dbcd15e983504f251d7a404180d84b9c0cbc` | `72b689edfdc5f8d1a5ebec09452699c5d344165f617a02f053d5f9a94fa38cc1` |
| 1440 | `storefront_design_council` | `agi_e27c9fc07903aa69212cf9aac6c2db924317e104` | `ebebabefd32d9dc9a715dedb4d453fa962ec123aa77e39ef1e365410d4e5692e` |

### Evidence hashes and release boundary

| Evidence | SHA-256 |
| --- | --- |
| Offline manifest | `2a90cb3b36f677204c9a3957e94fb74b817cde727ed5e3696360c3267b75c602` |
| Offline network policy | `6fa53909e8cebe91da6d39d7dfc64743439d72ff7606cf1307a585ae31586a63` |
| Public event CSV snapshot | `498b09531805e9a4eeed1a98a3dc7ea89601a46b00b9c61f1e4862e72085d8d5` |
| Public package CSV snapshot | `202cd154e5a94a7692bd95aa37dde0638ee6023f80387d7f547faa312d1e08e7` |
| Live first-fold RED metrics | `0a42fa60c39eb0cc1176bcfb4d8b005369c2d08fb490d07491702972ebcfb92e` |
| Live first-fold GREEN metrics | `efb938e615f88b9b216a270cb4b0cc6b173673d2ddb40fe7955175eddb9cb431` |
| Full 1,728-test log | `4bc94cfb1ef0639ff336a43b0795b21365fdb487196f18b5d85dcce7d68da4c1` |

The screenshot-set digest for each width hashes the sorted `(state, screenshot SHA-256)` pairs; screenshot binaries are not committed or delivered. Owner visual acceptance, fresh exact-candidate production readback, native-device/Safari acceptance, and external poster delivery remain open. The engineering execution gate remains `BLOCKED` on `RELEASE_READBACK`; no production success or owner approval is inferred from these local checks.

## 2026-10-16 continuation — offline Thai-font boundary resolved, technical matrix PASS

This supersedes the earlier offline missing-font failure as a layout result. It does not assert external poster delivery or owner acceptance.

- Retrieved Kanit400/500/600/700 and variable Noto Sans Thai directly from the official `google/fonts` GitHub repository through the connected file API using base64. Verified each decoded TTF against its exact Git blob SHA and retained OFL licenses locally. No `fonts.gstatic.com` or rejected event-image host was retried.
- Test browser blocks every external request and uses a loopback-only font server, the already captured canonical CSV and checked-in first-party image fallback. Fonts were injected only by the scratch test adapter; application HTML/CSS/font dependencies were not changed. All eight contexts verified both Thai font families loaded; external browser network requests **0**.
- Exact checked code `53a327cce3fd3fd225256ccff3d6a46472ddb950`: actual registered UX reviewer, Visual QA, critic and design council technical checks **8/8 PASS**, 64states/interactions complete, **0P0/0P1**, no runtime errors, writes or paid provider calls. Each width retains8P2 degraded-poster observations because external images deliberately use the local fallback. The gate was not weakened.

| Viewport | Result | Score | P0 | P1 | P2 | Sticky px | Filter rows | Card cols |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 320x568 | PASS | 60 | 0 | 0 | 8 | 96 | 1 | 1 |
| 375x812 | PASS | 60 | 0 | 0 | 8 | 117 | 1 | 2 |
| 390x844 | PASS | 60 | 0 | 0 | 8 | 117 | 1 | 2 |
| 430x932 | PASS | 60 | 0 | 0 | 8 | 117 | 1 | 2 |
| 480x932 | PASS | 60 | 0 | 0 | 8 | 117 | 1 | 2 |
| 768x1024 | PASS | 60 | 0 | 0 | 8 | 159 | 1 | 2 |
| 1024x768 | PASS | 60 | 0 | 0 | 8 | 91 | 1 | 2 |
| 1440x900 | PASS | 60 | 0 | 0 | 8 | 91 | 1 | 2 |

- Manifest SHA-256: `230331de714edfed1b1d505a26b9a0bcf747af2bd4aba3c98cd6fce1fa19eb44`. Policy provenance records exact official font blob identities and eight successful font-load readbacks. This is source/layout acceptance with official local font files, not proof of live Google font delivery.
- Current Production is independently READY at `dpl_4TFT2iMxHer24wtV8LvMGnpKvc3Z`, source **3d8b58af20550ef9fb093d74747548aedb106dfe**. It was published by the separate owner-authorized hero work, not this source-only continuation. Main remains `a54a348d`; do not claim #744 security/revenue/runtime changes are deployed.
- Fresh direct GETs verified Production `index.html`, active storefront CSS, `script.js`, and `style.css` byte-for-byte equal that exact3d8 source (4/4). The three acceptance-only source files in53a do not alter the rendered application.
- Reconfirmed native full tests **1,728/1,728 PASS**, plus focused/targeted results above. Hosted exact-head CI, signed owner screenshot acceptance, live external image/font delivery, nativeSafari and broader final-project gates remain separate and unproven. `release_ready=false` is retained.

Official font blob SHAs:
- Kanit-Regular.ttf: `e9bc0a2f5d0d1ad0df1fa20c44e381834c128c58`
- Kanit-Medium.ttf: `842e9a9e45ba45a47c4203cb892e5d23dc638459`
- Kanit-SemiBold.ttf: `0c79ade5d4d64cd0a0408e34a9b1219f042ea9c5`
- Kanit-Bold.ttf: `fc9110692bd709c4a940156c90b900093ab47c65`
- NotoSansThai.ttf: `34b48ab6f74867dbfce19410a2f452abef34e3ff`

Production file hashes:
- index.html: `21ab03330917aee6730edca4ebdf64409225a2589a5d8dafd41bbe93adb42f44`
- assets/kk-storefront-v5.css: `970d14598f18f80b07e59ac58115ddcb7114a25270c5f274835eec223ae90233`
- script.js: `3706c49822d3b78fca6b1eb91819e8c44132600f59d77d833842c71eefc5f848`
- style.css: `012c61ee5c0691f82d5a9af4cc3674a888f5ab49ccacad15c065d6945209ed1c`
