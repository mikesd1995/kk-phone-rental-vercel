# Content creative freedom behind hard gates — 2026-09-28

## Why this change

The previous pipeline correctly enforced Marketing → Strategy → Content → QA → Selector, but the QA/generation contract still leaned too heavily on one fixed X post order. That reduced creative range and encouraged near-identical posts.

The owner explicitly preferred the organic direction of the recent **Khom Khlang** copy: event-specific, vivid but concise, emotionally relevant to the fandom, then naturally connected back to the rental use case.

The goal of this change is therefore:

**mandatory pipeline + strict factual gates + flexible creative structure**

not:

**mandatory pipeline + one mandatory copy template**

## Before

Commercial rental posts were effectively pushed toward:

Brand → Event hashtag → Hook → Offer → Date/Venue → Benefits → CTA → Reach hashtags

The QA layer also contained a hard order check for the event hashtag before price.

Selector scoring emphasized hook/event/timing/novelty/hashtags/readability/commercial relevance but did not explicitly reward naturalness or penalize template feel.

Internal candidates could be technically different while still being semantically near-duplicates.

## After

### Hard gates remain mandatory

- verified event truth
- live approved pricing
- confirmed inventory availability
- exact verified price shown in commercial copy
- canonical date/venue present when supplied
- verified hashtags only
- brand line first
- booking CTA on commercial posts
- no duplicated canonical facts
- exactly 3 internal candidates
- distinct candidate angles
- near-duplicate candidate protection
- recent-copy anti-repeat protection
- QA PASS
- Selector PASS
- persistent invocation evidence
- owner review
- auto-publish = false
- production writes = 0

### Creative structure is flexible

The following are no longer hard-order requirements:

- event hashtag position
- hook position
- price block position
- event-context paragraph position
- benefits order
- emoji density
- paragraph rhythm
- CTA lead-in
- voice/tone within verified facts

The historical Standard A structure remains a useful baseline, not a mandatory template.

## Selector V2

New explicit quality signals:

- event_specificity
- naturalness
- non_template_feel
- hook_originality
- sales_pressure_balance

These are combined with the existing objective signals.

Awareness/reach now rewards event-specific organic copy instead of merely favoring a structurally compliant template.

Conversion still preserves commercial relevance and timing, but now also scores whether the copy feels natural rather than excessively sales-led.

## QA V3

New behavior:

- no event-hashtag-before-price order gate
- exact verified commercial price must appear exactly once
- canonical date/venue must appear when supplied for a commercial post
- commercial CTA must be present
- internal creative cores are compared for near-duplicate similarity
- recent copy is compared for anti-repeat similarity
- fixed store boilerplate is stripped before creative similarity checks so the required footer does not falsely make all candidates look duplicated

Thresholds:

- internal near duplicate: 0.78
- recent-copy repeat: 0.82

## Khom Khlang direction

The liked Khom Khlang post is treated as a **quality direction**, not a reusable template or phrase bank.

Desired characteristics:

- starts from something specific about the event
- sounds like a person who understands the event/fandom
- vivid but concise
- does not hard-sell immediately
- transitions naturally to why the rental is useful
- avoids generic lines such as repeated “ใครมีบัตรแล้วเตรียมเครื่องไว้”

## Learning boundary

The system may use measured post performance as an evidence nudge after enough real observations exist.

This is **not autonomous retraining**.

The system does not:
- retrain its foundation model;
- rewrite its own code from performance results;
- independently change selector weights in production;
- auto-publish based on learned behavior.

Any future weight or policy change remains versioned and reviewable.

## Versions

- Registry: KK_AGENT_REGISTRY_V18
- QA: KK_CONTENT_QA_GATE_V3
- Selector: KK_CONTENT_SELECTOR_V2
- Content Agent plan: KK_CONTENT_AGENT_PLAN_V2

## Tests added / changed

Coverage now verifies:

1. a fact-safe commercial post can PASS with a non-standard paragraph order;
2. near-duplicate internal creative cores BLOCK;
3. missing verified price/date/venue/CTA BLOCK;
4. recent-copy near duplicates BLOCK;
5. selector can prefer a more organic event-specific candidate over a rigid template when factual QA is equal;
6. all-post and chat-bridge tests include the new creative-quality metrics;
7. registry/version assertions track the new policy versions.

## Expected result

The Agent pipeline stays mandatory and auditable, while the output should become less repetitive, more event-specific, more human, and closer to the high-performing organic direction the owner prefers.
