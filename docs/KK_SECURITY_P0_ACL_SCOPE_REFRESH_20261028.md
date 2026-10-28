# KK P0 Poster ACL — Exact Active Scope Refresh (28 Oct 2026)

## Status
SOURCE-ONLY / DRAFT PR #721 / **SECURITY P0 HOLD**. No Drive ACL, Core Sheet, Customer, Booking, LINE, Vercel, Supabase, Make, or scheduled task writes.

## Fresh evidence (owner-connected Google Sheets + Drive metadata)
- Canonical Core: `01_Events!A5:I999`; Derived: `08_Web_Ready!A5:J1000`; selection Oct–Dec 2026 and action `show`/`show_full` only.
- 426 nonempty Core IDs / 426 derived IDs, no duplicate IDs, no visible orphan, no visible date/image divergence in scoped rows.
- **89 visible event-day cards** (Oct 39, Nov 27, Dec 23); **49 Google Drive thumbnail references**, **38 unique active Drive IDs**.
- Checked **38/38 active Drive file metadata individually** on 28 Oct 2026: image MIME, present in one of four pinned poster folders, **38/38 anyone/writer**. Public-edit exposure persists; anonymous exploit not tested.
- Previous draft manifest: 39 files; current 38. Six newly active IDs and seven previously active IDs now outside scoped Oct–Dec active references.

### Six additions (each confirmed image, pinned-folder member, anyone/writer)
- `1-rcnlEaIzpD2c4sY20awWIpgcFL8tPB6`
- `11syuNeglet-52JiZWMoK4JMCzS0ajhYA`
- `1ethDWGhtYdbPJMrOu8oQQuE0ipip6KOj`
- `1sGSDVNYPlk-0k_fEgRVZgHjUUcVbz9DQ`
- `1xErT4LJNfnGN7MfXRZo-1B3IGhaH3RwC`
- `1zlzXUfRFNA4yDFkUfYxF_l-PQTUTJL5u`

### Seven removals from the ACTIVE-ONLY proposed repair scope
- `1HFY4aRt9jFDME1KXtGMCNakRZyCEpHgl`
- `1IuFwiQGTLFKu_kLy0IRDYQXlwWdeAXxB`
- `1V7BmLJk4w3DTpa55DlyauDRPZ0XhLkuC`
- `1a72uNH2xAv_srOWwLY35tmXAvTJDw1Aw`
- `1bsdn_iG_QEXudZIyqu-EL2gFaAkPZUHo`
- `1qzZg3s9Wshx5IwAQ1ibnUP8oihuJSWL4`
- `1v9hbM_mr2uzd3WF-tEjNWqTFNXcUlwyk`

Removed IDs may remain historical and/or publicly writable. **Do not grant or remove historic permissions automatically.** Historical inventory and four folder ACLs remain separately on HOLD in issues #743/#718.

## Source changes on draft PR #721
- Pin owner and standalone READ-ONLY preflight to the same **sorted exact 38-ID active allowlist**.
- Fail-closed counts updated from 73/48/39 to **89/49/38**. Identity, Core↔Derived image/date consistency, folder membership, historical isolation, fingerprint, max 25 changes per separately approved batch, and no automatic apply are retained.
- Offline regression fixture updated for 89 cards, 49 thumbnail refs, 38 unique active images and 209 synthetic historical image entries. Synthetic counts are **test fixtures**, not a fresh census of all historical Drive assets.
- The readonly prefix must remain byte-identical with the owner script's preflight section; no `setSharing` in readonly script.

## Explicit outstanding gates
1. **Exact-head hosted CI and source review**, never infer a green run from an earlier SHA.
2. Re-read SOT and all relevant Drive permissions if any owner/scanner/editor changes event scope; fail closed on drift.
3. Owner-executed **READ-ONLY Dry Run**, independently review whole descendant tree, hierarchy and SHA-256 fingerprint. Inspect file/visitor image rendering rights and ownership.
4. An explicit separate ACL approval **after** verified dry-run; max 25 active images per approved operation, exact readback and rollback. No folder or archive ACL modification in this active-only script.
5. Independently repair folders + historical images under their own governed scope, then signed-out poster image decode/browser acceptance. Do not close #718 before both active and historic scopes pass.
6. Core Booking Sheet is still `anyone/reader` (separate P0 #738/#739); never revoke that before 13/13 private read and Booking/Admin/LINE parity.

## Rollback
If draft source is unsuitable, revert this exact draft commit only. There are **zero live permissions or customer changes** to roll back at this checkpoint. Full release remains under final gate #49.
