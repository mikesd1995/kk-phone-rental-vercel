# Ultra Deep October 2026 — date-less Independent Reference Recovery fix

**Scope:** Selected user task #4, recovery of event references dropped before Source Verifier because snippets/RSS/search results omitted the structured event date.  
**Date:** 2026-10-13 ICT. **Repo:** `mikesd1995/kk-phone-rental-vercel`, branch `audit/ultra-deep-panpuri-oct21-20261013`, Draft PR #720, Issue #719.  
**Authority:** Read-only code and tests; **zero Production writes, no Sheet/Booking/price/stock changes, no paid provider calls, no merge, no deployment**.  
**Acceptance:** **SOURCE PATCH AND ISOLATED JS REGRESSION PASSED; HOSTED NODE/CI AND LIVE PROVIDER FULL ACCEPTANCE STILL HOLD**.

## Root cause — two independent upstream drops

In `server/kk-ultra-deep-runtime-runner.js` V15, `referenceScopeDecision` immediately returned `NO_STRUCTURED_DATE` for a reference with `event_date:null`. Independently, `recoverEligibleReferenceCandidates` skipped every row that failed `Reconciliation.hasComparableEventIdentity`, which requires both title and `YYYY-MM-DD` date. This prevented promising independent Reference hits (including named-artist brand pop-ups or exact event detail pages) from reaching the existing Verifier V5, even though its `prefilter` accepts strong date-less leads and its `verifyHtmlCandidate` requires a matching source `Event.startDate` before commercial eligibility.

Separately, `reconcileCandidateSets` ignored unstructured references, which could allow eligible unresolved date-less leads to disappear from completeness accounting. Finally, the V27 Direct path returned `BLOCKED_DISCOVERY_NOT_FULL` *before invoking any verifier* when FULL failed, so merely adding date-less references without a read-only inspection lane would never fetch the source during a blocked scan.

## Changes on the isolated Draft PR

### 1. Runtime Runner V16

- Date-less scoped lead can be admitted **only** when it has a non-generic, event-specific HTTPS detail URL, an event/artist-pop-up identity, explicit Bangkok/Greater Bangkok location evidence from the lead itself (not the scan query), and an explicit target month context. Never invent a date from the month query.
- Reject off-month and impossible calendar dates, generic home/search/category/group/calendar pages, insecure URLs, foreign cities and no-location leads. Harden trusted ticket-site hostname boundaries against lookalikes (e.g. `fakeeventpop.me`).
- Mark allowed date-less leads `SOURCE_DATE_PENDING_PRIMARY_VERIFIER`; recovered candidates retain `event_date:null`, `date_pending_verification:true`, `candidate_origin:INDEPENDENT_REFERENCE_RECOVERY`, `verifier_required:true`, `authoritative:false`.
- Stable dedupe uses canonical source URL + event series title + venue; never merge two different show dates using source URL alone. Existing dated-reference match behavior remains.
- Add `reference_undated_recovered_count`, `reference_pending_source_date_count` and explicit `REFERENCE_SOURCE_DATE_VERIFICATION_PENDING` blocker, without fabricating FULL/coverage counts or provider receipts.

### 2. Independent Reconciliation V3

- An **explicitly scoped eligible** date-less independent reference now contributes `pending_source_date_count` and `SOURCE_EVENT_DATE_PENDING_VERIFIER` to missing candidates.
- `complete=false` until source-backed verification resolves the identity/date; no matching solely by title, common source URL, or search month.
- Unscoped generic calendars lacking dates remain informational and do not create fake reconciliation gaps.

### 3. Candidate Verifier V6

- Strong date-less reference checks `Event.startDate`, matching **JSON-LD exact-event title**, source-originated Bangkok-area `Place/address`, and poster/authority before commercial acceptance; wrong event/foreign venue is HOLD even if the search snippet claimed Bangkok.
- Prioritizes matching Event titles when a source page embeds multiple JSON-LD Events during the same month.
- Accepts short distinctive artist identities such as BTS/NCT/VVV while rejecting unrelated band names; preserves the source-title and venue gates.
- Named-artist PAÑPURI pop-up is always `HOLD_OWNER_ARTIST_POPUP_REVIEW` until organizer access/photography/lens restrictions and owner authorization, even if the HTML contains date/venue/poster. **Owner-provided image is not proof AI independently discovered the event.**

### 4. Direct Read-only V28

