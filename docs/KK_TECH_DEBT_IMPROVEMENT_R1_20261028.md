# KK Phone Rental — Isolated Technical Debt Guard (R1)

**Date:** 2026-10-28 (ICT)  
**Base:** exact main commit `57ec0227193ea186f034e1628ed331e33620dcc6`  
**Scope:** four NEW files on `audit/tech-debt-guard-20261028-r1`; no changes to any existing runtime, booking, storefront, Apps Script, workflow or deployment code.

## Codex collision avoidance

- Branch is separate from Codex's existing Draft #744 and all other active PRs.
- This branch only adds `scripts/kk-tech-debt-baseline.cjs`, `tests/kk-tech-debt-baseline.test.js`, `docs/KK_TECH_DEBT_BASELINE_20261028.json` and this document.
- No edits to package.json, `.github/workflows/*`, `vercel.json`, `script.js`, `admin/*`, `apps-script/*`, Google Sheet data, Booking, LINE, Secrets, permissions, Make or Supabase.
- Do not auto-merge, deploy, create a Preview, rebase over concurrent work, delete old branches, or cherry-pick without refreshing the latest main and checking intersections.
- No Draft PR automatically created, specifically to avoid triggering extra PR-based CI workflows / unknown quota. Branch + document provide durable cross-chat handoff.

## Improvement delivered

The new offline, dependency-free Node script measures only aggregate static code indicators from a fixed list of seven project files, and compares them against the source-dated baseline. It does not load credentials, network, customer data, APIs or Production services. Existing debt is inventoried but **not treated as a test failure**.

| Metric on pinned main | Recorded baseline |
| --- | ---: |
| `script.js` | 1,907 lines, 15 innerHTML assignment sites |
| `admin/admin.js` | 3,735 lines, 49 innerHTML assignment sites |
| `apps-script/Code.gs` | 3,281 lines |
| Legacy server public GViz references | 2 total (1 in each server module) |
| Direct Google Sheets URL string in customer `script.js` | 0 |
| API-only / browser direct-fallback guard flags | 3/3 present |
| npm scripts in package.json | 42 |
| Syntax check shell command length | 7,380 characters |

These are maintainability/review indicators, **not** proof of XSS, PII exposure, or production exploitability. The existing public GViz reader sites remain a separate protected Core Privacy cutover gate. This tool intentionally does not alter them.

## Running without installation or extra provider usage

```bash
node scripts/kk-tech-debt-baseline.cjs --json
node scripts/kk-tech-debt-baseline.cjs --check
node --test tests/kk-tech-debt-baseline.test.js
```

`--check` fails only for new regression relative to the recorded baseline: removal of API-only browser guards; newly added direct-browser Google Sheets URL; increase of legacy public GViz references; growth of one monolith by more than max(200 lines, 10%); proliferation of >10 extra npm scripts; or loss of test entrypoint. Missing source files or invalid baseline fail closed without exposing source text.

## Local native verification

- Native `node --check` of both new JavaScript files: PASS.
- Native Node `node --test tests/kk-tech-debt-baseline.test.js`: **12/12 PASS**, 0 skipped, 0 failures, with temporary synthetic file fixtures.
- Regression cases cover baseline pass, every browser protection, added public GViz, added direct URL, oversized growth, script proliferation, missing test entrypoint, stale baseline, missing source, fixed read-only paths and safe aggregate output.
- This is **not** full repo CI, not a live Google authenticated read, not browser E2E, and not proof of P0 closure.

## Future work and handoff

1. Verify exact SHA and four GitHub file blobs after branch commits; compare against the latest main to ensure four additions only and zero conflicts.
2. Before future adoption, refresh this baseline after Codex's current main changes and have Codex/owner review any new source/module ownership.
3. If quota and authorizations permit later, hook `--check` into an already approved zero-cost CI test group, preferably without starting separate workflows.
4. Prioritize protected Core Privacy #738/#739, Poster ACL #718/#721, Booking/LINE #796, release issue #49 and Scanner #777. This new static guard does not replace any Safety Gates.

**Actual writes:** branch-only new files and source code. **No merge, deploy, Studio/Drive ACL, business-data, Booking/customer, price, payment, Agent or Automation writes.**
