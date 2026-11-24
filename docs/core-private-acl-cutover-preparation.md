# Core private-reader and ACL cutover preparation

This is a source-only preparation contract. It is not permission to change Google sharing, GAS/Vercel settings, deploy, probe, send or activate a runner. Tests use isolated fixtures. Core private acceptance is independent of native C1; native uncertainty must not be used to reopen the Core workbook publicly.

## Existing boundaries

Keep the existing Core reader, Apps Script read key isolation, single writer, locks, booking transaction identity, owner-hidden events and exact readback. Core, Tracker and private CRM are separate destinations. Do not widen the public `/api/kk-data` projection or make Tracker public. Do not rotate keys, repeat owner consent or change feature gates just because an older setup note differs.

`server/core-private-range-contract.js` names all 19 source-allowed sheet/range pairs, including wide analytics, lean Admin and package L/M/N variants. Tests bind the manifest to current GAS source and the existing reader request/response path. A local parity test does not establish which GAS source is deployed.

`scripts/core-private-cutover-preflight.cjs` defaults to configuration-only. Its existing `--probe` performs authenticated reads and is **not authorized by this preparation task**. A schema result, including `PRIVATE_RANGE_SCHEMA_EMPTY`, never establishes consumer acceptance. The preflight always leaves consumer acceptance pending and cutover readiness false. Never call an Admin snapshot or intelligence-health route as a passive check: these paths can make health/upstream calls.

`scripts/core-private-acl-cutover-plan.cjs` evaluates an in-memory local evidence packet. It cannot fetch a permission ID or change ACL. A complete packet produces one proposed removal description and still sets execution authority, cutover readiness and runtime verification to false. It does not authenticate supplied evidence references. The standalone CLI only emits the blocked empty checklist; no execute switch exists.

## Ordered gates for a separately authorized cutover

1. Bind the exact reviewed candidate, CI, deployed source, canonical alias and runtime configuration. Before any protected action, refresh live Machine SOT/highest compatible Active policy and the current deployment. A READY deployment alone does not prove private transport or environment pickup.
2. The owner verifies the existing private read identity, key isolation, configured client/stored grant and actual destination binding in the appropriate provider secret stores. Record only a reviewed evidence reference, not secret values, tokens, raw URLs, permission identities or customer rows. Do not infer a new consent/rotation requirement without a mismatch.
3. With a separate explicit finite read budget, obtain authenticated acceptance for all 19 exact pairs through the approved transport. No public fallback, arbitrary range, raw row logging, automatic retry, business write, health, sender or native claim is permitted. Account for valid empty datasets explicitly; do not manufacture a row to prove the path.
4. Review the seven consumer surfaces: storefront events/event-share, storefront packages, Admin snapshot, Admin mutation read guards, rental dashboard, intelligence read helpers and the existing canonical quotation feature gate. Preserve current feature state. Use isolated fixtures for guard/denial behavior; later approved live checks must name exact routes and avoid hidden health calls. Bind acceptance to the candidate and new deployment/process or an approved uncached path; cached old data is insufficient.
5. Establish the full current sharing/published-view state and inheritance in the owner's secure context. The sanitized type/role metadata retained by this task is insufficient for exact permission identity or published-view exclusion. A SHA-256 digest over a deterministic representation of complete sorted permission identities, type, role, discovery and inheritance may be retained as a reference; raw access metadata stays in the provider/owner context. Equal role counts cannot establish identity continuity. Refresh immediately before removal; any mismatch stops the operation.
6. Obtain approval for the concrete exact source, gates, one public-reader removal and private-only rollback. Resolve the exact permission ID just in time in the provider context; never guess it from a cached note. Remove only that public-reader grant, preserve all owner/private grants and do not create broader domain/anyone grants. Ambiguous/multiple public grants or unexpected domain access require scope review rather than silent removal.
7. Read back the exact ACL and compare the full private grant set/digest with the preimage excluding the approved one grant. Confirm anyone access is absent and published views/inherited access cannot bypass the intended boundary. Separately verify approved public projections still work and private source access is denied using the reviewed bounded procedure. Do not download private rows merely to demonstrate denial.
8. Record before/after, exact approved operation, provider/readback evidence, consumer outcomes and residual unknowns. Only then assess backend privacy acceptance. Keep sender/runtime OFF regardless of private-reader success unless a separate authority changes that boundary.

## Local packet contract

`evaluate(packet,{now,maxAgeSeconds})` requires a caller-selected freshness bound between 1 and 3600 seconds. This is a local preparation bound, not a new Machine SOT policy. It requires exact Core workbook identity, candidate/deployment source equality, fresh policy/permission/private-read/binding/consumer references, 19 unique accepted pairs, no public fallback, exact matching permission digests and a private-only rollback. Evidence strings are never echoed.

The seven consumer keys are exported as `CONSUMERS`. For a feature that remains disabled, its reviewed acceptance must prove preserved disabled behavior, rather than enabling it to make a check green. `VERIFIED` in an input is a caller assertion requiring independent review; the helper cannot establish it.

## Failure and rollback

If private reads fail after an authorized ACL cutover, keep the source private and return the existing degraded/unavailable result. Restore only an already approved known-good private source/configuration if authorized; otherwise stop and report the exact failing boundary. Never restore `anyone/reader`, add a public GViz fallback, activate Make, allocate native attempts or replay queued work as a rollback. A source rollback alone is unsafe if it would restore reliance on a now-private public feed; review that dependency first.

Until those gates have direct evidence, backend ACL cutover and real private transport/consumer acceptance remain pending. Source tests and a complete offline checklist do not close those claims.
