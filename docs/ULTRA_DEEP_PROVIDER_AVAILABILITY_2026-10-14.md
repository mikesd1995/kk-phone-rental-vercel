# Ultra Deep truthful provider availability — 2026-10-14

## Defect and minimal scope

Baseline `86d7915a48da10221df51d20c258d558f45d25bc` could classify an HTTP202/active challenge page as an ordinary completed DDG search with no evidence. The circuit also returned an empty array while open, which the executor labeled NO_EVIDENCE. Consequently an unavailable-only source task could have `executionProof.complete=true` and `executed_count=1`. A throttled waiter did not recheck a circuit opened by another request. Non-numeric cooldown options could disable suppression.

The Planner reproduced these boundaries independently in six deterministic offline cases. Root also observed a real HTTP202 with a challenge-form marker at12:16:11Bangkok: the baseline recorded NO_EVIDENCE and executed=true. Only the adapter is changed; executor, runtime, registry, monthly plan, known-miss corpus, detail helper, business writers and provider bindings stay intact.

## V11 behavior and preserved invariants

- DDG requires HTTP200 before parsing. HTTP202/204 and normal HTTP failures throw their fixed HTTP class; this strict status option is scoped to DDG. Response cleanup aborts/cancels the unread remainder without waiting indefinitely.
- The DDG-only lexical classifier examines actual form attributes, quoted/unquoted and entity-decoded IDs. The first duplicate ID wins and whitespace remains exact. Challenge/anomaly forms cannot lend result-looking evidence. Attribute strings/data-id, inert markup and raw-text content are not active form IDs. Comments/templates/raw-text elements are skipped without interpreting tag strings inside quoted attribute values as real markup. This is a bounded classifier, not a general browser DOM implementation.
- HTTP200 active challenge throws DDG_CHALLENGE; an open circuit throws DDG_CIRCUIT_OPEN. These failures cannot become NO_EVIDENCE or completed unavailable-only coverage. Error bodies, raw exception messages, challenge payloads and tokens are not added to public diagnostics.
- Circuit availability is checked both before throttle waiting and immediately before transport. An already in-flight request cannot be unsent; a waiter sends no new GET after known unavailability.
- Cooldown is finite,1–60seconds, default60seconds; non-finite options use the default. A skipped request does not renew expiry. At expiry, the next eligible call can execute. This is the existing local DDG backoff, not a new scheduler/runner.
- Legitimate HTTP200 empty searches remain NO_EVIDENCE/executed=true. Later existing bound providers retain their original order and may return evidence. A mixed task with a healthy empty Bing search can legitimately have executed=true while still GAP_UNRESOLVED; the DDG error remains explicit. No source/strict recall/FULL gate is weakened.

The generic entity decoder's default whitespace behavior is unchanged; its new explicit boolean preserveWhitespace option is used only for actual DDG form ID values. Pure result parsers and all existing named event extraction behavior are unchanged.

## Exact source and tests

Frozen adapter SHA256: `f423dcc73e8753afe1d8e828f3de9053bdb656756062813c84c11a7f67a02b8e`.

New availability test SHA256: `124071f5d0b58580388ed86988d50f5a3a666f72e4a568ba1a535cc8d90a60cf`.

Root focused six files:136/136. Full offline repository regression:1683/1683, zero failures/skips/cancellations. Code Intelligence selected40/40 supplementary tests. Syntax and diff checks exit0. Local environment is Windows/Node24.13.1; this is not Node20/Linux/hosted acceptance.

Initial RED:7fail/2pass in9availability tests; marker refinements2fail and independent marker/context composition failures were retained before repair. Final availability file has11tests, including queued transport suppression, legitimate empty/result preservation, fallback, finite cooldown/rearm, entity/attribute/raw-text/template contexts. The first full regression exposed only a timing-test ordering assumption: whichever waiter wakes first may receive403. The corrected test still requires exactly two total GETs and exactly one HTTP403/one circuit error, without constraining irrelevant waiter ordering. The failed log is retained.

