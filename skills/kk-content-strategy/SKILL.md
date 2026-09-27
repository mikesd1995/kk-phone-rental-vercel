---
name: kk-content-strategy
description: Project-local content strategy contract for KK Phone Rental organic reach, brand awareness, creative drafting, and performance learning.
---

# KK Content Strategy

## Purpose

Use this skill when drafting, reviewing, or planning KK Phone Rental content for X, the storefront, or future paid creative. The current growth goal is **qualified organic reach + brand awareness** for a small two-device inventory, not maximum raw reach and not autonomous ad spending.

This skill is guidance only. It never becomes event truth, pricing truth, inventory truth, or publishing authority.

## Authority and safety

1. Consume verified event truth from the canonical Event/Verifier flow.
2. Consume current approved pricing and inventory from business truth; never infer from an old post, example, memory, competitor price, or previous event.
3. Never invent event date, venue, artist, hashtag status, price, promotion, availability, seat view, or camera outcome.
4. Performance history is evidence for ideation, not authority. A historically strong angle must not override current facts.
5. Every public post requires owner approval.
6. No auto-publish, auto-schedule, auto-spend, price write, inventory write, or Machine SOT write.
7. If event/pricing/inventory is not verified, useful educational content may still be planned only when its factual claims are independently verified; direct rental copy stays blocked.

## Mandatory routing for X content

Any request equivalent to **“ขอโพสปล่อยเช่างานนี้บน X”**, **“ขอโพสต์งานนี้บน X”**, or another KK content/caption request must route through:

**verified business truth → Marketing Agent → Content Strategy → Content Agent → Content QA Gate → Content Selector → Owner Review**

For direct-rental X posts:

- current event, pricing, displayed offer, and inventory must pass verification;
- the Content Agent must receive recent post/hook context when available;
- generate **exactly 3 substantively different internal candidates**;
- each internal candidate must use a different primary angle and hook structure;
- do not expose all three candidates by default; after QA, Content Selector must rank them and expose exactly **1 final post**;
- cosmetic rewrites (emoji swap, synonym swap, sentence reordering) do not count;
- avoid recycling recent hooks, metaphors, sentence skeletons, and generic filler;
- if event-specific context is not verified, stay neutral rather than inventing artist/fandom/event lore.

The request router is server/kk-content-request-router.js. Direct-rental requests fail closed when commercial truth is incomplete.

## Growth model

Use a rolling content-calendar target of approximately:

- **70% useful / educational / community content**
- **30% sales / conversion content**

This is a portfolio target, not a per-post quota. Do not force a sales CTA into every useful post.

Primary content pillars:

- seat_view — seat/zone/venue-view utility.
- photo_tips — camera, zoom, Lens, framing, and concert-photo education.
- event_info — verified venue, agenda, timing, or event information.
- review_proof — customer reviews and real-use proof with permission.
- engagement — genuine questions, polls, zone discussion, fan conversation.
- direct_rental — explicit rental offer when verified inventory exists.

Primary angles:

event_theme, artist, fandom, seat_view, lens_need, problem_solution, convenience, trust.

## Mandatory upstream Marketing Agent

Every KK content request must pass through `kk-marketing-agent` before Content Strategy and Content Agent.

Canonical chain:

**Marketing Agent → Content Strategy Agent → Content Agent → Content QA Gate → Content Selector → Owner Review**

Marketing Agent owns the pre-content decision layer: objective, campaign mode, opportunity/urgency context, and performance-informed priority. Content Strategy owns pillar/angle/structure. Content Agent drafts three internal candidates. Content QA validates all three. Content Selector ranks only QA-passing candidates against the Marketing objective and exposes one final post.

Marketing Agent is `READ_ONLY_ADVISOR`. It cannot publish, spend ads, change prices, change inventory, reopen hidden events, or mutate Machine SOT. Verified business truth always wins.

When `17_Content_Performance` has no measured rows, Marketing Agent must identify its state as `RULE_BASED_COLD_START`; it must not invent performance evidence.

## Mandatory pre-publish QA gate

Every generated direct-rental X internal candidate must pass `kk-content-qa` before selection.

Fail closed when any of these are true:

- event hashtags have not been verified for the current event context;
- copy uses a hashtag that was synthesized from an event name or is absent from the verified hashtag set;
- canonical date or venue is repeated in the hook and the Date/Venue block without a deliberate timing reason;
- Standard A ordering is broken;
- event, pricing, or inventory truth is unverified;
- the direct-rental batch does not contain exactly three distinct internal candidates;
- any internal candidate fails QA; selection must not proceed until all three pass.

