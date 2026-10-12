# KK Phone Rental — X rental post owner rules (2026-10-12)

Status: Owner-approved editorial requirements. Apply to every future X rental post draft, including batch requests. This file is a persistent source of truth for the marketing/content agents; it does not authorize publishing.

## Required
1. Use the existing KK/L Y K N-style information structure as a guide, **not a verbatim template**: brand opener `📱 KK Phone Rental | #เช่ามือถือ`, event/fandom, verified offer, verified venue/dates, relevant persuasive copy, truthful benefits, booking link, and selective hashtags.
2. Show device model **only on the offer/price line**. Never repeat device model in the hook, body or CTA. Brand `📱 KK Phone Rental | #เช่ามือถือ` appears ONCE in the header; do not repeat `KK` / shop name in the body. Standard CTA on its own line: `👉 เลือกวันแล้วจองคิว`, followed by `kk-phone-rental.vercel.app`.
3. **Never disclose remaining stock quantity** in customer-facing copy: no 1/2, 2/2, “last unit”, etc. Internally verify all dates in the event against bookings and owner locks. Include ALL event dates with compact truthful status: `14 ต.ค. ✅ ว่าง`, `15 ต.ค. ❌ เต็ม`, `16 ต.ค. 🚫 ปิด` where a day is intentionally closed rather than full. Never infer FULL solely from a missing listing; check booking-day truth. The status block must reflect verified source data, not the artist's public ticket sold-out status.
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
- Missing per-day verified statuses, incorrect `✅ ว่าง` / `❌ เต็ม`, or false FULL for an owner-hidden day.
- Event dates closed/hidden or conflict with bookings.
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
