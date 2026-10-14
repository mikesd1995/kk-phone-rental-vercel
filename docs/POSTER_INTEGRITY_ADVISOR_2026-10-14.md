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
