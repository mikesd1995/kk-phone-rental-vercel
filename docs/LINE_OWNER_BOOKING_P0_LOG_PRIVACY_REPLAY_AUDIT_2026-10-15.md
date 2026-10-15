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
