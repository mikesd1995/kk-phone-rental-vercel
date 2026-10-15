# KK LINE Booking P0 — Replay, Owner Decision & Upstream Log Privacy

Date: **2026-10-15 Asia/Bangkok**. Scope: Draft PR **#742** (`fix/line-owner-decision-replay-20261014`), pre-fix Git HEAD `906000ee7786a9c024f44a32af3ddaa906a4ae71`. Does not touch Gemini PR #744 / #739 / #737. Never merge/deploy or modify Booking/Price/Stock, live LINE, Apps Script, Google Drive ACL, Production feature flags, Supabase, Make, or paid services without safety acceptance and owner approval.

## Independent root cause / observed failing cases (pre-fix)

Source-based **isolated V8 reproduced with synthetic markers only**:
- Apps Script error response `{ok:false,error:'PII_PHONE_0812345678',error_code:'LINE_KEY_0812345678'}` returned an Error with the marker in both `message` and `code` and HTTP status 403.
- LINE HTTP429 text containing a synthetic contact marker surfaced unchanged in `sendLine()` Error.message. The LINE webhook currently writes caught `err.message` to logs, creating a **potential PII/secret-reflection path** (not proof of an actual production leak).
- Canonical Apps Script owner decision under `main` `apps-script/Code.gs` uses document lock and emits literal boolean `idempotent_replay`; app version deployed currently unknown. PR #742 already rejects missing replay booleans and guards canonical Booking ID/status.

## Scoped code correction
1. `server/line-booking-owner-approval.js:appsScriptCall()` no longer imports untrusted `parsed.error` or `parsed.error_code` into Error diagnostics. Failed upstream action emits stable `LINE_BOOKING_UPSTREAM_FAILED`, constant message, retained HTTP status. Malformed-JSON guard remains `LINE_BOOKING_UPSTREAM_NON_JSON`.
2. `sendLine()` no longer copies provider response text into error. Retains `LINE_SEND_FAILED` and HTTP status, never echoes customer LINE IDs or provider bytes to webhook error logs.
3. For callback `decision`, if canonical writer supplies a conflicting `data.decision`, fail before customer/owner sends; absent optional field remains backward-compatible. Existing strict `idempotent_replay:boolean`, matching Booking ID/status, authorized owner HMAC and customer-first push order remain.
4. New synthetic no-network regression suite `tests/line-booking-owner-approval-upstream-privacy.test.js` covers rejected HTTP/200 business writes, malformed JSON, push/reply failure, reject vs approve, conflicting decision, replay, old-compatible readback, no untrusted PII in diagnostics, no duplicate acknowledgements.

## Verification of staged exact-source candidate
- `25/25` existing + new authored node:test callback cases PASS, **120 assertions**, run in isolated JavaScript V8 using stubbed crypto, `Buffer`, `node:test`, `assert`, read-only extracted Apps Script source, LINE/App Script network mocks only, with no real provider calls. The 11 pre-existing owner tests, 4 replay tests and 10 added privacy/recovery tests were included.
- **THIS IS NOT NATIVE NODE.JS, hosted CI, full npm test, live webhook/App Script integration or actual provider-delivery proof**. Native Node 20+ focused and all `npm test` / `npm run check`, 10-route integration, independent review, Apps Script deployed-version comparison and owner UAT remain release gates.
- Same-branch changes only; no changes to Gemini-owned source. No new dependencies/lockfile/workflows; new test is automatically included by `npm test` glob when legitimately executed.

## Outbox/receipt limitation and deliberate non-scope
- Decision committed in Apps Script can precede an unsuccessfully sent customer LINE message. Replays deliberately produce `ALREADY_APPLIED` + `requires_manual_delivery_review`, never resend blindly. **Exactly-once delivery is not solved** and requires separate durable outbox/receipt review of #700; v2 immutable approval version is separately gated in #706 and touches Apps Script source shared with Gemini #739.
- Do not auto-merge or transplant #700/#706 code into #742 or #744. Their shared owner approval files diverge. Require isolated final integration tests after Gemini is finished.

## Known deploy / cost boundary
- This change is source/test/docs only in Draft #742; commit uses `[skip ci]` to avoid unwanted automatic PR runs. Public repository GitHub-hosted standard runners can be free, but this is not authorization for automatic paid providers or artifacts. Do not claim Hosted CI green without exact HEAD logs.
- No Production deployment, Google Sheet permission change, live customer delivery, actual booking status mutation or external billing operation authorized.

## Rollback
- Revert only this scoped source/test/doc commit on `fix/line-owner-decision-replay-20261014` using a fresh expected HEAD; do not reset Gemini or `main` and do not replay live webhook decisions.

## Independent POST-COMMIT test and readback (15 October 2026 ICT)

