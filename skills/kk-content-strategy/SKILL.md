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

## Hard owner trigger (2026-10-15): final-only X rental requests

The phrases **"ขอโพสปล่อยเช่างานนี้บน X"**, **"ขอโพสงานนี้บน X"**, **"ขอโพสต์ปล่อยเช่า"**, and equivalent multi-event table requests mean **produce the final selected post**, not provide three versions, a choice menu, or ask the owner to pick a tone.

For every named event: verify live booking/status including all dates, current package price, event identity/venue, owner locks, original poster, verified hashtags, and recent X posts; run the genuine five-Agent chat bridge using 3 INTERNAL candidates; require actual persistent QA/Selector PASS; one best copyable box per event; multi-event requests also require batch CTA/hook diversity. If an invocation cannot be evidenced, say **not executed** and do not label any self-drafted post as Agent-selected.

**Brand once** (`📱 KK Phone Rental | #เช่ามือถือ`) and never inside body; device model only on price line; every date in customer post is verified `✅ ว่าง` or `❌ เต็ม` (only confirmed booked-full maps to ❌ เต็ม; owner-closed/hidden dates are excluded from copy and remain unchanged in canonical truth); no remaining device quantity. Minimum 5 distinct **verified** hashtags: rental header 1 + primary event 1 + closing 3. CTA must be short, specific to fandom/event/date, not repeated across batch, followed by canonical site URL. No invented urgency, metrics, model calls, pricing, artist facts, or engagement. Use real measured content outcomes for learning; claim Hugging Face only if successfully invoked with provenance, no new cost. One OWNER-REVIEW winner only; never auto-post or spend.

This trigger supersedes any old fixed CTA wording or invitation to show multiple drafts. It is a **skill/policy**, not an automatically-installed ChatGPT hook; every runtime must execute its actual bridge and read back PASS.

## Mandatory routing for X content

Any request equivalent to **“ขอโพสปล่อยเช่างานนี้บน X”**, **“ขอโพสต์งานนี้บน X”**, or another KK content/caption request must route through:

**verified business truth → Marketing Agent → Content Strategy → Content Agent → Content QA Gate → Content Selector → Owner Review**

For **every KK social-post request** — direct rental, weekly roundup, last call, onsite/update, event announcement, brand/awareness, promotion/offer, repost/refresh, quote post, or another final X copy request:

- Marketing Agent, Content Strategy, Content Agent, Content QA Gate, and Content Selector are all mandatory;
- generate **exactly 3 substantively different internal candidates**;
- each internal candidate must use a different primary angle and hook structure;
- do not expose all three candidates by default; after QA, Content Selector must rank them and expose exactly **1 final post**;
- cosmetic rewrites (emoji swap, synonym swap, sentence reordering) do not count;
- avoid recycling recent hooks, metaphors, sentence skeletons, and generic filler;
- before drafting, check recent KK post history and set `recent_context_checked=true`; an empty history is valid only after the check was actually performed;
- collect at least 2 verified Event DNA / creative anchors per event when possible (for example special segment, show format, lineup relationship, stage concept, fandom-specific moment, or timing-specific fact);
- for multi-event batches, final winners must not reuse the same hook architecture. Repeated scaffolds such as “ใครมีบัตร...เตรียมเครื่อง...”, countdown + lock-device, or “เก็บทุกโมเมนต์” across several events must be rewritten before output;
- if event-specific context is not verified, stay neutral rather than inventing artist/fandom/event lore.

Commercial/rental posts additionally require current event, pricing, displayed offer, and inventory verification. Non-commercial brand/awareness posts do not invent pricing or inventory and are validated only against the factual claims they actually use.

The request router is server/kk-content-request-router.js. Any post request that enters the gateway fails closed if one mandatory stage is missing.

## Chat bridge enforcement

When the content request originates from ChatGPT and a GitHub connector is available, do not treat a direct chat draft as proof that the project Agents ran.

