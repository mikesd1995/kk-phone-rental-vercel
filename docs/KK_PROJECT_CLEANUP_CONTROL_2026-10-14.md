# KK Phone Rental — Project Cleanup Control / Cross-chat Handoff (2026-10-14 ICT)

**State: AUDITED / CLEANUP PLAN DOCUMENTED / RELEASE HOLD. This is not a production release.**

## Authoritative baseline and scope
- GitHub: `mikesd1995/kk-phone-rental-vercel`; audited main SHA `d6dc3bfe4cc0c4dd6fdfec407823752da0572464`.
- Vercel: project `prj_snbAmpya7YGmOuMbv1o8T16ouxl6`, team `team_uaeOdVIjXMSW690ZM2wPuJyt`.
- Production alias `kk-phone-rental.vercel.app` resolved to **READY** `dpl_7TYLb87ir9qNzXRtkeb49543dwVm`, source main SHA above at the time of readback. Previous READY rollback `dpl_B4NFKuic55jMVHfXUXcp6tD9Yigz`. Protect both pending accepted release.
- GitHub API readback: **36 OPEN PRs**, **25** files in `.github/workflows/` and **19,594 historical Actions runs** at audit time. Historical runs do *not* indicate 19,594 billable jobs, failures, or Vercel deployments.
- This audit inspected the changed filename sets for all 36 PRs and `on:` triggers of all 25 workflow files. **File overlap is NOT evidence that a patch was superseded.** No full PR diff equivalence, full exact-HEAD CI, production browser E2E, or paid/quota-dependent test was performed by this cleanup pass.

