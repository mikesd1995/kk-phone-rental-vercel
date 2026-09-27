# Marketing Agent mandatory routing — 2026-09-27

## Decision

Marketing Agent is mandatory immediately for KK content requests.

Canonical content chain:

**Marketing Agent → Content Strategy Agent → Content Agent → Owner Review**

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
Writes the final hook/copy variants under the approved content contract and anti-repeat rules.

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

Registry V6 requires `kk-marketing-agent`, `kk-content-strategy`, and `kk-content-agent` for both direct rental X and general content draft routes.

Gateway only records the three agents as invoked when the router actually produced a Marketing Agent plan. A bypass therefore fails the required-agent gate instead of silently continuing.