Use the GitHub issue bridge defined in `docs/CHAT_CONTENT_AGENT_BRIDGE_2026-09-28.md` for one post, and the batch bridge defined in `docs/CONTENT_BATCH_DIVERSITY_AGENT_BRIDGE_2026-10-01.md` when the owner requests 2 or more posts at once.

Single post:
**Chat verified facts + 3 internal candidates → GitHub bridge issue → Agent Gateway → QA → Selector → persistent result comment → Owner Review**

Multi-event batch:
**verified truth per event + recent-post check + Event DNA → 3 candidates per event → Batch GitHub bridge → five-Agent gateway per item → per-item QA/Selector → batch hook-diversity QA → persistent result comment → Owner Review**

A final chat response may say the Agent pipeline was used only after reading back a PASS bridge comment. For a batch, every item must contain a complete required/invoked Agent chain and the batch diversity gate must also be PASS. If a bridge is blocked or no result comment is available, fail closed rather than bypassing to an unverified direct final post.

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

Every generated KK social-post internal candidate must pass `kk-content-qa` before selection.

Fail closed when any of these are true:

- event hashtags have not been verified for the current event context;
- copy uses a hashtag that was synthesized from an event name or is absent from the verified hashtag set;
- canonical date or venue is repeated in the hook and the Date/Venue block without a deliberate timing reason;
- business-critical copy is missing (brand identity, verified commercial offer, required date/venue facts, or booking CTA for a commercial post);
- event, pricing, or inventory truth is unverified;
- copy uses unverified/synthesized hashtags;
- recent-copy or internal-candidate similarity crosses the anti-repeat threshold;
- the batch does not contain exactly three distinct internal candidates;
- any internal candidate fails QA; selection must not proceed until all three pass.

Do **not** fail a post merely because hook, price, context, benefits, emoji, or paragraph blocks appear in a different order. Creative structure is intentionally flexible once the hard facts are present and correct.

The QA gate is a read-only validator. It never publishes or mutates business truth.

## Mandatory single-winner selection

For every KK social-post request, the owner-facing output is **one final post only**.

The system still generates three candidates internally so Marketing/Strategy can compare genuinely different angles. After all three pass QA, `kk-content-selector` ranks them against the current Marketing objective.

Default awareness/reach weighting now also evaluates creative quality rather than only structural compliance:

- Hook / stop-scroll strength
- Event + fandom relevance
- Timing relevance
- Novelty / anti-repeat
- Verified hashtag relevance
- Readability on X
- Event specificity
- Naturalness
- Non-template feel
- Hook originality
- Sales-pressure balance

Exact weights are owned by `kk-content-selector` and versioned in code.

For conversion-oriented campaigns, the selector shifts weight toward timing and commercial relevance while preserving hook/event relevance.

When `17_Content_Performance` has fewer than three measured posts for useful evidence, selection remains `RULE_BASED_COLD_START`. Do not claim the chosen post is guaranteed to have the highest reach. It is the highest-scoring candidate under the current verified context and available evidence.

Public output contract: `SINGLE_FINAL_POST`, count = 1. Do not show alternatives unless the owner explicitly asks to inspect them.

## Creative freedom + hard gates for X rental posts

The historical Standard A order remains a useful **baseline**, not a rigid template.

Preferred baseline when it fits the event:

**Brand → Event hashtag → Hook → Offer/price → Date/Venue → Benefits → Booking CTA → Reach hashtags**

Hard requirements are narrower:

- brand line stays first;
- verified event facts only;
- live approved price/inventory only;
- official/verified hashtags only;
- canonical date/venue must be accurate and not duplicated;
- commercial posts must include the booking CTA;
- exactly three meaningfully different internal candidates;
- anti-repeat must pass;
- QA and Selector must pass.

Everything else may move: hook position, offer position, event-context paragraph, emoji density, paragraph rhythm, CTA lead-in, and tone.

Quality direction to preserve:
- specific to the event/fandom rather than generic concert copy;
- organic and human rather than template-first;
- vivid but concise;
- sales pressure balanced with audience value;
- transition back to the rental use case naturally.

