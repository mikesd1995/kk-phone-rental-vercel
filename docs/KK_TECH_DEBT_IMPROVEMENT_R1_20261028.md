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

## Exact readback and completed acceptance — 28 Oct 2026

**GitHub branch:** `audit/tech-debt-guard-20261028-r1` based on `main` `57ec0227193ea186f034e1628ed331e33620dcc6`.

| File | Git blob SHA (matches exact native-Node-tested local copy for source/test/baseline) |
| --- | --- |
| `scripts/kk-tech-debt-baseline.cjs` | `450bdd9d272487026d452a5d8346742162d1f721` |
| `tests/kk-tech-debt-baseline.test.js` | `2dec5f2e2371eb324b1b06af17b0ec3a09e214e0` |
| `docs/KK_TECH_DEBT_BASELINE_20261028.json` | `7fcbb7fa3ac128520a5fda5ca517e6d6fa660d16` |
| This handoff, before acceptance addendum | `95dee53c415925b4ce18aecad03fae936f658c3b` |

**GitHub commits:** `b1524622` checker, `fa23a3a2` native Node tests, `6ade5551` baseline JSON, `acb160ff` initial handoff.

**Native commands executed against exact SHA-matching source/test:**

```text
node --check scripts/kk-tech-debt-baseline.cjs       PASS
node --check tests/kk-tech-debt-baseline.test.js     PASS
node --test tests/kk-tech-debt-baseline.test.js      12 PASS / 0 FAIL / 0 SKIP
```

**Connector readback:** all four files found on separate branch; compare `main...audit/tech-debt-guard-20261028-r1` yielded **ahead 4, behind 0, four `added` paths, zero changed existing paths**. Codex Draft PR #744 remained at `a742fcb2a0f373eacccf9f4f8a31a8a133a68667` when checked; no write or merge to that branch. Vercel Production was **READY** at `57ec0227193ea186f034e1628ed331e33620dcc6`, deployment `dpl_4UsZU37NDxvoSPNL7CPKJY65mZhm`. This work did not initiate that deployment.

**Release disposition:** Source-only tooling delivered and locally verified; existing issues and Production security remain OPEN. No GitHub-hosted Actions, preview builds, CI integration, PR creation, Production writes or provider usage were initiated. Next owner/Codex review may cherry-pick only the four new files after checking latest Main, without overriding active P0 work.

## 2026-10-28 R2 — Guard blind spots closed, no Codex overlap

**Starting reference:** main and production `57ec0227193ea186f034e1628ed331e33620dcc6`; Codex Draft #744 HEAD `a742fcb2a0f373eacccf9f4f8a31a8a133a68667`. This is a follow-up on the isolated audit branch, **not** a main or Codex-branch update.

### Before / after

| Regression category | R1 | R2 |
| --- | --- | --- |
| New public-source URL references in customer browser | `script.js` exact Google Sheets path only | Also inspect `script.js` **and** `config.js` for direct Sheets, Apps Script and GViz literal references |
| Public API boundary | API-only, fallback disabled flags | Also check `apiEndpoint: '/api/kk-data'` |
| New HTML rendering sink | Count only | Flag added `innerHTML =` assignments for manual review; **not** a declaration of XSS |
| Build-check proliferation | npm script count only | Also flag unusually long new `scripts.check` expansions |
| Baseline corruption | Schema/version check only | Validate R2 guard counter fields and baseline shape, fail closed |
| Existing code technical debt | Measured, does not fail | Still measured; no change in production risk |

**Exact R2 commit/readback evidence:**
- Source patch `5e5807cb589e05ff01e626ce4598aba219c907f8`, blob `b3586df4a26885dc6558ac84a0d75bbfdd3af1ce`.
- Regression tests `79391ee4a83714745e117f7125edd3620b614848`, blob `64f1cd903cac9b91abe3ee6b7b27bcef959772a8`.
- Pinned JSON baseline `8854f03fde1865d9f77f68e84fade19eff1aabdf`, blob `c8c7049cb8024d3a758a158f21aeb322cdfec214`.
- After each update, GitHub **branch content readback matched new blob SHA and full text**. Git compare before this documentation append: **8 ahead, 0 behind, exactly four added paths, 0 existing paths modified**, no overlap with Codex #744 changed file set.

**Executed tests:** 18/18 PASS (0 failed) using the exact updated JavaScript source with isolated V8 and in-memory mock implementations of Node's `fs`, `path`, `os`, `assert` and test registry. This included all 12 original cases and 6 additional tests: newly added config Apps Script source reference, storefront GViz reference, HTML sink, sink reduction, long check-script growth, and malformed extended baseline. A first harness run got 17/18 because the V8 test harness failed to provide the `process` argument; **no R2 code was committed on that failure**. After fixing that harness, 18/18 passed and all three source/test/baseline files were committed with exact full-content readback.

**Test tier limitation:** R2 is exact-source **isolated V8 synthetic acceptance**, not native `node --test` on the updated branch, not a GitHub-hosted Actions run, and not customer-browser E2E. The prior R1 native Node 12/12 result does not automatically cover R2. Require native `node --test tests/kk-tech-debt-baseline.test.js` on the exact R2 revision before adopting it as a required CI gate.

**Code guard limitations:** Static literal-pattern scanning cannot guarantee absence of dynamically constructed URLs or XSS. New `innerHTML` assignments are a review trigger only. This tool remains observational and read-only. It must never be used to waive Core Privacy #738, Poster ACL #718, Booking #796, scanner #777, or Final Production Gate #49.

**Operations:** No new GitHub-hosted CI, PR/Preview, Vercel deployment, Apps Script deployment, Secrets, price, customer Booking, LINE, Drive ACL, Google Sheets or production automation writes occurred. No paid services used. Next safe step: native exact-branch Node test and then owner/Codex review of independent branch as an optional guard with no runtime changes.
