# Ultra Deep automatic public-detail follow-up — 2026-10-14

## Problem and resulting source behavior

At the previous source checkpoint `f938737c09797235aa9495bc406913bc400e2f2c`, the existing public search providers could return a correctly named event URL with no date. Admission rejected that undated row even when the public page contained a named show date. The V9 extractor could read those facts when separately invoked through OFFICIAL_DIRECT, but the ordinary factory → executor path did not invoke it. The Planner's neutral fixture reproduced one search request, zero detail requests and GAP_UNRESOLVED.

The existing public-provider factory now follows an eligible, actually returned, undated public event lead before the existing admission callback. Only compatible named page facts can fill previously unknown date/time/venue fields. Original title, source URL, row order and number of rows are preserved. A conflict with an already known time or venue preserves the entire original row and records `field_conflicts`; it never erases the old facts or admits a date from that conflicting page. Query terms can filter irrelevant leads but cannot supply identity, dates or facts.

The wrapper applies only to factory-created BING_RSS, DDG_HTML, BING_HTML and already configured SEARXNG/DDGS_TRAFILATURA search adapters. Provider order, standalone pure parsers, Live Nation structured rows and OFFICIAL_DIRECT are unchanged. User-injected provider overrides remain direct overrides. `use_only_injected_providers=true` still constructs no public factory and causes no implicit network access. An injected fetch is used for both search and detail; its failure never falls back to global fetch. No provider, scheduler or production writer is activated.

## Bounded public-content boundary

- Hosts must already occur in the source registry. Only exact `eventpop.me` / `deehuphouse.com` and canonical www aliases are supported in this first connector. Other registered hosts remain unchanged leads.
- Eventpop accepts public `/e/<numeric>` with an optional single slug and `/u/<numeric>-slug`. DeeHup accepts the root `/` only. Category/calendar/queue and booking step/vieworders/account/checkout/payment routes are not eligible.
- HTTPS/default443 only, no userinfo, arbitrary subdomains, IP literal or localhost. Encoded paths are skipped, including encoded UTF8 slugs; this intentionally leaves coverage debt outside this connector's supported surface.
- Only locale=en/th and harmless aff/utm parameters are allowed. Tracking parameters and fragments are removed before every HTTP hop and cache/receipt use. The original source lead URL is preserved in the candidate.
- Redirects are manual, at most two hops, and validated against the same public host/path/query boundary before another GET. Redirect cancellation is requested without awaiting a potentially stalled cancellation promise. Final cleanup aborts the chain.
- The official domain's DNS is trusted. This hostname/redirect boundary does **not** pin DNS, inspect A/AAAA addresses or claim complete DNS-rebinding/SSRF protection.
- Actual event-specific titles must share the same distinctive token set in both directions. This rejects a combined two-event page lending a date to one event. The conservative equality rule can miss legitimate aliases and extended names. Generic format/location titles and unrelated named-query rows require no detail request.

Hard factory-scoped bounds cannot be widened by caller options: 24 HTTP detail requests including redirects; 24 cached URLs; two new detail URLs per provider call; two concurrent chains; two redirects per chain; 2,000ms per chain; 5,000ms shared elapsed window from the first detail load. That shared window includes time spent in later searches, so later eligible leads can deliberately be deferred. Failed reads are cached and do not cause automatic retries. Disabled follow-up or zero budgets perform zero detail GETs.

Guarded detail reads require HTML, enforce the existing 1MiB limit while streaming, retain declared charset decoding, bound stalled body reads and cancel the unread remainder. A receipt callback must complete successfully before admission and within the shared deadline. Missing, rejected or late audit evidence preserves the lead. The receipt hash is SHA256 of decoded HTML encoded as UTF8, **not** a hash of the original legacy response bytes.

## Truthful coverage/readback gate

`detailReadback()` exposes a bounded local receipt set and fixed counts for HTTP/cache/hydration/skip/deferred/failure/identity/field-conflict/concurrency. URLs and decoded-body hashes are local read evidence; raw page contents, arbitrary exception values and search queries are not copied into machine diagnostics.

The runtime now projects only the fixed numeric counts. Monthly FULL additionally requires complete detail-follow-up proof; deferred reads, timeouts, receipt failures, identity mismatch and field conflicts keep `DETAIL_FOLLOWUP_INCOMPLETE` open. An independent isolated fixture proves every other FULL gate true and this gate false. SMART operational discovery retains its existing first-hit/readiness semantics, while showing the fixed summary.

This is a safety expansion from the initial Planner's adapter-only recommendation: the runtime projection and negative FULL gate are necessary so optional work debt cannot disappear from a positive monthly result. Existing known-miss, strict source/date, universe, reconciliation, truncation and Verifier gates remain in force. Empty detail work can be complete without recovering any events; `complete=true` with zero reads is **not** search success, FULL or runtime acceptance.

