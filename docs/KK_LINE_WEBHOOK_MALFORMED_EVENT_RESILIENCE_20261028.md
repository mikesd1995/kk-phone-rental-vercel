# LINE Inbox Signed Webhook Malformed-Event Resilience — Source-only R1

**Date:** 2026-10-28 ICT  
**Owner safety fence:** Source/tests/docs only. No Production, LINE provider calls, Apps Script, Booking, customer, price, Drive ACL, secrets, billing, automation or merge/deploy changes.

## Problem reproduced by source inspection

Existing `server/kk-line-webhook.js` processed every element in a signed `events[]` array with `normalizeEvent(event)` and directly dereferenced `event.source`, `source.userId`, and `msg.type`. A valid HMAC body containing `null`, `event.source=null`, or `event.message=null` could throw rather than process the rest of the signed messages. `Number.isFinite(Number(timestamp))` alone permitted numeric dates outside the JS Date range, so `toISOString()` could throw `RangeError`. JSON `null` payload would throw on `payload.events`.

**This is a code-path/negative-test finding, not evidence that an actual LINE provider sent malformed events or Production failed.** The HMAC validation remains required before JSON processing. We intentionally do not alter real send/persistence/booking behavior.

## Minimal changes

- Normalize malformed non-object event/source/message to safe skip instead of throwing.
- Require a stable webhook event ID or message ID before calling the Inbox contract.
- Validate JS Date range prior to `toISOString()`. Missing, malformed or out-of-range timestamps use Inbox's existing safe receive-time fallback.
- Accept signed JSON bodies with null/primitive/no array as an empty no-write batch.
- Preserve HMAC constant-time comparison, duplicate receipts, group identity, redelivery and `persistFn` errors. A persistence failure must still prevent successful acknowledgement.

## Exact branch, test and blob evidence

- Base main: `57ec0227193ea186f034e1628ed331e33620dcc6` (refresh before any future merge).
- Isolated branch: `fix/line-inbox-signed-malformed-events-20261028`.
- Code commit `225b904e7d66d97c9b64cfbfcbdec21994eaef6b`; Git blob SHA `23116ae7eaa90967cd9cc1a9b2e474b957c146d1`.
- Test commit `035fcb26da8404bbb4e727916bc2776b5a6f64c0`; test Git blob `536858ac023b0defd9cc82418d8c34c815fa322a`.
- Exact dependency `server/kk-unified-inbox-contract.js` from main Git blob `a5c2963c55e178a0deb0a6059ca56c57b948deae`.
- Native **Node v22.16.0** syntax check for exact source and test: PASS.
- Native `node --test tests/kk-line-webhook-malformed-events.test.js`: **12/12 PASS, 0 failed, 0 skipped**. Test fixture uses synthetic IDs and a synthetic HMAC secret, never provider credentials or real customer data.
- All three local tested source/dependency/test blobs were verified with `git hash-object` against GitHub refs, then all 12 tests rerun successfully.
- Initial GitHub branch diff against main: 2 commits ahead, 0 behind; ONLY `server/kk-line-webhook.js` modified and new `tests/kk-line-webhook-malformed-events.test.js` added.
- Checked Codex Draft #744 and Booking #796 / UX #804 changed paths: none touched `server/kk-line-webhook.js` at readback. Recheck HEAD and file-level intersection before adoption.

## Release remains blocked

1. This proves only isolated pure Node handler behavior. It is not a GitHub-hosted full CI / real signed LINE provider E2E / inbox persistence / booking acceptance.
2. To adopt, Codex/owner should review this narrow delta against current main, verify webhook API route and real raw body buffer, run existing inbox test suite + negative signature tests in an approved no-cost environment, and confirm no duplicate reply/outbox side effects.
3. Do not merge into existing conflicting PR branches, deploy, fire customer messages, alter production booking or enable automation until Security #738/#718, Booking #796 and Release #49 safety gates are accepted.
4. No separate PR opened to avoid possible free-tier Preview/Actions triggering; branch and this document are durable for cross-chat review.

**Actual operational result:** one isolated handler source fix and 12 new targeted tests committed/read back. **Business V1 and Production remain HOLD.**
