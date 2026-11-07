# KK Phone Rental — P0 Poster ACL owner-private roster cutover | 2026-11-07

**Status:** SOURCE REPAIR COMPLETE IN ISOLATED BRANCH; OWNER-ONLY LIVE ACL CUTOVER **NOT STARTED**. Stable Business V1 RELEASE HOLD. This report supersedes historical 89-card / 49-reference / 38-image Apply instructions, but does not authorize production writes.

## Verified current evidence
- Exact `01_Events!A5:I999` ↔ `08_Web_Ready!A5:J1000` join by event_id for October–December 2026, action `show/show_full`: **94 feed-visible cards, 57 standard Google Drive thumbnail references, 45 distinct IDs**; 0 visible orphan IDs / 0 date divergences / 0 source-vs-derived image URL mismatches.
- Owner Drive metadata directly reread in bounded batches: **45/45 in-scope image files grant `anyone:writer`, 4/4 pinned asset folders grant `anyone:writer`**, 0 read errors, 0 non-image items in the 45-image sample. This does not establish guest image delivery.
- Separate all-month PR #848 source: 106 visible rows and 46 distinct Drive IDs; 45 Writer and 1 no returned Anyone permission. The 46th may be outside the Oct–Dec repair scope; do not automatically publicize it.
- Historical unreferenced files and inheritance remain a separate P0 #743. **DO NOT downgrade a parent folder in the active-only image pass**.
- Core Booking workbook with `anyone:reader` is separate P0 #738; do not revoke until private 13/13 read path passes authenticated and negative tests.

## Actual isolated source changes (no public target ID leak)
- Owner script `ops/drive-security/kk-poster-acl-owner-review-20261013.gs`: remove stale public embedded 38-ID roster. Read 45 active IDs from current approved SOT; keep **57** exact Google thumbnail reference cap and **45** distinct file cap, reject alternate Google-hosted URL forms and duplicate/orphan/date/poster mismatches. Unrelated new non-Drive cards do not falsely block. The root folder scan still checks expected four folder IDs, all active image IDs inside approved trees, image MIME, access types, and complete sorted immutable hierarchy/role/name SHA-256 fingerprint.
- A **separate mandatory owner-private manifest** is now required before any real Apply. Owner sets Script Property `KKACL_OWNER_REVIEWED_ACTIVE_IDS_V20261107` to a JSON array containing exactly the **45 current sorted Drive File IDs**, after privately inspecting each name, parent, role, booking/visibility context and rights. Do not put the JSON in GitHub/PR/issue/LINE. Missing/invalid/duplicate/unsorted/mismatched private roster fails before any write.
- `kkAclDryRun_20261013()` remains read-only and can inspect all descendants, paged metadata and SHA-256 fingerprint without the property. `kkAclOwnerApprovedApply_20261013()` retains its unfilled owner fingerprint placeholder. The owner must independently approve a NEW actual fingerprint before **each** <=25-image batch. The provider code still performs `ANYONE_WITH_LINK` EDIT -> VIEW only for active images, with role readback; folder and historical image writes remain zero.
- Standalone `kk-poster-acl-READONLY-preflight-20261014.gs` mirrors the exact owner source prefix and contains no Apply or `setSharing` method.
- Offline test file extended from 34 to **36 cases** (the branch's V8 simulated Node-compatible test harness reports **36/36**). Cases include missing/malformed/drifted private roster and alternate Google URL. This is **not native Node CI, not hosted Google Apps Script, not owner execution, not browser/signed-out production QA**.

## Safe owner execution / strict gates
1. Verify branch ownership and exact PR #721 HEAD plus Codex changes; only one approved ACL writer. Treat this child branch as proposed source, never as an auto-merge or provider-change instruction.
2. Independently review source and run native `node --test ops/drive-security/kk-poster-acl-owner-review-20261013.test.cjs` against exact accepted SHA, with available no-cost CI quota verified if hosted CI is considered.
3. In owner-controlled **restricted standalone** Google Apps Script (not bound to link-readable Core Booking Sheet), install the vetted code; perform `kkAclDryRun_20261013()` first. Verify exactly 45 active/57 references, all four folders and every descendant, record fingerprint privately, inspect inherited permissions.
4. Privately enumerate the 45 exact IDs from the audited live SOT and compare every file; store the full sorted JSON in the private Script Property named above. Do **not** paste raw IDs or fingerprint in the public repo. If one image is outside known asset trees or private, halt and review scope.
5. BEFORE changing permissions, establish a signed-out successful image load baseline for **all 57 Oct–Dec referenced image URLs** and compare artwork/venue/date. If signed-out baseline or owner identity cannot be tested, remain HOLD.
6. Owner fills the placeholder `OWNER_REVIEWED_64_HEX_FINGERPRINT_HERE` only with the fingerprint produced by the **same** audited snapshot, and executes the owner-only Apply for <=25 images. No trigger, automation, bulk folder changes, historical or Booking access changes.
7. After **each** batch, direct Google Drive role metadata readback for each target plus signed-out real-image QA. Stop on unexpected role, propagation, URL/image failure or provider error; never restore global Writer as a casual rollback. Refresh full Dry Run and independently approve a new fingerprint for any remaining batch.
8. Separately address 4 public Writer folders with inheritance-aware owner approval and historical #743. Do not close master security #718 until all applicable files/folders have no public Writer and the storefront passes guest QA.

## Execution status and cost boundary
- Code changed only on isolated `fix/poster-acl-private-roster-20261107` branched off exact PR #721 parent commit `7bd37d1eb8a8cb60af02d6fd81227139ccd4a3d5`. No writes to PR #721, Codex branches, `main`, Vercel, Apps Script runtime, Sheets, Booking, customers, LINE, Make, prices, Drive permissions or public website.
- Connected Google Drive supports ACL metadata reads but no existing permission downgrade endpoint. Both connected Make organizations were checked previously and had **zero usable Google Drive OAuth connections** for their native ACL update module. Browser control and no-charge guest image QA are not available in this chat.
- **Actual ACL roles downgraded: 0.** Security P0 remains OPEN, risk score unchanged. Do not claim production repair from synthetic/hosted source tests.

## Cross-chat source-of-truth links
- Owner repair PR #721 (Draft/HOLD): https://github.com/mikesd1995/kk-phone-rental-vercel/pull/721
- Security incident #718: https://github.com/mikesd1995/kk-phone-rental-vercel/issues/718
- All-month evidence Draft #848: https://github.com/mikesd1995/kk-phone-rental-vercel/pull/848
- Historical security #743: https://github.com/mikesd1995/kk-phone-rental-vercel/issues/743
- Core privacy #738: https://github.com/mikesd1995/kk-phone-rental-vercel/issues/738
- Whole-project audit #489: https://github.com/mikesd1995/kk-phone-rental-vercel/issues/489