Independent final Reviewer:136/136focused and39/39adversarial, zero scoped BLOCKER/MATERIAL; exact source/test hashes read back after testing. Attribute/entity/raw-text/context findings are closed. The response-status cleanup, queued suppression, legitimate empty/fallback/rearm and unchanged generic202 behavior were independently confirmed. Engineering RELEASE_READBACK remains absent regardless of offline test success.

## Fresh final-source availability readback

At **2026-10-14T05:25:46.911Z /12:25:46Bangkok**, one ordinary DDG-only query on this frozen source returned actualHTTP202 and a challenge-form marker. It now records **PROVIDER_ERROR /HTTP_202**, `executionProof.complete=false`, executed_count0 and zero candidates/detail reads. The baseline12:16receipt recorded NO_EVIDENCE/executedtrue for the same unavailable boundary. Provider recovery is **not** claimed; truthful coverage accounting is the verified improvement.

An earlier pre-reviewV11 two-query probe at12:19 retained existing Bing fallback: first DDG202 was an explicit error, second query was a DDG_CIRCUIT_OPEN skip with no additional DDGGET. Five total search GETs instead of two DDG sends plus four Bing sends; both tasks remained GAP_UNRESOLVED. This demonstrates suppression/fallback on that development snapshot and does not replace the final frozen-source one-query receipt.

## Alternative discovery that succeeded

The already-connected Exa tool returned provider-reportedHTTP402/creditlimit for exactly two ordinary queries. No URLs or detail reads resulted. This is CONNECTED_EXA_ONLY capacity evidence, not global channel absence. Bundled Python read-only package inspection found DDGS/trafilatura unavailable; no package/key/provider activation was performed.

Root then used the existing web search tool for one bounded batch of the same two queries. It returned actual official lead titles/URLs, without source seeds or expected dates. The existing guarded detail helper then performed **two actual public HTTP200 GETs at12:19:05–06Bangkok**, with no reconstructed provider markup and no reused fixture pages:

- TEEHENG GEN OF US:24October2026,16:00,ONE BANGKOK FORUM, https://deehuphouse.com/ .
- FORTREASURE BEYOND THE HORIZON:29November2026,15:00,MCC HALL The Mall Lifestore Bangkae, https://www.eventpop.me/e/173408/fortreasure-beyond-the-horizon-concert .

Original search URLs are preserved; Eventpop's aff parameter was stripped before transport. Named title/date/time/venue were read from actual pages. Public-source decoded-body hashes, timestamps, requests and detail receipts are retained without whole page/session payloads. Reads used pre-reviewV11 adapter6cc674 and the unchanged detail helper047242; later changes are DDG classification only and default event-reader/decoder behavior remains covered by regression. Do not relabel that read as a later source/time.

Scope is **FRESH_ADVISORY_WEB_DISCOVERY_AND_GUARDED_PUBLIC_DETAIL**. This is positive current advisory discovery/extraction, not a configured monthly provider recovery, canonical task run, full recall, final Verifier event truth, production publication or October strict known-miss2/2. Fortreasure is November. Candidate flags remain authoritative=false/verifier_required=true/production_writes=0.

## Authority, release and cross-chat evidence

Fresh12:11:08Bangkok live policy audit confirms one Active globalv4.9.44, same canonical bindings and active persistence escalation. No conflict was found for narrow error/backoff diagnosis provided failures retain explicit coverage debt and eligible existing fallback/rearm. Source-failure backoff policy is separate from the Sheets429 exact-read three-attempt rule; that rule is untouched. Runtime/current taskstate and deployment remain UNKNOWN/UNVERIFIED.

Changes stay on the existing feature branch/draftPR732 stacked on unmergedPR705. Mainmerge, productiondeployment, task/policy/Make/AppsScript/business/customer/financial writes and external messages are zero. Hosted exact-head success, real monthly/canonical natural evidence, coordinated business/cleanup release and owner visual/mainmerge/deployment approvals remain separate gates.

Packet: `../../outputs/recall-availability-20261014/` from repository root. It preserves Planner/auditor/Reviewer, initial failures, root/independent tests, pre/final live availability, Exa capacity, actual web discovery/detail, GitHubhead/jobreadback, sourcegate and physical hashmanifest. The latest cross-chat handoff records the eventual commit and exact hosted result; source documentation is dated evidence, never live MachineSOT authority.
