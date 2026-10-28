# KK Phone Rental — P0 Poster ACL Scope Drift Fix (2026-10-29 ICT)

## Scope, ownership and Safety Gates

This is a **child branch of the existing Owner-only Poster ACL Draft PR #721**, starting from its exact HEAD `7bd37d1eb8a8cb60af02d6fd81227139ccd4a3d5`. **PR #721 and Codex's Draft #744 are untouched.** The parent branch intentionally remains Draft/HOLD. The new branch exists solely for Codex/owner review; do **NOT** merge or execute the owner ACL apply just because the source-level preflight passes.

No actual Drive permission modifications, Google Sheets customer/Booking/price writes, Production/ENV changes, Vercel deployment, paid services or external automation occurred.

## Fresh connector evidence

Read-only source-of-truth join of `01_Events!A5:I999` to `08_Web_Ready!A5:J1000` for dates in Oct–Dec 2026 and statuses `show`/`show_full`:
- Actual scoped visible event cards: **87** (old script hardcoded **89**).
- Recognized `drive.google.com/thumbnail?id=...` poster references: **49** (unchanged).
- Unique pinned image File IDs: **38**, exact sorted identity match with `KKACL_EXPECTED` **38/38** (no IDs disclosed in this report).
- Duplicate Core/Web event IDs: **0/0**.
- Web-visible scoped event orphans: **0**.
- Canonical/WebReady date mismatch: **0**; artwork URL mismatch: **0**.

The original exact source returned `SCOPED_ACTIVE_POSTER_DRIFT` for the live 87 cards, even though all 49 Drive references and 38 pinned IDs matched. The **sole source of this false block** was the mutable total-card-count assertion. The owner-only ACL mutation procedure was **not invoked**.

## Patch (fail-closed)

Only these **three existing PR #721 paths** are changed on this child branch:
1. `ops/drive-security/kk-poster-acl-owner-review-20261013.gs`: remove `cards.length===89` as an admission criterion; retain exact **49 Drive references + 38 pinned IDs + sorted identity equality**, duplicate IDs, Core/Web date and artwork parity, approved-fingerprint compare, mutation batch bounds, role readback, and historical role safeguards.
2. `ops/drive-security/kk-poster-acl-READONLY-preflight-20261014.gs`: mirror the owner source's preflight byte-for-byte; still **no setSharing or executable apply entrypoint**.
3. `ops/drive-security/kk-poster-acl-owner-review-20261013.test.cjs`: update old non-Drive extra-card test to assert zero-write admission; add two fail-closed regressions for a new Google Drive URL format and a new canonical Drive File ID.

A new guard **rejects unfamiliar Google-hosted image URLs** in in-scope visible cards with `SCOPED_GOOGLE_POSTER_URL_UNRECOGNIZED`. This prevents added Drive artwork using `drive.google.com/file/d/...` or Googleusercontent formats from being silently ignored when total-card-count becomes variable. Any new standard Drive File ID still fails the pinned 38-ID/ref manifest. Unrelated non-Drive cards do not expand the Drive permission-write scope.

## Verifications performed (NO provider ACL writes)

- Exact updated owner script blob: `139f3311cb68c5edd9c6f142809fe913aec516f1`
- Exact updated standalone read-only script blob: `27955ed180f76b2c3874ae9cba737c55aef6ef61`
- Exact updated test file blob: `437180c988e66d0998b4efaca431bb0c8553f5ef`
- **13/13 PASS** in exact-source isolated V8 synthetic tests (using actual updated GitHub source and a mocked SpreadsheetApp):
  1. fresh live Sheets 38/38 identity acceptance,
  2. owner/read-only prefix byte parity,
  3. changed test coverage present,
  4. unchanged 89-card fixture admission,
  5. **87-card** fixture admission,
  6. added non-Drive card admission,
  7. unfamiliar Drive URL format rejected,
  8. new canonical Drive ID rejected,
  9. duplicate Core ID rejected,
  10. visible WebReady orphan rejected,
  11. Core/Web date divergence rejected,
  12. Core/Web image URL divergence rejected,
  13. one-missing-thumbnail-reference rejected.
- **Original exact source mutation witness**: current live 87-card scope -> `SCOPED_ACTIVE_POSTER_DRIFT`; updated exact source -> 38 approved IDs returned; this reproduces the operational blockage and validates its correction.
- **Not yet done:** native Node `node --test ops/drive-security/kk-poster-acl-owner-review-20261013.test.cjs` on full original repo, hosted CI for the exact child-branch head, owner-authenticated Drive Dry Run, folder-tree inventory/fingerprint review, non-public thumbnail/browser decoding, provider ACL readback and controlled mutation acceptance. V8 checks do **NOT** count as those gates.

## Mandatory cutover procedure

1. Recheck latest main, Draft #721 and Draft #744 changed paths; resolve overlaps by owner/Codex review, **never blind merge**.
2. Execute full offline native owner/readonly Apps Script mock suite from the accepted **exact SHA** with no Google writes. Validate that existing tests still pass.
3. Verify current authorized owner identity, total Drive tree, 38 active exact File IDs, 4 known folders, historical image roles, permission inheritance and fingerprint. Perform **Dry Run first**. Compare fresh fingerprints and role list, no write yet.
4. Obtain explicit owner authorization for the exact dry-run fingerprint and bound 25-file approval batch. Apply via the authorized owner-only Apps Script entrypoint, **not** this assistant's connector.
5. Post-write readback must show the intended `anyone/reader` role for each approved active asset without accidental historical/folder changes, verify signed-out images, then consider next batch. Stop on first drift.
6. Core Booking Sheet public Reader **remains a separate P0 (#738 / Draft #739)**; do **NOT** revoke it until authenticated 13/13 private reads and full booking/storefront acceptance. Final release #49 stays HOLD.

**Classification: source-level fix and independent V8 mock acceptance PASS; live Drive ACL repair NOT executed; Stable Business V1 RELEASE HOLD.**