- Implementation Git SHA: [`e50471f0e9202a983e2a148b1e217c5870e8b1b9`](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/e50471f0e9202a983e2a148b1e217c5870e8b1b9).
- Exact GitHub blob SHAs fetched AFTER Git push: `server/line-booking-owner-approval.js` **`3d8c4f97bd93104fa8ef7ab2a72c9ed1c4c16329`**; `server/line-booking-intake.js` **`c3a755e0b04929436e40ce55a6b273ab1da2b4a8`**; preexisting owner test **`0598dc0db98e19604914a0cb2174613a392977ef`**, replay test **`ca8ca1c3b1b8d6da95a33d880cd31e56d88c289d`**, newly committed privacy/recovery test **`ead1a32b36f8b8979173ef3c12ccceb46a308bc3`**.
- Independently reran **25/25 PASS, 120 assertions, 0 failures** from those exact fetched GitHub source/test bodies using isolated V8 mocked `node:test`, assert, crypto, Buffer, Apps Script source, and provider fetch. No external calls. **Native Node 22 exists in analysis container but full GitHub checkout/remote raw download blocked by host DNS; do not mislabel V8 as native Node CI**. The remote PR did not execute hosted tests for this SHA.
- Atomic compare to pre-fix `906000ee7786a9c024f44a32af3ddaa906a4ae71` confirms exactly **3 changed paths**: one existing runtime module, one new test file, one new dated document. No GitHub workflows, scripts, package.json or lockfiles edited.
- Read-only GitHub Actions exact-head query `/actions/runs?head_sha=e50471f0e9202a983e2a148b1e217c5870e8b1b9`: **0**; combined statuses **0**. Not a GREEN CI result.
- Read-only Vercel full project deployment list: **81 objects**, newest remains **READY Production `dpl_7TYLb87ir9qNzXRtkeb49543dwVm`**, source main `d6dc3bfe4cc0c4dd6fdfec407823752da0572464`, created 2026-10-12 17:49:47 UTC; new #742 SHA not found. This is not a measurement of billed storage GB.
- Gemini scope isolation freshly checked after its PR #744 advanced to `44833139ae288a438fb7608476f40feb6bc1d818` (49 changed files then): **0 filenames overlapping** with #742, #739 and #737; no writes to these PRs. Separate #700 and #706 DO overlap the owner-approval module and require later integration review, but are outside this isolated change.
- Future gate: real Apps Script deployment/version and LINE webhook delivery must be independently read back, no blind replay; native `node --test` focused 25, `npm run check`, full `npm test`, CI/safety/owner approvals required before merging. Exactly-once provider receipt/durable outbox remains BLOCKED.

## 15 October 2026 — Native Node CI exact-main comparison and transport exception closure

**Hosted run [38674479946](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38674479946)** on prior `#742` SHA `a76f71bf673b0d70d189f3a733fd6709210ac579`:
- Exact candidate checked out and Node 20 + Booking E2E **57/57 PASS**, syntax PASS; full `npm test`: **1,515 total / 1,494 PASS / 21 FAIL** (exit 1).
- Pinned native baseline `main@d6dc3bfe4cc0c4dd6fdfec407823752da0572464`, same runner, same Node 20, source-only: **1,498 total / 1,477 PASS / 21 FAIL**.
- Names of **all 21 failing cases are identical**, introduced names `[]`, resolved names `[]`, `same_failure_set=true`; no new failed test attributable to #742. The 21 pre-existing failures cover Admin/CRM schemas, scanner, storefront legacy UX and content bridge; they remain full-suite release BLOCKERS. **Do not weaken or edit other subsystem files while Gemini owns master cleanup.**
- The PR-only full-suite comparison is scoped to PR #742; normal Booking CI stays targeted for future PRs. It remains fail-closed (full test failures cause the workflow to fail). Safety post-condition executes even after test failure; no provider env/key injection, deployment, external writes or paid resources.

**Second-stage transport exception patch** staged in this branch:
- Apps Script `fetch` rejection / response-body `text()` rejection now return sanitized `LINE_BOOKING_UPSTREAM_TRANSPORT_FAILED` with only numeric HTTP status when known.
- LINE provider `fetch` rejection returns sanitized `LINE_SEND_TRANSPORT_FAILED`; no upstream exception message reaches webhook logs.
- 4 additional synthetic no-network Native Node cases ensure thrown exception privacy and no owner reply after a failed customer push. Existing replay/decision/HTTP failure guards remain unchanged.
- Final Native Node CI outcome must be read back on **new exact HEAD** before acceptance; `[skip ci]` is not used for the source patch so Booking CI can execute. **No release/merge/deploy approved.**


## Native GitHub-hosted Node 20 FINAL source-gate evidence (2026-10-15 Asia/Bangkok)

