# KK Phone Rental — Core private read-key readiness regression (2026-10-18 ICT)

**Source-only / Draft PR #739 / SECURITY P0 HOLD.** This report does not authorize an Apps Script installation, deployment, Google permissions/secret change, Booking/customer write, PR merge or paid CI run.

## Exact observed source revision / repaired defect
- PR branch: `fix/core-sheets-privacy-private-read-gates-20261014`. Observed HEAD immediately before this evidence write: `d3683a2cd5efcc424d5bc07f56da3193ededaa7f`; re-check HEAD and file blob before every subsequent edit.
- Before the repair, isolated exact-source V8 verification found `assess()` reporting `ready:true` for private keys padded with leading/trailing whitespace or a newline, while `server/core-sheet-apps-script-reader.js` rejects the same malformed raw keys. Three malformed cases were RED (false readiness).
- Fix commit [94768f2](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/94768f2345e325eceb37c957befb8d1edf1e4cb8): `scripts/core-read-key-owner-setup.cjs` now retains `rawRead` and requires `reader_key_exact_format:rawRead===read`. Blob `2ce4cb9d9ff6f9307edf465c253952461ad621ce`.
- Regression commit [4a34e11](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/4a34e11a11c0b3e7135c793e0a6be4231d2a48ea): `tests/core-read-key-owner-setup.test.js` now covers leading, trailing, literal backslash-n, actual newline and tab inputs, plus accepted exact-format key. Blob `0d398044999dec7a3d568b79af9d68b662d665b7`.
- Source files were read back from GitHub at their write commits and again on a newer concurrent PR HEAD, confirming both fixed blobs remained intact. No key was generated or read from Production.

## Test confidence, explicitly separated
1. **PASS (limited):** Seven key-format cases executed against GitHub-fetched owner `assess` function in an isolated JavaScript V8 runtime; syntax compiled successfully. The malformed-key regressions now fail closed.
2. **NOT RUN / NOT ACCEPTED:** Native Node full repository `npm test` / exact-head full security suite. The isolated container has Node 22.16.0 but GitHub clone fails DNS; there is no mounted exact-worktree copy. Do not relabel V8 checks as native Node.
3. **NO HOSTED EXACT-HEAD GREEN:** GitHub Actions PR workflow runs, commit statuses and check-runs were empty for the observed HEAD checked during this execution; there was no manual Actions dispatch/rerun. Concurrent external HEAD commits mean any previous result is not proof for the new head.
4. **NOT RUN / NOT ACCEPTED:** Real 13-source private Apps Script reads, auth negative cases with real owner key, Admin/Booking/LINE full integration, public signed-out no-GViz/PII negative checks, rendered storefront/browser QA, and live rollback rehearsal.

## Live read-only controls / retained P0
- Connected Drive metadata on 2026-10-18 still reports Core source workbook **`anyone/reader`**, with file discovery disabled. This is not evidence of exfiltration, nor a proof that the file is private.
- The owner-selected future transport is **dedicated Apps Script private reader**; do not substitute the excluded Google Service Account approach. No private owner key was provisioned and no production private-cutover flags were changed here.
- Core privacy must remain P0 **HOLD** until 13/13 owner-authenticated private dataset schemas, isolation of read/admin credentials, public boundary checks, exact-head native/CI, end-to-end booking/admin/storefront and rollback all pass. Only after owner authorization and proven zero-downtime cutover may Core `anyone/reader` be revoked and anonymous access verified denied.

## Cross-PR integration / no-cost governance
- #739 and poster #721 both touch `package.json`; #739 and cleanup #744 have 26 overlapping paths (per read-only PR filename inventory), including private reader code/tests. These changes have **not** been integrated or regression-tested in one exact tree. #739 currently reports mergeability blocked.
- **Actual changes in this execution:** two safe Draft file commits, readbacks, bounded external metadata reads and isolated source validation. **Actual provider/Production/permission/customer/Booking/Automation writes: 0**; **merge/deploy/PR-close/manual CI dispatch: 0**.
- Cross-reference [Poster draft #721](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/721), [Core incident #738](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/738), [Draft #739](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/739) and [Cleanup draft #744](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/744). Continue only after rereading latest source HEAD; do not cherry-pick broad PRs or approve a release from this evidence alone.
