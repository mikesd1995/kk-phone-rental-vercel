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
