# KK Content Agent Routing — 2026-09-27

## Problem

The Content Strategy skill and Content Agent existed on main, but direct X-post requests could still bypass them and go straight from verified storefront data to ad-hoc copy generation. This caused repetitive hooks and sentence structures across unrelated events.

## Change

Added a mandatory content request router:

- server/kk-content-request-router.js

Direct-rental X requests now route through:

verified business truth
→ Content Strategy
→ Content Agent
→ anti-repeat context
→ three differentiated variants
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

- generate exactly 3 complete direct-rental variants;
- use different primary angles and hook logic;
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
- mandatory Content Strategy + Agent routing;
- three-variant requirement;
- recent-copy anti-repeat context;
- fail-closed commercial gate;
- non-content request pass-through.

package.json syntax checks now include server/kk-content-request-router.js.
