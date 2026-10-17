# KK Poster ACL — 2026-10-15 active-only manifest refresh (source-only)

**RELEASE HOLD / NO PERMISSIONS MODIFIED.** Scope: existing Draft PR #721 only, based on original HEAD `6f7b32addd43a651dd69c9dadc176dfd59b88191`.

## Native Google Sheets and Drive evidence
- Canonical Core 01_Events rows 5–900 and generated 08_Web_Ready rows 5–900 read with authenticated native Google Sheets connector on 2026-10-15.
- Exactly **76** visible (show or show_full) Oct–Dec 2026 event-date cards; exactly **44** Drive thumbnail references / **35** distinct active image IDs; **zero** Core ↔ WebReady poster mismatches. Previously pinned manifest was **42/33**, now refreshed to **44/35**. No images removed; two new active IDs added.
- Added `1HFY4aRt9jFDME1KXtGMCNakRZyCEpHgl` (LYKN original PNG): authenticated Drive metadata confirms parent `1m6sOf1vl6l_tHscb-tNkTUjlEy82ELHl`, PNG, anyone/writer.
- Added `1yMVpy4pNNuitIb6FFsBiEo4y9-ogFA2i` (JPEG): authenticated Drive metadata confirms parent `1haTk15ElLwZM8NFcLvK36tbyLZo5wnzw`, JPEG, anyone/writer.
- Both folders already in the approved four-folder scope. No unexpected replacement/removed IDs. Entire historical image tree and 209-file historical count **not re-audited today**; stress-test synthetic 244 files / 209 historical is not a current production inventory claim.

## Source change
1. Update exact sorted pinned active image IDs in both standalone READ-ONLY preflight and owner-only ACL script; require 76 cards, 44 references, 35 distinct IDs, exact zero Core↔WebReady drift.
2. Keep `KKACL_WRITE_SCOPE='ACTIVE_ONLY'`, maximum 25 ACL writes **per independently reviewed owner fingerprint**, no installed triggers. Do not permit updates to archived, hidden or private images; no scope widening.
3. Update mock regression fixture for 35 images + 4 reviewed folders + 3 synthetic historic files; verify 25+14 active-only batches with distinct owner dry runs and zero historical writes.
4. Keep previous full-history issue #743 OPEN and site/customer Core privacy issue #738 independently HOLD. Even successful active-only remediation must not report full scope `ok=true` if historical writers remain.

## Exact execution evidence and remaining gates
- On freshly retrieved source, isolated JavaScript V8 mock **6 safety scenarios PASS**: 35/44 read-only inventory, zero-write standalone preflight, stale fingerprint refusal, first batch 25, second batch 14 leaving historical HOLD, 44→43 reference drift blocked with zero writes. Simulated Drive permissions only; **no live Google Drive ACL calls changed permissions**.
- Exact-head native Node test suite / hosted CI **NOT YET ACCEPTED**; source commit intentionally uses `[skip ci]` to avoid unverified free-tier build/artifact resources.
- Before a real owner ACL change: authenticate Apps Script authority, run fresh standalone Dry Run against all images/folders and compare fingerprint, confirm zero inherited history side-effects, perform separate owner review and approve each batch; read back permissions and storefront image availability, then audit history separately.
- Never Merge/Deploy/execute Apps Script or setSharing until owner approvals, privacy policy, credentials and release gates pass.

Related: #718, #721, #743, #738 and project closure #49.
