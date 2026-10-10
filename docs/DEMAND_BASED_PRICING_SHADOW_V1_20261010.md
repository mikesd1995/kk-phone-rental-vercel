# KK Phone Rental — AI-Assisted Demand-Based Pricing, Shadow V1

**Date:** 10 October 2026 (Asia/Bangkok)
**Change authority:** Owner requested that KK stop letting weekday/weekend or fixed market-median baselines determine the optimal price. Some high-fandom TeeTeePor brand engagements rent successfully even midweek at THB 790; a static weekday THB 590 can leave an **illustrative opportunity gap of THB 200 per rental**, not necessarily a proven accounting loss.

**What shipped to SOURCE:** zero-cost deterministic **Evidence-Weighted Demand Pricing Shadow** (explicitly **not yet a trained machine-learning model**) + observational pricing-feedback evaluator + private Agent Gateway routes + registry + targeted tests. The system makes **proposals only**; does not alter public prices or activate production AI. Draft PR #680 still unmerged, CI/Production acceptance required.

## A. Policy precedence and phase separation

1. **Booking date** has absolute price lock; even one phone available does not authorize repricing; active phone inventory is only 2 units total, shared across events.
2. **Owner-hidden/tombstone**, individually owner-fixed prices and inventory collision block pricing.
3. **Exact-event competitor 1–2 shops**: show each original price, account, source URL and observed date to the owner; **NO AUTO CHANGE, NO computed midpoint as a final price**. Existing price remains until owner chooses. If found but stale/unpriced => owner/recheck hold.
4. **3+ independent verified shops**: original market median remains a competitive reference/check, but Demand Shadow is advisory; no automatic override until Owner/Verifier/production acceptance.
5. **No competitor found** is not equivalent to never searched. **Current site prices are preserved** in Shadow Mode. Weekpart 490/590 or 790/990 remains the *operational seeded price* while unproven AI modeling is validated; it is **NOT the driver** of the Shadow Agent's per-event score.
6. **New desired long-term authority:** evidence-driven per-event pricing after an accepted shadow/backtest phase and explicit owner-controlled rollout. There is no present justification for turning it into unsupervised live price writing.

## B. Price signal provenance

New pure module: `server/kk-demand-pricing-shadow.js` `KK_DEMAND_PRICING_SHADOW_V1` with stable `propose(input)`, `learn(input)`.

`propose` requires:
- exact canonical `event_id`, valid ISO `event_date`, `event_verified=true`;
- `current_phone_price` and `current_bundle_price` from read-only `09_Web_Packages`, not guessed; when absent, bundle suggestion stays unknown (never invent lens differential);
- no Booking, owner price lock, hidden/tombstone, inventory depletion or owner collision;
- at least **two independently source-tagged, dated, verified demand signals**, including fandom photo intent or qualified inquiry intent. Supported 0–100 factors: `fandom_photo_intent` 38%, `public_engagement` 21%, `ticket_demand` 18%, `qualified_inquiry_intent` 23%. Input metadata `source_url/source_ref` and `observed_at` required; bare follower counts without source are ignored;
- optional `completed_history`: only anonymized, **verified, completed and comparable** past rentals with event ID, date, *actually paid* phone price and source reference. `cancelled` and `no_show` are excluded; never use uncompleted/future bookings as actual revenue. Avoid personal data entirely.
- optional owner-verified viable phone floor `minimum_viable_phone_price`; never invent costs or margin. When proposed price below provided floor, HOLD.

Prices: A bounded, explicitly heuristic set of THB 490–1290 phone bands; demand classification is independent of **weekday**. If at least one verified comparable paid history sample exists, its observed median anchors the proposal; sparse history always gets **LOW confidence**. Output includes `demand_score`, `historical_paid_price_median`, `price_basis`, `verified_signals`, `evidence_gaps`, both current and proposed package prices, plus `SHADOW_PRICE_PROPOSAL_OWNER_REVIEW` or a safety HOLD. The currently published bundle premium is maintained, rather than assuming a fixed +200 premium in all events.

