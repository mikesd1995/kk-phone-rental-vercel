# LINE Webhook Signed Envelope — Isolated Production Entrypoint Guard (2026-10-29 ICT)

## Scope and Codex ownership fence

- Based on **exact main** `57ec0227193ea186f034e1628ed331e33620dcc6`.
- Branch: `fix/line-entry-signed-envelope-preflight-20261029`.
- Modify only `api/line-webhook.js`; add `tests/line-webhook-signed-envelope.test.js` and this documentation file.
- **No change to** `server/line-booking-webhook.js` (owned/modified by active Codex Draft #744), `server/kk-line-webhook.js`, Apps Script, Booking, payments, Google Sheets, Drive ACL, Production, secrets, CI or automations.
- Before the write, inspected PR #744 current changed-file list: neither new path appears. Recheck overlap and latest main immediately before any integration; absence of file overlap does **not** guarantee no semantic conflicts.

## Reproduced source problem

Production entrypoint `api/line-webhook.js` did enforce **1 MiB** raw LINE request size but forwarded signed JSON to `server/line-booking-webhook.js`. Both the current main booking handler and Codex Draft #744 use `Array.isArray(payload.events)` without checking whether `payload` itself is null. A valid-HMAC JSON `null` could throw rather than return a controlled 400. Other malformed signed top-level shapes were previously treated as empty event batches (200), masking bad input. This is a code path finding; **no evidence that LINE sent such input in Production**.

## Change

The API entrypoint now verifies the HMAC-SHA256 using the **raw bytes** of the bounded request before any JSON parsing or schema check. It then rejects malformed JSON or any top-level value that is not an object containing `events: Array`, returning **400**. Wrong HMAC returns **401**. It preserves the previous raw body-size **413**, delegates normal signed envelopes to the current booking handler, and delegates missing LINE secret/token to the existing 503 configuration path. HMAC is currently computed twice on admitted requests (entry + booking handler), deliberately avoiding a change to Codex's booking handler; this should be consolidated during later approved integration if safe.

The change **does not** add an arbitrary event-count limit, modify booking eligibility, change persisted data, or attempt automatic retries.

## Exact source / tests / native verification

| Evidence | Value |
| --- | --- |
| Main original `api/line-webhook.js` blob | `3698d9ff23d872bec00e9bca2680e10f7749f9ca` |
| Updated `api/line-webhook.js` blob | `6024548127ec7a0342919cbe989fb804052c5ac8` |
| New `tests/line-webhook-signed-envelope.test.js` blob | `133ac92707810e90c396e897b97100c82cd0b829` |
| Native Node version | `v22.16.0` |
| Syntax checks | both updated source/test **PASS** |
| Local `node --test tests/line-webhook-signed-envelope.test.js` | **13 PASS / 0 FAIL / 0 SKIP** |

**Verification method:** Restored the original API entrypoint file in an isolated local directory and verified its Git blob SHA matched GitHub `main`. Applied the narrow patch and verified its Git blob SHA matched the new GitHub branch. New test Git blob also matched the GitHub branch. Tests use synthetic HMAC credentials and a **synthetic Booking Handler stub**, so they prove API-envelope routing and negative case admission only — **not** full real booking handler or LINE provider end-to-end. The test itself is committed for repeatable native CI verification with the actual repository dependencies.

Test coverage includes valid empty and benign-event envelopes, valid signature on Buffer/stream request body, wrong/mismatched signature, signed invalid JSON, signed `null`, primitive/array top-level payloads, missing/non-array `events`, actual API 400/401, unchanged oversized raw-body 413, missing-configuration pass-through, and `bodyParser:false`.

## Release gates / required next validation

1. Run the existing repository `tests/line-webhook.test.js`, `tests/line-booking-inbox-safety-integration.test.js`, `tests/kk-line-inbox-tee.test.js`, plus the 13 new cases in full repo CI pinned to the exact accepted SHA, after Codex path-intersection review.
2. Add a synthetic **real handler** acceptance covering malformed signed input and non-mutation of Booking/owner notification/LINE output; verify actual LINE provider event shape and HMAC headers.
3. Check interaction with Codex #744's `server/line-booking-webhook.js` changes, then integrate only through the approved release candidate.
4. Existing P0s remain OPEN: Core Private Reader #738/#739, Poster ACL #718/#721, Booking #796, Scanner #777 and release #49.

**No Merge/Deploy, Production/environment, Booking/customer, payment, spreadsheet, ACL, LINE send, external automation or paid service writes occurred.** Branch-only source/tests/doc delivery.

## R2 independent source-level acceptance (2026-10-29 ICT)

**Purpose:** verify that malformed or unsigned inbound webhook content is rejected by the **actual `api/line-webhook.js` entrypoint source** before any downstream booking handler invocation, and that valid signed envelopes still delegate. This is a separate boundary acceptance layer, not full LINE provider E2E.

- Added `tests/line-webhook-no-downstream-on-reject.test.js`, **exact Git blob `d08cd31a049f27497bf958c32144b2df1fab2a2e`** (verified via GitHub readback against native-tested local file).
- The test loads the **unchanged exact source blob `6024548127ec7a0342919cbe989fb804052c5ac8`** from disk using an isolated Node VM. Only the delegated Booking Handler is replaced by an isolated counter stub. No network, secret, customer data, persistence or real LINE sends occur.
- Native Node **v22.16.0**: `node --check` passes for the entrypoint and both test files; `node --test tests/line-webhook-signed-envelope.test.js tests/line-webhook-no-downstream-on-reject.test.js` returned **23/23 PASS, 0 FAIL, 0 SKIP**. The previous test blob `133ac92707810e90c396e897b97100c82cd0b829` also matched GitHub exactly.
- Negative-path checks assert zero delegate calls on valid-HMAC `null`, missing/non-array `events`, invalid JSON, bad/absent HMAC, raw request over 1 MiB, and oversized streaming body. Valid signed `events:[]` delegates once and preserves streamed bytes. Missing token and non-POST intentionally delegate to the Codex-owned handler, preserving its existing 503/405 ownership.
- **Baseline regression sensitivity:** the exact old main entrypoint blob `3698d9ff23d872bec00e9bca2680e10f7749f9ca` (also verified with native `git hash-object`) produced **6/10 PASS, 4/10 FAIL, nonzero exit** against the new isolation tests; the patched entrypoint produced **10/10 PASS**. Baseline failure proves this suite detects a real improvement instead of only asserting unchanged behavior.
- **Repo and Codex ownership:** current main still `57ec0227193ea186f034e1628ed331e33620dcc6`; Codex Draft #744 still `a742fcb2a0f373eacccf9f4f8a31a8a133a68667`. Git compare prior to this addendum: branch **4 commits ahead / 0 behind**, exactly four paths (API modified + 2 test files and 1 report added). No path overlap with #744 changed-file list.
- **Not yet accepted:** real booking handler dependency closure and E2E, native full repository suite, hosted exact-head CI, PR reviewer approval, customer privacy cutover, Production release or runtime LINE provider verification. No PR auto-created to avoid unapproved Preview/Actions cost. Any eventual cherry-pick must rebase against newly refreshed HEAD and verify no semantic contract conflicts.
- **Release classification:** **ISOLATED TESTS PASS / RELEASE HOLD**. Core security #738, Drive poster ACL #718, Booking #796, Scanner #777 and final gate #49 remain unresolved.

No Production, Booking, LINE provider, Secrets, customer, Google Sheets, ACL, financial values, Scanner/Automation, Merge, Deploy or billing changes were performed.

## R3 — Cache-safe rejection, static privacy logs, blank-config parity (2026-10-29 ICT)

**Reason for work:** The R2 API signature preflight correctly rejects untrusted requests, but its early 400/401/413 responses bypass the inner booking handler's `Cache-Control: no-store` and `X-Content-Type-Options: nosniff` headers. The outer raw-body exception handler also logged arbitrary stream `error.message`, a possible untrusted-data leak to server logs. Its environment check used truthiness rather than the booking handler's trimmed secret/token readiness, misclassifying whitespace-only configuration.

**Patch in only `api/line-webhook.js`:**
1. Set both defensive headers at the outer request entrypoint before any early return, guarded for minimal synthetic response objects that do not implement `setHeader`.
2. Log only `size-limit` or `read-failed` with the static `[line-webhook-raw-body]` prefix; do not log any thrown provider error message or raw body.
3. Use trimmed values for `LINE_CHANNEL_SECRET` and `LINE_CHANNEL_ACCESS_TOKEN` when deciding whether to run early signed-envelope validation. If either is blank, delegate to the inner handler's existing configuration check and its 503 response.

**Native acceptance and regression evidence:**
- New isolated test file: `tests/line-webhook-security-response.test.js`, SHA-verified Git blob **`7f2fed7386076d77483bcd96a9825f3d0065b6a2`**.
- Final patched source: `api/line-webhook.js`, SHA-verified Git blob **`7d29d37c1aa7888a4c19f1aa15a0bfb63db9ca31`**.
- Native Node **v22.16.0**, `node --check` for both files PASS; `node --test tests/line-webhook-security-response.test.js`: **10/10 PASS, 0 FAIL, 0 SKIP**.
- **Mutation witness:** restore the exact previous R2 source Git blob `6024548127ec7a0342919cbe989fb804052c5ac8` and rerun the same suite: **1/10 PASS, 9/10 FAIL, exit 1**. Restore patched source blob: **10/10 PASS**. Both local source blobs were verified with `git hash-object`, and the GitHub updated source/test blobs matched the same local hashes.
- Cases cover unauthenticated 401, signed malformed-envelope 400, oversized 413, secrets in simulated stream error messages (must not echo), valid signed stream delegation, whitespace token/secret delegation, GET path unchanged, mixed-case signature header, and backward compatibility with response mocks lacking setHeader.
- **Scope limitation:** new R3 source VM tests substitute the downstream Booking Handler; they do **not** prove production header behavior on Vercel, actual LINE reply/token delivery, full repository CI or real customer Booking. Prior R2 **23/23** acceptance was run against the earlier R2 source SHA; do not claim 33/33 were rerun on the R3 SHA without doing so.
- **No new CI workflows, hosting, secrets, credentials, Production, customer, Booking, price, payment, ACL or automation writes.** One existing source file and one additional test file were changed/added; neither touches Codex #744's `server/line-booking-webhook.js`. There is no automatic merge/deploy.

**Remaining release acceptance:** Codex #744 exact-HEAD integration, `node --test` of all three new entrypoint test files plus repository LINE/Booking test suites at the merged candidate SHA, authentication/authorization negative checks, no-customer-write synthetic booking E2E, owner approval, and Security/Poster/Booking P0 gates #738/#718/#796 before Production.
