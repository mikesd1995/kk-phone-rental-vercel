# KK Phone Rental — Security Google Sheets Phase A (tasks 1–4), 18 Oct 2026 ICT

## Scope, policy, last readback
The owner requested Phase A: (1) resolve three OpenAI optional source/design failures, (2) diagnose/fix mobile/visual/poster QA, (3) execute a complete native Node Core privacy suite, (4) reconcile PR #739 against latest Main, cleanup PR #744 and revenue PR #737. **Draft source only**, no Merge, Deploy, Production/Google Drive permission, customer, Booking, price, secret, or paid-provider changes. Google Service Account task was previously cancelled by owner.

**Security candidate:** Draft [PR #739](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/739), branch `fix/core-sheets-privacy-private-read-gates-20261014`. At the start of this turn HEAD `39e759f6af9d5d955bec3d46ab826bc86158f958` (37 changed files, GitHub mergeable=false). New isolated hardening commits this turn: `0800a6ca2a0a1a75871424ca30ca7cb61fb01c2b`, `f2130c7d608e9a2b62fb14fcab4c541f898dcb5f`. All merge/release gates remain HOLD.

## Phase A1: old OpenAI 3/69 failures — source repairs verified, hosted acceptance pending
- Old **non-current SHA** `84713248674eb1035fbff2326883089f5f67a319`: OpenAI Optional run #38605320815 showed 66/69 PASS, 3 FAIL: obsolete V5.8 hero headline literal, V6.1 Thai how-to CTA label literal, V6.5 English how-to/venue text literals.
- Work staged **before this turn** on #739 (see `docs/SECURITY_SELECTED_1_2_3_2026-10-17.md`) updated stale source-contract expectations while retaining hero, owner-design language, actual `#booking-journey` CTA targets, layout, translation and responsive guards; tests were not silently disabled.
- **This turn** fetched all 11 referenced current-GitHub-branch source blobs and evaluated the full `tests/storefront-visual-qa-automation.test.js` 42-case source suite using isolated JavaScript V8 equivalents: **42/42 PASS**. The current code is byte-identical to the previous 17 Oct source-test checkpoint except a subsequent documentation-only commit (compare `ba022c037ecfa61deade1dbbb241434c6aba2361` → `39e759f6af9d5d955bec3d46ab826bc86158f958`: one documentation file). **No current-head GitHub-hosted Node run**, so do not say full CI green.

## Phase A2: Visual QA (partial engineering; real browser/owner screenshot not accepted)
- Actual older failed run #38605320772 exposed `CARD_CONTENT_ESCAPES`, `POSTER_LETTERBOX_UNTREATED`, `POSTER_SOURCE_DEGRADED_FALLBACK_RENDERED`, modal placement/screenshot review BLOCKED. Not a fabricated success.
- Existing staged #739 source updates preserve `object-fit:contain` official art and exact-event degraded poster fallback, apply backdrop on cached Safari images without a reliable onload event, override 100% mobile card heights with content-size, and accept truly centered owner modal or anchored sheet while rejecting clipping/offscreen/focus issues. Source/tests verified as A1.
- **Not executed**: fresh Chromium screenshot for this exact current PR branch at 320/375/390/430/480/768/1024/1440, Thai/English × dark/light, actual poster delivery, owner acceptance and screenshot fingerprint readback. No exact-head Preview deployment exists in latest Vercel list; no new deployment authorized. Remain blocked. Do NOT modify approval JSON to mark PASS.

## Phase A3: Security exact-head testing; new hardening
- Existing staging has a read-only source-only 10-suite Native Node step **before** the optional design gates in `.github/workflows/openai-platform-staging-acceptance.yml`. New standalone `.github/workflows/core-sheet-privacy-exact-head.yml` exists on #739 but is not established as registered main workflow. Both use standard Node 20/no-install and no real provider secrets or Production writes.
- **Current exact-head GitHub Actions:** zero workflow runs returned for `39e759f6...` and after the new code commits as checked. A YAML command is NOT Native Node execution. Environment's Git clone to GitHub failed DNS; no complete working checkout in container. Therefore **full native Node security suite remains UNVERIFIED**, not claimed as passed.
- **Discovered additional actionable source flaw** while reconciling #744: `server/core-sheet-apps-script-reader.js` previously trusted any rejected upstream exception whose `code` began `CORE_APPS_SCRIPT_`. A malicious/untrusted network exception could forge the prefix to pass through error classification. Implemented a private `WeakSet` of internally manufactured errors and only rethrows errors owned by this reader. All untrusted external exceptions return generic `CORE_APPS_SCRIPT_UNAVAILABLE`. Ported the safe principle from the #744 separate branch while preserving the stricter reader-key format check on #739.
- Added synthetic `tests/core-apps-script-private-reader.test.js` regression that injects `CORE_APPS_SCRIPT_fake_sensitive_fixture_never_log` on an upstream rejection and asserts generic result without that value. Exact fetched GitHub branch source isolated V8: full Apps Script/auth/privacy suite **18/18 PASS**, focused forged-error/redirect/key-config checks **3/3 PASS**. These are NOT native Node nor Google live Script API tests.
- All tested values are synthetic. No live credential generation or customer rows were used.

## Phase A4: reconciliation with Main, cleanup and Revenue
- At start of turn `git compare main...#739` on the current source showed **103 commits ahead / 2 behind**, not fast-forward-safe; PR #739 `mergeable=false` as reported by GitHub. Do not confuse GitHub main with live Vercel production, which was independently READY from commit `44de0066f0c7edd59e153b2d31c22d65b84de5af` (`fix/hero-theme-parity-20261016`) at read-only inventory.
- `PR #744` cleanup Draft (head `9427ec6093c61deb3b739fe093d61ff3f65b7b60`, 122 changed files) overlaps **26 file paths** with #739. Some snapshots are **byte-identical** for `api/kk-data.js` and `apps-script/Code.gs`; others explicitly conflict/differ:
  - `server/core-sheet-apps-script-reader.js`: cleanup had locally-owned errors, security had stricter base64url reader format. Phase A imported ONLY the locally-owned error logic into #739 and added negative test; do not replace whole file.
  - `server/core-sheet-private-reader.js`: security defaults transport to `service-account`; cleanup defaults to `none` and requires explicit opt-in. **Unresolved decision:** owner cancelled new Service Account option, but changing this legacy default might break existing contract; requires scope-specific acceptance and test update, not blind copy.
  - `server/admin-sheet-fallback.js`, `script.js`, `assets/kk-storefront-v5.css`, `server/rental-dashboard-core.js`, `server/legacy/kk-rental-dashboard-v5.js`, `package.json`, `scripts/storefront-evidence.cjs` have distinct blobs and overlapping original-line hunks. Integrate manually with contract tests; do not cherry-pick wholesale.
- `PR #737` Revenue Draft (head `943ccf4ea6f32bcb4ed95a135a04dfe1162b0bc5`, 7 paths) overlaps **3 paths** with #739: `package.json`, `server/rental-dashboard-core.js`, `server/legacy/kk-rental-dashboard-v5.js`. Revenue rule Future must derive from verified Master Booking X, not collected cash O; neither Revenue nor Security change should silently overwrite the other. Keep unrelated pricing/customer/booking writers unchanged.
- Main-to-PR security difference includes owner hero/front-end work released separately; therefore a blind merge/cherry-pick/production release could regress front-end UX or finance correctness. Rebase/merge only after reviewed conflict reconciliation and owner release approval.

## Latest independent production security checks
- Vercel metadata (secret values NOT decrypted) still lists `KK_ADMIN_SCRIPT_URL`, `KK_ADMIN_API_KEY`, `KK_ADMIN_PIN`, `GOOGLE_SHEET_ID`, but **NO** `KK_CORE_PRIVATE_READ_KEY`.
- Core owner Drive ACL still includes `type:anyone, role:reader` plus owner. This is confirmed broad link access; no demonstrated external exfiltration.
- Source-only fixes on PR #739 do NOT revoke that ACL, provision a live key, deploy Apps Script, change Booking/Price, or turn on private-only flags.

## Phase A exit decision / hard HOLD
| Task | Source progress | Fully accepted? |
|---|---|---|
| 1 OpenAI 3 failures | prior fixes + exact-source 42/42 isolated tests | **NO** — no current-head hosted Node/OpenAI job |
| 2 Visual QA | cached poster/card/mobile/center-modal fixes staged | **NO** — no current-head real Chrome screenshots or owner visual approval |
| 3 Core full Node security suite | exact-head 10-suite step staged; new upstream error hardening tested 18/18 isolated | **NO** — no current-head native full-suite execution |
| 4 Branch divergence | exact overlaps and critical differing files mapped, safe patch imported | **PARTIAL** — integration must be reviewed, no merge/rebase approval |

**Next authorized steps:** obtain new exact-head hosted standard-runner CI or a complete owner local checkout (zero cost) and run Node 10-suite + design tests; perform read-only Chromium multi-viewport visual review on the same SHA; manually reconcile Security with Main/cleanup/Revenue using a single gated integration branch; preserve other PR scopes; only then request owner approval to proceed to Phase B private-key provisioning and finally Phase C public ACL cutover. No task authorizes release or production permission changes.

**All Phase A writes this turn were to #739 Draft branch / GitHub evidence only.**


## 18 Oct 2026 — Phase A owner follow-through / exact-head checkpoint

**Owner request:** finish phase A (tasks 1–4) while remaining on Draft source only; no Merge/Deploy, production ownership/ACL, Booking/customer/pricing, secret or automation changes, no added fees. The Service Account *provisioning option* stays cancelled.

### Changed and verified on Draft (this follow-through)
- Started at observed PR #739 HEAD `6fe862aebf3826b2df1e62806da2d8d84f7889b3`. Read file blob SHA before each update; GitHub's contents writes used the exact SHA to avoid blind overwrites while other workers may update the branch.
- Commit `9d96bd31e912a66ef2eb09836af15fcf56bfda4b`: `server/core-sheet-private-reader.js` now defaults to `KK_CORE_PRIVATE_TRANSPORT=none` rather than silently selecting a Service Account. Legacy mode remains **explicit** `service-account` compatibility only; Apps Script requires explicit `apps-script`. Unset transport with strict Core read fails with classified `CORE_PRIVATE_TRANSPORT_NOT_CONFIGURED` before any read.
- Commit `bd02b61cc5d834601d719217576748f9c209c3e7`: `tests/core-sheet-privacy-cutover.test.js` synthetic legacy fixture explicitly opts in to `service-account`, and adds a negative test that even populated legacy env credentials cannot override a missing transport.
- Commit `f1b9a17427866d54375c82f1dcbcd02044457e3b`: add safe no-secret missing transport code to `scripts/core-private-cutover-preflight.cjs`.
- Commit `c5d06758e6cfeb119c6f9cd074a6653e1a005071`: add two regression tests to `tests/storefront-visual-qa-automation.test.js` preserving P1 blocking of escaped card details, untreated letterbox, webpage screenshot service, and centered/bottom mobile modal containment/focus. **Do not** weaken screenshot gates or forge owner approval to get a PASS.
- Commit `8c5457e0fc4763a6dd4036a0df6591272b09a039`: align Apps Script private reader test with no implicit transport and explicit legacy compatibility.
- Commit `2778f873aea932ce3e90507e1faadead0b3f582c`: `tests/core-private-cutover-preflight.test.js` sets explicit synthetic legacy transport and adds fail-closed no-transport preflight negative test (0 network/row reads).

### Exact GitHub-source **isolated V8** checks (NOT hosted CI/native Node)
- Visual source + synthetic poster/card/modal blockers: **44/44 PASS** at commit `c5d06758...`, including source readbacks for production stylesheet, JS, page markup, visual runner and workflows.
- Apps Script private-reader, doGet, auth separation and log safety: **20/20 PASS** at exact HEAD `2778f873...`.
- Core 13-source preflight suite with intentional fake reader: **9/9 PASS** at exact HEAD `2778f873...`. Configuration fail-closed check does not touch Google.
- Source syntax parsed for all **6/6 changed critical JavaScript** files (including new tests) at HEAD `2778f873...`. CSS/YAML are not JavaScript and were not passed off as syntax-tested by this check.
- These are 73 distinct isolated checks total (44+20+9), not equivalent to native repo `node --test`, actual real Private Google data, GitHub-hosted exact SHA acceptance or real Chromium visual screenshot.

### Exact HEAD hosted job status / blockers
- The last GitHub-hosted PASS/FAIL run at SHA `84713248674eb1035fbff2326883089f5f67a319` is **STALE** and cannot certify these newer commits: earlier Ultra Deep, Booking and Vercel source checks passed; old OpenAI 3 design assertions and Visual QA failed at that old SHA.
- Exact HEAD `2778f873...` GitHub workflow-run query reported **zero runs** (NOT PASS). Neither normal Draft push to branch nor presence of new PR-only workflow file `core-sheet-privacy-exact-head.yml` provides native acceptance by itself. No manual Actions run/rerun/release was executed.
- The environment's GitHub CLI/network cannot resolve GitHub domain (container DNS blocked); complete repo worktree / native Node tests and live Chrome screenshots cannot be validated locally. Re-running stale SHA jobs or forcing PR Ready would not prove current Draft SHA. Do not use paid browser automation or unknown-cost new provider services.
- A1 old OpenAI 3 literal design tests have been corrected at source and visual contract source now passes; A1 **hosted test remains UNVERIFIED**. A2 known CSS/poster/mobile fixes and source blocking tests pass; A2 actual 320/375/390/430/480/768/1024/1440 TH/EN×dark/light screenshot and owner visual acceptance are **BLOCKED**. A3 exact-head full 10-suite native Node security workflow exists, but latest HEAD has **0 hosted runs**, so it is **NOT ACCEPTED**.

### A4 branch collision inventory, checked against latest refs
- Main HEAD `a54a348dd3258d87b1ec0c70e6ffd255d4678018`. At `2778f873...`, GitHub compare `main...#739` reports `status: diverged`, **120 ahead / 2 behind**. PR #739 remains `draft=true`, `mergeable=false`. Front-end owner changes already live elsewhere; do not blindly merge even if conflicts are resolved mechanically.
- PR #744 cleanup HEAD `9427ec6093c61deb3b739fe093d61ff3f65b7b60`: **26 overlapping modified file paths** with #739. `api/kk-data.js` blob identical between both candidate refs (`50b721636570169ba7337e755283ca421d7bd0cd`), but `server/core-sheet-private-reader.js`, `server/core-sheet-apps-script-reader.js`, `server/admin-sheet-fallback.js`, `apps-script/Code.gs`, `script.js`, `assets/kk-storefront-v5.css`, `scripts/storefront-evidence.cjs`, `package.json` and rental dashboard code differ. Merge requires hunk-by-hunk owner reviewed reconciliation, preserving no-public GViz and explicit transport.
- PR #737 Revenue HEAD `943ccf4ea6f32bcb4ed95a135a04dfe1162b0bc5`: **3 overlapping paths** `package.json`, `server/rental-dashboard-core.js`, `server/legacy/kk-rental-dashboard-v5.js`. All three current blob SHA differ among #739, #744 and #737. Preserve revenue rule **Future derives from verified Master Booking X, never cash collected O**. No automatic cherry-pick, merge, rebase, or price/booking write was attempted.
- Actual Vercel Production READY at readback is `44de0066f0c7edd59e153b2d31c22d65b84de5af` on separate `fix/hero-theme-parity-20261016` track; this is **not** PR #739. Google Core ACL remains `anyone/reader`, Vercel metadata no `KK_CORE_PRIVATE_READ_KEY` or Core strict flags. This is a confirmed current privacy P0 risk, not independently proven exfiltration.

### Phase A exit decision
- **SOURCE READY (bounded):** A1 corrected stale 3 design assertions, A2 staged technical render fixes + additional fail-closed QA tests, A3 explicit transport selection + stronger simulated privacy/preflight tests, A4 exact overlap/merge-safety matrix.
- **NOT FULLY ACCEPTED / HARD HOLD:** A1 old failures have no updated hosted green; A2 lacks exact SHA screenshot/owner reviewer acceptance; A3 lacks native full-suite/registered exact SHA CI green; A4 remains branch-diverged with critical financial/security collisions. These cannot be marked DONE based only on isolated V8 source tests.
- **Safe continuation:** obtain exact-source native Node 10-suite and Chrome visual evidence using standard public GitHub Actions on the CURRENT SHA when workflow admission is possible and budget/no-provider gates verified, inspect artifacts/negative cases, perform manual hunk-level integration on Draft and re-test, then request distinct owner cutover approval. Never enable Private reader or revoke Drive ACL until 13 real owner-authenticated private source reads and no public fallback plus rollback acceptance.
