# KK Phone Rental — Poster Intelligence V1 (read-only candidate, 14 October 2026)

## Objective and authority

Owner selected **Option 5: automatic poster auditing + AI learning** without modifying Booking and with zero paid-provider spend. This is a **source-only, non-deployed, read-only manual preflight**, not a new scheduled automation and not a production writer. It does **not** run any paid AI model, does **not** automatically claim artwork is the correct concert, and does **not** update canonical spreadsheet records. Its output is a review queue designed for a later trusted visual model and human owner/verifier.

Isolated branch: `feat/poster-intelligence-readonly-v1-20261014` from `main`. Independent from owner poster write-route Draft PR #678 and storefront design Draft PR #727. No merge/release until exact-head regression acceptance and budget-safe review.

## Implemented

1. `server/kk-poster-intelligence.js`: pure, zero-cost evaluator. Explicit `as_of` Bangkok-day eligibility, show/show_full only, duplicates, missing URL, HTTPS/host validation, shop-brand placeholder detection, three exact historically misattributed photos (LE7EL 15 Oct, VVV/Xiaomi 25 Oct, POP-ป่ะห์ 30 Oct), multi-event reused image (review-only), signed-out delivery observations (if supplied), and content-type/dimensions evidence.
2. Image source key normalizes Google Drive thumbnail and googleusercontent variants by immutable file ID. **Two dates of the same named event sharing artwork are not automatically marked wrong.** Different named events using one asset are only an alert: multi-event event flyers can legitimately span distinct names.
3. `ai_review_queue` instructs vision reviewer to inspect **actual pixels**, printed performer/name/date, organizer announcement link, original bytes SHA256, delivery evidence and cropping. Evidence import: `vision_reviews` keyed by exact event ID, image URL and event date. Positive vision verdict demands exact digest match with independently recorded loaded/decoded image, official evidence link, title/date booleans and high confidence. Even then output is **AI_MATCH_UNVERIFIED_BY_OWNER** and never authorizes publication.
4. `scripts/kk-poster-intelligence-audit.js`: read-only CLI using public `08_Web_Ready` feed, default operating day calculated for Asia/Bangkok; optional local fixture, observation file, vision-review file; `--probe` opt-in reuses existing zero-cost external poster network checker. **No provider jobs, GitHub Actions timer, Vercel deployment or Google Sheet writer.**
5. Regression: `tests/kk-poster-intelligence.test.js` and `tests/kk-poster-intelligence-audit.test.js`. No changes to existing booking, price, inventory, storefront render, event visibility, LINE or pricing files.

## Live source inventory, exact read-only Google Sheets snapshot

Connected spreadsheet ID: `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`; derived `08_Web_Ready!A4:J380`, read on 14 Oct 2026, filter `action_for_web=show/show_full` and `event_date >= 2026-10-14`.

- **57 future visible events** out of **78 total show/show_full rows** (21 old show rows before the date excluded).
- **8 missing poster URL** -> P0 needs exact original or temporary event summary, **not automatic hide**. Earlier audit reported only 6; this new read-back identifies **two additional public, future visible blanks**.
- **49 remaining image URLs** -> P1 `IMAGE_DELIVERY_UNVERIFIED` because real signed-out HTTP/image decode and pixel-verification proof **not collected in this run**. They are **not** 49 confirmed broken/wrong posters.
- **2 reused URL entries** -> one low-confidence cross-name alert involving Moonshadow: The Afterglow Fan Party (14 Oct) and Moonshadow: The Afterglow After Party (15 Oct). Their shared flyer may be correct; no auto removal.
- Without independent browser/network probes and visual checks, do **not** label any visible image `VERIFIED_OFFICIAL`.

### Eight missing official poster sources

