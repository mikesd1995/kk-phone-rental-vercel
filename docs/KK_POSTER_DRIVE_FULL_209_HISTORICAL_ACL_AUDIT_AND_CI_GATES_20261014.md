# KK Phone Rental — Full Drive Poster Security Audit + CI/PR Acceptance
**Evidence date:** 2026-10-14 Asia/Bangkok. **Selected tasks:** #2 full history role audit, #3 PR code / Native Node / CI review, #7 PR acceptance and cross-chat preservation. **Execution limits:** no added cost, no GitHub merge/production deploy, no Google Drive permission updates, no customer/Booking/price/stock/poster URL writes.

## 1. Grounded source roster / scope
The connected Google Drive owner's canonical SOT is the KK Phone backend workbook. Read `01_Events!A5:I650` and `08_Web_Ready!A5:J650` and join by exact event_id for Oct–Dec 2026 effective `show/show_full`:
- **76** visible event-date cards, **42** Google Drive thumbnail uses, **33** unique active poster image IDs; **0** Core/Derived poster URL disagreements. All 33 IDs match the exact `KKACL_EXPECTED` preflight manifest in `ops/drive-security/kk-poster-acl-owner-review-20261013.gs`.
- Four pinned Drive folders from the same script; non-trashed images in exact parent scopes, paginated with `item_type=image` (100 / page). Direct-child image counts in script-folder order: **[1, 227, 5, 9]** = **242/242 unique**. Active membership by folder: **[0, 27, 0, 6]**; historical/unreferenced by folder **[1, 200, 5, 3]** = **209**. No API search continuation token unconsumed.
- Historic 263-item count in an earlier snapshot is superseded for this exact current parent/MIME/non-trashed scope. Do not infer that any specific number of files were deleted; it may be filter/scope/timing variation. Any files outside these four folders and trashed assets are NOT in this census.

