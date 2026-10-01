# X Signal Detector V2 — 2026-10-01

## Incident

KK Phone Rental post planning was treating unlike X evidence as if it were directly comparable. Examples included:

- old official posts with very large raw view counts being ranked against same-day rental-market posts;
- unlabeled numeric fragments returned by logged-out/public X parsing being described as likes/reposts/interactions;
- raw views being compared without accounting for post age;
- historical reach being allowed to look like current momentum;
- stale `inventory_available=true` remaining usable even when the numeric phone inventory had already reached zero.

This made post-plan ranking look stronger or stranger than the underlying evidence justified.

## Fix

Added deterministic module:

- `server/kk-x-signal-detector.js`
- version: `KK_X_SIGNAL_DETECTOR_V2`

The detector is deliberately not a web scraper. A collector/search step must supply evidence with provenance. The detector normalizes and gates that evidence before Marketing Agent may use it.

### 1. Source classes are separated

Signals are classified as:

- owned / KK actual;
- official / organizer;
- community / fandom / media;
- market / rental-market / ticket-market;
- unknown.

Raw view counts from these groups are **never directly summed or treated as equivalent**.

### 2. Metrics require labels/provenance

A numeric value is usable only when its metric label is confirmed through one of:

- `<metric>_label_confirmed=true`;
- structured metric objects with `label_confirmed=true`;
- explicit structured provenance such as `metric_provenance=api_structured`.

A fragment such as `96.5K 151` does not allow the system to call `151` interactions. Unlabeled numbers are ignored and surfaced as warnings.

### 3. Reach is age-aware

The detector records:

- `age_hours`;
- freshness band: HOT / FRESH / RECENT / HISTORICAL;
- views per hour using a one-hour floor for posts younger than one hour;
- `early_window=true` for sub-hour evidence.

This prevents a ten-minute post and a twelve-hour post from being compared only by cumulative views.

### 4. Historical scale is context only

Signals older than 48 hours are stored as `historical_scale_views` but do not contribute to current `priority_score`.

This permits statements such as “the fandom has previously shown large scale” without presenting historical scale as live momentum.

### 5. Engagement is fail-closed

Engagement rate is calculated only when:

- an explicitly labeled total engagement count exists; or
- likes + reposts + replies are individually labeled.

Partial or ambiguous engagement numbers do not receive an engagement score.

### 6. Current priority uses normalized dimensions

The event summary exposes separate dimensions:

- `kk_actual_reach_momentum`;
- `official_fandom_momentum`;
- `rental_ticket_intent`;
- `engagement_quality`;
- `historical_scale_views`.

The priority calculation uses freshness-adjusted normalized scores, not raw cross-source views.

Current weights:

- official/fandom momentum: 50%;
- rental/ticket intent: 25%;
- KK actual momentum: 15%;
- engagement quality: 10%.

Only dimensions with valid evidence participate; available weights are renormalized.

## Inventory safety correction

Added a numeric inventory gate.

For direct phone-rental content:

- `inventory_remaining <= 0` => `BLOCKED_NO_PHONE_INVENTORY`;
- a stale `inventory_available=true` cannot override zero phone inventory;
- lens inventory does not make a phone-rental post eligible;
- an explicit `lens_only_offer=true` may enter `LENS_ONLY` mode but is not considered a phone-rental offer.

`server/kk-content-request-router.js` now derives effective inventory before Marketing Agent and Content Agent run, so commercial content fails closed when the phone count is zero.

## Marketing Agent integration

`server/kk-marketing-agent.js` is now `KK_MARKETING_AGENT_V2_X_SIGNAL`.

When `input.x_signals` is supplied it returns:

- `x_signal_analysis`;
- `x_signal_contract`;
- signal-aware opportunity reasons.

Historical reach never adds a current-momentum bonus.

## Regression coverage

Added `tests/kk-x-signal-detector.test.js` covering:

1. unlabeled numeric fragments are ignored;
2. explicitly labeled metrics produce age-aware velocity;
3. sub-hour posts use the one-hour denominator floor;
4. historical official reach cannot inflate current priority;
5. official momentum and rental intent stay separate;
6. zero phone inventory blocks phone-rental content;
7. lens-only availability is separated from phone-rental eligibility;
8. Marketing Agent exposes the V2 signal contract;
9. direct-rental routing fails closed at zero remaining phones.

`package.json check` now syntax-checks both the detector and its regression test.

## Operational interpretation

For future KK post planning, evidence should be reported as separate facts rather than a single ambiguous “X signal” number:

- **KK actual:** exact KK post URL, observed views, age, views/hour;
- **current official/fandom momentum:** fresh labeled metrics only;
- **rental intent:** rental/ticket-market evidence separately;
- **historical scale:** contextual only;
- **inventory:** current numeric phone count before recommending a direct-rental slot.

No detector result guarantees reach. It is decision support only and cannot override verified storefront inventory, event truth, approved pricing, or owner review.
