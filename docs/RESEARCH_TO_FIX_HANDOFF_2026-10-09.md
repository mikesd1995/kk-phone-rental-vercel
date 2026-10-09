# KK Phone Rental — Research-to-fix handoff / source-only implementation
Date: 2026-10-09 (Asia/Bangkok)
Mode: read-only diagnosis plus changes confined to EXISTING draft PR #673. No production rollout.

## Grounded baseline

- Canonical storefront: https://kk-phone-rental.vercel.app/; connected Vercel read returned HTTP 200 and HTML containing FAQ, persisted Light/Dark toggle, TH/EN switch, event search, month/status filters, and modal markup.
- Vercel alias resolved to READY Production deployment `dpl_EvxUPHrrZyBf4hPBptaGQUFx5upp` with main `231ae1b133bd1046afcb5c9e8db74fc42ffe8f6a`. READY is NOT rendered UX/booking/scanner end-to-end acceptance.
- Production HTML loads `style.css`, then the active `assets/kk-storefront-v5.css` layer. The latter had `object-fit:cover!important` on `.poster-img-wrap img`, overriding the original PR #673 base CSS fix until its later `.poster-has-image>img` contain rule applied after a successful load.
- UI features FAQ and theme controls already exist. Do not duplicate them. Production interaction/performance evidence is incomplete.
- Existing workstreams: #673 poster fitting; #674 October known-miss live recall (including ten owner posters); #661 audit/evidence gate; #654 Verifier/External Demand; #665 owner suppression. Do not create duplicate PRs or independent schedulers.

## Actual source changes performed in draft PR #673

Existing PR changes: `style.css` changes base poster from cover/hover zoom to contain/no zoom.

Added in this continuation:
1. `assets/kk-storefront-v5.css`: changes the authoritative base `.poster-img-wrap img` from `object-fit:cover!important` to `object-fit:contain!important`; preserves the existing `.poster-has-image>img` contain rule, blurred same-poster background, status badges, card geometry and responsive layout.
2. `scripts/storefront-evidence.cjs`: records `poster_fit_issues` on **successfully loaded** poster images whose computed `object-fit` differs from `contain`; emits release-blocking `POSTER_ARTWORK_CROPPED` via existing `stateFindings`. The previous letterbox/background witness remains separate.
3. `tests/storefront-poster-fit-contract.test.js`: three Node tests for active CSS cascade/load order, success-state treatment, and crop-finding emission.

Source commits in PR branch:
- `39bc8443ccbecac5e6626928a3d828686fa7ee30` active CSS
- `f7eda8463b359d1b30a3b617f5f3bcb7a4ec2fb4` rendered crop witness
- `800cf1d6c0e98ea558d35b25dd4318eae974a6fa` regression test

## Validation and limitations

- Connector readback at the exact PR branch checked ten independent source-structure assertions: **10/10 PASS** (stylesheet load order, old/new rules, no active `object-fit:cover!important`, loaded-image contain/background, crop witness and test registration).
- This is NOT Node test execution, CI PASS, browser screenshot proof, independent UX Agent review or Production acceptance.
- Required next tests on an authorized no-cost local checkout: `node --test tests/storefront-poster-fit-contract.test.js tests/storefront-evidence.test.js`; broader `npm test`; `npm run ux:visual:accept` with the repository's exact-SHA/local-zero-cost fixture policy; eight viewport/screenshots 320/375/390/430/480/768/1024/1440 with portrait/square/landscape images and light/dark. Do not weaken checks.
- Account evidence as of Oct 7 reported exhausted included GitHub Actions minutes (2032/2000), and prior hosted visual jobs failed with zero runner steps. Current hosted root cause/account billing settings not independently verified this turn. Do not rerun blindly or pay.
- Required release gates: registered `storefront_ux_review` + `storefront_visual_qa` evidence; independent reviewer; exact-head CI; rendered screenshot comparison; owner acceptance; one governed merge/release; exact production readback after authorization. Do not mark accepted based on source assertions.
- The active presentation layer already applies `contain` to `.poster-has-image>img` for loaded posters; therefore distinguish incomplete pre-load/fallback cascade from an unsupported claim that all posters are cropped.

## Cross-stream decisions (no speculative edits)

- PR #674 already fixes false-FULL where the matcher fixture passed despite live known-miss gaps; has explicit `KNOWN_MISS_LIVE_RECALL_INCOMPLETE` and month-scoped evidence. Retain `production_writes=0` until executed live acceptance; candidate vs hidden vs owner-locked distinctions stay authoritative.
- PR #654 covers failure of Verifier to evaluate sourced details without date/legacy title heuristics; do not widen production verification heuristics without its acceptance.
- PR #661 already handles incomplete acceptance and code/test regressions; do not rebuild a second code-intelligence stack.
- Research-based `NO_CHANGE_REQUIRED` principle: if a feature is already present or another PR owns the bug, report it as covered/unverified instead of producing an overlapping patch.
- Existing system-preference behavior for first-visit theme should be tested separately (the current bootstrap defaults to light absent an explicit saved dark choice), but it is not a justification for another major UI refactor or unsafe production release.

## Security, costs, invariants

No booking, pricing, inventory, event visibility, core Sheet/Supabase truth, customer notifications, external sends, or scheduler configuration changed in this PR follow-up. No production deploy, merge, paid tool, quota increase, or business write was requested. Owner-hidden tombstones, booking locks, Verifier, exact readback and fail-closed conditions remain required.

## Suggested next turn

Read this document and PR #673 exact head/diff; confirm tests and eight-width Visual QA with an existing authorized execution path. Only after passing release gates consider merging #673. Review #674 separately using real live known-miss evidence, never synthetic fixture-only FULL. Until then report source-ready changes and remaining blockers, not production success.
