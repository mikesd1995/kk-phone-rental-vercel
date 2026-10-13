# KK Phone Rental — X rental post owner rules (2026-10-12)

Status: Owner-approved editorial requirements. Apply to every future X rental post draft, including batch requests. This file is a persistent source of truth for the marketing/content agents; it does not authorize publishing.

## Required
1. Use the existing KK/L Y K N-style information structure as a guide, **not a verbatim template**: brand opener `📱 KK Phone Rental | #เช่ามือถือ`, event/fandom, verified offer, verified venue/dates, relevant persuasive copy, truthful benefits, booking link, and selective hashtags.
2. Show device model **only on the offer/price line**. Never repeat device model in the hook, body or CTA. Brand `📱 KK Phone Rental | #เช่ามือถือ` appears ONCE in the header; do not repeat `KK` / shop name in the body. Standard CTA on its own line: `👉 เลือกวันแล้วจองคิว`, followed by `kk-phone-rental.vercel.app`.
3. **Never disclose remaining stock quantity** in customer-facing copy: no 1/2, 2/2, “last unit”, etc. Internally verify all dates in the event against bookings and owner locks. **X copy has exactly two customer-visible date labels:** `14 ต.ค. ✅ ว่าง` and `15 ต.ค. ❌ เต็ม`. A verified owner-closed, hidden, locked or unavailable date must also render **`❌ เต็ม`** in public X copy; never print `🚫 ปิด` or `ปิดรับจอง` as a date state. Keep the actual internal `closed`/`hidden`/`owner_closed`/`full` reasons unchanged in backend and audit; display mapping is not a Booking mutation. Never infer a date's state from a missing listing or public concert ticket sell-out; verify all event dates against canonical event truth, Booking and owner locks first.
4. Avoid repeated hooks, metaphors, sentence rhythms and generic phrases across posts. Explicit anti-examples: “ทุกสายตา ทุกรอยยิ้ม”, “โมเมนต์ที่รอคอย”, “เตรียมไปด้วยเลย”. Do not mechanically swap artist names in one copy.
5. Each event requires a genuinely distinct audience insight and sales angle grounded in its actual artist, fandom, show format, access rules, date and context. Concert: live set/performance; fan meeting: encounter and participation; themed event: unique program; festival: lineup; sports: on-field moments. These are prompts for research, not fixed language.
6. Generate three **internal** diverse candidates, run Marketing Agent → Content Strategy → Content Agent → QA → Selector and show **only one best version per event**. In a multi-event batch, also perform cross-post diversity QA before showing any copy. Do not claim an agent ran or scored when no actual run evidence exists.
7. Verify live source-of-truth pricing, event dates, venue, availability/booking locks, official artwork, package terms and discount claims before publishing. Do not invent event facts or hype. Use the correct official poster; do not generate replacement posters.
8. Keep prose concise, readable, professional, fan-aware and commercially relevant without overusing emoji or overpromising zoom/photo results. Hashtags relevant, not spam.
9. **Owner approval is required before publishing or scheduling on X**. No automatic publish, paid spend, merge or production writes solely from this policy.

## QA rejection triggers
- Device model appears outside price line.
- Customer-facing stock count or scarcity claim.
- Repeated `KK` or shop name in the body, device model outside offer line, or non-standard verbose CTA.
- Missing per-day verified statuses, incorrect `✅ ว่าง` / `❌ เต็ม`, or a public `🚫 ปิด` label. Owner-hidden/closed days **must** map to `❌ เต็ม` after verifying internal lock state; no blind assumptions from a missing row.
- Event dates omitted, status contradicts verified backend evidence, or a hidden/closed date is incorrectly represented as available.
- Hook/paragraph near-duplicate of another post in the batch or recent history.
- Generic event copy with no concrete event-specific insight.
- More than one candidate displayed per event.
- Unsupported claim of AI scoring, publishing, or verification.

## Learning and audit
Record candidate angles, selected angle, factual sources, duplicate/novelty QA, owner feedback, approval and publishing outcome in existing governed logs when the logging workflow is available. Never fabricate log entries or publish evidence. Owner feedback on 2026-10-12: previous posts felt repetitive and amateurish; this rule supersedes repetitive boilerplate while preserving brand/offer essentials.


## Enforcement in code (proposed; requires tests and gated release)
- \`server/kk-x-owner-copy-policy.js\`: fail-closed per-candidate gate for direct rental X content; requires verified \`day_statuses\` and \`day_statuses_verified=true\`.
- \`server/kk-content-request-router.js\`: invokes the owner policy before the existing content QA and Selector. Both individual and batch issue bridges forward the \`owner_x_policy_required\` flag.
- \`server/kk-content-agent.js\`: prompt now includes owner copy requirements and the short CTA.
- This PR is **documentation + code before merge**. It does not change what ChatGPT automatically executes across conversations by itself; each new chat must actually use the documented bridge and present a PASS invocation record.
- **Learning:** rule-based scores are not evidence of model training. Mark \`RULE_BASED_COLD_START\` until real post-performance records are provided, and avoid fictional engagement or booking scores.
- **Hugging Face:** no claim of its use without a separately verified, successful model invocation, provenance and proof of no incremental paid usage; HF is not a mandatory provider for the existing free content bridge.
- Do not turn an unverified chat-generated draft into an “Agent PASS” without a persistent bridge result and the exact five required/invoked agents. Do not auto-publish.

## Owner update 2026-10-14 — locked display convention
All public X date-status labels are binary: ✅ ว่าง / ❌ เต็ม. A date intentionally closed by the shop is shown as ❌ เต็ม in the **post only**. Never alter Booking, dates, hidden flags or the owner lock to satisfy this copy rule. This replaces the previous three-label convention.

## Owner update 2026-10-14 — hashtag floor
Each X rental post must have at least 5 distinct, relevant, verified hashtags: `#เช่ามือถือ` in the opening brand line, one verified primary event hashtag in the event section, and at least 3 additional relevant and verified hashtags together at the end. Never count repeated tags twice, repeat the brand/event tag in the closing block, or invent tags to fill the quota. If fewer than 3 suitable verified closing tags are available, halt for verification; do not publish an incomplete post. Applies to every event and batch.
