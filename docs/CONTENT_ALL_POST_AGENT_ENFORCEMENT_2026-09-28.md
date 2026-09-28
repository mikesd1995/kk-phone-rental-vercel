# All-post Agent pipeline enforcement — 2026-09-28

## Decision

All KK Phone Rental social-post generation routes are now governed by one mandatory pipeline:

**Marketing Agent → Content Strategy → Content Agent → Content QA Gate → Content Selector → Owner Review**

This applies to direct rental, weekly roundup, last call, onsite/update, event announcement, brand/awareness, promo/offer, repost/refresh, quote-post, caption, hook, and other explicit post-copy requests.

## Runtime contract

Every matched post request that enters `kk-agent-gateway` must satisfy all of the following:

- `kk-marketing-agent` invoked
- `kk-content-strategy` invoked
- `kk-content-agent` invoked
- `kk-content-qa` invoked
- `kk-content-selector` invoked
- exactly 3 internal candidates
- all internal candidates pass QA
- exactly 1 owner-facing winner
- owner review required
- auto publish = false
- production writes = 0
- publishes = 0

If any stage is absent, the gateway returns `BLOCKED_REQUIRED_AGENT_NOT_INVOKED`. A route cannot claim PASS while omitting Selector or another required stage.

## Post coverage

The router recognizes, among other forms:

- rental posts
- weekly / multi-event roundup
- last call
- onsite / arrived-at-event updates
- event announcements
- brand / awareness
- promo / offer
- repost / refresh
- quote posts
- captions / hooks
- explicit X/Twitter post requests

## QA behavior

Commercial posts remain fail-closed unless current event, pricing, displayed offer, and inventory truth are verified.

Non-commercial posts do not need fabricated price or inventory fields. They are validated against the facts and hashtags they actually use. Event-specific claims still require verified event truth. Unverified hashtags remain blocked.

## Single-winner behavior

Three differentiated candidates stay internal. The selector exposes one `SINGLE_FINAL_POST` winner for Owner Review. Alternatives are shown only when explicitly requested.

## Versions

- Registry: `KK_AGENT_REGISTRY_V17`
- Gateway: `KK_AGENT_GATEWAY_V3`
- QA Gate: `KK_CONTENT_QA_GATE_V2`
- Selector: `KK_CONTENT_SELECTOR_V1`

## Important boundary

This change closes bypasses **inside the KK Agent Gateway**. A ChatGPT surface that does not call the private gateway is still outside repo enforcement. Do not claim that a chat-generated post used the project Agents unless invocation evidence from the gateway exists.
