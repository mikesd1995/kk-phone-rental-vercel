# KK Phone Rental — Zero-cost Poster Integrity Advisor (2026-10-14)

## Executive state

This is **Phase 1: read-only automatic source triage**, not an AI model that independently views a poster. No pretrained model is invoked, no OCR is performed, and HTTP 200 or a valid image content type is **not** taken as proof that the flyer matches its event. Owner or independently reviewed visual evidence is still mandatory before source replacement. It does **not** replace the separate one-command owner poster upload flow in [PR #678](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/678).

### Changes in Draft PR
- `server/kk-poster-integrity-agent.js` — deterministic evidence advisor: missing URLs, already owner-audited exact wrong-image pairs (LE7EL, VVV, POP), shared generic KK brand hero, image transport failure, missing event identity, reused image for differently named events (review only), and optional externally supplied visual date/name conflict (review only). Unknown images are marked `DELIVERY_ONLY_IDENTITY_UNVERIFIED`, **never** "official verified."
- `scripts/audit-storefront-posters.js` — adds `poster_integrity` beside its existing HTTP candidate checks; injects an optional fetch implementation for offline acceptance. Script remains a read-only public GET and exits nonzero on missing/broken/known-wrong image. No automatic Sheets changes. A new public-source guard blocks private/loopback/non-HTTPS URL targets and validates up to three bounded redirect hops before downloading, then checks a JPEG/PNG/GIF/WebP/AVIF binary header rather than trusting only the HTTP image MIME; unrecognized formats fail closed for verification.
- `server/kk-agent-registry.js` / `server/kk-agent-task-router.js` — callable `poster_integrity_review` via existing governed Agent Gateway, with `kk-poster-integrity-advisor` authority `READ_ONLY_EVIDENCE_TRIAGE`; gateway continues requiring project-memory bootstrap and durable invocation evidence. It is **not** a new privileged writer.
- `tests/kk-poster-integrity-agent.test.js` — no-network mocks for canonical media, missing, known mismatches, ambiguous cross-event reuse, invalid dates, stale/contradictory visual observations, immutable business fields, image content-type spoofing, unsafe image URLs and private redirect rejection, and the existing HTTP audit report.

## Read-only canonical production-data baseline

Read owner-connected native Google Sheet `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU` > `08_Web_Ready!A4:J380` on **2026-10-14**. Rows at or after 2026-10-14 with `action_for_web` equal to `show` or `show_full`:

| Finding | Count | Meaning |
|---|---:|---|
| Visible future events | 57 | Sheet-visible, not signed-out production browser proof |
| Missing canonical poster URL | **8** | Confirmed blank `poster_image_url` |
| Shared image by distinct names | **2** | Moonshadow Fan Party / After Party; potentially legitimate, **review only** |
| Others without these metadata flags | 47 | **Not confirmed official**, and not proof of successful delivery |
| Official poster replacements executed in this PR | 0 | This PR deliberately does not write to business data |
| Paid AI calls, new schedules, booking/price/stock writes | 0 | Code contract and input-source readback |

Eight blank poster-source events (two additional versus the previous six-item repair ledger):
1. `EVT-20261115-2026-K-POP-MASTERZ-SPECIAL-L` — **2026 K*Pop Masterz SPECIAL LIVE IN BANGKOK** (15 Nov)
2. `EVT-20261127-FORTREASURE-BEYOND-HORIZON` — **FORTREASURE BEYOND THE HORIZON CONCERT** (27 Nov)
3. LE7EL — 1st Debut Anniversary (15 Oct)
4. VVV × Xiaomi (25 Oct)
5. AF Halloween Party — AFTERLIFE (30 Oct)
6. POP-ป่ะห์ #4 Halloween — NAMP Live (30 Oct)
7. MizuMi × PHUWIN — FIND YOUR MOISTURE MATCH (5 Nov)
8. SUPER SUN × ZEE PRUK BIRTHDAY FANSIGN (2 Nov)

**No automatic owner-hidden event unhide**, no fabricated poster, no auto-upload, and no `08_Web_Ready` formula edits.

## Evidence rules and limits

| Category | System verdict | Required handling |
|---|---|---|
| No URL / verified historical wrong URL / generic brand hero | `BLOCKED_NEEDS_POSTER` | Organizer artwork provenance and exact owner approval |
| HTTP image transport fails | `BLOCKED_NEEDS_POSTER` | Check permission, URL redirects, image bytes and cache |
| Same URL, different event names | `OWNER_REVIEW_REQUIRED` | May be one festival flyer spanning dates; never claim wrong just from URL reuse |
| Optional OCR/visual annotation conflicts with canonical date/name | `OWNER_REVIEW_REQUIRED` | Validate annotation, exact event poster and provenance |
| Transport delivered with no known mismatch | `DELIVERY_ONLY_IDENTITY_UNVERIFIED` | Human/verified AI visual inspection still needed |
| Missing canonical event ID or invalid calendar date | `BLOCKED_NEEDS_POSTER` | Do not guess event identity |

Visual observations have to supply the exact `event_id` and the current `poster_url`; stale URL evidence is ignored. They do not automatically set `official_poster_verified=true`. The advisor never calls a vision API, books reservations, writes logs to paid services, or approves its own suggested replacement.

## How to test (no external write)

```bash
node --test tests/kk-poster-integrity-agent.test.js
# Optional read-only live network audit: GET only; run intentionally, never by default
node scripts/audit-storefront-posters.js > storefront-poster-health.json
```

Caller can pass rows directly via `TaskRouter.executeTask('poster_integrity_review',{rows,delivery_by_event,visual_observations})`. The existing Agent Gateway must have its durable invocation ledger and project-memory bootstrap available and will otherwise fail closed; this is not a bypass.

The audit's normal output includes `poster_integrity`; the existing GitHub health workflow is **manual/on existing main script change only** (no new recurrence). It may fail due to intentionally blank source URLs; a failing gate must not be masked by a fallback or treated as permission to change Core SOT.

### Test evidence and honesty

- **17/17 targeted tests passed** in a standalone exact-file V8 mock harness loading file bytes from the GitHub Draft branch (not a real Node test process). This includes a full synthetic public-feed CSV + injected no-network image GET and a check for zero business writes. Detailed source checks are in the test file.
- No Vercel Preview/Production deployment, GitHub merge, paid API, new automation, or Google Sheet modification was performed.
- Not yet accepted: real Node CI on the exact candidate head, signed-out image network/visual QA for 57 event cards, and independent actual image pixels/date/artist verification. These remain distinct release gates.
- This branch edits source modules and documentation only, **does not touch Booking, price, stock, LINE**, and does not depend on TinyFish.

## Next bounded steps

1. Run the 13 tests in a Node>=20 runtime in the repository, then run normal CI only within existing free quotas. Do not claim green on the basis of mock harness alone.
2. Add **optional local/free** visual evidence extraction where permitted (e.g., human-provided checked OCR/vision observations) and verify provider provenance and event/date before changing poster fields. Do not invoke paid models or silently treat guesses as truth.
3. Remediate the 8 blank-source events using owner-reviewed exact official originals through the existing governed poster-only writer; check both Core `01_Events.poster_image_url` and derived WebReady, then signed-out production `naturalWidth>0` and object-fit `contain`. Changes in PR #727 and #678 are independent Draft branches and must be reconciled with this new branch before a unified release.
4. Only after exact-head CI, independent visual screenshots, owner approval and free Vercel quota proof, merge/deploy and collect rollback evidence. Do not mark entire automatic visual-validation program complete at this stage.

### Cross-chat handoff

Branch `fix/poster-integrity-advisor-zero-cost-20261014`. This audit is safe to resume by fetching this document and running the above targeted tests. Current mode: advisory source code in Draft; `production_writes=0`, zero model charges, all releases HOLD.

### Network hardening details

The prior poster-health probe trusted HTTP `image/*` plus at least one byte; it could classify a forged image-MIME HTML page as delivered. The candidate now checks supported image-file magic bytes and rejects misleading content. Fetch is GET-only and uses a hard timeout, bounded concurrency, 3-hop redirect cap and HTTPS-only public targets. Private/loopback and link-local IPv4/IPv6 literals, localhost, non-HTTPS and unsafe redirect targets are rejected before another GET. This is defense in depth, **not** a complete DNS-rebinding-proof sandbox: production execution requires an egress policy or isolated runner if untrusted hosts are introduced.

Visual identity is **still not pixel-verified** by this protocol; valid JPEG bytes could depict the wrong event. These continue to require organizer and owner visual evidence.

### Change/provenance accounting

- Earlier state: 57 future-visible, six known blank poster sources. New direct 14 Oct sheet readback confirms **eight blank sources** including K*Pop Masterz SPECIAL LIVE (15 Nov) and FORTREASURE BEYOND THE HORIZON (27 Nov). These two extra rows were **already blank** when read; no source was cleared by this branch.
- No new automatic nightly/posting task was registered, no Hugging Face or OpenAI inference endpoint invoked, and no GitHub Actions workflow was manually triggered.
- New agent task route is callable when given an explicit event list. The only automatic component at present is within the existing poster-health audit when that audit is invoked. Fully unattended visual classification or autonomous repair is **not enabled**.

## Follow-up 14 Oct: reconcile full 57-row audit / ninth missing poster

### Readback chronology (do not confuse earlier 8 with latest 9)
- Earlier PR #736 snapshot recorded **8** missing poster URLs. The separate 57-entry audit in [PR #727](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/727) subsequently confirmed removal of LYKN REFLEXION's **23 October** artwork; it printed only 24–25 October, while official ThaiTicketMajor confirms a third 23 October show: https://www.thaiticketmajor.com/concert/lykn-reflexion-concert.html .
- Fresh authoritative `08_Web_Ready!A5:J380` signed-in Google Sheets readback on 2026-10-14 now yields **57 future visible (50 show + 7 show_full), 48 nonempty URL, 9 empty poster URL**. The earlier eight count above is HISTORICAL and no longer current.
- Nine required organizer-exact sources: LE7EL 15 Oct, LYKN 23 Oct, VVV/Xiaomi 25 Oct, AF AFTERLIFE 30 Oct, POP-ป่ะห์ #4 30 Oct, SUPER SUN/ZEE 2 Nov, MizuMi/PHUWIN 5 Nov, K*Pop Masterz 15 Nov, FORTREASURE 27 Nov.

### New code-only preventive changes on this Draft (NO customer-facing release)
- `server/kk-poster-integrity-agent.js` `KNOWN_WRONG` now includes **six exact event_id/old_url pairs**, adding LYKN 23 Oct (Drive ID `1YAcm8q9b9YBJcAKeEgxRB5fnVIPXbiDS`), K*Pop Masterz 15 Nov (Drive ID `1yMVpy4pNNuitIb6FFsBiEo4y9-ogFA2i`), and FORTREASURE 27 Nov (Drive ID `1OVYGQIlzt-n_la8eKKwgFIBcrrVxix78`) to earlier LE7EL, VVV/Xiaomi and POP/NAMP historical sources. Each is barred ONLY on the affected exact event ID; different dates and genuinely corrected URL remain eligible for future visual review.
- `tests/kk-poster-integrity-agent.test.js` now covers all six and the additional three date-specific pairs, cross-event isolation, no unauthorized business mutations, and recovery when the owner supplies a new organizer URL.
- Executed **six/six** verified old-URL guard checks and URL-replacement checks via fetched source in a pure V8 harness. For production-feed triage the isolated harness required a minimal `URL` shim because the orchestration runtime lacks Node's global `URL`; without it all Drive URLs erroneously group by path. Re-tested with a per-ID URL parser, yielding **57 visible / 9 BLOCKED_NEEDS_POSTER / 2 OWNER_REVIEW_REQUIRED (Moonshadow two-day shared festival-style art, not confirmed wrong) / 46 DELIVERY_ONLY_IDENTITY_UNVERIFIED**. This is only a source-triage test, **NOT** running GitHub's native Node test suite.
- `DELIVERY_ONLY_IDENTITY_UNVERIFIED` expressly does not mean the file loaded or is the exact official poster. No HTTP image GET/browser visual check was performed by this triage.

### Additional validation and remaining limitations
- Public site `https://kk-phone-rental.vercel.app/` and public `/api/kk-data` were not accessible to the available web reader, while the free local container has no outbound DNS. Thus real signed-out `naturalWidth`, client screenshot, Google Drive redirect, 48/48 HTTP response and pixel-date verification remain **NOT TESTED**; do not claim that the 57 cards are visually correct or that this PR is Production.
- Google Drive owner-metadata on all **27/27** unique image IDs before 3 source removals found valid nonzero image bytes and `Anyone:writer`; permission risk must be handled separately, no public sharing modification made here.
- Official schedule (not an approved image source): ThaiTicketMajor https://www.thaiticketmajor.com/concert/lykn-reflexion-concert.html lists Oct 23, 24, 25; Eventpop https://www.eventpop.me/g/concert indexes FORTREASURE performance Nov 29, so Nov 27 must be treated as an owner-listed related benefit day rather than assuming the 29th performance poster matches Nov 27. Business/event visibility state untouched.
- Zero paid requests, zero model inference, zero local service change, zero Vercel deployment, **zero Sheet/Booking/price/stock/visibility mutations** from this PR continuation. Original live 9 blanks are retained. CI exact-head status and signed-out visual acceptance still required; PR remains Draft/HOLD.

### Resume path
First read the full [57-row per-event snapshot](https://github.com/mikesd1995/kk-phone-rental-vercel/blob/fix/storefront-premium-poster-release-candidate-20261014/docs/STOREFRONT_POSTER_57_EVENT_AUDIT_2026-10-14.md), then current Sheet readback, reconcile this Draft with PR #727's poster-only changes, obtain and pixel-confirm exact organizer sources for the 9 blanks, inspect all 48 URL-present cards signed-out, resolve CI/runner failure without incurring charges, and ONLY then request owner release approval.

### Exact-head 14 Oct follow-up CI readback
- Current Draft PR #736 branch head after follow-up doc change: `eda27a1f9899e9165091c352f8346faeb1774d2f` at time of run submission. GitHub Actions [zero-cost acceptance 38502214008](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38502214008) and [visual QA 38502214092](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38502214092) both **completed FAILURE**. Their jobs exposed **0 steps**, and `fetch_workflow_job_logs` for both returned HTTP 404 `BlobNotFound`. The failure cannot be attributed to application tests from this evidence; it does **not** establish native Node green. No reruns, paid services or deploys were requested.
- Current 57-row canonical Sheets triage with per-ID URL parsing: 9 missing, 2 Moonshadow cross-name review, 46 URL-present **identity/delivery unverified**. No auto-publishing and zero source writes during this continuation. Earlier 8-source statements are dated snapshots, superseded by latest 9.

## Consolidation acceptance 14 Oct 2026 — Option 5 continuation

### One canonical integration, no competing poster agents
- PR #736 remains primary **read-only poster-integrity advisor**, Agent Registry and Router route `poster_integrity_review`. Features unique to experimental PR #735 were moved into this existing agent and existing CLI, not deployed as a second agent.
- `server/kk-poster-integrity-agent.js`: optional `as_of` date filter; Buddhist/ISO date normalization; exact event+URL+date AI evidence; independent decoded-image SHA256 equality plus successful image decode and organizer source URL; same-byte hashes across different URLs are review-only; `ai_review_queue` for model-assisted visual review; owner approval remains always false; brand/wrong event URL blocks; temporary-source notes receive review; safe HTTPS public host checks for poster and AI evidence.
- `scripts/audit-storefront-posters.js`: keeps its hardened HTTPS redirect/magic-bytes network guard; manual optional `--as-of=YYYY-MM-DD`, `--observations-file=...`, `--vision-file=...` JSON input; only binds decoded evidence when event ID and **current canonical URL** match. Invalid/missing CSV schema, empty data, no visible records or invalid date fail closed. **No automatic writer, model job, recurring scheduler or spend.**
- `tests/kk-poster-integrity-agent.test.js`: 31 cases exercised from exact connected branch source in isolated JavaScript V8 environment (mocked URL/Response, timer, AbortController, process): **31/31 passed** including legacy advisor/router and new byte/evidence, private URL, no-booking-write and CLI cases. This is NOT a checked-out native Node suite or GitHub CI.

### Current source and event scope
- Owner-connected `08_Web_Ready!A4:J380` on 14 Oct: **57 future-visible records**, **9 missing poster URLs** (previous six plus LYKN REFLEXION 23 Oct / K*Pop Masterz 15 Nov / FORTREASURE 27 Nov), **48 with URL**, not necessarily verified or healthy. Core and derived both had LYKN 23 Oct poster empty and `show_full`; do not touch Bookings, price, available stock or owner locks.
- When Drive thumbnail query IDs are compared accurately (real Node WHATWG URL or parsed id), the sole same-file cross-name pair on these 57 future records is `Moonshadow : The Afterglow Fan Party` (14 Oct) and `Moonshadow : The Afterglow After Party` (15 Oct), potentially valid shared event flyer. **Review required**, not known wrong. Do NOT strip Drive thumbnail IDs and collapse every Google Drive image to `/thumbnail`.
- Even healthy image delivery proves only bytes/MIME, not event/date; `official_poster_verified=false` for all without separate organizer image inspection. There has been NO live model inference or customer-browser screenshot proof.

### Run commands and evidence contract (manual/free)
```bash
node --test tests/kk-poster-integrity-agent.test.js
node scripts/audit-storefront-posters.js --as-of=2026-10-14
node scripts/audit-storefront-posters.js --as-of=2026-10-14 --observations-file=/path/decoded.json --vision-file=/path/vision.json
```
Only operator-supplied decoded image evidence may carry `event_id`, `poster_url` (exact canonical), `sha256` (64 hex), `loaded=true`, `natural_width>0`; a separate AI vision record requires matching `event_id`, `poster_url`, `event_date`, `asset_sha256`, `verdict`, organizer `evidence_url`, `title_match`, `date_match`, and confidence 0.8–1. Positive AI evidence is labeled `AI_MATCH_UNVERIFIED_BY_OWNER`, never an approval/Sheet write. Missing/suspicious evidence remains alert/review. No source data or Booking may be copied into provider payloads.

### Explicit release/rollback gates
- Preserve this Draft PR; **not** merged, not deployed, no Vercel quota consumed by this assistant. Existing production READY SHA is not evidence that these Draft code changes are live.
- Full native Node exact-head CI and browser signed-out 57-card naturalWidth/pixel/`object-fit:contain` QA are still pending; earlier GitHub runners have failed without exposed steps/BlobNotFound, so cannot assert CI green.
- Official organizer originals for nine blank sources remain pending through owner-approved poster-only path (Issue #731). No inferred/fan/older art substitutions; preserve LYKN 23 Oct show_full booking lock.
- Recommended branch cleanup: close duplicate Draft PR #735 as **superseded by #736** only after confirming its unique source evidence gates were copied and reviewed. Keep its history/doc accessible across chats.

**Measured outcome: merged features inside Draft #736; read-only code & mock tests ready; production poster original replacement = 0 in this pass; customer-browser visual acceptance NOT YET PASSED.**
## Final exact-branch CI check — 14 Oct 2026 ~09:45 ICT

- Draft primary PR #736 advanced with strict unsafe poster / official-evidence URL validation, and imported exact-event current-source decoded-image + optional AI digest evidence into the existing manual poster health audit.
- Exact fetched branch `server/kk-poster-integrity-agent.js`, `scripts/audit-storefront-posters.js`, `server/kk-agent-registry.js`, `tests/kk-poster-integrity-agent.test.js`: **31/31 selected regression tests passed** in an isolated V8 execution with mocked URL, Response, timers and process. The module source had an intermediary syntax error from a string-replacement patch; this was detected **and repaired in commit 64afebe** before this passing run. This is a mock-runtime result, **not** a native Node test or CI certificate.
- GitHub actions for post-consolidation commit `a35cfc1fbd0af745791a49b11761b78b8bd2d971`: [Storefront Automated Visual QA run 38502659214](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38502659214) and [OpenAI Optional Zero-Cost Acceptance run 38502659403](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38502659403) both completed with **failure**, jobs each returned **zero steps**, logs read **404 BlobNotFound**. The exact failure cause is still **unverified** and cannot be attributed to application tests. No CI rerun was manually triggered; keep PR Draft/HOLD.
- Direct public web-tool access to `https://kk-phone-rental.vercel.app/` and its `api/kk-data` URL was inaccessible in this session; customer signed-out browser and `naturalWidth`/pixel verification remain **unverified**.
- Vercel Production READY remains `dpl_7TYLb87ir9qNzXRtkeb49543dwVm` at main commit `d6dc3bfe4cc0c4dd6fdfec407823752da0572464`; draft primary #736 remains **unmerged and undeployed**. No Google Sheets, Booking, prices, stock, owner visibility, LINE, API provider send, paid model inference or scheduler changes.
- After full feature parity confirmation, close experimental Draft #735 as superseded and preserve its history. Continue only in primary PR #736 for exact-head Node/CI, signer-off visual QA and owner approval. This document is the persistent cross-chat handoff.

**Release result: merged intelligence features into a single staged Draft source, not live automation. Nine missing official poster originals and production pixel validation remain open.**
## Poster canonical precedence hardening — 14 Oct continued repair

### Reproduced integrity defect and implemented source-only correction
- The advisory previously resolved poster source as `poster_image_url || canonical || poster_url`. This can **resurrect stale media** from legacy fields when `poster_image_url` is intentionally set to the empty string to remove a verified wrong poster. A provided healthy old preview image could then mislead audit output into treating the stale image as the primary event poster even though the public source-of-truth explicitly has no poster.
- Fixed `server/kk-poster-integrity-agent.js`: explicitly present `poster_image_url` is authoritative **including an empty string**; fall back to `canonical` or `poster_url` ONLY when higher-priority property is ABSENT (for legacy inputs without this key). This intentionally does not change event visibility or any Sheets data.
- Another defect: event-ID-keyed `delivery_by_event` can carry transport success from an old canonical URL after the owner has replaced the poster. Now discards such transport evidence **when `canonical_url` is present and differs exactly from current canonical URL**; returns `NOT_TESTED`/`NOT_TESTED` instead of false `IMAGE_DELIVERED` / `HEALTHY`. A matching URL remains delivery-observable but never becomes `official_poster_verified=true` merely because image GET succeeded.
- Added two regression cases in `tests/kk-poster-integrity-agent.test.js` covering blank canonical with nonempty old `canonical` and `poster_url` aliases, stale successful delivery evidence from old URL, current valid delivery, zero Booking/pricing/visibility/Production writes and no owner object mutation.

### Focused test and live readback evidence
- Fetched exact modified `server/kk-poster-integrity-agent.js` from this GitHub Draft branch and evaluated in a zero-network V8 harness with a minimal HTTPS URL parser substitute (the orchestration isolate has no native Node `URL` constructor). **10/10 focused cases PASS**: blank source and aliases; stale delivery; matching current delivery (identity still unverified); 6 exact audited wrong event+source pairs; actual current 57-event triage.
- Canonical read-only Google Sheets `08_Web_Ready!A5:J380`: **57 visible**, `show=50`, `show_full=7`, **9 empty poster URL**, **48 nonempty URLs**. Advisor verdicts **9 BLOCKED_NEEDS_POSTER, 2 OWNER_REVIEW_REQUIRED (Moonshadow Fan Party/After Party share a poster, not proven wrong), 46 DELIVERY_ONLY_IDENTITY_UNVERIFIED**. No new Sheet writes in this continuation.
- Browser and native Node CI **NOT proven**: CLI container has Node 22 and Chromium but external DNS resolution for both GitHub source download and live storefront failed. Without owner-authorized free browser connectivity, no truthful client-signed-out 57/57 image GET / naturalWidth / screenshot proof can be reported. GitHub PR Actions also continue returning failed jobs with no executed steps and BlobNotFound logs in earlier attempts; do not infer application-test failure/success.
- Organizer schedule searches for 9 missing events confirm schedules (e.g. LE7EL 15 Oct, SUPER SUN x Zee 2 Nov, K*Pop Masterz 15 Nov, POP-ป่ะห์ 30 Oct), but no signed-out direct source URL plus inspectable exact-date official image bytes passed the provenance gate. **0 official poster URL replacements**; keep all 9 truthful event-specific fallback cards pending verified originals.

### Safety, PR status, and restart procedure
- Zero Booking, price, stock, LINE, owner visibility, canonical Sheets poster, Drive permission, Vercel deployment or paid-provider changes in this continuation. The **only writes** were `server/kk-poster-integrity-agent.js`, `tests/kk-poster-integrity-agent.test.js`, this Markdown record, and GitHub PR/Issue metadata.
- Exact branch: `fix/poster-integrity-advisor-zero-cost-20261014`, PR #736 at https://github.com/mikesd1995/kk-phone-rental-vercel/pull/736 remains **Draft/HOLD**; do not merge/deploy without native tests, zero-cost available CI, first-party image provenance and signed-out browser acceptance.
- To resume in another chat: read this file, then [57-event per-row source ledger](https://github.com/mikesd1995/kk-phone-rental-vercel/blob/fix/storefront-premium-poster-release-candidate-20261014/docs/STOREFRONT_POSTER_57_EVENT_AUDIT_2026-10-14.md), verify fresh Core/WebReady count, inspect `KNOWN_WRONG` and canonical priority tests, check exact-head CI without paid reruns, and only update the nine Core poster cells if event/date/art bytes and anonymous delivery are verified.
## Canonical-vs-fallback defect closure — 14 October 2026

### Production-risk finding and code fix (Draft only)
- Existing `scripts/audit-storefront-posters.js` reported `recovered_by_fallback=true` when a **different Google Drive thumbnail candidate for the same underlying canonical file** happened to be the first healthy URL. That is a false emergency-recovery attribution, because alternate Drive endpoints are not alternate event artwork.
- It also evaluated overall card `PASS` if ANY checked fallback image loaded. The core source could have returned 404 or invalid magic bytes but source-health truth was hidden in the low-level candidate list; callers could wrongly infer the official/canonical poster itself was healthy.
- Fixed first case by comparing a successful image URL against **all canonical candidates**, not just canonical[0]. Added `canonical_candidate_count`, `canonical_healthy` and a strict `recovered_by_fallback` signal.
- Fixed second case in `server/kk-poster-integrity-agent.js`: if canonical is known bad but an emergency poster returns successfully, add **P0 `CANONICAL_POSTER_DELIVERY_FAILED`**, `canonical_status=FAILED`, `emergency_recovery=true` while still reporting `IMAGE_DELIVERED` for the visible card. **Do not automatically replace or remove art**.
- At report level, added `canonical_failed_events` and `canonical_failed[]`, separately from old `failed_events` (any candidate/fallback failure) and `recovered_by_fallback`. Nonzero canonical failures cause exit status 2 during CLI audit, even if a fallback means the visible card remains usable.
- Added 3 core regressions: canonical source 404 with healthy emergency MaxkyBas; alternative Google Drive endpoint within same file ID does **not** count as an emergency recovery; card PASS cannot conceal P0 canonical failure. Added 2 assertions to verify top-level canonical failed counts.

### Verification and remaining gates
- Exact fetched GitHub branch `server/kk-poster-integrity-agent.js`, `scripts/audit-storefront-posters.js`, `server/kk-agent-registry.js`, `tests/kk-poster-integrity-agent.test.js` loaded together in isolated JS V8 test harness with mocked URL, Response, timers and process: **36 / 36 selected callbacks PASS**, 0 failures. Full checked-out native Node runtime **not** executed because this isolated container cannot DNS-resolve GitHub; don't confuse a V8 harness with `node --test`/CI.
- Automatic GitHub Actions jobs for an earlier pre-final source commit `a1795abe0ca70c30498a3ec18c7f96ac1a7f1532`: [Zero Cost #38506016054](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38506016054) job 115663587912 and [Visual QA #38506016087](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38506016087) job 115663588745 **failed with zero reported steps and logs HTTP 404 BlobNotFound**, reproducing the previously recorded upstream runner/log issue. The application steps did **not** demonstrably execute; don't interpret this as a Node test failure or assert runner quota as the proven cause.
- Related [CI Issue #707](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/707) documents a *historical* GitHub account usage warning (2032/2000 minutes on 2 Oct 2026, free reset listed 1 Nov), but separately documents **successful real hosted runner runs on 13 Oct for PR #724**. Hence the cause of this fresh intermittent zero-step failure is **unconfirmed**; do not spend money, raise budget or rerun repeatedly.
- Public `https://kk-phone-rental.vercel.app/` cannot be opened using available external web tools; signed-out 57-card browser decode/naturalWidth and visual event-art identity remain unverified.
- Independent owner-connected canonical `08_Web_Ready!A4:J380` readback **still: 57 future-visible events, 9 missing poster URLs** (LYKN 23 Oct and K*Pop Masterz Nov15 are `show_full`; nine blank originals need authorized future source updates) and **48 nonempty source URLs not visually certified**. Data, status, Booking, availability, prices, LINE and rights untouched.
- **No expenses/no additional deployments/no manual CI reruns**. Both this Draft PR and production remain distinct; no automatic AI model inference was run and no poster was published from AI-generated verdicts.

### Safe continuation
1. Use approved zero-spend Node runtime to check exact current PR SHA with `node --test tests/kk-poster-integrity-agent.test.js`; capture actual CI logs; triage Actions account/runtime state in CI Issue #707 if the job has zero steps.
2. Run manual read-only image audit with `--as-of=2026-10-14`, using safe public network access. Inspect `canonical_failed_events` separately from card `failed_events`; preserve event-specific share-image exceptions.
3. Verify the original artwork for each of nine missing poster dates; check publisher provenance and actual pixels. `AI_MATCH_UNVERIFIED_BY_OWNER` never approves a publish.
4. Get signed-out browser desktop/mobile visual QA, deterministic release acceptance, then owner-reviewed merge and Production readback. **Do not auto-deploy while required checks fail.**