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

## 28 Oct 2026 — Regression fixture reconciliation and Draft-only CI trigger
Follow-up after the initial atomic scope refresh:
- Corrected test assertions to reflect 38 active images (25 + **13**, not 25 + 14); 45 synthetic mocked nodes (three paginated detail pages **20/20/5**); mock writer count after 25 writes is **20** (13 active + 7 held). Historic private file is excluded from Writer totals (**44** initial mock public writers, **19** after first 25).
- Added a **push trigger restricted to the existing PR #721 Draft branch** on its offline test/helper paths because the `kk-poster-acl-offline.yml` workflow is *absent on default/main*. A PR-only workflow authored only on the head branch did not produce exact-current-head CI. GitHub Actions runs on `push` to this Draft branch must check out `github.sha`, not `main`; this should not mutate Drive/Sheets/Booking/Production.
- The workflow explicitly checks exact Git SHA, runs Node syntax and unit tests without npm install, and has no secrets/permission-write steps. Record actual hosted result separately; **do not presume success until the run reports SUCCESS on the new exact SHA**.
- This fix changes no Drive ACL, poster URL, owner locks, bookings, prices or data.


## 23 Nov 2026 — fresh complete ACL census and draft-only regeneration

**Supersedes 28 Oct 89/49/38 as a CURRENT scope.** The historical narrative above is retained as prior evidence, not an authorization to execute a stale script.

### Live source-of-truth
- Scope: Core `01_Events` joined by exact event ID with `08_Web_Ready`, only `show` / `show_full` event dates in Oct–Dec **2026**. This includes past event cards still marked visible in native data; it is not equivalent to a forward-only browser view or to every 2027 poster.
- **143 Oct–Dec visible event-day cards** (Oct 36, Nov 46, Dec 61), **55 Drive thumbnail references**, **44 sorted unique current poster file IDs**.
- Bounded live source join: **0 duplicate WebReady IDs, 0 visible Core orphans, 0 image URL mismatches, 0 event date mismatches**.
- Read current Drive metadata directly for **all 44/44 unique IDs** in three bounded batches. Every item exists as an `image/jpeg` or `image/png`, has current `anyone/writer` plus owner and belongs directly to one of the two pinned Poster parent folders. **Zero non-image, zero 404, zero out-of-scope direct parent**.
- Old pinned 38-image manifest now requires **11 additions** and **5 removals** to become the exact present 44-image allowlist. Removed IDs are NOT safe to delete or automatically rewrite; they are held as historical security scope.

### Source-only remediation, no Drive write
- Refreshed `ops/drive-security/kk-poster-acl-owner-review-20261013.gs` from 38 IDs + 89/49 to the exact verified 44 IDs + **143/55**; unchanged max **25 image-only permission changes per separate owner-fingerprint approval**, zero folder/archival writes, no triggers. Unknown future drift remains fail-closed.
- `ops/drive-security/kk-poster-acl-READONLY-preflight-20261014.gs` is still a byte-identical copy of the owner's preflight prefix, contains **no `setSharing`**, no apply entrypoint or trigger.
- Refreshed `ops/drive-security/kk-poster-acl-owner-review-20261013.test.cjs` synthetic fixtures to 143/55/44, mocked 47 image files + 4 folders (51 nodes total), approval batches 25+19, historical 209-image synthetic case, and all negative drift / private historical / ownership guards.
- CI result must be read back for the exact final SHA; a green test does **not** grant permission to execute owner apply.

### Outstanding P0 gates and rollback
1. Require independent review of exactly which 44 IDs, the latest native source, all files/folders, and potential inherited permission behavior. Owner authenticated dry-run must inventory **every** descendant and produce a fresh exact metadata SHA-256 fingerprint.
2. Only after separately reviewed fingerprint and owner approval may the owner-controlled Apps Script downgrade up to 25 **active image** permissions to `ANYONE_WITH_LINK / VIEW` per run; exact role readback plus signed-out browser poster rendering must follow each operation.
3. Do **not** modify parent folders or 209 historical image synthetic scope via this active-only script; their real inventory and ACL must be independently rechecked and remediated. P0 [#718](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/718) remains OPEN.
4. The connected Google Drive action set here exposes metadata and sharing invitations, **not an API action to update/delete an existing Anyone ACL**. No live rights were changed in this session, no credentials collected, no owner Dry Run represented as executed.
5. Rollback of this branch-only change is confined to the source/test/doc commits; Production storefront, Core data, booking, customer, LINE and all Drive ACLs were untouched.
