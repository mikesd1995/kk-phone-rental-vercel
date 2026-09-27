# KK Content Agent Routing — 2026-09-27

## Problem

The Content Strategy skill and Content Agent existed on main, but direct X-post requests could still bypass them and go straight from verified storefront data to ad-hoc copy generation. This caused repetitive hooks and sentence structures across unrelated events.

## Change

Added a mandatory content request router:

- server/kk-content-request-router.js

Direct-rental X requests now route through:

verified business truth
→ Marketing Agent
→ Content Strategy
→ Content Agent
→ three differentiated INTERNAL candidates
→ Content QA Gate
→ Content Selector
→ ONE final owner-facing post
→ owner review

## Trigger coverage

The router recognizes Thai and English request patterns equivalent to:

- ขอโพสปล่อยเช่างานนี้บน X
- ขอโพสต์งานนี้บน X
- โพสปล่อยเช่า
- rental post/copy for X or Twitter

Non-content requests such as competitor-price research do not get hijacked by the Content Agent.

## Direct-rental gate

A publishable direct-rental draft requires:

- verified event;
- verified current pricing;
- explicit price display;
- confirmed available inventory.

If commercial truth is incomplete, CONTENT_GATE is BLOCKED.

## Anti-repeat contract

The Content Agent now receives up to 12 recent posts/hooks when available and must:

- generate exactly 3 complete direct-rental candidates internally;
- use different primary angles and hook logic;
- all three candidates must pass QA;
- selector ranks the three candidates and exposes exactly one winner to the owner;
- avoid cosmetic rewrites;
- avoid recent hook wording, sentence skeletons, metaphors, and generic filler;
- never invent event/artist/fandom lore to create novelty.

## Safety boundaries

Unchanged:

- READ_ONLY_ADVISOR
- human approval required
- auto_publish=false
- auto_spend=false
- production_writes=0
- no pricing/inventory/Machine SOT writes

## Verification added

Regression tests cover:

- Thai X rental trigger detection;
- mandatory Marketing + Content Strategy + Content Agent + QA + Selector routing;
- three-internal-candidate / one-public-winner requirement;
- recent-copy anti-repeat context;
- fail-closed commercial gate;
- non-content request pass-through.

package.json syntax checks now include server/kk-content-request-router.js.
