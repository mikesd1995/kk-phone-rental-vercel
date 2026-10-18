# KK Phone Rental — Poster ACL Security P0: active-only safe cutover and full handoff
**Evidence date:** 2026-10-14 Asia/Bangkok. **Owner instruction:** Task #1 from earlier menu is REMOVED. Continue tasks #2–#7 only; no new standalone script project created or dry-run executed by this session. Zero additional spend, no Merge/Deploy or business-data writes.

## 1. Security outcome — IMPORTANT: not a completed live fix
- Google Drive remains **UNSAFE**: authenticated metadata on **33/33 active Google Drive poster images** and **4/4 related Brand/Posters/Kit folders** verified `type=anyone, role=writer`. Public editable role not changed. Never claim a successful ACL repair.
- Source of Truth current Oct–Dec `01_Events` exact-ID joined to `08_Web_Ready`: **76 effective visible event-date cards; 42 Drive thumbnail references; 33 unique active image IDs; 0 URL mismatches**. All 33 active IDs match the script-pinned manifest; historic 41-use/35-ID inventories are superseded.
- Current canonical Google Sheets backend remains `type=anyone, role=reader`, despite containing customer-related Booking fields. This is a **separate privacy P0** at [#738](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/738). Revoking its public Reader right now could disrupt `api/kk-data.js`, `script.js` direct GViz fallback, `server/admin-sheet-fallback.js` and `server/rental-dashboard-core.js`. Do not revoke before private-reader cutover with E2E.

## 2. Fresh historic inventory (actual connector pages, no Google ACL writes)
- Re-executed Google Drive metadata-only `files.list` search using exact `'<folder_id>' in parents and trashed=false`, `item_type=image`, `topn=100`; consumed all returned pages for the four known folders.
- Folder image counts in pinned script order: **1, 227, 5, 9**, totals **242 unique image assets**; all **33 active pinned** IDs found; **209 historical/unreferenced** assets.
- 10/10 sampled historical image metadata records were `anyone/writer`, illustrating exposure beyond currently published cards, NOT evidence that every historical image has Writer role.
- Prior audit had 263 image objects; new exact search returned 242. **Do not claim 21 files were deleted** or set a security PASS based on discrepancy; investigate earlier query scope, trash, additional folder scopes/provider pagination or intervening file changes.
- Important inheritance uncertainty: downgrading a folder role may alter effective permissions on descendants without explicit child `setSharing`; the source now tests for historical ACL drift and fails closed if history changes.

## 3. Exact Draft source repairs staged — branch only
- Pull request [#721](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/721), `security/drive-public-acl-owner-review-20261013`. Default `main d6dc3bfe...` and Production are unchanged.
- Scope constant `KKACL_WRITE_SCOPE='ACTIVE_ONLY'`. The owner-approved `kkAclApply_20261013` writes **only the 4 named folders + 33 active current poster IDs**, at most **25 objects per approval**. The full file-tree inventory is still read and fingerprinted for safe review, but 209 historical/unreferenced image objects receive **NO explicit setSharing operations**.
- Stable priority: folder items first, then active images; extra-history items are not eligible for active-only batch.
- After each batch, returns separate `remaining_active_writers`, `historical_public_writers`, `active_scope_completed`, `remaining_writers`, `ok`, and `need_new_owner_dry_run`. **`ok` means ALL visited public Writers gone, not just active files**, so historical Writers keep full #718 OPEN. A stale fingerprint, drift, failing write, or unintended historic-role change fails closed.
- Restricted historic assets (PRIVATE, DOMAIN, DOMAIN_WITH_LINK) never receive explicit writes; unexpectedly public-discoverable ANYONE images are not mislabeled private; true active images require existing public-with-link permissions.
- No trigger, web app, Google permissions update, Booking, price, inventory, customer, thumbnail URL, Sheet edit or Vercel deploy occurred.

## 4. Test / release evidence boundaries
- Exact GitHub-fetched source and authored offline suite tested in isolated JavaScript V8 Node-module/crypto mock harness: **22/22 PASS** after adding tests for active-only 25+12, no historic explicit writes, folder inheritance side-effect fail-closed, stale 42/41 URL reference, fake fingerprint and provider partial failure.
- **NOT** native Node `node --test`, Google Apps Script runtime, real Drive update, browser E2E or Hosted CI.
- Local container has Node.js v22.16.0, but private GitHub repository direct clone fails with outbound DNS unavailable. The GitHub connector does not materialize fetched source files into local shell automatically. Do not claim native test execution. Host Actions check status and commit workflow-run list on tested head had no confirmed PASS; do not trigger paid Actions or Vercel builds.
- No signed-out image-decoding success has been established. **42/42 public thumbnail URLs** must decode successfully and match event artwork before customer-facing acceptance.

## 5. Owner-only completion dependencies — NOT SKIPPED despite removed Task #1
1. Read-only review of actual scope/permissions before any irreversible role changes remains a **safety prerequisite**, although owner removed standalone Task #1. Do not invent owner approval or run an unseen Apps Script, and do not replace an existing Anyone Writer grant by adding another domain/user Reader grant.
2. Actual ACL `Anyone Writer -> Anyone Reader` remains blocked from this ChatGPT Google Drive connector: it supports metadata reads and *new* user/domain grants only, not updating existing `anyone` ACL; no authenticated Apps Script execution. The only prepared path is a separately owner-private standalone script at https://script.google.com with `DriveApp.setSharing(ANYONE_WITH_LINK,VIEW)` and owner-reviewed per-batch fingerprint. Never attach it to public-reader Booking Sheet.
3. After an authorized change, read back role for **33/33 active images**, **4/4 folders**, plus separately reviewed historical file scope; ensure every approved target has Reader, zero Writer, and that private assets remain restricted. An unexpected inherited historic role change is an incident, not a silent PASS.
4. Validate **42/42 signed-out** thumbnail references + responsive Storefront after real ACL change, with no URL/price/Booking visibility mutations.
5. Independently address #738 with a secure server-side authenticated private read projection (only public event/package allowlist) before revoking Anyone Reader to canonical Booking spreadsheet. Current main contains GViz fallback reader routes. Existing Draft revenue PR #737 must also be reviewed before release because it includes a Master quote read.
6. Only after real Node / exact-head Actions where no-charge capacity exists, owner security acceptance, user-visible QA and full ACL readback, consider release/issue closure. Do not Merge/Deploy automatically.

## 6. Links / durable lineage
- [Security issue #718](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/718): real poster Writer exposure, remains OPEN P0
- [Source Draft PR #721](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/721): active-only code, tests, manual runbook, remains DRAFT/HOLD
- [Core Backend Sheet security #738](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/738): separate data privacy P0
- [Runbook](https://github.com/mikesd1995/kk-phone-rental-vercel/blob/security/drive-public-acl-owner-review-20261013/ops/drive-security/README-20261013.md)

**Net business effects:** 0 Production role changes, 0 Booking changes, 0 price/stock changes, 0 poster URL edits, 0 LINE/X sends, 0 new spend. Security P0 remains open.