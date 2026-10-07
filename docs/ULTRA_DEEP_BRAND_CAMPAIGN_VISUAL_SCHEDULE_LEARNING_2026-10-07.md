# Ultra Deep brand-campaign / visual-schedule recall hardening — 2026-10-07

## Trigger
Owner supplied five poster/schedule examples that exposed a recurring recall gap:
- SING INFINITY — 24 Oct 2026 — true October discovery miss.
- Love at First Trip with TleFirstone — 8 Nov 2026 — true November brand/private-trip miss.
- L'Oréal Paris Elseve Day with AuAu — 20 Nov 2026 — true November purchase-to-win/Lucky Fan miss.
- Curél Sun-safe & Fan-fun! Auu & Save — 19 Dec 2026 — December event, but its purchase window runs through 8 Nov and winner announcement is 17 Nov, so November discovery should capture it as cross-month lead-time evidence.
- TOPS OF BEAUTY performance schedule — 1–7 Oct — partially discovered previously, proving that individual brand posts were found while the whole schedule-board family was not exhaustively segmented.

## Root cause
The source registry already had BRAND_SPONSOR, mall campaigns, and lucky-fan/top-spender coverage. The failure was semantic granularity, not absence of the tier:
1. purchase/register/redeem/winner-confirmation language was not a mandatory query lane;
2. private experience formats (trip/workshop/private talk/polaroid) were not first-class discovery terms;
3. retail performance schedule / image-led calendar boards were not a first-class lane;
4. monthly date windows were event-date-centric, so a future-month event with a target-month qualification window could be missed;
5. known-miss regression did not contain these event archetypes.

## Repair
- Source registry V6 adds required brand source families for beauty/personal-care campaigns, retail performance schedules, purchase/register/redeem campaigns, and private brand experiences.
- Monthly query plan V9 adds PRESS_BRAND expansion plus CAMPAIGN_LEAD_TIME and VISUAL_SCHEDULE lanes.
- CAMPAIGN_LEAD_TIME may extend through the end of the next month so an active qualification/winner window can seed the future Candidate Master Pool without making the future event storefront-eligible in the current month.
- Learning Agent V4 learns BRAND_PURCHASE_CAMPAIGN_GAP, BRAND_LEAD_TIME_CAMPAIGN_GAP, RETAIL_SCHEDULE_BOARD_GAP, IMAGE_ONLY_SCHEDULE_GAP and BRAND_PRIVATE_EXPERIENCE_GAP.
- Independent reference sweep adds purchase/register/winner/private-experience and performance-schedule challenge queries.
- Known-miss regression V9 adds SING INFINITY, TleFirstone brand trip, Elseve/AuAu, Curél/Auu&Save and TOPS schedule-board archetypes.

## Safety
- Candidate discovery only.
- No storefront publication authority added.
- Verifier and external-demand gates remain required.
- No automatic reopen of owner-hidden events.
- No booking/price/inventory/customer mutation.
- production_writes=0.
- Cross-month lead-time discovery does not authorize current-month publication of a future-month event.