- When FULL is blocked, inspect at most **four** `date_pending_verification` independent references via Verifier (two concurrent source fetches with a 5-second timeout each). Return only sanitized `reference_source_date_review` with counts, HOLD reasons and `authorized_to_publish:false`. The overall result **stays** `BLOCKED_DISCOVERY_NOT_FULL` and `production_writes:0`.
- **Commit-intent blocked FULL** bypasses this review entirely and makes **zero** write/fetch attempts through the diagnostic lane. This is not a way around the final Verifier, pricing, booking-lock, tombstone or governed writer gates.
- The current Full Scan still needs a separate verified source-date readback/eligible discovery rerun before FULL can be declared; review-only diagnostics are not a completion certificate.

## Regression and evidence

- New `tests/kk-ultra-deep-reference-date-recovery.test.js`: **24 cases**, including snippet missing date, named pop-up, exact ticket URL, impossible/off-month dates, generic/counterfeit host, missing/foreign location, date-less duplicate, different event identities, existing multi-date dedupe, FULL still blocked, unscoped calendar exception, verified JSON-LD date, wrong JSON-LD title, foreign JSON-LD venue, wrong month/missing source date, multi-event JSON-LD selection, owner access HOLD, runtime provider-to-Verifier queue, real `Direct.run` mocked dependency behavior for read-only vs commit-intent.
- Updated `tests/ultra-deep-panpuri-popup-reference.test.js`: replace outdated assertion that all missing-date leads are excluded with guarded Verifier-only admission test.
- `package.json`: register new test within existing `test:ultradeep:recall` and include new test/source syntax checks.
- **Isolated exact-source V8 execution: 90/90 pass across five relevant files**: new date-less recovery suite, existing PAÑPURI popup suite, Reconciliation suite, Runtime Runner suite and Candidate Verifier suite. Mocks supplied Node builtins, URL, Web adapter and fake Provider/HTML; it is **NOT** a Node/npm/hosted GitHub CI pass or evidence that live public providers found any October event.
- Native Node v22 was present in the local container, but the private GitHub branch could not be cloned there (`Could not resolve host: github.com`). No exact-head native Node test of the full repo was obtained in this workflow.
- Previously observed exact-head GitHub Actions: no executed step details and `BlobNotFound` Logs; zero-cost CI/Node acceptance is still an independent HOLD gate. Never report these new tests as hosted CI green.

## Invariants and remaining steps

1. Maintain `production_writes=0`, `authoritative=false`, no auto pricing/event creation, booking mutation, owner-hidden resurrection, Paid-provider calls or release flag changes.
2. Run exact-head native Node 20+ `npm run test:ultradeep:recall` and `node --test tests/kk-ultra-deep-reference-date-recovery.test.js` on a trusted free runner. Require actual stdout/exit code, not inference from V8 isolated tests.
3. Run one or more read-only provider-based October shards with source receipts. Confirm date-less Reference hits really reach Verifier and cases lacking source `Event.startDate` remain HOLD, then verify the full 12-shard evidence independently. Keep `FULL=false` while any independent unresolved reference remains.
4. For PAÑPURI 21 Oct, preserve the owner's existing Core event and 490/590 package prices; independently check official date and access/recording/lens rights before any approval. Do not auto-backfill Tracker using fabricated scanner origin.
5. Investigate the separate GitHub Actions Runner `steps=[]`/404 BlobNotFound issue and document its infrastructure remediation; this source patch does not repair Runner access.
6. Perform governed end-to-end acceptance, duplicate/booking/tombstone checks and exact storefront readback before any release. PR #720 stays DRAFT and not deployed.

**Bottom line:** The pre-Verifier loss of date-less references is repaired at source level, with safety-gated read-only Verifier inspection. Production remains unchanged, source-backed Full October discovery and native CI remain unverified.


## Post-patch GitHub CI readback (2026-10-13 ICT)

GitHub PR #720 still DRAFT / OPEN / UNMERGED. Read the latest returned PR commit `3ff446b3c8fad7e4c9d707bf2ff71b194891f830` and the exact commit's PR-triggered workflow runs:
- **Vercel Deployment Source Contract**: run `38390966537`, job `115274367665`, status completed / conclusion failure; job `steps=null`, `logs_url=null`; attempting job logs returned 404 `BlobNotFound`.
- **Ultra Deep V2 Acceptance**: run `38390966568`, job `115274368371`, completed / failure; `steps=null`, `logs_url=null`; attempting job logs returned 404 `BlobNotFound`.

These job results provide **no evidence that source Checkout, offline dependency preflight, Node 20/24 syntax or regression tests actually ran**. It is not legitimate to attribute these particular failures to the new source code or to mark them as passed. Incident is separate GitHub Actions/runner/service access investigation. The CI source fix from prior Phase 4 on the same Draft branch also stays unaccepted until actual executor receipts. **This source-level task is repaired, but the project is not ready for merge/release.**