**The weights and discrete bands are untrained heuristics, not inferred willingness-to-pay or causal price elasticity.** A verified historical THB 790 TeeTeePor rental is evidence the price *can* convert in that context, **not** evidence every similar brand event will sell for THB 790 or that charging THB 590 objectively loses THB 200 profit. Never report an unverified revenue uplift as achieved.

## C. Learning workflow (bounded zero-cost read-only)
`learn({proposal,outcomes})` aggregates records only for matching canonical event ID with source, verified status `completed`, `cancelled`, `no_show`. `observed_completed_gross` = SUM paid price from **completed** only. Do not silently count pending/confirmed/prepared/picked_up/returned/uploaded as Actual: those remain Future under Revenue Dashboard rules. Returns sample size, observed average actually paid, cancellation/no_show counts and `INSUFFICIENT_OBSERVED_OUTCOMES` until minimum five independent verifiable records. **Does not claim causal uplift, optimize price elasticities, persist ML state or initiate training.**

**Data architecture needed before a trained model can honestly be claimed:** persisted immutable price-observation (event_id, event_date, package, posted_price, timestamp window, audited visitor/exposure denominator, booking conversion, cancellations, source), owner decision ledger, venue/fandom/date attributes, features extracted with evidence, train/validation time split with leakage prevention, calibration/backtest vs static prices, confidence thresholds, drift/error audit, rollback. Inventory censoring and marketing exposure strongly bias price/conversion data. With only two devices the sample is too small for uncontrolled online A/B tests. No made-up p(conversion) or ROI.

## D. Router/Agent integration

- `server/kk-agent-task-router.js` adds request types `demand_pricing_shadow` and `learn_demand_pricing_outcome` returning agent output only.
- `server/kk-agent-registry.js` V30 declares `kk-demand-pricing-shadow` and `kk-pricing-learning-shadow` with `production_writes:0`, owner review, persistent invocation-evidence requirement. The caller must provide verified current business snapshot and evidence, no private consumer data in model.
- `server/kk-final-pricing-policy.js` **legacy LIVE pricing path remains unchanged** on Draft: it is not silently converted into live AI repricing. Prior competitor policy V7 still enforces 1–2 shop Owner HOLD. This explicit separation avoids unreviewed changes to the governed Admin Writer.
- Source tests `tests/kk-demand-pricing-shadow.test.js`; `npm run test:demand-pricing:shadow` script; main `npm test` already globs all `tests/*.test.js`.

## E. Acceptance and rollout gates

Shadow-only SOURCE acceptance:
- demand scoring independent of day-of-week;
- owner/booking/tombstone/inventory safeguards and no negative/invalid event date;
- no evidence => HOLD, not a confident AI hallucination;
- one/two competitors => raw quote report Owner HOLD, current prices preserved;
- only verified completed comparable history anchors price; no invented profit claims;
- all outputs `production_writes=0`, no publisher or outbound approval claims;
- recorded evidence ID/time, model version, current/pricing suggestion and owner decision for every proposed event;
- test/integration/CI readback and production API proof before any release.

**Release blocked until:** full GitHub CI+relevant workflow passes, Verifier and security review, a real replay of October/November anonymized bookings/signals, a human review of 10+ representative events including midweek TeeTeePor, and evidence of net outcomes from comparable periods. Explicit Owner acceptance, no paid tool activation, Vercel free quota honored. Do not overwrite prices for Oct10 policy conflict, any booked dates or owner-hidden events.

## F. Execution and limitations in this change

- Added Demand Shadow module, registered Agent Gateway routes, registry and tests, source-only on Draft PR #680.
- **Isolated execution in connector-hosted JS:** 12 focused shadow regression cases passed, including exact router/registry integration with other unrelated imports stubbed. That is NOT full project CI or live production.
- No AI external-model calls occurred, no paid credits used; **machine learning is not trained yet**. Code uses deterministic evidence weights as an initial safe baseline while historical data engineering/owner feedback is built.
- **NO Google Sheets/Supabase booking, pricing, inventory or storefront event write** was made. None of the existing 23 October/November Fri–Sun price adjustments were changed in this work.
- Existing high-frequency Ultra Deep Acceptance remains a separate gate; previous CI failures must be resolved before new code is merged.
- Project result is **Shadow V1 source implemented, NOT autonomous live pricing**. Any claim of "100% fully automatic pricing completed" is incorrect.