## Validation on the frozen source

Source byte SHA256:

| File | SHA256 |
| --- | --- |
| server/kk-public-event-detail-followup.js | 0472425295575ae43802fc6d84233b73fba1b9c4f435f2e57caa736dd8aaab90 |
| server/kk-ultra-deep-public-web-adapters.js | d0583e6aafd47aa728ddc7d6bea6a1129683fa0ae5fcb8330dfb4d3db384a8f2 |
| server/kk-ultra-deep-runtime-runner.js | 3507c3393a58bf1c921ff152114932eb27acf78e6d94036d4377df997f55b283 |

Root validation: 125/125 focused (30 follow-up tests included), 1,672/1,672 full offline regression, zero failures/skips/cancellations. Code Intelligence's generic selector passed100/100 but routed mainly to storefront files; it is supplementary and does not replace the explicit five-file focused group or full regression. Syntax checks include the new helper separately; diff check exits0. RED/GREEN evidence covers the initial connector, incomplete FULL proof, identity/privacy/audit/URL findings, streaming/time bounds, query relevance and the final three composition findings.

Independent final review on these same hashes: 125/125 focused and 40/40 connector adversarial cases, zero scoped BLOCKER/MATERIAL. Nine material composition findings and the callback/deadline case were repaired and read back. The isolated negative FULL gate and injected-only zero implicit GET were independently confirmed. DNS/token/path/hash limitations remain explicit notes. This40/40 connector matrix does not replace the prior V9 parser matrix37/40 with three retained notes. Technical tests and independent review do not satisfy RELEASE_READBACK.

## Fresh live result and alternate offline proof

The final integrated live probe at **2026-10-14T03:46:27.031Z /10:46:27 Asia/Bangkok** used only these two ordinary existing queries:

1. `TEEHENG GEN OF US site:deehuphouse.com`
2. `FORTREASURE site:eventpop.me`

Both yielded **GAP_UNRESOLVED**. Bing RSS and Bing HTML returned HTTP200 without parsed event evidence; DDG_HTML returned HTTP202 without parsed event evidence. There were six search GETs and zero detail GETs. `detail_readback.complete=true` means no detail debt was created because no lead was available; it does not certify search availability. The preceding 10:40:47 provider-gap receipt is retained separately. No further retry loop or full monthly network scan was run.

The authorized alternative is explicitly **OFFLINE_SELECTED_CAPTURED_LEAD_PAGE_REPLAY**. It uses actual prior undated lead title/URL rows from `search-followup-final.json` and redacted captured public pages `fresh-1.html` / `fresh-2.html`, all from the earlier read-only packet. Provider markup is reconstructed from those captured title/URL rows. The fetch transport is injected, with **zero real network requests**; no expected dates or source seeds are passed in tasks. It is selected replay, not a fresh search or whole-corpus recovery.

The same captured inputs through f938 factory yield two GAP_UNRESOLVED results and zero detail reads. The frozen factory yields two EVIDENCE_FOUND results automatically before admission:

- TEEHENG: 2026-10-24 /16:00 /ONE BANGKOK FORUM.
- FORTREASURE: 2026-11-29 /15:00 /MCC HALL The Mall Lifestore Bangkae; its public /u alias is preserved while the validated /e URL is in the receipt.

Replay consumes three simulated detail requests (one DeeHup read, one Eventpop alias plus its redirect), two cache entries and two hydrated rows. It proves the connector on captured evidence. FORTREASURE remains outside October strict scope. `live_search_recovery_verified`, monthly FULL and canonical runtime are false. Earlier development observations are not substituted for the final frozen-source live result.

## Authority and release boundary

Read-only policy audit at10:14:11 Asia/Bangkok confirms exactly one Active global policy v4.9.44 in current Machine SOT, the same canonical Scanner/Verifier bindings and the active persistence escalation. Current canonical task state, natural lock/manifest/output/persistence, Vercel production identity and business/cleanup state were not refreshed by this source task.

This source change stays on `fix/ultra-deep-sweep-20261014`, stacked draft PR732 → draft PR705. It includes no main merge, production deployment, scheduled-task/policy/Make/Apps Script/business/customer/financial mutation. RELEASE_READBACK remains missing and the engineering gate remains BLOCKED. Hosted exact-head checks, real provider/full recall capacity, canonical natural runtime, coordinated Apps Script/business proof and owner visual/release approvals retain their separate gates.

Evidence packet: `../../outputs/recall-hydration-20261014/` relative to the repository, including Planner/auditor/Reviewer, RED/GREEN/focused/full checks, final live provider-gap, offline replay and physical evidence manifest. Cross-chat handoff records the final commit and external readback after push; source docs are dated evidence, never live authority.
