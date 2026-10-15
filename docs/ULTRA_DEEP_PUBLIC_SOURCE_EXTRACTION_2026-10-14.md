# Ultra Deep public-source extraction and site-scope repair

Source baseline: `8d725db3e9e9925c8befe177324396d442bbd918` on `fix/ultra-deep-sweep-20261014`, stacked draft PR #732 on draft PR #705. This follow-up changes only the public web adapter, its regression tests and this document. It adds no dependency, provider binding, scheduler, business writer or production release.

## Reproduced boundaries

The earlier complete manual October probe still reported strict known-miss recall **0/26**, 1,397 candidates, 38 dated rows, zero venues and 47 truncated tasks. Its completion as a process is not FULL, canonical scheduled evidence or production acceptance.

Three bounded current Bing RSS queries returned HTTP 200 but irrelevant rows; the two positive `site:` queries returned no requested-host evidence. Separately, current official Dee Hup and Eventpop pages contained labeled/semantic show date, time and venue that the old `candidateFromPage` discarded unconditionally. DDG/Bing HTML also discarded explicit dates in actual result titles. RSS combined title dates with unrelated snippet sale dates. These are separate search-relevance and extraction failures.

## Implemented behavior

`KK_ULTRA_DEEP_PUBLIC_WEB_ADAPTERS_V9`:

- Enforces positive `site:host` scope against the actual canonical result host and subdomains. Parenthesized host syntax is supported; invalid explicit scopes fail closed. Ordinary queries without a positive site constraint preserve their scope. Host lookalikes and credential-bearing evidence URLs are rejected.
- Reads actual title dates from HTML results, prioritizes identity-bearing title dates in RSS, and conservatively separates explicit ticket-sale/publication markers from named show dates. It never substitutes the search query for a missing source title or uses a query date as source evidence.
- Extracts valid event-detail Open Graph start timestamps and named `Show Date`/`Event Date` and `Venue` definition-list fields. Generic descriptions, ticket-sale fields, article publication metadata and full-page date unions do not supply official-page event dates. Conflicting dates/time/venue stay unknown, including multiple showtimes inside one field combined with metadata.
- Removes comments, scripts, styles and balanced/nested templates before page identity/semantic extraction. Unclosed inert markup does not leak event fields.
- Decodes declared Thai legacy charset using the built-in `TextDecoder`, with the existing byte cap and timeout retained.
- Rejects partial final-day extraction from the tested unsupported English/Thai cross-month ranges and long day-first ranges. Existing bounded same-month expansion remains.

The current executor/runtime/known-miss date, authority, truncation, source-universe and Verifier gates are unchanged. The earlier V6 exhaustive-query and V15 honest-truncation repair stays intact.

## Validation and review

Twenty-one meaningful regression guards were added. Initial RED: 8 failures out of 33 adapter tests. Independent review found identity manufacture, invalid timestamp components, inert HTML leakage, time conflict loss, invalid-site scope widening and sale-date role mistakes; each additional repair has retained RED/GREEN evidence, including nested-template and metadata/time composition cases.

- Root final focused group: **98/98**, zero failures/skips.
- Root final full repository regression: **1641/1641**, zero failures/skips/cancellations.
- Syntax and diff checks completed with exit 0.
- Independent final focused review: **94/94**, zero failures/skips, **0 BLOCKER / 0 MATERIAL** in the bounded change.
- Independent adversarial matrix: **37/40** conservative expectations met, with **3 explicitly retained notes**, not 40/40. Query-only fabricated RSS proof now produces `GAP_UNRESOLVED`, zero candidates.

Reviewed adapter SHA256: `156891213c15b134184709ff8cc287309bca4a69a8d6197d41aab97b41216b80`. Reviewed test SHA256: `07d0dd28a9521a74b1b75dedf09b39d52752aa75de7b3ac7ad7f305f361546a6`.

## Current selected public-source readback

Fresh named site queries rejected off-domain RSS rows and continued through the existing DDG fallback. DDG found actual public event URLs. A subsequent **manual bounded read-only follow-up** used the existing `OFFICIAL_DIRECT` adapter on two URLs actually returned by those searches; neither title nor date was seeded from benchmark fixture answers.

At 2026-10-14T02:45:46–47Z (09:45:46–47 Asia/Bangkok), source extraction read:

| Actual public source | Extracted show fields |
| --- | --- |
| `https://www.deehuphouse.com/` | TEEHENG GEN OF US, 2026-10-24, 16:00, ONE BANGKOK FORUM |
| `https://www.eventpop.me/u/173408-fortreasure-beyond-the-horizon-concert`, redirected to the canonical `/e/173408/...` page | FORTREASURE BEYOND THE HORIZON, 2026-11-29, 15:00, MCC HALL The Mall Lifestore Bangkae |

Before extraction all three fields were null on both pages. Both now produce dated staging candidates with `authoritative=false`, `verifier_required=true`, `production_writes=0`. This proves the bounded extraction/fallback behavior, not automatic full monthly recovery, publication eligibility, final event truth or canonical scheduled runtime. No event was published.

## Retained limits and release gates

Supported positive-site grammar is host with an optional path prefix, and multiple positive sites use union semantics. URL-shaped `site:https://...` is not certified; path matching is a prefix, not a segment matcher. ISO cross-month endpoint parsing is historical behavior and does not prove all intervening dates. General prose date-role inference, image-only schedules and broad search relevance remain incomplete. Missing or ambiguous facts must continue to Verifier as unknown.

Current GitHub UI readback confirms Actions 2,000/2,000 included minutes and an Actions account budget of $0 displaying `Usage blocked`; billable usage is $0 after discounts, which is not an unpaid invoice finding. Exact-head hosted execution and Linux acceptance remain pending. Global Machine SOT policy v4.9.44 and persistence-escalation boundaries remain authoritative; this repair did not resume, replace or reschedule either canonical task.

Natural runtime evidence, capacity/truncation debt, coupled Apps Script creator/cleanup release, actual business return/upload evidence, owner visual acceptance, main merge and production deployment remain separate open gates. No production/business/task/policy/Make/customer/financial mutation was made. An engineering gate that requires release readback must remain BLOCKED until that evidence exists.

Detailed local evidence is saved outside the repo at `../../outputs/recall-provider-20261014/`, including the planner, before/after public-source receipts, root tests, initial/final independent review, adversarial matrices, exact GitHub/policy snapshots and billing UI readback. Public-source captures redact irrelevant session/nonce fields; original source hashes and saved-file hashes are recorded separately.
