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
