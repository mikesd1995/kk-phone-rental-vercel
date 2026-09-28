# Marketing Agent mandatory routing — 2026-09-27

## Decision

Marketing Agent is mandatory immediately for KK content requests.

Canonical content chain:

**Marketing Agent → Content Strategy Agent → Content Agent → Content QA Gate → Content Selector → Owner Review**

## Responsibility split

### Marketing Agent
Decides the pre-content marketing brief:
- objective: awareness / engagement / conversion
- campaign mode
- opportunity and urgency context
- performance-informed priority when measured data exists

### Content Strategy Agent
Chooses content pillar, angle, structure and strategic creative direction.

### Content Agent
Drafts three differentiated internal candidates under the approved content contract and anti-repeat rules.

### Content QA Gate
Fail-closes unverified hashtags, duplicate canonical date/venue, broken Standard A structure, incomplete commercial truth, and invalid/duplicate candidate batches.

### Content Selector
Ranks the three QA-passing candidates against the Marketing objective and exposes exactly one final post. The score is an estimate, never a guarantee of maximum reach.

## Cold start

The existing `17_Content_Performance` dataset does not yet provide sufficient measured history. Marketing Agent therefore explicitly reports `RULE_BASED_COLD_START` rather than pretending historical performance proves a recommendation.

## Safety

Marketing Agent is `READ_ONLY_ADVISOR`:
- production writes: 0
- auto publish: false
- auto spend: false
- price writes: false
- inventory writes: false
- Machine SOT writes: false
- human approval required

It cannot override verified event truth, pricing, inventory, owner-hidden visibility, or commercial safety gates.

## Enforcement

Registry V17 requires `kk-marketing-agent`, `kk-content-strategy`, `kk-content-agent`, `kk-content-qa`, and `kk-content-selector` for **every KK social-post route**, including direct rental, weekly roundup, last call, onsite, event announcement, brand/awareness, promo/offer, repost/refresh, and general X copy drafts.

The public output contract for every matched post route is `SINGLE_FINAL_POST` with exactly one owner-facing post. Exactly three candidates remain internal unless the owner explicitly asks to inspect alternatives. A missing Marketing, Strategy, Content, QA, or Selector stage fails closed instead of silently continuing.

Commercial posts still require verified event/pricing/inventory truth. Non-commercial posts do not fabricate commercial facts and only validate facts/hashtags actually used.
