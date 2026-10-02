# KK X Posting Plan Agent - default route - 2026-10-02

## Decision

Requests equivalent to "what should KK post next on X", "which event should be posted tonight", "rank events for X", or "split the posting plan by time window" must not use ad-hoc manual ranking.

The mandatory planning chain is:

verified candidate events + current labeled X evidence + recent KK post history
-> Marketing Agent
-> X Posting Plan Agent
-> time-slot ranking
-> owner-facing plan

When final copy is requested for a selected slot, the existing mandatory content chain still applies:

Marketing Agent -> Content Strategy -> Content Agent -> Content QA -> Content Selector -> Owner Review

## Default timezone and dayparts

Timezone: Asia/Bangkok

- Morning: 08:00-10:30
- Midday: 11:30-13:30
- Afternoon: 15:00-17:30
- Prime time: 19:30-21:30
- Late night: 22:00-00:30

The caller may request only a subset, such as prime time and late night.

## Ranking evidence

The planning score uses:

- freshness-adjusted current X momentum;
- engagement quality;
- rental/ticket-market intent;
- event proximity;
- fandom strength;
- booking/inventory fit;
- recent-post novelty/fatigue;
- competitor-market signal.

Historical raw reach is context only and never substitutes for current evidence. Unlabeled X metrics remain ignored by the existing X Signal Detector.

At least one verified event with current labeled X evidence is required. Otherwise the planner fails closed with BLOCKED_INSUFFICIENT_CURRENT_EVIDENCE.

## Anti-repeat

Recent KK posts are part of the planning input. Posting the same event again shortly after a recent post receives a strong novelty penalty. Reusing the same event across adjacent time slots also receives a repeat penalty unless it still wins after the penalty.

Late-night planning may prefer CONVERSATION_CAPTURE instead of another standalone sales post when engagement or rental-market conversation is active.

## ChatGPT bridge and persistent invocation proof

A ChatGPT session with the GitHub connector must use the owner-only issue bridge before claiming the project X Posting Plan Agent actually ran.

Issue prefix:

[KK-X-PLAN-RUN]

Payload markers:

<!-- KK_X_PLAN_PAYLOAD_START -->
<!-- KK_X_PLAN_PAYLOAD_END -->

Workflow:

.github/workflows/kk-x-posting-plan-chat-bridge.yml

Bridge implementation:

scripts/kk-x-posting-plan-chat-bridge.js

The resulting GitHub issue comment is persistent invocation evidence and records the required and invoked Agents plus the selected time-slot plan.

## Cross-session project behavior

The locked project-memory corpus records this planning route as the default for KK X planning requests. New Agent Gateway sessions bootstrap the rule before execution.

This is project runtime memory. It does not grant authority to invent current X evidence or bypass live verification.

## Safety

This route is read-only. It cannot:

- publish or schedule posts;
- spend ads;
- change prices;
- change inventory;
- mutate bookings;
- change production business truth.

The ranking is evidence-based decision support and does not guarantee maximum reach.