## 2. FULL metadata readback — 209/209 historical images checked, not sampled
Using authenticated owner-connected Google Drive `get_file_metadata`, individually read permissions and MIME for **every one of the 209 unique historical/unreferenced IDs**, excluding the 33 active pins. Deterministic sorted slices per provider page, with matching first/last masked tags for adjacent repeated reads:
- Large Posters folder, page 1 (100 files, **81 historic**): 18 + 18 + 18 + 18 + 9 metadata reads = **81 Writer, 0 errors**.
- Large Posters folder, page 2 (100 files, **92 historic**): 16 + 16 + 16 + 16 + 16 + 12 = **92 Writer, 0 errors**.
- Large Posters folder, page 3 (27 files, **27 historic**): 15 + 12 = **27 Writer, 0 errors**.
- Other 3 folders combined (1+5+9 image items, 6 active): **9 historic Writer, 0 errors**.
- **TOTAL historical: 209 / 209 returned an `anyone/writer` permission, 0 `anyone/reader`, 0 restricted/unshared, 0 other, 0 metadata exceptions; MIME image/* 209/209**. All calls were read-only. This is a verified role inventory, NOT proof a signed-out user can successfully perform an editing API call.
- Prior same-day direct owner metadata checks on 33/33 active images and 4/4 folders: all also `anyone/writer`. Thus currently identified scope = **242 public-Writer image files + four public-Writer folders**. This is a confirmed security risk and remains unremediated on Google Drive.

**Privacy:** No complete Drive asset IDs, filename roster, customer PII, booking IDs, approval fingerprint, OAuth token or event owner contacts are placed in public issues or this report.

## 3. Engineering/code changes in existing DRAFT #721
- Prior owner-safety branch changed the `.gs` script to `KKACL_WRITE_SCOPE='ACTIVE_ONLY'`. Eligibility for future owner-approved `setSharing(ANYONE_WITH_LINK,VIEW)` consists of **33 active images + 4 known folders only**, max **25 writes** per reviewed fingerprint; 209 historic images inventoried read-only and monitored for accidental inherited role changes. Results distinguish `active_scope_completed` from full `ok` and retain `historical_public_writers`. A full PASS is impossible while 209 historic Writers remain.
- Standalone `kk-poster-acl-READONLY-preflight-20261014.gs` remains separate with **no `setSharing` / Apply entrypoints**. Creating a private standalone project and executing the owner Dry Run did **not** occur; no permission writes authorized.
- Added one **real-scale contract test** for 242 image files, 209 historical Writer roles, 4 folders, with two owner-reviewed active batches **25+12** and explicit **0 historic mutations**. Asserts `active_scope_completed=true` with `ok=false`, `remaining_writers=209`. Existing 25 mock cases cover stale 42/41 references, owner-fingerprint drift, no-write standalone source, custom ACL role/ancestry failures, inherited folder effects and provider failure.
- Added **`test:security:poster-acl`** script to `package.json`: `node --test ops/drive-security/kk-poster-acl-owner-review-20261013.test.cjs`. Existing `npm test` now invokes that script after its existing `node --test tests/*.test.js`. This wires the exact security tests into a standard no-new-dependency Node gate whenever `npm test` is run. It does NOT claim hosted CI has run.

## 4. Precise test / CI status and cost guard
- Executed **26/26 tests PASS, 0 FAIL** with the exact GitHub-fetched script + test + read-only source in isolated JavaScript V8 Node-module stubs and mocked Drive/Sheets. The crypto digest in this harness is a deterministic synthetic fixture, NOT Node SHA-256; treat this only as regression-level mock confirmation.
- **Native Node status: NOT EXECUTED on exact repository files.** Node 22.16.0 is installed in the local container, but direct `curl` / clone of `raw.githubusercontent.com` failed with DNS resolution unavailable; GitHub connected fetch results are not automatically mounted as container files. Do not fabricate a native `node --test` PASS.
- **GitHub Actions / hosted exact-head status: UNVERIFIED; no matching successful commit status / PR workflow run.** Do not dispatch paid reruns or trigger preview builds under the strict no-added-cost policy. Even after `npm test` is wired, this is a ***prepared* gate**, not a certified hosted PASS.
- Native command once authorized source is available in a filesystem: `npm run test:security:poster-acl`; full regression gate: `npm test`. Require `node --test` native success and exact-head CI status if future no-charge capacity is confirmed.

## 5. PR/Issue governance, release contract and next choices
- **[Master P0 #718](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/718)** updated title from obsolete “35 posters” to **242 image files + 4 folders Anyone Writer**; remain **OPEN**, cannot close from source/tests.
- **[New historical P0 #743](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/743)** explicitly owns the real ACL repair of all **209** archived/historical files; no automatic historic `setSharing` while its source/role scope is unapproved.
- **[Draft PR #721](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/721)** owns a reviewed, active-only/script-only remediation plan plus tests/docs, **not** an already applied security fix. It must stay DRAFT/HOLD; code merge alone cannot downgrade Google Drive permissions.
- **[Core Sheet PII #738](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/738)** remains separate: canonical Booking Sheet is `anyone/reader`; Production/main still uses some GViz fallback. Never revoke that role before authenticated private-reader cutover and production acceptance.
- Real owner-controlled ACL fixes for active art and separately for history, direct metadata readback all 242+4, signed-out 42/42 storefront poster decode, no price or Booking regression, Native Node and exact-head CI plus owner approval are required BEFORE closing corresponding P0s.
- **Zero permission changes, zero Production deploy/merge, zero Google Sheet edits, zero business writes, zero paid service use.** No owner Apps Script Project/Dry Run was created or run by this ChatGPT session.

### Durable files
- `ops/drive-security/kk-poster-acl-owner-review-20261013.gs`
- `ops/drive-security/kk-poster-acl-READONLY-preflight-20261014.gs`
- `ops/drive-security/kk-poster-acl-owner-review-20261013.test.cjs`
- `ops/drive-security/README-20261013.md`
- `docs/KK_POSTER_ACL_ACTIVE_ONLY_P0_HANDOFF_20261014.md`
- `docs/KK_POSTER_ACL_TASK1_STANDALONE_READONLY_PREFLIGHT_20261014.md`