## G. Durable pointers
- [Draft PR #680](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/680)
- [October Issue #685](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/685)
- [November Issue #686](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/686)
- [Competitor 1–2 shop policy](./PRICING_COMPETITOR_REFERENCE_OWNER_POLICY_20261010.md)

## H. Read-only current-core pilot & exact-head gate (2026-10-10 evening Bangkok)

Connected canonical Core Sheet `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`, `09_Web_Packages` readback:
- **BENTON × TeeTeePor**, 2026-10-28, `EVT-20261028-BENTON-JOURNEY-BACK-TO-GLOW`: existing phone **THB 490**, bundle **THB 590**, packages currently available. Shadow input supplied verified event identity/date and current package values, but **did NOT invent** independent photo/inquiry/ticket receipts or analogous completed paid price. Result `HOLD_INSUFFICIENT_DEMAND_EVIDENCE`, suggested price `null`, 0 writes.
- **NARS × TeeTeePor**, 2026-10-25, `EVT-20261025-NARS-TEETEEPOR-EXCLUSIVE-EVENT`: existing phone **THB 790**, bundle **THB 990**, packages available. Same real evidence gap and same HOLD, suggested price `null`, 0 writes.
- Tracker `_Score_Feature_Snapshot` first three inspected historic snapshots have `Demand/Fandom Raw`, `Ticket Heat Raw`, `Rental Fit Raw`, `Social Engagement Raw`, `KK Historical Raw` as **empty**, not zero. `_Business_Outcome` includes a small number of historical completed gross records but does **NOT** prove they represent same-fandom phone-only paid rentals or exposure-adjusted demand; they were **NOT injected** as fake comparable training samples.
- An **illustrative synthetic fixture**, explicitly NOT live TeeTeePor data, with 4 verified signal receipts and two comparable completed rentals paid THB 790, generates a higher-than-590 weekday proposal, but that is a deterministic **unit-test demonstration**, not a production owner pricing recommendation.
- Focused isolated JavaScript run with current branch files `server/kk-demand-pricing-shadow.js`, task-router, agent-registry, `server/kk-final-pricing-policy.js`: **36/36 executed tests passed, one unrelated Verifier integration test deliberately skipped**. All 12 Shadow tests including route+registry pass with unrelated router dependencies stubbed. Full `npm test`, full CI and frontend rendered acceptance were **NOT** executed or proven by this harness.
- Exact branch HEAD at final read `323f3504dc43874a230b11c9df46de84ad810875`; Draft PR #680 OPEN not merged. GitHub Actions latest read `38055235287` OpenAI Optional Zero-Cost Acceptance FAIL, `38055235323` Storefront Automated Visual QA FAIL, `38055235345` Ultra Deep V2 Acceptance FAIL. Individual logs previous same-branch attempt returned 404 `BlobNotFound`, so do **not** claim exact test failure cause. Vercel commit status success **not** equivalent to passing CI. No merge, production write or paid calls.
- Agent policy propagated to `.agents/skills/kk-event-verifier/SKILL.md` and `.agents/skills/kk-discovery-scanner/SKILL.md` so future source reviews do not regress to weekday-only pricing or confuse KK internal pricing outcomes with External Demand publish eligibility.
- Roadmap/production acceptance tracker: [GitHub Issue #687](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/687).

**Final turn handoff:** SOURCE_SHADOW_IMPLEMENTED | TESTS_ISOLATED_36_PASS_1_SKIP | REAL_TT_2_HOLD_NO_VERIFIED_DEMAND_FEATURES | LIVE_PRICING_UNCHANGED | LEARNING_NOT_TRAINED | 3_GITHUB_WORKFLOWS_FAILED | PR680_DRAFT_NOT_MERGED | PRODUCTION_WRITES_0.
