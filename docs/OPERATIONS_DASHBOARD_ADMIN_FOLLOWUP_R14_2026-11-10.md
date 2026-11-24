# KK Phone Rental — Operations Dashboard R14: venue-identity fail-closed

Date: 2026-11-10, Asia/Bangkok. **STAGED ON ISOLATED BRANCH / RELEASE HOLD / NOT PRODUCTION.**

## Context and conflict avoidance
- Parent: PR #851 (`feat/ops-dashboard-readonly-v4-20261107`) at exact base commit `884cd1123ad67f74adf9c0243ee9da8590c2511f`, Ready for Review, not merged.
- Isolated child branch: `fix/ops-dashboard-venue-identity-r14-20261110`; PR targets the #851 branch rather than `main`.
- Different work streams: PR #854 (synthetic signed-Admin Preview UAT) and PR #856 (LINE accept-once/Login) are NOT edited.
- No Booking, price, stock, Owner Locks, social posting, Apps Script, private sheet, Vercel environment, credentials, Production or main writes.

## Root cause and concrete fix
The Operations normalizer compared Core venue to Web Ready venue only when **both** were nonempty:
`coreVenue&&webVenue&&coreVenue!==webVenue`.
If either source was empty, `dateRisk` could remain false. A positive phone/package count could therefore set `phoneReady=true` or `bundleReady=true`, even though Core-to-Web identity had not been verified. The QA panel already warned on an empty Web Ready venue, but the readiness label did not honor it. A placeholder venue could also agree across both sources and be treated as verified.

Changes confined to:
1. `admin/operations-dashboard.js`: `venueRisk` is true for missing Core or Web Ready venue, mismatch, or explicit unconfirmed markers (`รอยืนยัน`, `รอประกาศ`, `ยังไม่ประกาศ`, `not yet confirmed`, `TBA/TBC/TBD`). Valid Core/Web matches continue through existing availability logic. The same fail-closed `dateRisk` controls `phoneReady`, `bundleReady`, QA and posting hold.
2. `tests/operations-dashboard-readonly.test.js`: three new tests cover empty Core/Web venue, equal unconfirmed placeholders, and positive matching venues.

## Reproducible test evidence
- Tested against exact original GitHub file blobs that also existed in the R5 ZIP: UI `967d10f3bd64e47d0bc677f85c09b7bda24766d9`, tests `cb25b34d0b9044b4696fb7df51780e8b6e229944`. Both were still the blobs on #851 R13.
- **Before fix:** `node --test tests/operations-dashboard-readonly.test.js` with the added tests => **26 PASS, 2 FAIL** (missing venue and placeholder cases). This is the expected RED regression.
- **After fix:** targeted **28/28 PASS**, then locally scoped `node --test tests/*.test.js` against packaged R5 modules plus exact R14 changed source => **41/41 PASS**, 0 fail, 0 skip.
- `node --check admin/operations-dashboard.js`: PASS.
- Expected new Git blob SHA: UI `f6b353f519a58806c53b37649393b3460c2d418d`; tests `d9fafc6377248c87277ba5d3f8fe8d307feba836`. Verify GitHub readback after upload.
- **Limitations:** local ZIP-based scoped tests are NOT full native repository CI or hosted signed-Admin Preview; no CodeQL/security approval can be inferred from them.

## Remaining release HOLD
1. Independent (non-author) GitHub Reviewer, exact-current-head security review and merge-tree reconciliation against moving `main`.
2. Investigate two CodeQL `js/user-controlled-bypass` notices in V6 action/gate routing and remaining repository alerts. Existing negative-auth synthetic tests are not a human security approval.
3. Real hosted signed-session Preview UAT, protected SSO, private source coverage/freshness, transport PII/no-store and negative-auth verification. PR #854 is a separate synthetic-only path and does not substitute for private real-source reconciliation.
4. Post-change exact-head CI plus registered UX/Visual QA and mobile Safari after the two-file change is integrated; previous R13 CI success does not certify R14.
5. Owner-controlled release authorization; **no merge/production deployment or source-of-truth business mutation** until all gates pass.

## Follow-up / rollback
Review these two-file changes and the RED/GREEN tests in the isolated PR. If rejected, close the child PR; #851, main and Production are untouched by R14. If accepted, integrate by a governed PR update and rerun exact-HEAD checks before considering release. Refer to parent #851 R13 handoff and its Google Doc for earlier R1-R13 work.
