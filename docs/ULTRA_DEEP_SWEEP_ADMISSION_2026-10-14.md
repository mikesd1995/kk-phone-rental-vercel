# Ultra Deep bounded sweep and provider admission repair

Date: 2026-10-14, Asia/Bangkok. Scope: source-only correction; no production, policy, task, booking, pricing, inventory or owner-visibility mutation.

## Reproduced failures

A fresh manual public-provider probe at base8ea1bd65877e326f1b14f37a595553d9c849c370 finished with full=false and known-miss live recall0/26. It returned885 staged candidates, only20 with dates and none with venue. Its preflight reported READY from unrelated VirtualBox results for the Bangkok concert query. An independent correctly instrumented single Bing RSS request returned HTTP200 with unrelated Outlook/Hotmail help results. Provider availability does not establish useful event evidence. The first probe's fetch trace hook was named incorrectly; function-level provider calls used actual global fetch, but its zero recorded HTTP receipts must not be interpreted as zero network requests.

Separately, the monthly plan already declares EXHAUST_BOUNDED_VARIANTS_AND_RECORD_RECEIPTS, but the executor ignored the condition and returned immediately after the first sourced result. Deterministic replay showed later aliases/providers were never invoked.

## Resulting behavior

- Only the explicit exhaustive condition changes execution. Already-bounded query variants and allowlisted bound providers continue, with one receipt per attempted query/provider. Default and SMART operational first-success behavior remain unchanged.
- Accumulated candidates deduplicate exact identity/date/time/venue/artist/source fields and retain first-provider provenance. Existing MAX_RESULTS25 output/normalization bounds remain. Overflow reports inspected unique drops separately from uninspected raw rows; neither is hidden as complete evidence.
- executionProof refuses truncated tasks. Full completion remains governed by provider, source, discovery/reference, reconciliation and strict known-miss gates; truncation exposes DISCOVERY_RESULTS_TRUNCATED. A zero reconciliation gap with no eligible reference still is not complete.
- Preflight uses the existing candidate-admission hook. Topic-relevant event/brand/fan signals and recognized event-detail paths are usable; unrelated technical-help rows do not certify readiness and allow fallback. Dates and venue remain optional for this probe, not invented. Exact/subdomain host checks reject lookalike domains.
- Provider parsing, dates, known-miss expectations, current policy, locking/fencing, schedule identity and Verifier authority are unchanged. No credentials, providers or dependencies are provisioned.

## Validation and limits

Regression tests reproduce early-stop, unrelated preflight, accumulated/per-response overflow, dedupe, error/unbound receipts and default compatibility. Final full source regression1620/1620 with zero failure/skip; syntax and diff checks pass. Independent reviewer also reproduced a26-row overflow producing false FULL before correction and confirmed it becomes incomplete afterward. Focused independent62/62 and adversarial cases pass, with no remaining scoped blocker/material.

Explicit exhaustive mode performs more of its planned provider calls. October main-discovery plan has111tasks; independent deterministic bounds are489Bing-only calls,1077–1125LN+Bing+DDG calls, and4164–4452calls if all10providers were bound, excluding known-miss/reference/preflight. These are invocation counts, not runtime-duration or spend forecasts. No new binding is enabled. Existing server/runtime budgets, source permissions and quotas must be checked before release; bounded manual performance evidence remains separate from canonical scheduled acceptance.

The missing26 are not declared recovered. A later successful provider readiness check is not Full Scan, Verifier success, storefront publication or stable scheduling. Current canonical task persistence escalation and hosted CI/account release gates remain in force. Owner-hidden events and unknown business/receipt/return facts remain untouched.
