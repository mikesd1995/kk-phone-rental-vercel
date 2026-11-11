# KK Phone Rental — Urgent repeat Terms UX fix / 2026-11-10

**Status: SOURCE STAGED / SEPARATE DRAFT PR / NOT DEPLOYED / RELEASE HOLD.**
This is a narrow interim UX solution **not LINE Login** and not a permanent cross-device identity system. Continue full verified LINE Login / server acceptance separately in Draft PR #856 and Issue #855.

## Why
The current `assets/kk-booking-agreement.js` unconditionally resets `check.checked=false` and blocks every booking/waitlist click. Customers are required to check the same Terms again and again, even though `script.js` already includes exact current Terms acknowledgement and Privacy notice lines in each LINE draft and the existing webhook checks the text of the *actually sent* message.

## Files changed on isolated branch
- `assets/kk-booking-agreement.js`: one `termsVersion` constant, `kk_booking_terms_prompt_version` in browser localStorage, guarded read/write; skip gate only when current version string matches. On first booking the checkbox stays unchecked. On explicit click of 'continue', store UX reminder *only*, close the popup and replay original LINE link. On storage denial or version mismatch, continue showing original modal.
- `tests/storefront-booking-agreement.test.js`: replace old no-storage assertion with narrow test of the versioned UI-only storage and no unrelated browser/API writes.
- `tests/storefront-booking-agreement-remember.test.js`: synthetic Node VM DOM/URL tests: first-time unchecked, confirm, next booking bypass, Cancel does not store, changed Terms re-prompts, localStorage blocked re-prompts, non-LINE URL untouched, actual version string parity.
- `docs/KK_LINE_TERMS_ACCEPTANCE_2026-11-06.md`: update description of UI-only persistence vs signed LINE evidence.
- `scripts/qa/storefront-booking-agreement-qa.cjs`: adapt the real localhost Playwright smoke test at 390px/1440px to require a repeat click to open LINE directly, while a stale version still shows unchecked Terms in English; no provider request.
- `.github/workflows/storefront-visual-qa.yml`: include the new browser-storage regression test in the workflow's Node test step and trigger paths.
- This handoff document.

## Strong evidence boundary
- localStorage is **not** customer identity, Terms acceptance evidence, durable audit, or signed consent. It records ONLY a version string to avoid repeated UI friction in the *same browser*.
- The authoritative LINE booking proof is still actual customer **Send** with two exact current-version lines and an authenticated LINE webhook. The original `script.js`, webhook parser, Booking, Owner Locks, cancellation/price/stock behavior are completely untouched.
- Unsending/altering the LINE draft or opening a deep link is **NOT** a completed booking; the shop still confirms the request. No guest or returning customer is automatically accepted server-side based on browser state.
- Browser storage cleared/private mode/new browser/new device re-shows the checkbox; only complete LINE Login + server receipt ledger can support cross-device remember-accept. New substantive Terms version must update source in `server/kk-booking-terms-evidence.js`, `script.js`, `terms/index.html`, and this UI version in one independently reviewed change.

## Source inspection & test evidence
- Original main SHA at start: `eec14200cb087173ca555fa0c21b99e54c1c3961`.
- Source and existing tests read from exact current GitHub Main; 5 relevant files changed in a new branch independent of #856.
- Exact modified JS was compiled in V8 and exercised in simulated DOM with first prompt, explicit checkbox, LINE click replay, stored version, subsequent skip, old version forced prompt, blocked localStorage fallback, and non-LINE untouched: all checks matched expected behavior.
- The first GitHub native Storefront Automated Visual QA on SHA `a79718bf25640d8f6b34b3f2dcce4032e4619e97` (`run 42677809442`) **FAILED** because the original scripted browser test still expected a click count of 1 after a repeat booking, whereas the correct new behavior produced 2. The Playwright QA script and workflow test list were then patched; recheck their final exact HEAD CI before any release.
- Native `npm run code:context`, `node --test` and full `npm test` **not** run in the local container; container cannot resolve github.com, so no full repo checkout; test source exists for exact-head CI. Project's registered `storefront_ux_review` and `storefront_visual_qa` invocations **not available/verified** in this connector-only run. No synthetic test can substitute for mandatory actual gate.
- Vercel production alias and GitHub main were read-only checked before change. Production remains original until authorized deployment; do not claim this fix is live.

## Release blockers and next steps
1. Registered Agent Gateway `storefront_ux_review` before UX acceptance and `storefront_visual_qa` after, with genuine screenshot/mobile width evidence; independent Reviewer on source and privacy boundary. This gate is currently UNSATISFIED.
2. Native targeted/functional/full regression and exact PR HEAD CI PASS, source SHA readback, Vercel protected Preview at 320/375/390/430/480 and desktop. Ensure LINE popup, iOS Safari and in-app browser behavior, open new tabs and back navigation tested.
3. Revalidate Main, other Codex branches, current Booking/Owner Locks and no overlap with existing Draft PRs; preserve original release hold #489 and owner exact-SHA approval.
4. Only then merge and release via authorized Vercel path and recheck live public production homepage/Terms version/LINE actual sent evidence. Do **not** deploy a draft or manually alter Vercel Production as a shortcut.
5. If problems surface after release, rollback only this scoped storefront asset/test/doc change; leave LINE/Booking/data and signed chat evidence intact. Browser localStorage key can remain; old JS does not read it.

## No operations performed
No LINE/Booking/Google Sheets/Supabase/Owner Locks/X data writes, no customer messages, no purchases/paid services, no production merge/deploy or environment variable mutations.