**Code-fix / exact tested HEAD:** [`2479669d6aa6fc9a5d46730a1ded2ebf078619e4`](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/2479669d6aa6fc9a5d46730a1ded2ebf078619e4). **Automated run:** [#38674739542](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38674739542), job [#116225654794](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38674739542/job/116225654794), event `pull_request`. Runner: standard public-repo `ubuntu-22.04`, Node 20, `permissions: contents: read`, checkout exact head with credentials not persisted, no packages installed, no uploads, no production credentials.

| Exact native check | Result |
|---|---|
| Candidate checkout SHA / syntax | PASS |
| Booking E2E (10 targeted files including all LINE replay + privacy + transport cases) | **61/61 PASS, 0 FAIL** |
| Full Candidate `npm test` | **1,519 tests: 1,498 PASS, 21 FAIL** |
| Independent pinned main baseline `d6dc3bfe4cc0c4dd6fdfec407823752da0572464` `npm test` | **1,498 tests: 1,477 PASS, 21 FAIL** |
| Exact failed-test name comparison | **Same all 21**, `introduced_failure_names=[]`, `resolved_failure_names=[]` |
| Post-condition: no provider/production activation env | **PASS** |
| Combined workflow final | **FAIL/HOLD** because Full Suite remains red (did not weaken acceptance). |

**Interpretation:** The LINE candidate adds 21 tests relative to pinned main with 21 more PASS (full suite), while **all 21 failing names are unchanged**. The 21 are baseline failures, not new LINE regression evidence. Full-suite acceptance is still BLOCKED; an unchanged baseline failure is not a waiver of the global release gate.

### Exact baseline failing cases (native GitHub logs; do not modify in this LINE branch)

1. fallback GViz ranges start at each real schema header row
2. Admin regression workflow covers PR and main push
3. admin Inbox has readable timestamps, non-text fallbacks and read-state cleanup
4. Unified Inbox task routes to the actual Admin and LINE/X integration surface
5. batch bridge fail-closes when selected hooks overuse the same generic prepare-device archetype
6. bridge comment persists invocation evidence without exposing internal candidates
7. Inbox reads reuse the existing admin guard and remain zero-write
8. next month resolves deterministically from supplied date
9. smart operational query plan stays intentionally small and leaves exhaustive coverage to audit
10. V25 Vercel-native path requires authenticated production OIDC control before Full Loop
11. V26 machine ingress is authorization-queue gated and cannot accept arbitrary month or commit
12. scanner ingress GET acceptance is queue-authorized and permanently read-only
13. production runtime completes zero-write when every verified candidate is safely terminally skipped
14. bridge invokes the real x_posting_plan gateway route and persists invocation evidence
15. Booking form keeps the daily path short and hides overrides under Advanced
16. new storefront assets are cache-busted
17. V5 language switch binds hero, benefits and event-discovery DOM
18. mobile modal scroll lock is valid source and restores the captured position
19. V5.8 uses proprietary editorial optics rather than literal trend decoration
20. V6.1 conversion polish keeps trust, CTA hierarchy and floating contact out of the left content rail
21. V6.5 owner mobile polish reduces density and makes hierarchy intentional on normal phones

Other current task changes: `appsScriptCall()` catches thrown `fetch` and `response.text()` exceptions and returns only `LINE_BOOKING_UPSTREAM_TRANSPORT_FAILED` and optional numeric status; `sendLine()` catches transport exceptions and returns `LINE_SEND_TRANSPORT_FAILED`. This protects private data in thrown transport errors that the previous HTTP-only sanitization did not cover. Customer-first push, static owner identity/HMAC, canonical readback, literal Boolean replay guard and no replay-resend remain in place.

### External readback / hard HOLD boundaries
- Direct Vercel inventory shows **81 deployments** with most recent Production **READY `dpl_7TYLb87ir9qNzXRtkeb49543dwVm`**, dated 2026-10-12T17:49:47Z on `main d6dc3bfe...`; none of the new #742 CI commits appears as a deployment. No actual storage-GB usage was measured.
- This work updates only Draft PR #742. Do not merge/deploy or edit Gemini-owned #744/#739/#737. No actual LINE messages, Apps Script/Sheets/booking/inventory writes, Supabase migrations, ACL changes or paid-service calls made by this work.
- Native Booking E2E test pass means **source-level acceptance of the targeted system**, not provider end-to-end delivery. Pending gates: baseline 21 full failures resolved by owning subsystems (many assigned to Gemini), verified currently deployed Apps Script owner-decision version, recipient delivery receipt/durable outbox (#700), approval version fencing (#706) and explicit owner release permission.
- Rollback: revert only new #742 commits on its branch, do not reset main or the Gemini branch; never replay real LINE webhook events blindly.
