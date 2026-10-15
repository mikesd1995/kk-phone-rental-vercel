# KK Stable Auto V1 — Apps Script Private Core Reader untrusted-error privacy hardening

**2026-10-16 Asia/Bangkok | Draft PR #744 | SOURCE ONLY — RELEASE HOLD**

## Confirmed defect
Existing `server/core-sheet-apps-script-reader.js` catches provider exceptions and blindly rethrows any exception with `error.code` beginning `CORE_APPS_SCRIPT_`. An untrusted network transport or response hook could set that code and attach a confidential-looking message, and the full provider error message would propagate to a caller. Native Node reproduction used **only a synthetic marker**, no real customer data or tokens. On the previous source blob `62369d1cbd5bf494205f45923885958b30395790`, injected `code:'CORE_APPS_SCRIPT_UNAVAILABLE'` + synthetic confidential message was indeed returned as the exception message.

## Exact code repair
A module-private `WeakSet` marks only the errors produced by local `err(code)` factory; the catch forwards **only** these local errors. Any external exception even if it spoofs `CORE_APPS_SCRIPT_*` becomes fixed `CORE_APPS_SCRIPT_UNAVAILABLE`, while AbortError yields fixed `CORE_APPS_SCRIPT_TIMEOUT`. Normal 302 redirect validation and HTTP 503 own error keep their stable codes. No added network, dependencies, credentials or write permissions. The independent key, canonical workbook ID and redirect-host allowlist are unchanged.

## Native evidence (isolated exact Git file bytes)
- Before fixing, `git hash-object` of local original source was **62369d1cbd5bf494205f45923885958b30395790**, identical to GitHub PR source; the synthetic private marker leaked through a forged provider Error.
- After fixing, `node --test tests/core-apps-script-untrusted-error.test.js` on Node v22.16.0: **8/8 PASS, 0 failures**. Covered forged-error codes, unknown errors, AbortError, own redirect/HTTP classification, success path, second redirect GET zero forwarded credentials and disabled read key.
- Exact locally tested Git blobs **source fb8ea9fca50f465445cb848d4534f2ea1e82b3b6**, **new tests 4fa05cdb8af8f531ce7bcdf77cf10628a03e394f**. Verify the same hashes were added to PR tree before accepting this evidence.
- Focused unit tests are **not** the whole repo Node 20 test suite, exact-head hosted Actions, actual Google Apps Script bound deployment, or verified Private Core 13/13 production authentication.

## Safety and next gates
Keep live `KK_CORE_PRIVATE_READ_KEY`, `KK_CORE_PRIVATE_TRANSPORT`, `KK_CORE_SHEET_REQUIRE_PRIVATE` unmodified. Vercel Production project env inventory still lacked these named entries when read without decrypting; no assumption of inherited/shared env validity. Canonical Core Workbook currently Anyone Reader; poster ACL Anyone Writer separate P0. Both remain owner-controlled change after real private read, anon-denial, Admin parity and rollback validation. Booking/LINE requires confirmed physical handover times and exact durable receipt/outbox, not just replay-safe source.

**No Merge, Deploy, Production/ACL/Booking/LINE/Make/Scanner/Agent writes or paid services in this change.** Issue #49 stays OPEN.