The liked **Khom Khlang** direction is a style-quality reference: event-specific hook, a natural emotional bridge, then the rental relevance. It is **not** a phrase bank or template to copy.

## X copy contract

For direct rental posts:

- First line: 📱 KK Phone Rental | #เช่ามือถือ
- Keep the hook event-specific, short, and natural.
- Use current verified offer/pricing only.
- Keep: 📱 รับ-คืนเครื่องหน้างาน + สอนใช้ก่อนเข้างาน
- Keep: ☁️ เก็บไฟล์ Google Drive ฟรี 30 วัน
- Booking CTA: one concise **event/fandom-specific invitation to book**, unique among the batch and recent posts; vary the actual booking action, not just emoji. Always put `kk-phone-rental.vercel.app` on the next line. Avoid a fixed generic phrase repeated across all events.
- **At least 5 DISTINCT verified, relevant hashtags per X rental post (mandatory):** `#เช่ามือถือ` once in the brand header + one verified main event hashtag + **at least 3 other distinct, verified closing hashtags at the end**. Prefer 3 strong closing tags and do not exceed existing QA reach-tag limits. Do not repeat the main event tag or `#เช่ามือถือ` at the end. If adequate verified tags cannot be found, fail closed rather than inventing tags.
- Do not repeat the brand line at the bottom.
- Brand/header appears **once only**. Do not name "KK" or the shop again in the body or hook.
- Device model must be visible only in the verified offer/price line. Never repeat it in story paragraphs or CTA.
- Verify every canonical event day internally. Display only eligible days using `14 ต.ค. ✅ ว่าง` or verified actual booked-full days using `15 ต.ค. ❌ เต็ม`. **Never mention or promote shop-closed/hidden/owner-locked dates**, and never disguise those locks as booked-full. For multi-day events, omit closed days but keep genuinely sellable dates. Block fully locked events or events without a verified available date. Never infer status from missing rows or display stock counts.
- Use a different, verifiable artist/fandom/format-specific angle for each post. Repeating generic hook/closing skeletons is unacceptable.
- Reject all commercial X content without verified `event_dates`, `event_dates_verified`, `day_statuses` and `day_statuses_verified`. The actual validator is `server/kk-x-owner-copy-policy.js`.
- The owner rules source is `docs/X_POST_OWNER_COPY_RULES_2026-10-12.md`. If a ChatGPT request has no persistent PASS bridge invocation, say so and do not imply Agent/learning/Hugging Face scoring was used. Learning means actual performance evidence, not autonomous retraining.
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

This is **evidence-based adaptation**, not autonomous retraining. The system does not self-modify its model or rewrite its own code from post performance.

Use 19_Content_Experiments for explicit A/B hypotheses so changes are traceable instead of anecdotal.

## Draft output contract

When asked to generate a content plan, return objective, content pillar, content angle, hook direction, body direction, CTA type, hashtag approach, asset idea, verified facts used, and unresolved blockers/assumptions.

When asked for any final KK social copy, generate three differentiated candidates internally, run QA + objective-aware selection, then return only the single selected final post. Show alternatives only when the owner explicitly requests them.

## Rollout rule

Start manually. Capture real post results for 1–2 weeks before using performance history to materially narrow creative choices. Scale by evidence, not by component count.

## Owner CTA update — 2026-10-14
Owner requires **distinct natural, event-specific CTAs** for all X rental drafts. No repeated universal sentence like `👉 เลือกวันแล้วจองคิว` across every event. Anchor each CTA to the artist, fandom, show format, verified available day or booking intent while remaining short, professional, and conversion-oriented. Compare the final CTA and its lead-in across all posts and recent history; reject identical or near-duplicate CTA structures. Keep booking link `kk-phone-rental.vercel.app` unchanged, never repeat KK/shop name or phone model in CTA, and never invent scarcity, booking pressure or unverified benefits. This supersedes earlier fixed CTA guidance. **Staged Draft runtime owner-X validator V4 and batch CTA duplicate QA require exact-head CI/acceptance before Production**; documentation is not proof of live enforcement.
