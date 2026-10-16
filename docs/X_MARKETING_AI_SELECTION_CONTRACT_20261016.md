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
