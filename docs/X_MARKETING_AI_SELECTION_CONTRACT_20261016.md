# KK Phone Rental — AI-selected X Posting Contract (2026-10-16)

Status: **SPEC + SHADOW ONLY**, not production-activated. Owner direction: every future X posting timetable must select events using **remaining bookable physical phones** first, then verified engagement and learning evidence; no subjective hype masquerading as measured engagement. No automatic posting.

## Mandatory decision order

1. **Read live Production** `https://kk-phone-rental.vercel.app/api/kk-data?sheet=08_Web_Ready&range=A4:K` and `...sheet=09_Web_Packages&range=A4:N`; verify HTTP 200, freshness, exact event ID/date, package price > 0 (or clearly marked inquiry-only), `action_for_web=show`, `booking_status_for_web=เปิดจอง`, and available phone package > 0. `show_full`, `hide`, stale direct Sheet snapshots, and lens-only offers cannot count as phone-rental opportunities. Read authoritative booking/owner locks and reconcile cross-event shared physical phones per date. A `show` row alone does not establish a visible/bookable storefront card.
2. **Customer-facing storefront**: deployed script sorts by date and initially renders only 24 cards; require confirmed initial-page card or verified search/deep-link + clickable booking flow. Capture evidence (URL, timestamp, card ID, package prices). An API entry beyond page 24 is not necessarily absent, but should not be called first-page visible. No claim of browser DOM verification from source-code-only inspection.
3. **X posting history**: check real X account and `18_X_Post_Log` for confirmed/planned/assumed posts across operating day 06:00–05:59 Asia/Bangkok; fail closed if timestamps/source are ambiguous. Avoid previously recommended same-event slots unless explicitly revised.
4. **Engagement source**: prefer authenticated X account/competitor/artist hashtag metrics with URL, captured_at, views, likes, reposts, replies, sample window, and attribution. Normalize engagement rate = (likes+reposts+replies)/max(views,1), but never infer missing views or extrapolate from follower count. Public search mentions can be contextual trend signals, **not verified reach**. No fabricated 90/100 score.
5. **AI ranking agent**: run evidence-backed candidate ranking in shadow. Hard constraints first; compare urgency, verified audience signal, conversion/booking evidence, available physical inventory, posting fatigue, fan eligibility and timing. Publish top candidates with evidence and explain rejected alternatives. A model-generated rationale is NOT proof an agent ran.
6. **Learning AI**: use only prior posts with authenticated timestamps, X permalinks and measured reach; join to attributable booking conversions when available. Time-split validation and leakage checks; if sample too small, label learning `INSUFFICIENT_DATA`, use transparent rules-based ranking and show `NO_VERIFIED_X`.
7. **Hugging Face**: optional text/Thai sentiment or fandom-topic classifier **only if a real model was invoked**, outputs logged, licenses/permissions checked and cost stays zero. Never claim HF helped without invocation receipt. Do not use paid inference/GPU jobs.
8. **Human owner approval**: recommendation is not publication. Respect temporary <=2 new recommendations per 06:00–05:59 day, >=90 min gap, no Production/permission/booking/repricing changes or deployment without safety gates and owner approval.

## Every user-facing schedule must report

- Time (Asia/Bangkok), event, event date(s), **remaining phone stock from Production**, bookable package price, storefront proof, last-post duplicate check.
- `Engagement: VERIFIED_X` with numbers and URL **or** `UNVERIFIED`; `AI Agent: EXECUTED` with run receipt **or** `RULES_ONLY`; `Learning: VALIDATED` with sample size **or** `INSUFFICIENT_DATA`; `Hugging Face: INVOKED` with model receipt **or** `NOT_RUN`.
- Rationale should prioritize expected bookings per scarce device, not broad vanity reach. If any hard gate fails, do not recommend posting.

## Evidence on 2026-10-16

Production HTML and deployed `script.js` plus both CSV API feeds inspected read-only. Script renders only first 24 cards by default, despite 49 future `show/show_full` rows. Production API showed OH MY FOURTH 16 Oct `hide/0` and WEIRDO-101 16 Oct `show_full/0`; older direct Sheet-based recommendations were incorrect. Metricool connected brand reports **no social network connected**. PR #716 remains draft/open; no exact-head Node tests verified; no live X metrics or actual Hugging Face inference verified. Therefore production AI selection **NOT ACTIVE**.

## Acceptance tests to implement before activation

- hidden/full/zero-phone/lens-only events excluded
- actual package price, inventory and owner lock checks
- cross-event shared inventory on the same date
- first-page vs search/deep-link discovery verified
- same-day duplicate detection and Bangkok 06:00 boundary
- X metrics must include permalink + capture timestamp; unverifiable metrics do not influence measured engagement
- learning rejects missing attribution, small sample and leakage
- Hugging Face/model-run provenance; no silent external cost
- shadow candidate rankings compared with baseline; no auto-post, no merge/deploy until safety gates and owner approval

Reference: PR #716, Issue #555, and the Production incident checkpoint in Issue #555.


## Owner clarification — blended full-day objectives (2026-10-16)

**This supersedes any reading that selection should maximize only near-term rentals.** The daily X content mix deliberately combines two independent objectives, provided every advertised event has a verified bookable storefront card and remaining shared physical phone stock:

- **Conversion / near-term rental: 60% initial allocation**. Favor verified near-term dates, actual remaining phones, current bookings, package prices, and expected bookings per available device.
- **Awareness / engagement: 40% initial allocation**. Favor events with verified fandom conversation, current relevant public interest, measured engagement opportunity, reach to new potential renters, and a longer booking lead time. The event still must be genuinely bookable. A popular event without a bookable phone is ineligible.
- The **60/40 is a provisional business policy, not a data-derived optimum**. AI ranking may recommend 50/50 or 70/30 only when supported by measured results; report the change and evidence. No fabricated engagement data.
- Interleave categories across the day rather than concentrating all conversion posts in the morning and awareness at night. Allocate integer slots using a transparent largest-remainder rounding method and avoid duplicates. Example 5 slots -> 3 conversion / 2 awareness; 2 slots -> 1 / 1. A candidate can serve both goals but assign one primary objective for quota accounting.
- Optimize per-objective metrics: conversion = attributable booking inquiries, bookings, and utilization; awareness = authenticated impressions/reach, engagement rate, profile visits, follows. Track both; do not confuse reach with revenue.
- AI Agent: filter by hard storefront/booking/owner rules, rank candidates **separately within each objective**, then schedule the blended slate subject to operating-day caps, time spacing, posting history and owner approval.
- Learning AI: adapt allocation only after sufficient verified sample size with measured outcomes, avoid overfitting and event/fandom leakage; if insufficient, keep 60/40 and label `PROVISIONAL`.
- Hugging Face: optional zero-cost sentiment/topic classification on legally usable public text, with model execution receipts. It is not required for an advisory slate and cannot be claimed to have run without receipts.
- Important: PR #716's existing temporary **<=2 new recommendations per operating day** remains binding until separately reviewed and approved; the five-slot example is illustrative, **not authorization** to override the cap. No automatic X publication.

Every future posting schedule must display a `Conversion` or `Awareness` tag per proposed slot, daily actual split vs target, remaining stock and evidence provenance. Distinguish editorial candidates from executable recommendations.
