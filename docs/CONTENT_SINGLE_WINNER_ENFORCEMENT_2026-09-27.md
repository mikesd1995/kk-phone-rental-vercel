# Content single-winner enforcement — 2026-09-27

## Decision

All KK social-post requests no longer expose three copy variants to the owner by default.

Canonical chain:

**Verified business truth → Marketing Agent → Content Strategy → Content Agent → Content QA Gate → Content Selector → Owner Review**

## Runtime contract

- Content Agent generates exactly 3 differentiated **internal** candidates.
- Content QA requires all 3 candidates to pass.
- Internal candidates must be distinct; duplicate copy or duplicate structured angles fail closed.
- Content Selector ranks the 3 candidates against the Marketing objective.
- Owner-facing output is exactly 1 post: `SINGLE_FINAL_POST`.
- Alternatives are shown only when the owner explicitly asks to inspect them.

## Selection model

For awareness / qualified-reach selection, the cold-start profile is:

| Signal | Weight |
| --- | ---: |
| Hook / stop-scroll strength | 30% |
| Event + fandom relevance | 25% |
| Timing relevance | 15% |
| Novelty / anti-repeat | 15% |
| Verified hashtag relevance | 10% |
| Readability on X | 5% |

Engagement and conversion use objective-aware profiles. Conversion adds commercial relevance and increases timing importance.

When measured performance evidence is insufficient, selector state is `RULE_BASED_COLD_START`. After sufficient measured posts exist, historical performance may nudge the score but cannot override verified current truth.

## Fail-closed rules

Selection does not produce a public winner when:

- there are not exactly 3 internal candidates;
- any candidate fails Content QA;
- required selector metrics are missing;
- direct-rental event/pricing/inventory truth is incomplete;
- hashtags are unverified or synthesized;
- canonical date/venue is duplicated without an intentional timing reason.

## Safety

`kk-content-selector` is read-only:

- auto publish: false
- production writes: 0
- publishes: 0
- human approval required

The selector estimates best fit to the current objective. It must never claim that a candidate is guaranteed to produce the highest reach or bookings.

## Enforcement

Registry: `KK_AGENT_REGISTRY_V17`

Required agents for every KK social-post route:

`kk-marketing-agent → kk-content-strategy → kk-content-agent → kk-content-qa → kk-content-selector`

Public output count: **1**.
