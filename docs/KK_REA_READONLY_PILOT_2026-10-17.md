# KK Phone Rental — REA read-only pilot / cross-chat handoff (2026-10-17)

## Objective and decision
Evaluate [REA](https://github.com/morluto/rea) as a supplemental reverse-engineering / evidence tool, not a replacement for Storefront Visual QA, `storefront-evidence.cjs`, browser acceptance or Code Intelligence. Focus: stylesheet load order, actual browser CSS, missing posters, modal/theme visual regressions. Static code analysis **does not prove** Production behavior.

## Constraints
- No paid upgrades, additional deployments, Merge, security changes, owner/customer/booking/price writes or new automations.
- No credentials, LINE images, identities, storage values, HAR private payloads or private admin sessions in collected evidence.
- Use disposable loopback-only Chrome profile; prefer local test mirror. Do not expose CDP externally.
- Every report must distinguish **observed** vs **not executed** and specify source commit/deployment/viewport/timestamp.

## Actual investigation on 2026-10-17
1. REA [source](https://github.com/morluto/rea), MIT license, npm `rea-agents`, source package version `6.5.0`, Node `^22.19.0 || ^24.11.0 || >=26.0.0`. Browser passive CDP and screenshot comparisons exist, but are **not** a substitute for functional acceptance.
2. KK main `index.html` loads `style.css` then `/assets/kk-storefront-v5.css`. Later CSS can override earlier declarations; this is a diagnostic lead, **not** a proven visual defect.
3. Existing KK evidence/acceptance: `scripts/storefront-visual-acceptance.mjs`, `scripts/storefront-evidence.cjs`, `server/kk-storefront-ux-reviewer.js`, `scripts/kk-code-context.js`. Reuse rather than replace.
4. Current `vercel.json` source had `git.deploymentEnabled` = `{"*":false,"main":true}` and `ignoreCommand` = `node scripts/vercel-ignore-build.js`. This is **source** protection, not proof that no build could ever occur; independently check Vercel if future changes.
5. Vercel canonical alias on 2026-10-17 was READY Production deployment `dpl_5CNUZg2fyT7JGqvhegTQxG6wmcd6`, commit `44de0066f0c7edd59e153b2d31c22d65b84de5af`, branch `fix/hero-theme-parity-20261016`. Recheck, do not assume identical to current main.
6. Local execution Node was `v22.16.0` (below REA minimum); Github DNS unavailable for REA download. **REA was not installed or run.** No real browser capture or live REA analysis was performed.

## Implemented safe local preflight
- `scripts/kk-rea-readonly-preflight.cjs`: zero dependency, no network, child-process launch, browser attachment or production writes. Checks runtime, localhost/canonical public URL allowlist, necessary local source files, source Git deploy gate, and CSS inclusion order. A PASS is only readiness for a separate REA trial.
- `tests/kk-rea-readonly-preflight.test.js`: 4 Node built-in tests, executed locally using isolated synthetic fixtures: **4/4 PASS**, `node --check` PASS.
- Commands from a repo checkout:
  ```sh
  node --test tests/kk-rea-readonly-preflight.test.js
  node scripts/kk-rea-readonly-preflight.cjs
  node scripts/kk-rea-readonly-preflight.cjs --target=https://kk-phone-rental.vercel.app/
  ```
  An exit code 2 denotes deliberately blocked readiness.

## Remaining / strictly separated from this pilot
1. Provision a free local supported Node (22.19+, 24.11+, 26+) **without changing Vercel runtime** and verify official REA package provenance. No paid/native provider required for browser inspection.
2. Use separate Chrome loopback profile and local KK test page to run REA's **passive** target listing, page inspection and screenshot capture, referring to actual returned target ID. No booking clicks, network interception of private data, hidden admin pages or stored credential exposure.
3. Compare captured, sanitized observations with existing Storefront Visual Acceptance (mobile 390, tablet 768, desktop 1440; separately verify actual Safari on iOS). Check computed CSS, poster image response, theme/hero sizing, modal overflow and Thai/English.
4. Only if a reproducible regression is found, propose minimal patch in a draft PR, capture exact source/target evidence, require full local/CI and owner release gate. Do **not** merge/deploy from this pilot.

## Acceptance ledger
| Gate | Status |
| --- | --- |
| REA project, runtime, license, scopes reviewed | PASS: documentation/source |
| KK existing code/style/load order reviewed | PASS: source |
| Offline preflight unit tests | PASS: 4/4 on isolated fixture |
| Actual REA installation/execution | BLOCKED: Node/network |
| Live UI/Production REA captures | NOT DONE |
| Full KK exact-head tests/iOS Safari acceptance | NOT DONE |
| Any UI or booking bug proven fixed | NOT CLAIMED |
| Production/data/billing writes | NONE |

## Rollback / continuation
Only these three new files were proposed; deleting them fully reverts this research addition without runtime effects. In future chats read this file and refresh live GitHub/Production before continuing. Treat real REA execution and Production P0 acceptance as separate follow-up gates.


## 2026-10-17 continuation — source versus deployed version
- Rechecked: local Node v22.16.0, Chromium present, REA absent, GitHub DNS blocked. Original four tests still PASS (4/4).
- GitHub source file blob comparison between main and Vercel Production commit 44de0066f0c7edd59e153b2d31c22d65b84de5af proved **two distinct file revisions**: index.html (16,913 vs 18,027 bytes; blob 70c7b53336ea12478a00a0dec1359a01776c49ff vs 73acb944d20e8257048da64b66e7c8f5b1eac9ee) and assets/kk-storefront-v5.css (95,403 vs 108,122 bytes; blob 0ed73fba7cb90700f8690399a366aa12113ba80b vs b3af7deb77b439fe62cc5ee2a1ecb7f239d16067).
- style.css and vercel.json were identical by blob SHA across both refs. Source HTML CSS revisions: v633 in main, hero-v102-align in deployed ref.
- Vercel connector read: READY Production deployment dpl_5CNUZg2fyT7JGqvhegTQxG6wmcd6, branch fix/hero-theme-parity-20261016, commit 44de0066f0c7edd59e153b2d31c22d65b84de5af. This is a point-in-time read only; source drift is **not proof of a customer-facing UI bug**.
- New offline gate: scripts/kk-rea-source-parity.cjs compares pinned GitHub file blobs, checks Vercel deployment lineage and deliberately returns exit 2 when source drift exists. A matching blob pair still reports release acceptance NOT_EVALUATED.
- New 4-test suite: tests/kk-rea-source-parity.test.js, covering observed drift, equal versions, malformed hashes/deployment lineage and missing fields. Pinned evidence: docs/KK_REA_SOURCE_PARITY_EVIDENCE_2026-10-17.json.
- Executed node --check on parity script: PASS; combined node --test suite **8/8 PASS** locally. Parity CLI expected exit **2**, result SOURCE_DRIFT_OBSERVED. The committed parity code, test and evidence were read back from GitHub, with exact content length and blob SHA.
- No installed/running REA; no actual browser capture, visual QA acceptance, production bug fix or full-project CI. Do not promote this research as a Production PASS.
- These changes live only on research/kk-rea-readonly-preflight-20261017. No Merge, Deploy, billing, Production, booking, customer, price, LINE, permission or automation writes. For future continuation, refresh the GitHub main/deployed commits and Vercel alias, then test the exact deployed revision locally before selecting any CSS fix.


### Exact-byte local-to-GitHub test attestation
After GitHub create_file and connector read-back, local git hash-object produced the exact same blob IDs as GitHub for **all five executable/evidence inputs**:
- scripts/kk-rea-readonly-preflight.cjs: 1e86cc02b82f1236b84049095e5ebb61fe250f77
- tests/kk-rea-readonly-preflight.test.js: d5f9b045fdf0199773775bec7aaeaaed48343dd5
- scripts/kk-rea-source-parity.cjs: 3cf5fef399a1c85670d6435e6d1d9507ac40a5ba
- tests/kk-rea-source-parity.test.js: 0bdfc8d4b663f5e6250a82b2e1a8907bf4d2d76b
- docs/KK_REA_SOURCE_PARITY_EVIDENCE_2026-10-17.json: 10cbf97f2571814cab90175e323932d150dd14b2

This establishes that the locally executed 8/8 tests used exact bytes persisted on the research branch, without borrowing results from a different code revision. Vercel branch-filtered deployment query returned zero deployments, GitHub combined commit status returned no CI contexts (not PASS), and Vercel alias still pointed to READY dpl_5CNUZg2fyT7JGqvhegTQxG6wmcd6. Browser-attached REA and Production acceptance remain blocked/not executed.


## 2026-10-17 follow-up: harden offline preflight, zero additional cost

### User directive
Continue safe REA work without follow-up questions, repair reproducible defects, run tests, and preserve a detailed cross-chat audit. Scope is **local diagnostic utility only**. No authorization was used to alter the customer-facing storefront, production, owners, bookings, LINE, price, privileges, automations, billing, Merge or Deploy.

### Environment readback and actual blockers
- `node -v`: `v22.16.0`; official REA minimum for Node 22 is 22.19. REA was **not installed or executed**.
- `npm -v`: `10.9.2`; network probe of `https://registry.npmjs.org/rea-agents` failed DNS resolution (`Could not resolve host`). Do not run repeated npm install attempts or incur paid runtime expenses.
- Chromium is present (`/usr/bin/chromium`), and Python Playwright is installed. Browser navigation to both local file and `data:` URLs was blocked by administrator policy, although sandboxed `page.set_content` on a synthetic page worked. This does **not** constitute inspection of KK Production.
- Connected Browser tab access unavailable outside originating browser context.
- Vercel `list_deployment_files` returned 404 File tree not found and `get_deployment_file_contents` for Git deployment returned 404; cannot attest deployed byte-for-byte artifact using that API. Git commit identity and public alias remain available separately.
- Connected Vercel recheck: Production alias remained READY `dpl_5CNUZg2fyT7JGqvhegTQxG6wmcd6` from `44de0066f0c7edd59e153b2d31c22d65b84de5af`, branch `fix/hero-theme-parity-20261016`. Research branch filtered deployments **zero**; GitHub combined status contexts **zero**, which means CI is **not proven passed**.

### Three confirmed diagnostic utility defects addressed
1. Stylesheet parser previously assumed `rel=stylesheet` precedes `href`. Valid HTML with reversed attributes could be missed, creating a false CSS inspection result. Now parses all `link` attributes in any order, handles case-insensitive attribute names, rel token lists, query/hash suffixes, and ignores HTML comments.
2. Source completeness check used `fs.existsSync` and could count a directory as an expected source file. Now validates regular files.
3. A symbolic link could previously count as source and permit reads outside repository. Now uses `fs.lstatSync().isFile()` and refuses to read `index.html` or `vercel.json` if they are not regular local files. All changes are inside the offline pilot's own `scripts/kk-rea-readonly-preflight.cjs` only.

### Tests, verification and exact source hashes
Executed locally in the existing isolated pilot directory:
```sh
node --check scripts/kk-rea-readonly-preflight.cjs
node --check tests/kk-rea-readonly-preflight.test.js
node --test tests/*.test.js
```
Result: **11 tests, 11 passed, 0 failed**; test suite includes the prior 8 cases plus stylesheet attribute ordering, directory-as-file, and symlink-outside-root cases. A syntax mistake in initial **local** test edit was detected and fixed before any GitHub write; the pushed tests are the passing version.

Source code Git blob hashes from local `git hash-object` were verified by GitHub fetch readback after commit:
- `scripts/kk-rea-readonly-preflight.cjs`: `c69a06b24784d5c4a882d5e3f7a70485e6d7f692` (5,257 bytes)
- `tests/kk-rea-readonly-preflight.test.js`: `f30f2f73a468c2b805fe3a9d3c933e87b563445e` (5,541 bytes)

The remaining source-parity suite and historical JSON evidence remain unchanged; the CLI still reports `SOURCE_DRIFT_OBSERVED` for the pinned, historical main-vs-deployed commits (not proof of visual bug). The test suite does **not** certify the entirety of KK or actual REA browser analysis.

### Continuation / constraints
- **Done:** Correct and test 3 concrete diagnostic bugs; prove local/committed file byte identity; leave only research-branch changes with existing safety gates.
- **Not done / blocked:** REA package execution, live CSS computed-style/screenshots, complete Storefront Visual Acceptance, iOS Safari, current-source-to-runtime build matching and Production P0 approval.
- **Next safe path:** On a free local environment with Node `>=22.19` in series 22 or supported 24/26, install official, pinned REA; use a disposable loopback Chromium profile and `inspect_web_page` against an authorized local KK test mirror; compare with the existing visual QA. Preserve raw credentials and LINE/customer data by excluding them entirely. Only patch a reproducible customer-facing defect on a separate Draft PR after observing it. No automatic Merge or Deploy.