The QA gate is a read-only validator. It never publishes or mutates business truth.

## Mandatory single-winner selection

For direct-rental X requests, the owner-facing output is **one final post only**.

The system still generates three candidates internally so Marketing/Strategy can compare genuinely different angles. After all three pass QA, `kk-content-selector` ranks them against the current Marketing objective.

Default awareness/reach weighting:

- Hook / stop-scroll strength: 30%
- Event + fandom relevance: 25%
- Timing relevance: 15%
- Novelty / anti-repeat: 15%
- Verified hashtag relevance: 10%
- Readability on X: 5%

For conversion-oriented campaigns, the selector shifts weight toward timing and commercial relevance while preserving hook/event relevance.

When `17_Content_Performance` has fewer than three measured posts for useful evidence, selection remains `RULE_BASED_COLD_START`. Do not claim the chosen post is guaranteed to have the highest reach. It is the highest-scoring candidate under the current verified context and available evidence.

Public output contract: `SINGLE_FINAL_POST`, count = 1. Do not show alternatives unless the owner explicitly asks to inspect them.

## Standard A — X direct-rental post order

Use this as the default structure for KK Phone Rental rental posts on X:

1. Brand: 📱 KK Phone Rental | #เช่ามือถือ
2. Official/main event hashtag
3. Event-specific hook from Content Agent
4. Device + verified rental price
5. Date / venue when useful
6. Store benefits
7. Booking CTA
8. 3–5 strongest relevant reach hashtags

Canonical order:

**Brand → Event hashtag → Hook → Offer/price → Date/Venue → Benefits → Booking CTA → Reach hashtags**

The hook must appear before the price block by default because the current strategy prioritizes stopping power and qualified organic reach before conversion detail. Date/venue follows the offer unless a specific event context makes earlier placement materially more useful. Do not change this order casually; deviations should be deliberate experiments and logged as such.

## X copy contract

For direct rental posts:

- First line: 📱 KK Phone Rental | #เช่ามือถือ
- Keep the hook event-specific, short, and natural.
- Use current verified offer/pricing only.
- Keep: 📍 รับ-คืนหน้างาน + สอนใช้ก่อนเข้างาน
- Keep: ☁️ Google Drive 30 วัน
- Booking CTA: 👉 จองคิว / เช็กคิวว่าง https://kk-phone-rental.vercel.app/
- Put **3–5 strongest relevant hashtags at the end**, preferring official event/artist/brand tags.
- Do not repeat the brand line at the bottom.
- Add a promotion/discount line only when the promotion is currently approved and verified.

For awareness/education posts, do not mechanically paste the full rental footer. Lead with utility; add a soft rental mention only if it naturally helps the reader.

## Seat-view / venue simulator content

A strong pattern for KK is:

**Useful seat/zone insight → practical photo/zoom interpretation → optional soft rental mention**

When using a seat-view or 3D venue site:

- link or name the original source;
- summarize in KK's own words;
- do not imply the simulator is exact if the source says it is approximate;
- confirm image/screenshot reuse rights before reposting source assets;
- do not copy copyrighted text or imagery just because it is publicly viewable.

## Performance learning

Use 17_Content_Performance in **KK Phone Rental — CRM & Intelligence** as the post-level learning table.

Track at minimum impressions, engagements, engagement rate, profile visits, link clicks, inquiries, bookings, revenue, spend when applicable, content pillar, angle, objective, CTA and asset type.

Interpret metrics by objective:

- awareness → average impressions per measured post;
- engagement → engagements / impressions;
- consideration → (profile visits + link clicks) / impressions;
- conversion → bookings / link clicks.

Do not call an angle a reliable winner from one post. The current minimum evidence nudge is three measured posts; 3–7 is medium confidence and 8+ is high confidence.

Use 19_Content_Experiments for explicit A/B hypotheses so changes are traceable instead of anecdotal.

## Draft output contract

When asked to generate a content plan, return objective, content pillar, content angle, hook direction, body direction, CTA type, hashtag approach, asset idea, verified facts used, and unresolved blockers/assumptions.

When asked for final X rental copy, generate three differentiated candidates internally, run QA + objective-aware selection, then return only the single selected final post. Show alternatives only when the owner explicitly requests them.

## Rollout rule

Start manually. Capture real post results for 1–2 weeks before using performance history to materially narrow creative choices. Scale by evidence, not by component count.
