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

## R2 — bounded signed webhook inputs and native final readback

- Following targeted test discovery, the source now **skips signed message-type events with no valid `message` object** instead of creating empty inbox items; existing legitimate message handling is unchanged.
- Introduced `MAX_WEBHOOK_BYTES=1,048,576` and `MAX_WEBHOOK_EVENTS=100` resource bounds. Oversized raw bodies return 413 `REJECTED_PAYLOAD_TOO_LARGE` before JSON/HMAC work; signed batches with more than 100 events return 413 `REJECTED_TOO_MANY_EVENTS` before any persistence. Both paths report `writes:0`. This conservative resource cap must be reviewed against the real provider delivery limits before Production rollout.
- Appended four tests for missing message objects, oversized raw bodies, event-count rejection with zero persistence, and valid 100-event batches.
- Final source commit `684b077ecf8fc41e16ccf807c8c430c4b2e3472a`; GitHub/local exact Git blob **`b9edae7a9a2ee0d6d4d493396ecb1ad07e564765`**.
- Final test commit `5bceba982d6e2217ebc14c9002cf2f116b3a23ad`; GitHub/local exact Git blob **`48e93e8792406a630180276977b65391918198d8`**.
- Native Node v22.16.0 on source + test + exact Git-blob inbox dependency: both `node --check` commands PASS; `node --test tests/kk-line-webhook-malformed-events.test.js` **16 PASS, 0 FAIL, 0 SKIP**. No npm install.
- Baseline regression sensitivity verified: earlier exact main handler blob `b25feba60510cc2ea80e99ecaa77a03152b76d40` intentionally swapped into the isolated local fixture produced **8 PASS / 4 FAIL**, nonzero exit as expected. Restored patched exact Git blob `23116ae7eaa90967cd9cc1a9b2e474b957c146d1` and 12/12 PASS before R2 improvements. No GitHub main source was changed during the mutation.
- HMAC invalid signature, missing persistence 503, duplicate delivery receipt, group identity and upstream persistence error semantics retained in tests.

**No final acceptance claimed:** Native unit tests do not prove live provider quotas, full repo/Actions CI, actual LINE inbound/outbox delivery, customer privacy, or global release readiness. All customer/Production/ACL/Booking changes remain prohibited without Safety Gates.
