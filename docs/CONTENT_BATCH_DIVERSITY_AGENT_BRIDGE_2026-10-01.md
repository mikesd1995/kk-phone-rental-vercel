# KK Content Batch Diversity Agent Bridge — 2026-10-01

## Problem

The single-post Agent path already enforced:

Marketing Agent → Content Strategy → Content Agent → Content QA → Content Selector → Owner Review.

However, a multi-event request could still be handled as several independent posts. Each post could be factually correct and individually pass QA while the batch as a whole reused the same hook skeleton, for example:

- “ใครมีบัตร...เตรียมเครื่อง...”
- “อีกไม่กี่วัน...ล็อกเครื่อง...”
- “เก็บทุกโมเมนต์...”
- countdown → device preparation → scarcity

That creates a machine-template feel even when event names and facts differ.

A second operational gap was also confirmed: a ChatGPT reply could manually imitate the Agent workflow without actually creating the GitHub bridge invocation. Repository policy already prohibited that, but there was no efficient multi-event bridge to make the correct path practical.

## Change

Added a batch-aware bridge and a batch creative-diversity QA layer.

New files:

- server/kk-content-batch-qa.js
- scripts/kk-content-batch-chat-bridge.js
- .github/workflows/kk-content-batch-chat-bridge.yml
- tests/kk-content-batch-qa.test.js
- tests/kk-content-batch-chat-bridge.test.js

Updated:

- server/kk-content-agent.js
- skills/kk-content-strategy/SKILL.md
- package.json

## Multi-event runtime contract

For any owner request containing 2 or more KK social posts:

verified event/business truth per item
→ recent post-history check
→ at least 2 verified Event DNA anchors when possible
→ 3 internal candidates per item
→ one owner-authored GitHub issue with prefix [KK-CONTENT-BATCH]
→ Agent Gateway invoked once per item
→ Marketing / Strategy / Content / QA / Selector evidence per item
→ one winner per item
→ batch hook-diversity QA across all winners
→ persistent issue comment
→ Owner Review

No batch output is accepted if any item fails.

## Batch QA V1

Version: KK_CONTENT_BATCH_QA_V1

The gate checks:

1. each item has a final winner;
2. recent KK post context was actually checked (recent_context_checked=true);
3. each item carries at least 2 verified Event DNA / creative anchors;
4. normalized hook skeleton similarity across different events;
5. overuse of generic hook archetypes across the batch.

Initial archetypes:

- TIMING_COUNTDOWN
- TICKET_HOLDER
- PREPARE_DEVICE
- CAPTURE_MOMENT
- SCARCITY
- ENUMERATION

A generic archetype may appear at most twice in one batch. A third reuse blocks the entire batch and requires a rewrite.

Pairwise normalized hook-skeleton similarity blocks at 0.58 or above.

The normalization removes verified event names, artists, venue, hashtags, date/number noise and supplied Event DNA before structural comparison. This is intentional: changing only the artist/event name must not make a repeated sentence skeleton look “new”.

## Event DNA

Event DNA is not permission to invent lore.

It must come from verified sources and can include:

- official special segment;
- show format;
- artist combination;
- stage concept;
- fandom-specific official wording;
- screening / talk / group-shot / fansign structure;
- official timing fact that materially changes the hook;
- verified sold-out / added-show / event-day context.

The batch bridge requires at least two anchors per item so the drafting worker has enough material to avoid generic rental-copy fallback.

## Current X copy baseline synchronized

The repository Content Agent contract is synchronized with the owner-approved current baseline:

Brand
→ main event hashtag
→ exact verified offer / bundle price
→ separate date line
→ separate venue line
→ event-specific hook
→ benefits
→ booking CTA
→ exactly 3 verified closing hashtags by default.

Pickup/training line:
📱 รับ-คืนเครื่องหน้างาน + สอนใช้ก่อนเข้างาน

Storage line:
☁️ เก็บไฟล์ Google Drive ฟรี 30 วัน

The structure remains a preferred baseline, not a rigid paragraph-order gate. Creative layout can move when strategy supports it.

## Truthfulness rule for ChatGPT

ChatGPT must not say “Agent ran” merely because it manually performed research and wrote copy.

For a single post, Agent execution requires a PASS from the existing [KK-CONTENT-RUN] bridge.

For 2+ posts, Agent execution requires:

- one PASS [KK-CONTENT-BATCH] bridge result;
- one successful five-Agent invocation per item;
- per-item QA PASS;
- per-item Selector PASS;
- Batch QA PASS;
- persistent invocation IDs in the issue comment.

If this evidence is absent, the response must say the Agent bridge was not executed.

## Safety

Unchanged:

- owner review required;
- auto-publish = false;
- production writes = 0;
- no price write;
- no inventory write;
- no event/Machine-SOT mutation;
- no external paid model/provider is added.

Candidate language generation is still performed by the active ChatGPT conversation. The repository pipeline provides auditable orchestration, per-item QA/selection, and cross-item diversity enforcement. A separate model provider is not claimed or implied.

## Expected improvement

Compared with independent one-post-at-a-time drafting:

- repetitive hook skeletons are detected at batch level;
- event-specific facts have to drive creative direction;
- “prepare device / capture every moment” boilerplate cannot dominate a batch;
- recent-post checking becomes explicit evidence rather than an assumed step;
- multi-event requests can use one bridge issue instead of one issue per event;
- ChatGPT can only claim Agent use after verifiable bridge execution;
- final output remains one selected post per requested event and never exposes internal candidate drafts by default.
