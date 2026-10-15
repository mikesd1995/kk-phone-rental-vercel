# KK Private Core Phase 1 — Apps Script URL authority guard (2026-10-15 ICT)

**Source-only security patch / Release HOLD.** This change extends Draft PR #744; no Merge/Deploy/ACL/Production credentials were changed.

## Evidence
- Exact Google Core workbook metadata and the **header row only** of 13 declared private read datasets were checked with authenticated Drive/Sheets connector on 2026-10-15. All **13/13 header contracts matched**, including `_Rental_Dashboard_Data` and `13_Event_Archive`. **No customer/body row values were published or copied to GitHub.**
- The Core workbook still has an `anyone / reader` permission; private reader E2E and unauthenticated-denial, browser/storefront readback remain unaccepted. **13/13 headers are NOT 13/13 private access acceptance.**
- `#739` had a stricter URL-authority rule than `#744`. Do not replace whole #744 files: #739 defaults to `KK_CORE_PRIVATE_TRANSPORT=service-account` while #744 intentionally defaults to `none` (fail closed). Exact-authority checks are ported only.
- For owner Apps Script transport: initial `script.google.com`, returned `script.googleusercontent.com` redirect, and final response host must be HTTPS on the allowed host without embedded userinfo/credentials or nonstandard port. Existing redirect follow-up remains GET with no body/auth headers.
- New Node regression file cases reject initial URL username/password/nonstandard-port, redirect username/password/nonstandard-port before following, and final response username/nonstandard-port. In-memory V8 exact-source smoke uses a synthetic URL parser because the tool isolate has no native URL global: SOURCE RULES verified with **${assertions} assertions**, 5 mocked first-stage calls, 0 unsafe redirect follow-ups. This is **not** full native Node/CI acceptance.

## Release dependency
Require: selected credential/transport in owner-managed secrets, strict Core reads 13/13 via actual private identity, unauthenticated deny negative, Storefront/Admin/Revenue parity, separate controlled Google Drive ACL owner approval and reversible cutover, Apps Script release Gate #9 and browser production readback. Preserve current Public GViz only as a held transition dependency; never make the browser a direct reader of private Core.

## Safety/readback
Commit is source/tests/docs only on existing DRAFT #744. No Apps Script deployment or Script Properties mutation, no Sheets/Drive ACL update, no Make/LINE/Telegram/X action, no Customer/Booking/Price/Stock write, no paid usage/CI trigger. Keep #49 OPEN/HOLD. Next chat: verify latest PR HEAD, compare #739 and #744 exact file contents and run Node tests on the chosen exact SHA before Release.
