# SIAM HALLOWEEN 2026 — Nov 1 Owner-Approved Publish Release Contract

Status as of 2026-10-09: **Original image committed, event publication NOT completed.** Do not label this contract as a deployment receipt.

## Evidence and file

- Full original owner-supplied poster (artist-wide lineup, not screenshot): image(3).png, PNG 1638×2048 SHA256 `0d0e73193a0966dbac246d8fcca142e243d3197169a76b3c296a06e6ec4956fa`.
- Transcoded full-height, uncropped WebP, 1638×2048 SHA256 `e9e73bb06b61721b6ddab9bf2ad643e32d47a816627ffae833b13ee13dd5a723`: `/assets/event-posters/siam-halloween-2026-nov01-owner-original.webp`.
- Organizer: Flex104.5 and PMCU, event from **2026-10-30 through 2026-11-01**, Siam Square. Confirmed by organizer's public announcement and owner's official-branded full artwork.
- Original owner-uploaded PNG also saved in persistent ChatGPT Library `/kk phone rental/siam-halloween-2026-owner-supplied-full-poster.png`.
- Image must never be replaced by an old-poster crop, app screenshot, fabricated artwork, or unrelated media without recorded evidence.
- Full artist lineup on multi-day poster does **not** identify performers for the Nov1 stage, so do not assert Nov1-specific artists without official day timetable.

## Exact requested commercial mutation

**Only event date 2026-11-01**; not Oct30 and especially not Oct31 which has two active phone bookings and must remain full. Human owner approved publication on 2026-10-09.

Event title `SIAM HALLOWEEN 2026 — Flex 104.5 × PMCU`, venue `Siam Square, Bangkok`, poster `https://kk-phone-rental.vercel.app/assets/event-posters/siam-halloween-2026-nov01-owner-original.webp`.

The 2026-11-01 inventory **shares 2 total phones** with other event cards NCT127 and NuNew; do not mint 2 new phones for each event. Recheck `00_Master_Booking` immediately before writing. No active booking of Nov1 at last read-only snapshot (2026-10-09). This is a snapshot, not a promise.

**Price 690 phone / 890 with lens is a proposal, NOT authorized final pricing**; latest true direct-event competitor median is missing. Use only owner-approved KK baseline with Verifier fallback and explicit provisional recheck semantics, or await pricing governance without inventing comparables. Existing booked-day prices remain locked.

## Existing production write contract (must not bypass)

1. Owner approval, exact date identity and current booking/availability; `18_Event_Visibility_Locks` no owner tombstone for exact event/day, plus comprehensive historical duplicate check `01_Events`. Never recreate existing hidden event.
2. Confirm public image responds HTTP200 `image/webp` and has correct bytes/dimensions. Source asset ready in Git, not yet proof of CDN.
3. Confirm permission to record at the venue or label suitability of filming; do not invent special camera permission.
4. Prepare `KK_VERIFIER_STOREFRONT_PROMOTION_V6` final prices with `verifier_approved=true`, `owner_publish_allowed=true`, valid `final_pricing_policy`, `visibility_locks`, `existing_event`, status `READY_FOR_FINAL_VERIFIER`; must yield `READY_FOR_GOVERNED_ADMIN_CREATE`. Use `KK_ULTRA_DEEP_V2_GOVERNED_WRITER_V2.createPlan` for package-aware create with correct templates.
5. Authenticate with configured server `KK_ADMIN_PIN`, POST through **existing** `/api/kk-admin-guard` (not direct Google Sheet cells, not public dataset write, not unguarded GET endpoint). Run Admin duplicate/date/tombstone check.
6. Persist event + packages/overrides and verify exact `01_Events`, `08_Web_Ready`, `09_Web_Packages`, public card and poster; if readback mismatch, fail closed and log incident.
7. No scheduler duplicates, no payment/top-up, do not activate paused Make admin bridge without fresh credits/health acceptance.

## Known blocker

The connected tools currently expose Vercel GET and Google Sheets, but not authenticated Admin `POST` with a live owner session. Make `05_KK_ADMIN_WRITE_BRIDGE` was paused due 0 Free credits before 2026-10-10 reset. **Publishing remains unverified; do not mark release done until readback.**

Cross-chat ledger: Event Tracker `_Candidate_Queue!342`, `_Run_Coverage!4580:4586`, `_Audit_Log!395:399`; GitHub Issue #672.
