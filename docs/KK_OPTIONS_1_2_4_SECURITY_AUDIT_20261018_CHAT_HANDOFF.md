# KK Phone Rental — owner-selected security options 1, 2 and 4 (18 Oct 2026 ICT)

**Checkpoint: Draft-source-only. Security P0 HOLD.** This is a durable cross-chat audit, **not** an acceptance, deployment instruction, CI-green certification, or Drive ACL change approval.

## Immutable evidence at time of handoff

| PR | Read-only HEAD snapshot | Status |
| --- | --- | --- |
| [Core privacy #739](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/739) | `2778f873aea932ce3e90507e1faadead0b3f582c` | DRAFT/open, mergeable=false |
| [Poster ACL #721](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/721) | `b6b24f2f48eb950f3cfca407ebcfb10095432cf5` | DRAFT/open, mergeable=true, not accepted |
| [Cleanup/integration #744](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/744) | `7fbd74a8cf667ae5087961b17ff347154aa068c2` before this documentation commit | DRAFT/open, not accepted |

Concurrent branch HEAD movement was observed during this task; **always reread exact HEAD and blob before every edit/test/review**. One test-file content update encountered HTTP 409 and was deliberately retried from a newer HEAD and blob, without overwriting concurrent work. Mergeability is not a release gate by itself.

## Option 1: Core private Google Sheets

- **Direct owner Drive permissions read-only today:** Core workbook still contains `anyone/reader`, `allowFileDiscovery=false`; sharing is broad link access, but no customer-data exfiltration has been demonstrated. No permission was changed.
- New source-only change on Draft #739: [`f8e66f6`](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/f8e66f6224a746b6411c52714705c4e90a29657c) rejects arrays, objects, booleans, numbers, null and other non-string cell values in the authenticated Apps Script private Core response. This validates the actual `getDisplayValues()` string-cell contract before CSV/Admin processing. Preserves empty-string cells and valid string arrays.
- Added focused Node regression in [`6b384df`](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/6b384df0aa4eb0d8623fdace37d3ab83faf69d4d), with six malformed synthetic values. At latest readback, source blob `53b1df0590d22bf8f98574264a814a68e28e5bcb` and test contain the intended guards.
- **Actually executed:** 7/7 source-extracted V8 mock scenarios PASS (one valid string matrix + six malformed matrices), no network, no customer cells, no credentials. Script and test JS parsing was checked. **Not executed/NOT green:** native full repository Node tests, exact-current-HEAD hosted CI, live Apps Script read, authenticated 13/13 Core datasets, negative key-isolation and public no-GViz/PII browser checks, Admin/Booking/LINE end-to-end, rollback.
- Owner-selected future path remains **dedicated Apps Script private read key**, not a new Service Account. Key provisioning, strict flag, transport and ACL restriction are held until separate owner acceptance; never remove `anyone/reader` before a fully rehearsed safe cutover.

## Option 2: Drive Poster ACL

- **Direct Sheets scoped read-only today:** `01_Events!A5:I1000` and `08_Web_Ready!A5:J1000` yielded **73** visible Oct–Dec 2026 event/date cards, **48** active Drive thumbnail references, **39** unique active image IDs; **0** Core/WebReady URL divergence and **0** duplicate IDs in the scanned range. The current Draft #721 manifest contains 39 pinned IDs; stale 74-card count from 17 Oct is superseded.
- **Direct Google Drive metadata read-only today:** all **39/39 active pinned images are image MIME and anyone/writer** (read in four batches, 10+10+10+9, zero errors); all **4/4 pinned Brand/Poster folders are anyone/writer**, zero errors. Their discovery flag is false, which does **not** make them private. The prior **209 historic files** date to 14 Oct; they were **not** all rechecked today. Anonymous image decode and historical inheritance provenance are not verified.
- New Draft #721 [`d93ddeb`](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/d93ddeb3f99f735007064330e17dae7563ec88ca) corrects the `reader_verified` reporting counter to include only genuine `VIEW` roles and separately reports `restricted_historical`. An owner-private history image can no longer be falsely called a public Reader. Regression additions [`b6b24f2`](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/b6b24f2f48eb950f3cfca407ebcfb10095432cf5) check after both simulated batches. Exact source/test GitHub readback confirmed.
- **Actually executed:** isolated exact-source JavaScript V8 full owner-script mock with 73 visible cards/48 refs/39 active IDs, four folder nodes and one private historical image: simulated first 25 then 14 active-only image writes; **0 simulated folder/history writes**; new counters 25/39 public Readers, one restricted historical image; stale fingerprint rejected; end-state folder writers held and `active_scope_completed=false`. This is a **mock**, not a real Drive ACL update or a native Node full suite.
- Default owner Apply stays guarded by non-hex placeholder; never install a trigger or call `setSharing`. New Drive owner Dry Run/reviewed complete descendant fingerprint, direct historic role re-audit, inheritance-safe parent-folder plan, 48-reference anonymous image decoding and explicit permission-batch approval remain required. Keep [#718](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/718) and [#743](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/743) unresolved.

## Option 4: cross-Draft no-cost compatibility / test status

- GitHub changed-path overlaps computed from current PR filename inventories: **#739/#744 = 26 paths; #721/#744 = 9; #739/#721 = 1 (`package.json`)**. These are potential integration conflicts, not proof of text conflict on every path.
- Confirmed distinct source blobs between #739 and #744: `server/core-sheet-apps-script-reader.js`, `server/core-sheet-private-reader.js`, `server/admin-sheet-fallback.js`, `scripts/core-private-cutover-preflight.cjs` and `apps-script/Code.gs`; `api/kk-data.js` matched at observed revisions. #721/#744 owner ACL script, owner tests, read-only script and `package.json` have distinct blobs. **Do not cherry-pick or overwrite entire files blindly.** Revenue and storefront gates also need regression before integration.
- Snapshot main divergence at review: #739 was 118 commits ahead / 2 behind and **mergeable=false**; #721 68 ahead / 2 behind and mergeable=true; #744 82 ahead / 0 behind and mergeable=true. Exact HEAD can change concurrently, and these counts are not evidence of compatibility.
- For each observed PR latest HEAD at that checkpoint, GitHub PR-triggered workflow runs **0** and combined statuses **0**. [skip ci] Draft commits were deliberately used to avoid unapproved CI/Preview usage. **No native full repo, hosted exact-head, rendered browser QA or live Admin/Booking/LINE tests were run or accepted in this task.** Do not call any workflow or Production acceptance PASS based solely on this handoff.
- No paid runners, service upgrades or external automation were started; no Google/Vercel secret values were fetched. Source-only/synthetic validation does not certify Google Apps Script permissions, real user-facing image decoding, or financial parity.

## Mandatory remaining Safety Gates / owner decisions

1. Obtain an approved **zero-extra-cost complete exact-repo checkout** or owner-approved existing free runner; execute Node security/ACL/visual/revenue/LINE tests against **one immutable integration SHA**. Preserve logs/artifacts and verify known failure counts rather than relying on YAML existence. No paid or provider-mutating test harness.
2. Manually reconcile #739/#744 Core transport default, Apps Script, fallback, public proxy, CSS and Finance/Revenue code; reconcile #721/#744 ACL files and all three `package.json` copies. Exact-source tests on separate branches **cannot** prove the combined release is safe. No PR merge/rebase/deploy without separate permission.
3. For Core: owner-provisioned independent Apps Script private-read key, **13/13 actual authenticated private datasets**, no-GViz/PII signed-out negative tests, Admin/Booking/LINE/Storefront parity and documented rollback. Only then separately approve private ACL cutover and independently verify anonymous denied.
4. For poster: verify all live active+historical asset ACLs and folder-inheritance blast radius, owner standalone Drive Dry Run + fingerprint, anonymous thumbnails and official event artwork match, negative/rollback acceptance, independent owner-approved per-batch Apply only **after** gates. Folder writes remain prohibited in current source.
5. Explicit owner acceptance required for any Merge, Deploy, Production/config/secret change, Google/Drive permission change, customer or Booking mutation, Automation state change, paid runner, or PR closure. Current gate status: **P0 HOLD**.

**Observed operations performed for this work:** GitHub Draft source/tests/evidence only; read-only GitHub, Google Sheets event/poster references, and Google Drive metadata; no network from local V8 tests. **Production/Google Drive permission/customer/Booking/LINE/Automation writes = 0; merges/deploys/PR closes = 0.**
