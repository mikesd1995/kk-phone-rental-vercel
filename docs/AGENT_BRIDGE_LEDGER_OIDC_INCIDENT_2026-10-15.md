# KK Agent Bridge / GitHub OIDC audit ledger incident — 2026-10-15

## Scope and observed failure
- Owner report: GitHub issue [#745](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/745) produced `Status: BLOCKED`, `Blocker: ITEM_FINALIZATION_FAILED`, `Gateway: BLOCKED_LEDGER_UNAVAILABLE`, `Finalization: NOT_RUN`.
- Invocation identity in issue: `agi_dd8513c7009d_2265462333b04ff7b592`. Required and invoked five content agents were listed, **but the persistent ledger was not written**.
- At 2026-10-14T17:38:27Z, Supabase runtime project `zehlsagzrpromtfqqflt` logged GitHub-OIDC `POST /functions/v1/kk-project-memory-github-read` with HTTP **200** for project-memory read. At ~17:38:28Z a second authenticated POST to the *same* function returned **503** for the audit invocation-write probe.
- Supabase Edge Function `kk-project-memory-github-read`, active version 2 (verified 2026-10-15), had this reproducible recursion in source:

```ts
function internalRuntime(){
  const {url,key}=internalRuntime();
  return {url,key};
}
```

The invocation writer calls this function after request schema validation. Its self-call cannot resolve credentials and causes stack exhaustion. The Edge exception handler emits HTTP 503, which the upstream Gateway correctly fails closed as `BLOCKED_LEDGER_UNAVAILABLE`.

## Scope of candidate fix
- **Code-only draft**, no active Edge deployment:
  - `supabase/functions/kk-project-memory-github-read/index.ts`: read canonical `SUPABASE_URL` from Deno runtime and `secretKey()`, reject missing or malformed config with `SUPABASE_INTERNAL_CREDENTIALS_MISSING`.
  - Identical binding semantics to the already working read-only `readMemory()` route; audit path remains restricted to `public.kk_agent_invocations`.
- No new credentials, network providers, subscriptions, database DDL, RLS/grant changes, booking/pricing/inventory writes, X posting or paid inference.
- OIDC signature and exact repository/ref/workflow allowlist stay unchanged: expected `mikesd1995/kk-phone-rental-vercel`, `refs/heads/main`, `issues`, and the three authorized content workflows.
- Durable audit has idempotent `on_conflict=invocation_id` with `resolution=ignore-duplicates` and zero business-writes/publishes guards.
- Added focused Node regression `tests/kk-github-oidc-agent-ledger-runtime-regression.test.js` (valid credential resolver, missing/malformed key, identity constraints, audit-only allowlist and read-only memory separation).

## Additional independent database readback
- Supabase runtime project: `zehlsagzrpromtfqqflt` = `kk-phone-rental-runtime-ledger`, active/healthy.
- Table `public.kk_agent_invocations`: exists, RLS enabled; `service_role` has SELECT and INSERT, **not UPDATE**; `anon` and `authenticated` do not have INSERT.
- At inspection time, table had 0 invocation rows, consistent with the failure before DB POST. This is **not** proof that a repaired function can write until a controlled invocation is run.
- Read-only `kk_project_memory_events` endpoint succeeded during the failed run; its success must not be misinterpreted as success of the separate audit-write path.

## Acceptance gates and safe release sequence (not automatic)
1. **Draft PR**: review exact diff; require no recursive call and no broadening of OIDC access or business writes.
2. CI: `node --test tests/kk-github-oidc-agent-ledger-runtime-regression.test.js tests/kk-agent-invocation-oidc-persistence.test.js tests/project-memory-github-oidc.test.js`; then `npm test` and repository safety/invariant checks. Record GitHub Actions evidence, not simulated scores.
3. With required owner/release approvals and gates passed, explicitly authorize **targeted deploy of ONLY the corrected Supabase Edge Function** `kk-project-memory-github-read` to `zehlsagzrpromtfqqflt`. Avoid unrelated Vercel/website deployment or Make workflows.
4. Production controlled acceptance AFTER that authorized deploy: open **new** owner-issued `[KK-CONTENT-BATCH]` issue (the existing #745 `issues.opened` workflow is not replayable by adding comments). Confirm authenticated OIDC read 200, audit-write 200, matching new `invocation_id` in `public.kk_agent_invocations`, idempotency check, Agent Gateway READY, full Content QA+Selector and Batch QA PASS, and `production_writes=0`, `publishes=0`. Do not auto-post to X.
5. Owner's separate [PR #694](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/694) is still a **draft** for final-only X copy, five hashtags, binary availability and event-specific CTA. Even with Ledger repaired, those copy gates and the main-branch legacy CTA may independently block or produce noncompliant posts. Do not claim the six posts are production Agent-selected until all gates pass.

## State at time of preparation
- Root cause **PROVEN** from active Edge function source + historical 503 log.
- GitHub branch contains targeted patch and regression tests.
- **Production still has the old v2 until deployment.** Do not mark live fixed.
- **No CI full-suite result, deployment approval or production acceptance yet** unless later evidence is appended below.
- Handoff requirement: keep this file, issue #745 and the Draft PR linked to durable project memory to permit a new chat to continue without re-investigation.

## Validation/evidence append-only log
- 2026-10-15: GitHub main source and active Supabase Edge source both had self-recursive resolver.
- 2026-10-15: Supabase logs observed authenticated memory read 200 and audit write 503 in same issue run; no OIDC identity failure.
- 2026-10-15: Supabase SQL read-only verification: agent invocation table present, RLS enabled, service_role INSERT/SELECT only; 0 rows.
- 2026-10-15: Executed **11/11** read-only in-memory source checks using the modified branch file (5 runtime resolver cases: valid URL/key, missing URL, missing key, malformed key JSON, empty key; 6 auth/audit source-contract assertions). All passed. These are **not a substitute** for Node CI, Edge deployment, or live database write/readback.
- 2026-10-15: Node test file syntax parsed successfully and Project Memory bootstrap with new incident entry returned **READY**, domain agent_orchestration. No false PASS asserted.
- 2026-10-15: Draft PR [#746](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/746) opened with 4 changed files. GitHub commit status and pull-request workflow run queries returned **no status/runs** for PR head at inspection time; full CI remains UNVERIFIED.


## 2026-10-15 follow-up: explicit completion and quality gates

**Patch/test evidence:** Draft PR #746 now includes 10 regression tests in \`tests/kk-github-oidc-agent-ledger-runtime-regression.test.js\`. The additional cases exercise the actual checked-in \`writeAgentInvocation()\` source using fake Deno credentials and an in-memory mock HTTP transport. Verified independently in a read-only JS source simulation: 6/6 (new insert, idempotent duplicate, reject invalid row without network call, upstream HTTP error, transport failure, malformed upstream readback). Test-file JS syntax check: PASS. This is **not a real Node test run or Edge production write**. Run exact checked-in tests in GitHub Actions before release.

**CI runner constraint:** \`docs/CI_RUNNER_QUOTA_RECOVERY_2026-10-03.md\` records GitHub-hosted runner/quota failures before step 1, after which Project Memory Enforcement and Admin Regression were changed to \`workflow_dispatch\` only. PR #746 currently has **zero reported pull-request Workflow runs and zero commit status checks**; CI must be treated as **UNVERIFIED** (never PASS). When runner capacity returns, dispatch and require exact source SHA, job step logs, passing focused and full suite results; do not create paid runners.

**End-to-end content acceptance beyond the ledger repair:**
- The latest owner-specific X rules remain in **Draft PR #694**. Its policy still fixes an exact short CTA in code, while owner wants distinct event-specific CTAs and long-form X Premium copy. The creative-quality gate must require verified event context, four verified benefits, correct price model+bundle disclosure, five distinct verified hashtags, no invented scarcity, multiple meaningful independent candidate angles, truthful dates and an original strong booking reason. **Never claim that structural QA alone predicts conversion.**
- \`18_X_Post_Log\` available at inspection covers historical 2026-10-01/02 labeled posts, not authenticated 2026-10-15 conversion/engagement attribution. Learning AI must expose \`RULE_BASED_COLD_START\` whenever enough measured results are unavailable, and may claim \`PERFORMANCE_INFORMED\` only from actual measured records.
- Hugging Face OAuth was authenticated at inspection but **no inference** was run; no tool-backed free, zero-charge Thai post-evaluator deployment was verified. HF model discovery or authentication is **not** equivalent to model evaluation. Do not start HF Jobs or charged compute without an explicit zero-cost guarantee and consent.
- Metricool reported no social network linked to the current brand, so no current X post insights or clicks were obtained via Metricool. Do not hallucinate click/conversion metrics.
- Issue #748 confirmed the GitHub Agent Bridge invoked the five registered Agent names but stopped at \`BLOCKED_LEDGER_UNAVAILABLE\` with Finalization NOT_RUN. A read-only in-memory QA/Selector run is useful draft feedback, but not the full GitHub persisted Agent acceptance.
- The source-of-truth for prices and day booking statuses remains Google Sheets; no data or owner locks may be changed to make QA pass.

**Precise remaining sequence:** (a) running Node/CI Safety Gates (include full test suite) and independent diff review; (b) owner/release authorization for *only* corrected Supabase Edge function; (c) targeted deployment; (d) authenticated bounded issue-event OIDC invocation with HTTP 200, matching durable audit ledger row and idempotent repeated probe, business_writes=0; (e) separately accept PR #694 style contracts and multi-event Creative Quality review; (f) use only measured post outcomes for Learning AI and verified zero-cost inference for HF; (g) produce one owner-review Final per event, **never auto-post** to X.

**Deployment remains PENDING**; do not label operational incident resolved until live evidence exists.

## 2026-10-15 GitHub Actions exact-main CI regression comparison

- New workflow: .github/workflows/kk-agent-ledger-oidc-regression-zero-install.yml, PR-only, no Secrets and zero installs, Node suite only. No additional paid providers or production writes.
- GitHub Actions run https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38715949746: exact SHA checkout PASS, no-secrets PASS, focused OIDC agent-ledger regression suite PASS. Full repository suite 1487/1508 PASS; 21 FAIL.
- GitHub Actions run https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38716213547: focused Agent Ledger/Project Memory tests PASS; full PR suite 1487/1508 PASS (21 FAIL). The same job additionally checked out exact main base SHA d6dc3bfe4cc0c4dd6fdfec407823752da0572464 and ran the same full suite: 1477/1498 PASS (21 FAIL). Exact test-name diff: 0 new failures, 21 shared failures, 0 resolved. The 10 new focused tests all passed.
- The 21 inherited failures include Storefront, Admin/Inbox, Scanner, legacy Agent Bridge fixtures, and outdated CI-mode test assumptions. Do not silence or weaken baseline tests to claim a green full CI. Track as independent master cleanup debt.
- **Accepted only as targeted regression evidence** (NO NEW REGRESSIONS), NOT a FULL CI PASS or Release Approval. Production Edge still v2/recursive and audit table has no persisted invocation. No merge or deploy.
- Separate PR #694 improved event-specific CTA, five verified distinct hashtags, X Premium longform and batch diversity; its Project Memory schema bug (two >1200-character summaries) was identified, corrected to 1143/1153 characters and bootstrap independently returned READY. PR #694 remains DRAFT, not production.
