# KK Phone Rental — Isolated Technical Debt Baseline
Date: 2026-10-28 (Asia/Bangkok) | Source-only Draft | No Production changes

## Purpose

Existing Technical Debt is repeatedly inspected by hand across overlapping Draft PRs. This addition makes several source indicators reproducible **without rewriting any shared Codex runtime files**. It is not security certification or Release Acceptance.

### Changed files — exactly three new paths

1. scripts/kk-technical-debt-baseline.cjs — standalone dependency-free source-only scanner. Fixed allowlist of five source files for maintainability line counts, two server legacy GViz-marker locations, two API-only Browser guard source witnesses, package script/check-command lengths and a Vercel ignoreCommand presence indicator.
2. tests/kk-technical-debt-baseline.test.js — 8 native node:test cases: source-only normal/negative fixtures, file-not-found UNKNOWN, deterministic CRLF line counts, monolith review warning, no raw source/fixture-secret echo, legacy-marker classifications, and explicit strict-browser CLI exit.
3. This handoff file.

### How to run

    node scripts/kk-technical-debt-baseline.cjs
    node scripts/kk-technical-debt-baseline.cjs --strict-browser
    node --test tests/kk-technical-debt-baseline.test.js

Default checker exits zero, even for existing debt, so it does not disrupt Codex, Preview or the existing CI workflow. An explicit --strict-browser exits 2 only if Browser API-only static markers disappear. It does not claim live browser or authentication verification.

Output: JSON with ONLY fixed source paths, numeric counts, boolean/source markers, safe constant codes and limitations. No .env, customer record, Google Sheet, Script Properties, LINE secret, Vercel credential, provider call, paid dependency, file write or live deployment.

### Existing debt still outside scope

- Core Privacy P0: Core Sheet anyone/reader persists; dedicated protected Private Reader Production ENV not configured. PR #739 focused CI passed but real 13/13 owner-authenticated private-source reads, Booking/LINE/Admin parity and owner-approved cutover remain pending. https://github.com/mikesd1995/kk-phone-rental-vercel/issues/738
- Poster ACL P0: current active artwork Google Drive metadata shows anyone/writer, as do older poster folders and historical assets in earlier scans. PR #721 focused CI passed; owner Dry Run/fingerprint, safe staged permission update and image QA still pending. https://github.com/mikesd1995/kk-phone-rental-vercel/issues/718
- Booking P0: PR #796 targeted acceptance green but Apps Script live E2E and shared two-phone date/stock protection not accepted. https://github.com/mikesd1995/kk-phone-rental-vercel/pull/796
- Codebase architecture: script.js roughly 1,900 LOC; admin/admin.js roughly 3,700 LOC; apps-script/Code.gs roughly 3,200 LOC on checked main. These are review signals, NOT proof of defects. Major overlapping cleanup PR #744 remains Draft. https://github.com/mikesd1995/kk-phone-rental-vercel/pull/744
- Runtime/Scanner observability: Supabase main ledger HEALTHY, but read-only aggregates still show 2 QUEUED scanner commands, 0 runtime observations, 0 agent invocations and 0 admin write receipts. Do not replay old commands. https://github.com/mikesd1995/kk-phone-rental-vercel/issues/777
- Full repository CI, Production browser acceptance and overall Stable Business V1 are separate, still held. https://github.com/mikesd1995/kk-phone-rental-vercel/issues/49

### Codex collision protection

A fresh GitHub main comparison showed HEAD **57ec0227193ea186f034e1628ed331e33620dcc6** as the starting point; main had advanced while this task was running, including Canonical Owner OFF/GAS work. New isolated branch: audit/tech-debt-baseline-readonly-20261028. No existing file, package.json, .github/workflows, production code, Booking/Sheet, Secret, ACL or deployment was edited. Do not force-push over Codex, alter its PR, auto-merge or independently enable a new workflow. Refresh main/PR HEAD before any future integration; if Codex independently introduces an equivalent checker, compare the paths and retire this Draft safely.

### 28 Oct connected GitHub main — actual read-only baseline witness

Directly read the eight fixed sources from main after creating the isolated branch; observed:
- script.js **1,906** physical lines; admin/admin.js **3,734**; apps-script/Code.gs **3,281**; api/kk-data.js **498**; server/admin-sheet-fallback.js **418**.
- Browser source witnesses **both true**: config.js has API-only flags and script.js defines a throwing directSheetUrl. This is **static contract evidence only**, not a signed-out browser check.
- Legacy public GViz/CSV string markers still present in both api/kk-data.js and server/admin-sheet-fallback.js. The checker classifies them as REVIEW_LEGACY_PATH, not proof of a presently reachable vulnerability.
- package.json has **42** scripts and a **7,380-character** syntax-check command; vercel.json declares ignoreCommand. This documents review debt, not build failure.
- Source module line thresholds are review prompts (2,000/3,800/3,400/650/550), so these observed line counts do **not** trigger monolith-threshold warnings at this checkpoint.
- No secret value, Booking/customer row, Core data mutation, Vercel environment value or network fetch was used in this static source inspection.

### Test provenance and limits

Native local Node v22.16.0: syntax checks passed, 8/8 node:test synthetic fixture cases passed; GitHub source/test file content must be verified by exact Git blob SHA before treating those local results as evidence for the committed files. No full npm test or GitHub-hosted test has been claimed. These source-marker tests can be bypassed by dynamic code and are NOT a penetration test; offline sample warnings cannot prove that Production leaks data.

**Outcome:** A safe, reusable Debt Baseline instrument exists for review; this does not close Security, Booking, Scanner, Poster ACL or Stable Business release gates. Owner approval remains required for any later Merge/Deploy or protected business modification.