## Already-live zero-spend guard: do not undo
- `vercel.json` on audited main contains `git.deploymentEnabled: {"*": false, "main": true}` — Git-integrated Preview branches disabled.
- `vercel.json` also uses `ignoreCommand: node scripts/vercel-ignore-build.js`, whose current rule skips known docs/tests/workflow-only diffs but fails closed for missing SHAs/unknown runtime paths. Existing `tests/vercel-ignore-build.test.js` exercises the pure decision contract; these tests were **read, not re-run** in this pass.
- **Do not assume these settings block app-initiated Vercel deployments**. Issue [#692](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/692) documents Preview objects sourced from the ChatGPT app after Git preview suppression.
- Avoid new Vercel deployments, including Preview, or deployments initiated through connected apps. Do not buy Vercel capacity.

## Open PR triage — all 36 preserved
`Priority` means review ordering; `HOLD` is not rejection. The table lists exact observed changed-file overlaps but **does not authorize closing any PR**.

| PR | Priority / area | Triage and next action |
|---|---|---|
| [#742](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/742) | P0 LINE | Replay-safe owner decision; overlaps `server/line-booking-owner-approval.js` with #706/#700. Test duplicate/no-message safety before considering any integration. |
| [#741](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/741) | P0 Notifications | Runbook-only recovery evidence. Preserve; integrate documentation after notification acceptance. |
| [#739](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/739) | P0 Security | Private Core Sheets reader cutover. Impacts `api/kk-data.js`, Apps Script, admin and tests. Must pass anonymous-access negatives, exact-owner/booking readbacks and rollback before any production ACL change. |
| [#737](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/737) | P0 Revenue SOT | Master booked-quote Future correction. Overlaps `server/rental-dashboard-core.js` and `package.json` with #739. Confirm actual/future/forecast contract before port. |
| [#736](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/736) | P1 Poster | Advisor + quality tests; advisory only, no uncontrolled poster writes. |
| [#732](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/732) | P1 Scanner | Public detail/source follow-up. Overlaps provider runner files with #720/#695; reconcile and test fail-closed. |
| [#727](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/727) | P0 Storefront | Integrated premium hero and poster fitting. Overlaps essentially all #725 hero paths and #722 poster paths; **candidate consolidation**, not proven replacement. Needs viewport/owner visual QA. |
| [#725](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/725) | P0 Storefront | Earlier hero candidate. Compare SHA/file patches with #727; HOLD rather than blindly merge both. |
| [#724](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/724) | P1 Scanner | Backscan miss-learning and shards; correlate #720, #707 before any scanner release. |
| [#722](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/722) | P0 Storefront | Poster contain/crop guard overlaps #727/#711; validate effective CSS after all loaded styles. |
| [#721](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/721) | P0 Drive Security | Owner-only poster ACL read-only preflight; do not change live Drive permissions without approval and audited downstream readers. |
| [#720](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/720) | P1 Scanner | Large 40-file October discovery/lineage branch; overlaps #732/#724/#695 and CI; needs minimum-diff port + exact-head safety tests. |
| [#716](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/716) | P2 Marketing | X post visibility/recovery rules; preserve verified availability, dedup, owner approval; do not auto-post. |
| [#711](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/711) | P0 Storefront | Bookable prices + TH/EN LINE prefill; overlaps UI/CSS with #727/#722 and LINE with #700/#706. Verify customer-facing behavior first. |
| [#706](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/706) | P0 LINE | Booking identity & replay safety; overlaps Apps Script, webhook and approval with #700/#742. Needs canonical writer contract before combining. |
| [#705](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/705) | P0 Cross-cutting | **71 changed files** spanning admin, storefront, scanner, Apps Script. Do NOT mass-merge; decompose per subsystem and check changed main SHA. |
| [#703](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/703) | P1 Scanner | Effective storefront visibility/readback; cross-check bookable-day locks and #720/#680. |
| [#700](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/700) | P0 Inbox | Private LINE images, outbound idempotency, migrations, media API. Major overlap with #706/#742; require RLS, migration rollback, privacy tests and media readback. |
| [#697](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/697) | P1 Make | Event-driven owner bridge; avoid production writer or paid automation activation. |
| [#695](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/695) | P1 Scanner | Provider handoff/early hits; overlaps #732/#720; compare patches, not PR titles. |
| [#694](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/694) | P2 Marketing | Owner X content policy/memory. Preserve as separate non-production acceptance. |
| [#689](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/689) | P2 Pricing | Shadow-only demand pricing; preserve booking-day price locks and zero writes. |
| [#681](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/681) | P1 Maintenance | Audit closure + scanner + health contracts; overlaps #661/#705. Require targeted ports. |
| [#680](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/680) | P1 Scanner | Broad 67-file scanner/pricing/recovery branch; overlaps #720/#655/#689. No direct mass merge. |
| [#678](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/678) | P2 Agents | Owner poster operations/agent gateway; owner approval preserved. |
| [#675](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/675) | P1 Apps Script | Date parser patch; compare `scripts/build-apps-script-date-hotfix.js` with #681 before port. Do not deploy stale Apps Script source. |
| [#665](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/665) | P1 Scanner | Owner suppression; overlaps #655/#680; preserve hidden-day rules. |
| [#661](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/661) | P1 Maintenance | Audit regressions; candidate overlap #681/#705, verify remaining unique deltas. |
| [#655](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/655) | P1 Scanner | Demand hardening runtime; overlaps #680/#720; verify current state consistency. |
| [#654](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/654) | P1 Scanner | Demand verifier; overlaps #720; verify safety constraints. |
| [#638](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/638) | P2 Design | Inspiration review gate; no P0 release dependency proven. |
| [#636](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/636) | P2 Marketing | Attribution shadow; no production activation required now. |
| [#614](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/614) | P2 Engineering | Older 26-file agent/design docs branch, includes historical cleanup guide. Compare with current AGENTS; no blind overwrite of main. |
| [#610](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/610) | P1 Scanner | Atomic create adapter; older delta may be contained in later runtime branches, **unverified**. |
| [#605](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/605) | P1 Scanner | Rentability adapter; older delta may be contained in later runtime branches, **unverified**. |
| [#599](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/599) | P1 Data Integrity | Continuous invariant gate; review as safety regression, not dispensable housekeeping. |

**Review waves, without closing or merging:**
1. P0 safety/business truth: #739, #737, #742, #706, #700, #721; require ownership map and non-destructive security test plan.
2. P0 customer surfaces: #711, #727, #722, #725 plus #741; exact-head local tests and browser evidence, no cross-PR blind combination.
3. Large cross-cutting #705: split patches by domain after comparison with current main.
4. Scanner/Verifier: #720, #724, #732, #695, #703, #680, #681, #661, #655, #654, #665, #610, #605; ensure no suppressed/hidden/booked event is republished.
5. P1/P2 deferred: all other PRs remain recoverable.

## Workflow inventory: 25 tracked main files
- **10 have `issue_comment: created` fanout**: `bounded-oidc-production-acceptance.yml`, `current-production-readback.yml`, `phase4-zero-cost-existing-preview-recovery.yml`, `storefront-v59-zero-cost-promote.yml`, `storefront-v60-prebuilt-production.yml`, `storefront-v60-zero-cost-promote.yml`, `ultra-deep-full-loop.yml`, `storefront-production-screenshot-capture.yml`, `rental-analytics-prebuilt-production-recovery.yml`, `ultra-deep-runtime-acceptance.yml`.
- **3 triggered on `issues: opened`**: `kk-content-batch-chat-bridge.yml`, `kk-content-chat-bridge.yml`, `kk-x-posting-plan-chat-bridge.yml`. Creating a new tracking issue can itself generate run records.
- **Other 12**: `admin-regression.yml`, `booking-e2e-acceptance.yml`, `discovery-crawl4ai-uat.yml`, `hf-event-assist-uat.yml`, `october-ultra-deep-one-shot.yml`, `openai-platform-staging-acceptance.yml`, `project-memory-enforcement.yml`, `rental-analytics-production-watch.yml`, `storefront-poster-health-audit.yml`, `storefront-visual-qa.yml`, `ultra-deep-v2-acceptance.yml`, `vercel-storage-source-contract.yml`.
- Observed multiple synchronized `issue_comment` runs marked `completed/skipped` (e.g. [run 38566802206](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38566802206)). **This establishes event fanout, not measured billed minutes.** Some gated workflows can deploy under explicit commands; do NOT disable/remove a trigger until command compatibility, owner approval and a tested manual alternative exist.
- Before code changes: baseline event rates for representative comment/issue/push/PR, map exact comment command patterns and all dependent owners, test a bounded central command router or manual-dispatch-only migration **in a draft**, enforce no unintended production job execution. Retain security and release gates.

## Vercel capacity / deployment reality
- [Issue #692](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/692) is the current authoritative capacity case, **OPEN**. Owner warning on Oct 10 reported 10 GB / 10 GB then; **current used GB is unverified** via available API.
- #692 records a prior audit of 81 Deployment objects (73 Preview, 8 Production), with sampled `via: ChatGPT app` sources after Git Preview suppression. Count is historical, not storage GB. App-created deployments can bypass the Git suppression rule.
- Vercel current Project/Deployment readback is READY; this **does not certify all functions, bookings or images**. Production acceptance requires browser/customer-flow readback.
- **No bulk deletion**, no Storage Retention change, no secret/permissions change. Preserve current Production & previous rollback until explicit approved replacement.
- Only owner-authenticated Team Usage can establish current Deployment/Function Storage GB; measure before/after before claiming quota recovery.

## Freeze + release acceptance policy
- Freeze optional feature additions while P0 booking, security, inventory, LINE and storefront correctness remain unresolved.
- ONE canonical writer per overlapping business aggregate; determine actual runtime write paths before modifying Apps Script, direct Sheets API, Supabase or Make. Avoid cash/quote confusion and maintain booked-day/device safety.
- Keep Google Sheets operational SOT for now; Supabase migration is a separate shadow/design task requiring clear authority and rollback, not part of this cleanup.
- All future code tasks: search for open PR, issue and current-main implementation first; classify `EXISTING / PORT / REBASE / NEW`. No new duplicate branches for unchanged fixes. Tests with exact SHA and independent review before release.
- Before any Merge/Deploy: P0 acceptance, tested rollback, GitHub Actions exact-head evidence, no unauthorized private data/ACL mutation, sufficient **measured** free resources, owner approval. No automatic X post, customer message or booking confirmation.

## Done vs pending in this cleanup pass
**DONE (read-only audit + documentation on isolated branch):**
- Identified 36 open PRs and inspected all 36 filename manifests for consolidation candidates.
- Classified all 25 active main workflow files and identified 10 issue-comment-fanout definitions.
- Confirmed live Git Preview suppression rule, skip-build script, Production READY SHA/ID and existing #692 evidence.
- Created this dated, durable triage/handoff plan on a non-main branch. No PRs closed or merged. No production write/deployment/permission change performed.

**NOT DONE / release blockers (do not convert to success):**
- No verified current storage GB or quantified savings; Vercel team Usage access needed.
- No full diff-level supersession proof, conflict-free rebase or semantic merge of the 36 PRs.
- No workflow trigger modification or measured Actions billing reduction.
- No full exact-head CI run, production E2E, screenshot QA, security cutover, or booking concurrency acceptance.
- No user-facing runtime cleanup deployed; Production remains on audited baseline until separately authorized.

## Next-run instructions (for ChatGPT, Gemini or other engineer)
1. Read this file, main AGENTS.md, issues #692, #738, #707, #49, current Production SHA and `git.deploymentEnabled` before any work.
2. Refresh open PR list and take one P0 dependency wave. Compare full patches against current main; label overlaps as *candidates* only until code-equivalence/review is established.
3. Update the dated evidence table with new SHA, test command + exit code, chosen fix, rollback path, exact deployed SHA if any.
4. Do not repeat an attempted build/deploy after quota failure. Seek zero-cost local/CI alternative when available; if runners are unavailable, mark acceptance blocked.
5. Maintain `DONE`, `BLOCKED`, `NOT STARTED`, `ROLLBACK` separately. Never present a created draft PR as a Production fix.

**References:** [Quota / Preview bypass #692](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/692), [Core Sheet ACL P0 #738](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/738), [CI exact-head #707](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/707), [Final acceptance #49](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/49).

## Continuation — owner command workflow fanout remediation (2026-10-14)

**Implementation staged only in Draft PR #744, not merged or deployed.**
- Added `.github/workflows/kk-owner-comment-command-router.yml` with one top-level `issue_comment: created` listener and **10 owner/issue/command-gated** reusable workflow call jobs. The router itself contains no Vercel API/deploy/build command.
- Converted exactly 10 historical direct `issue_comment` workflow subscriptions to `workflow_call`. For each target, read back current `main` and the draft branch, and compared the complete contents: **only the event trigger and, for eight workflows, a declared minimum reusable secret changed per file**; job bodies, command parsing, existing `workflow_dispatch` (where present), `issues: labeled` (where present), concurrency and individual safety gates stayed byte-for-byte intact.
- Included least-privilege per-caller-job GITHUB_TOKEN permission scopes matching each prior target workflow. The owner command router passes **only `VERCEL_TOKEN` into the eight target workflows that use it**; screenshot and runtime acceptance jobs receive **no repository secrets**. The target workflows explicitly declare the same optional reusable secret; no token values or new credentials were written to GitHub.
- Added `tests/kk-owner-comment-command-router.test.js` (3 Node test cases): single repository comment listener, 10 exact owner+command+issue routes and scopes, and preserved original authorization/manual/labeled triggers.
- **Expected topology after accepted merge:** comment -> exactly one top-level command router run -> zero or one permitted reusable target. Other workflows still react to manual, issue labeled, push, pull request, or schedule as before. This is a design expectation, **not GitHub-hosted runtime evidence**.
- **Exact scoped-diff verification 10/10 PASSED** from fresh GitHub main-vs-branch file readback; **124 connector-side structural assertions PASS** on 11 workflow files. The checked-in Node test suite is **NOT EXECUTED** (GitHub-hosted CI and local full-repository execution unverified); never treat static checks as runtime acceptance.
- **Do not claim reduction in GitHub billed minutes or Vercel storage**. Skipped jobs may already have zero billed minutes; this cleanup reduces top-level event fanout only. Vercel app-sourced Preview deployment bypass remains an independent problem in #692.
- **Release gate:** targeted `node --test tests/kk-owner-comment-command-router.test.js` on exact head; GitHub workflow YAML validation; non-production owner and unauthorized-comment dry-run proving no deploy; independent reviewer; owner approval and measured free resources before merge. Preserve active Production `d6dc3bfe4cc0c4dd6fdfec407823752da0572464` until release approval.

**Rollback**: revert the new router YAML and restore `issue_comment: types: [created]` to the ten target workflows in one approved revert, using exact pre-PR `main` content. Do not roll back the security checks in the original job bodies.

**Validation boundary for the latest draft head:** 10/10 target workflow exact-scoped diffs PASS. GitHub Actions language/runner acceptance, customer system E2E and actual measured fanout after merge remain `PENDING`. The revision makes no Production changes, but cannot be called fully delivered until reviewed, tested, approved and merged.

## Content-level PR overlap investigation — 2026-10-14

**Evidence obtained from exact GitHub blob-SHA comparisons, not merely shared filenames:**
- Storefront earlier [#725](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/725) head `93204e594dbf51bd97533095c701c5beb1d124bc` vs integrated [#727](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/727) head `6d24664964d08fc146242a922b45305d02fa7e0d`, same main base SHA at readback: compared ALL nine files changed by #725. **Exactly 2/9 blob hashes identical** (the original premium-hero documentation file and `index.html`), **7/9 different**, including the product asset, CSS, workflow, JS and tests. **Not proven superseded; DO NOT close #725 on title/path overlap alone.**
- Apps Script parser [#675](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/675) vs broader audit [#681](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/681): 2/3 #675 files appear in #681; the two shared code/test files have **identical content blob hashes**. The standalone #675 documentation file does NOT occur among #681 changed paths. Strong candidate for review/port, **not safe to close now while #681 itself remains unmerged and the unique documentation has not been preserved**.
- 
- Poster fitting [#722](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/722) head `0c3fd709ff6a361a3227e8acd79851bb269e3e3c` vs integrated [#727](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/727) same main base: compared all six #722 changed paths by exact blob SHA. **3/6 identical** (`assets/kk-storefront-v5.css`, `style.css`, `tests/storefront-poster-fit-contract.test.js`); **3/6 different** (`script.js`, `scripts/storefront-evidence.cjs`, `tests/storefront-poster-dom-runtime.test.js`). Do not close or merge both until reviewer resolves unique runtime/test deltas.

**Decision:** 0 PR closures or merges, 0 deleted branches, 0 discarded unique file modifications. Next cleanup wave should compare the remaining pairwise blobs for #722/#727, #695/#732, #661/#681/#705; if a PR is fully superseded after successful fresh-main integration and full safety tests, preserve its unique documentation and evidence before marking obsolete.

**Additional runtime constraint from [#707](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/707):** October 2 account notice stated 2,032/2,000 included GitHub Actions minutes used, reset date November 1. Genuine October 13 GitHub-hosted tests also succeeded for a particular PR #724 SHA, so not all recent failures are explained solely by quota. Current balance and actions billing flags remain unreadable from the connector; no paid reruns or new hosted jobs initiated by this cleanup.

## GitHub reusable workflow specification review — 2026-10-14

Read-only review against official GitHub reusable workflow documentation (no hosted execution):
- Official GitHub docs require a called workflow to have `on.workflow_call` and a caller job to use `jobs.<id>.uses`; the allowed caller job keys include `if`, `permissions`, and `secrets`. The staged router has these keys.
- GitHub documents that the `github` context inside the called workflow is associated with the **caller**; existing `github.event_name == 'issue_comment'` gates should therefore continue to read the owner comment event. This is **documentation-level compatibility**, not an executed end-to-end acceptance.
- GitHub documents that nested reusable workflows cannot increase `GITHUB_TOKEN` permissions. Every caller job explicitly mirrors the permissions required by its target workflow; test asserts these scopes, including `id-token: write` only for the existing Ultra Deep OIDC path.
- Eight target workflows use `secrets.VERCEL_TOKEN` and explicitly declare an optional `workflow_call` secret; the other two do not receive a secret. All values remain stored in existing GitHub Secrets only.
- Official references: https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows and https://github.com/github/docs/blob/main/content/actions/reference/workflows-and-actions/reusing-workflow-configurations.md

**Still not accepted without independent actionlint/Node/hosted runner evidence.** A plausible workflow graph and 124 passing connector assertions cannot prove GitHub Actions accepts and executes each comment command.

## Scanner PR content comparison — 2026-10-14

- #695 versus #732: all six #695 files accessible on both heads; 3/6 blob SHA identical (historical recall doc plus probe-handoff and Thai-date tests), 3/6 runtime JS blobs different. Their base SHAs also differ. HOLD; don't mark fully superseded.
- Comparison tally: #725/#727 2/9 identical, #722/#727 3/6 identical, #695/#732 3/6 identical, #675/#681 2/2 identical among shared code/test paths, but #675 has unique documentation. No PR closed or discarded.
- Test hardening: `tests/kk-owner-comment-command-router.test.js` now detects ANY top-level `issue_comment` subscriber, not merely `types: [created]`.

## Additional issue-comment admission boundary — 2026-10-14

- Root-cause during independent route simulation: original `ultra-deep-full-loop.yml` had a permissive GitHub `startsWith(..., '/run-ultra-deep-full-loop')` job-level predicate, so malformed commands such as `/run-ultra-deep-full-loopEVIL` could previously allocate a hosted runner before the existing Bash argument validation rejected them. Existing Bash itself verifies the exact command and optional YYYY-MM argument; do not weaken it.
- Draft router hardening: accept `/run-ultra-deep-full-loop` exactly OR the prefix with a separating ordinary space; malformed unseparated suffix now fails at job routing without runner allocation. **This narrows only the early routing gate** and preserves the supported no-argument and spaced-argument forms. Extra tab-separated argument commands would be rejected earlier, even though Bash previously accepted generic whitespace; do not claim absolute backwards compatibility with obscure tab formatting without owner review.
- Updated checked-in Node regression source to cover the no-argument case and reject the unsafe broad prefix; Node runner execution remains pending.
- **101/101 dynamic scenarios PASSED in isolated JS on conditions extracted from actual latest router YAML:** 11 positive (including Ultra Deep no-arg) and 90 negative (wrong issue, owner, association, malformed command and untrusted-comment noise). This checks the route predicate model only, not GitHub's hosted expression interpreter or Actions runner execution.
- Zero Vercel deploy/preview, no GitHub Actions dispatch and no external business writes during this simulation.

## Native offline Node & YAML acceptance — 2026-10-14

**Native execution achieved without Vercel or GitHub-hosted runner:**
1. GitHub connector fetched the exact branch router `.github/workflows/kk-owner-comment-command-router.yml` with Git blob SHA `03066fd11833dce72d4b437b5324f3c5549d6234`. Reconstructed it byte-for-byte in an isolated container; local computed Git blob SHA matched `03066fd11833dce72d4b437b5324f3c5549d6234` exactly (5,237 bytes).
2. Parsed the exact YAML with **ruamel.yaml safe parser: PASS**, `on.issue_comment.types=[created]`, **10 jobs**.
3. Executed Node.js v22.16.0 native `node --check tests/kk-owner-comment-router-evaluation.test.js` **PASS, exit 0** and `node --test tests/kk-owner-comment-router-evaluation.test.js` **2/2 PASS, exit 0**, on local Router whose blob exactly matches GitHub.
4. Committed the actual Node test under `tests/kk-owner-comment-router-evaluation.test.js` (Git commit `91beedcc13e7bf554e87cf358c82adc63c2412b7`). The tested local test file was 3,918 bytes, Git blob SHA `d0d1c6b294d1c6e57fd03df4c34cda562b63787f`; GitHub branch readback returned the **same blob SHA and byte count**, proving the checked-in test matches the file executed.
5. Test method: use Node built-ins `node:test`, `node:vm`, `assert`, `fs`; extract **actual** GitHub-style `if` expressions from the exact local Router YAML; emulate `github` event and GitHub `startsWith` for authorized/unauthorized comments without deploying, posting or reading secrets. Includes 10 owner command routes, wrong issue/actor/role, malformed Ultra Deep command boundary and strict equality commands.
6. This is **native Node predicate acceptance and YAML structural validation**, not an official `actionlint` run, a GitHub-hosted job, a production acceptance test or a proof of Vercel storage savings. `actionlint` is **not installed** in the isolated container and network Git download is unavailable (`Could not resolve host github.com`). No paid dependencies installed.

**Full release gate still HOLD:** exact-head all-repository test suite, GitHub actionlint/workflow validation (including reusable invocation), bounded non-production GitHub-hosted canary, current free-minute/storage measurements, independent security review, owner approval before any Merge/Deploy.

## 2026-10-14 independent offline revalidation and regression mutation audit

**Revalidation environment**: isolated local container, Node.js `v22.16.0`, npm `10.9.2`, `ruamel.yaml` `0.18.17`; no GitHub clone or external dependency download. GitHub repository URL cannot resolve from this container, so bytes were taken from the connected GitHub file readback and checked against actual Git blob SHA.

**Exact-source integrity (both PASS)**:
- `.github/workflows/kk-owner-comment-command-router.yml` 5,237 bytes, SHA-1 git blob `03066fd11833dce72d4b437b5324f3c5549d6234` equals current Draft GitHub blob.
- `tests/kk-owner-comment-router-evaluation.test.js` 3,918 bytes, SHA-1 git blob `d0d1c6b294d1c6e57fd03df4c34cda562b63787f` equals current Draft GitHub blob.

**Commands actually run, with observed results**:
- `node --check tests/kk-owner-comment-router-evaluation.test.js`: exit **0**.
- `node --test tests/kk-owner-comment-router-evaluation.test.js`: exit **0**; 2 passed, 0 failed, 0 skipped; TAP duration **504.193 ms**.
- `ruamel.yaml.YAML(typ='safe').load(router)`: PASS, `on.issue_comment.types: [created]`, 10 Jobs, 8 narrowly passed `VERCEL_TOKEN` and 2 Jobs with no secrets.
- **Mutation sensitivity (offline only):** sequentially modified a *temporary working copy* of the router (never GitHub) and re-ran the same Node tests. Three intentionally bad modifications each caused nonzero `node --test` exit **1** as expected: (1) remove owner-login check, (2) change issue #47 requirement to #48, (3) restore unsafe Ultra Deep broad prefix. Original exact file bytes were restored in a `finally` path and rechecked. **3/3 mutants rejected**. No actual protected workflow, Vercel operation or customer action was invoked.

**Additional Git blob-to-main PR triage (read-only, do not discard)**:
- [#599](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/599): current PR has 3 changed paths; two runtime/test files differ from current main, and one PR doc is absent from main. NOT NO-OP.
- [#605](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/605): all three changed code/test files differ from current main. NOT NO-OP.
- [#610](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/610): all three changed code/test files differ from current main. NOT NO-OP.
- [#675](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/675): all three unique files are absent from main, even though two files are identical to #681's draft head. NOT NO-OP. Do not delete existing source until one accepted integrated replacement is actually on main.

**Assessment / blockers:** This offline acceptance is reproducible and stronger than text-only static checks but **still cannot substitute** for actionlint, complete native repo regression, GitHub-hosted workflow-call invocation and a verified Production release. Account-included GitHub minutes were historically exhausted on Oct 2; live free balance not accessible. Vercel GB recovery/current measured storage is not accessible by supported connector; see #692. No paid use, CI rerun, merges, deployments, PR closures, or production ACL/data changes were made.