| Date | Event | Issue |
| --- | --- | --- |
| 15 Oct 2026 | LE7EL — 1st Debut Anniversary | previously wrong artist photo removed |
| 25 Oct 2026 | VVV — Tornado Shopping × Xiaomi | previously unrelated VVV promotion removed |
| 30 Oct 2026 | AF Halloween Party — AFTERLIFE | repeated KK brand hero removed |
| 30 Oct 2026 | POP-ป่ะห์ #4 Halloween — NAMP Live | previous-event photograph removed |
| 2 Nov 2026 | SUPER SUN × ZEE PRUK BIRTHDAY FANSIGN | repeated KK brand hero removed |
| 5 Nov 2026 | MizuMi × PHUWIN — FIND YOUR MOISTURE MATCH | repeated KK brand hero removed |
| **15 Nov 2026** | **2026 K*Pop Masterz SPECIAL LIVE IN BANGKOK** | **additional blank URL found 14 Oct** |
| **27 Nov 2026** | **FORTREASURE BEYOND THE HORIZON CONCERT** | **additional blank URL found 14 Oct** |

Prior six source clears are logged with full rollback URLs in `docs/STOREFRONT_POSTER_SOURCE_AUDIT_2026-10-14.md` on PR #727. **This PR does not change those records again.** Missing posters are not secretly hidden or sold out.

## Runbook (manual, zero paid service)

```bash
node --test tests/kk-poster-intelligence.test.js tests/kk-poster-intelligence-audit.test.js
node scripts/kk-poster-intelligence-audit.js --as-of=2026-10-14
# Optional read-only HTTP image sampling (may take time, does not prove artistic identity):
node scripts/kk-poster-intelligence-audit.js --as-of=2026-10-14 --probe
# Offline input and independently gathered evidence:
node scripts/kk-poster-intelligence-audit.js --rows-file=/path/to/rows.json --observations-file=/path/to/decoded-images.json --vision-file=/path/to/vision-evidence.json --as-of=2026-10-14
```

Output codes: P0 when source missing, historically wrong, generic shop artwork, invalid/private source, duplicated event IDs, or observed broken response; P1 for unverified source/image bytes and suspected cross-event reuse. P1 does not mean wrong artwork. Exit code 2 if any P0 found; it is a signal for manual review, **not** a production write.

For AI review evidence, the supplied record must include `event_id`, `event_date`, `poster_url`, `verdict`, `asset_sha256`, `evidence_url`, `title_match`, `date_match`, and `confidence`. Positive advisory verdict requires a separate observation with **the same** SHA256, `loaded=true`, `natural_width>0`. Source validation is distinct from owner approval. All reports explicitly state `production_writes=0` and `ai_can_approve=false`.

## Remaining gates / known limitations

- **Not yet a running vision model**: zero-cost deterministic risk engine and model-ready evidence queue are implemented, but paid AI inference is **not enabled**. Do not claim automatic semantic art verification, visual accuracy scores, learning completion, or continuous monitoring.
- The existing `scripts/audit-storefront-posters.js` network check validates HTTP image byte delivery, **not** actual concert/date/pixel identity and **not** browser naturalWidth. An optional network probe cannot by itself pass a visual gate.
- **No scheduled task** has been created; manual CLI and read-only audit API only. A future owner-approved free-capacity runner could schedule reporting but must not write Sheets and must not bypass spend/CI budget.
- Add verified organizer-original posters for 8 missing entries using owner-authorized poster-only workflow (see issue #677/PR #678 and #731). Do not scrape and publish an unverified fan image. Verify effective Drive Reader permission and immutable ID, Core+derived readback and customer-browser image before considering complete.
- PR stays Draft/HOLD until exact-head real Node tests and CI/QA accepted. Earlier Vercel/GitHub Visual QA runner sometimes fails before steps/BlobNotFound; a local V8 test harness is **not** an official Node/CI pass.
- No Booking, pricing, inventory, LINE, event visibility, Core/derived Sheets, Vercel production/preview, or paid providers were mutated in this work.

## Cross-chat continuation

On next turn: inspect this document, the new Draft PR and linked issue. First distinguish **verified shipped** vs **staged source** vs **unavailable original images**. Next complete Node test readback and signed-out browse/inventory of 57 events; triage the eight missing (including K*Pop Masterz & FORTREASURE); accept only evidence-bound vision verdicts; keep owner/verifier approval for replacement. Do not automatically promote any poster based on a model's confidence.
