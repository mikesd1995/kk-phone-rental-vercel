# KK Phone Rental — Full-System Audit 2026-09-30

## Method
Read-only cross-layer audit using current GitHub main/open PRs/issues, current Vercel deployments/runtime HTTP boundaries, ChatGPT automation registry, Hugging Face account status, and available connector state. No business data or production configuration was changed by this audit.

Percentages below are acceptance-weighted estimates, not lines-of-code completion. A feature gets less credit when code exists but current Production/runtime acceptance is absent.

## Executive status
- Current GitHub main: `3c98c8846dc8b705eed140d530e6bca7eeb3dfbb` (Private Reader readiness hardening).
- Current Vercel Production: `2f628a2b92d6c913089fd749429a06d02ee617ed`.
- Production is therefore behind current main and does not yet contain several merged safety fixes.
- Storefront root: HTTP 200.
- Admin gate: HTTP 200, no-store, CSP, frame deny, noindex.
- Event/package public feeds: HTTP 200, no-store, but both still report `public-gviz-fallback`.
- Project remains NOT production-complete while the Final Production Completion Gate is open.

## Acceptance-weighted subsystem status

| Subsystem | % | State | Main remaining gate |
|---|---:|---|---|
| Storefront core / booking entry | 90 | operational, production behind main | deploy current main; runtime smoke; exact poster defect |
| Storefront poster delivery | 88 | 74/75 healthy candidates in validated audit | fix KHOM KHLANG exact-event poster; deploy #327 |
| Admin UI / security boundary | 88 | operational | authenticated real-mobile save/cancel acceptance |
| Admin write backend / Apps Script | 62 | safe but incomplete | Gate 2 exact source + atomic return-time/collision + controlled deploy |
| Booking / inventory concurrency | 70 | Vercel guard exists, backend atomicity incomplete | #325 / Gate 2 acceptance |
| Pricing / packages | 90 | live derived feed and bulk edit implemented | current-main production acceptance / competitor evidence freshness |
| Revenue / analytics | 84 | actual/future/forecast logic implemented | private reader/CRM freshness and production acceptance |
| Public data boundary | 82 | no-store/redaction live | deploy #326/#333 and reconcile #324 |
| Private Reader | 68 | code/readiness hardened, not active | service account + private-service-account parity + strict cutover |
| Scanner | 58 | contract hardened; canonical recurring task currently OFF | P0 natural task persistence and provider-bound full loop |
| Verifier / promotion | 62 | contract/no-drop/promotion logic exists; recurring task OFF | natural persistence + live governed acceptance |
| Canary | 48 | structural/zero-write contracts exist | natural provenance + scenario-specific evidence; task OFF |
| Event discovery / Ultra Deep | 65 | strong repo contracts and monthly work | recurring provider executor + natural runtime reliability |
| Competitor intelligence | 65 | watch policy exists | durable evidence freshness and automated governed price handoff |
| AI agent gateway / orchestration | 72 | registry/router/governance substantial | production runtime acceptance and stale PR consolidation |
| HF Event Assist | 60 | account connected; quality/safety harness exists | production activation intentionally blocked by control-plane gate |
| OpenAI CSV analysis agent | 55 | substantial draft implementation | fresh-main reconcile, CI/live zero-write acceptance, release |
| GPT shadow migration | 50 | draft/shadow only | live zero-write eval/credentials/acceptance; no production cutover |
| LINE booking notification | 55 | text path exists; poster Flex is staging PR #334 | complete dry-run then controlled LINE integration acceptance |
| Make / Telegram / CRM sync | 35 | historical design exists | current connector unavailable; historical issue says org/team quota paused |
| CRM / Intelligence dual-sheet | 58 | secondary private model exists | fresh sync + private reader + lazy cutover |
| Visual QA / UX automation | 60 | draft Playwright/UX reviewer work exists | reconcile #237/#238 onto current main and execute acceptance |
| CI / regression / invariants | 93 | strong and active | production must catch up to main; prune stale branches/PRs |
| Deployment / production parity | 45 | Production healthy but stale | exact current-main READY deployment + post-deploy acceptance |
| Ops / physical inventory | 70 | 2 phones tracked | accessory shortfall physical reconciliation; payment follow-up |
| Scheduled monitoring | 72 | consolidated market+safety and daily report active | canonical Scanner/Verifier recurring tasks are OFF; P0 recovery pending |

Weighted overall estimate: **~70% production-complete**.
Code/repository readiness is materially higher (~84%), but runtime/production acceptance is lower (~61%); the overall number intentionally penalizes unproven production cutovers.

## P0 / highest-priority blockers

1. **Production is stale versus main.** Merged fixes after `2f628a2b...` are not serving Production, including public-feed pipe redaction (#326), poster fallback (#327), Scanner/Verifier contract hardening (#332), and Private Reader split-brain hardening (#333).
2. **Canonical Scanner and Verifier recurring automations are OFF.** This is direct current registry evidence and matches the long-running task-persistence P0. Do not create replacements/watchdogs.
3. **Apps Script Gate 2 remains incomplete.** Exact/reconstructed 9_5_9 lineage, return_time persistence and atomic cross-day collision/duplicate protection need controlled production acceptance; PR #325 remains draft.
4. **Private Reader is not active.** Production event/package feeds still report `public-gviz-fallback`.
5. **Canary natural-run provenance remains unaccepted.**
6. **Make runtime cannot be freshly inspected from the current connection.** Historical project issue records org/team usage-limit pause; treat current state as unverified until connector/runtime capacity is restored.
7. **One poster source remains confirmed unhealthy:** KHOM KHLANG Special Episode 5.
8. **Admin Direct Writer remains blocked-safe** pending dedicated writer service-account identity and controlled write/readback/receipt acceptance.

## Open development debt
Current open PRs include #334 LINE poster dry-run, #325 Gate 2, #324 public Sheets boundary, #322 CSV agent, #315 superseded Admin refresh fix, #314 GPT shadow, #237/#238 UX/visual QA, plus older AI platform drafts. Several are based on old main and must be fresh-ported or closed as superseded rather than merged blindly.

## Recommended execution order
1. Restore **deployment parity**: get exact current main to READY Production and run post-deploy runtime audit. This unlocks merged safety fixes.
2. Execute the already-scheduled **P0 Recovery Acceptance** on the natural Scanner/Verifier pair; do not manually manufacture runtime credit. Resolve task-persistence defect before HF activation.
3. Finish **Gate 2 Apps Script / booking atomicity** from #325 with owner-authenticated project/timezone/trigger evidence, controlled deployment, legitimate write/readback.
4. Activate **Private Reader migration mode** with read-only service account; require both public feeds to report `private-service-account` and parity before strict mode/private workbook.
5. Resolve **Make capacity/connection** and prove CRM 8/8 freshness + Telegram transport.
6. Close the **KHOM KHLANG poster** defect with a verified exact-event publicly readable source.
7. Reconcile/close stale PRs; prioritize #324, #334, #322, #237/#238 after rebasing/fresh-porting to current main.
8. Only after control-plane persistence is accepted, perform HF/GPT shadow live zero-write acceptance; keep production authority with Verifier.
9. Complete Admin Direct Writer identity only if the operational benefit justifies it; do not route Booking/Asset/create until exactly-once/concurrency semantics are accepted.
10. Finish physical ops debt: accessory kit count/capacity and payment follow-ups.

## Safety
This audit performed no business writes, no Sheet mutation, no Vercel environment mutation, no deployment, no task-state mutation, no Make scenario mutation, no Apps Script deployment, and no customer/provider send.


## Execution update — Production Catch-up Acceptance (2026-09-30)

### Completed
- Exact current main resolved to `e8094f333c38a766f3adfd5f85e2668413d35f26`.
- Vercel Production deployment `dpl_HAmBtzx6sNwpCfXaVqfYjvD576Pa` is `READY`, target=`production`, ref=`main`, SHA exactly equals current main.
- GitHub combined Vercel status for exact main is `success` / `Deployment has completed`.
- Main Admin Regression run #1050 (`36614072989`) completed `success`.
- Continuous invariant gate completed `success`.
- Code Intelligence retrieval benchmark completed `success`.
- HF benchmark safety/readiness checks completed `success` and HF remains fail-closed without activation.
- Rental Analytics Production Watch run #164 (`36614072971`) completed `success`, including exact-main pinning, read-only Production watcher, durable evidence, and unsafe-state failure gate.
- Live Production storefront `/` returns HTTP 200.
- Live Production Admin gate `/admin` returns HTTP 200 with no-store, CSP, frame deny, noindex/security controls.
- Live public event and package feeds both return HTTP 200 on the current Production alias.
- This closes the previously identified stale-Production/build-rate-limit blocker for merged main changes including #326, #327, #332, #333 and #334 source.

### Still intentionally open
- Private Reader is not accepted merely because the current-main code is deployed. Runtime cutover still requires both feeds to report `private-service-account` with parity before strict mode.
- Scanner/Verifier natural task-persistence P0 remains separate from deployment acceptance.
- Apps Script Gate 2 remains separate and is not changed by this deployment.
- Make capacity/runtime remains separate.
- No production business data, Sheet data, task state, Apps Script, Make scenario, or customer/provider message was mutated during this acceptance pass.

### Improvement
Deployment parity moved from the prior stale state to exact-current-main Production. This removes a cross-system split-brain where repository safety fixes existed but were not serving users. Runtime and CI evidence are now tied to the same SHA instead of inferring acceptance from merged code.


## Execution update — Control-plane persistence checkpoint and debt cleanup

- Fresh task-registry readback confirms canonical Scanner `6ab272b36b1881919577ff3367fa8245` is OFF and canonical Verifier `6ab7e060fa788191b5f17a7028494c3a` is OFF.
- Retired Verifier remains OFF.
- No task was re-enabled, cloned, replaced, rescheduled, or backfilled. Current classification remains `RECURRING_TASK_STATE_PERSISTENCE_PLATFORM_DEFECT`; natural-runtime credit remains zero until governed durable evidence proves a valid occurrence.
- The existing `KK P0 Recovery Acceptance` one-shot remains enabled and is the correct bounded path for the next checkpoint; it explicitly forbids manufacturing proof or re-enabling an unexpectedly-OFF canonical task.
- GitHub Issues #47 and #49 were updated with the fresh exact task-state evidence.
- Stale PR #315 was closed as superseded because its Admin refresh-race fix was already incorporated and merged through PR #316, now present in current Production.
- Gate 2 PR #325 remains draft. Its exact-head Admin Regression #1029 passed, but its base predates current main and live acceptance still requires owner-authenticated Apps Script identity/timezone/trigger evidence plus controlled legitimate write/readback. It was not merged or deployed by this pass.


## Execution update — Vercel function-budget recovery / PR #337

Fresh audit found that main advanced after the prior deployment-parity checkpoint: LINE webhook PR #336 merged to main while Production remained on the prior healthy SHA. The LINE branch exposed a Vercel Hobby API-function budget problem, so the earlier statement that deployment parity was fully closed became stale.

Actions:
- Root cause isolated to deployable legacy v5 API entrypoints plus stale regression references.
- Retired v5 analytics code was preserved as a non-deployable oracle under `server/legacy`; unused v5 API entrypoints/config were removed from the Vercel function surface.
- Admin auth regression coverage was reconciled so security assertions remain against current v6/internal legacy code without requiring a retired deployable API function.
- PR #337 exact-head Admin Regression #1066 passed: syntax, regression, continuous invariant gate, Code Intelligence benchmark, HF safety, and HF fail-closed readiness.
- PR #337 was squash-merged to main as `8b73699bfbe3acae4b9acc8a439efc9f52870511`.
- No legacy API function was restored merely to make CI green.
- Vercel subsequently reported `Deployment rate limited — retry in 24 hours` for the new main SHA. Therefore current-main Production deployment/runtime acceptance is **externally blocked**, not falsely marked complete.
- Existing Production remains the prior healthy deployment; no rollback or unsafe alias mutation was performed.

Safety: no booking/pricing/inventory/Sheet/Apps Script/automation/Make/HF/customer-provider business mutation was performed by this recovery.


## Execution update — Apps Script Gate 2 fresh-port

The original Gate 2 PR #325 was re-audited before merge. It was based on `e579f33...`, had diverged from current main, and therefore was not safe to merge directly.

Actions:
- Created `gate2/apps-script-9-5-12-fresh-port-20260930` from current main.
- Fresh-ported exactly the nine Gate 2 files from #325: Admin return-time surface, admin guard/proxy, reconciled Apps Script 9.5.12 candidate, reconciliation document, and reservation/Gate 2 regressions.
- Opened draft PR #339 against current main.
- PR #339 Admin Regression #1070 passed all steps: syntax, regression, continuous invariant gate, Code Intelligence benchmark, HF safety, HF fail-closed readiness.
- Google Drive discovery was attempted for owner-authenticated Apps Script deployment evidence. Accessible KK CRM spreadsheets were found, but no authoritative Apps Script project/deployment identity, timezone, or installed-trigger evidence was returned by the available Drive surface. Therefore no production Apps Script deployment or legitimate business write/readback was attempted.
- PR #339 remains intentionally draft/unmerged until the acceptance contract can be satisfied with authoritative owner-side Apps Script evidence.

Safety: no Production Sheet mutation, Apps Script deployment, booking mutation, inventory mutation, task mutation, or customer/provider send.


## Execution update — Private Reader runtime readiness diagnostics

Fresh Production readback confirmed both `08_Web_Ready!A4:K` and `09_Web_Packages!A4:N` still return `X-KK-Sheet-Source: public-gviz-fallback`; Private Reader is therefore not yet runtime-accepted.

The available Vercel connector in this session does not expose environment-variable read/write actions, so credential presence could not be authoritatively inspected from the control plane without guessing or requesting secret material in chat.

Actions:
- Added coarse, non-secret Private Reader readiness headers to the existing public-data response: configured (0/1), auth mode, Sheet-ID resolution classification, and strict-mode state.
- Explicitly excluded service-account email, private key, token, and Sheet ID from diagnostics.
- Added regression coverage proving the diagnostic does not leak credential/Sheet identifiers and preserves public fallback behavior.
- PR #340 Admin Regression #1072 passed syntax, regression, continuous invariant gate, Code Intelligence benchmark, HF safety, and HF fail-closed readiness.
- Initial merge attempt correctly failed because #340 was still Draft; no protection bypass was used. PR was marked Ready for review and squash-merged as `c0e7ca224e6e836601a27321b4ba6657454ec38a`.
- Strict private mode remains unchanged/off until both feeds prove `private-service-account` parity. Public workbook access was not changed.

Safety: no secret was printed or stored in repo; no Vercel env mutation, workbook ACL mutation, business-data mutation, or strict-mode activation was performed.


## Execution update — KHOM KHLANG Special Episode 5 poster re-verification

The remaining poster failure was re-investigated rather than papered over with a generic series image.

Fresh public evidence confirms the exact event identity: `KHOM KHLANG (Special Episode 5)`, 2026-10-05, SIAM PAVALAI ROYAL GRAND THEATRE / Paragon Cineplex. Public sources include the event discovery page derived from Ticketmelon, contemporaneous entertainment coverage, and posts attributed to the official Khom Khlang / WeTV channels.

However, direct image discovery still did not yield a verified public-readable exact-event poster asset suitable for the storefront fallback. Image search returned a Khom Khlang series-launch visual, which is not the Special Episode 5 poster and was explicitly rejected as a fallback. The previously configured Drive asset remains a delivery/permission failure from prior evidence.

Result: the audit is intentionally **not** forced to 75/75. The remaining state stays 74/75 until an exact-event, publicly deliverable poster asset is obtained. This preserves visual SOT integrity and prevents a false-green poster audit.

No storefront fallback, Sheet poster URL, or business data was mutated during this re-verification.


## Execution update — Make / CRM / Telegram runtime audit

A live read-only audit was run against both connected Make accounts in zone `us2.make.com`.

Canonical Make A findings:
- `05_KK_ADMIN_WRITE_BRIDGE` (6336390): paused/off, zero incomplete executions, Google connection `ok`; its own description records Free-plan credit exhaustion and Vercel quarantine. No execution was triggered.
- `04_KK_CORE_CRM_SYNC_ENGINE` (6274697): paused/off, Google connection `ok`, zero incomplete executions. Historical runtime evidence on 2026-09-15 contains multiple successful end-to-end syncs with exact readback gating; latest successful runs used 56 credits each. Earlier configuration errors were followed by successful runs, so those old errors are not the current blocker.
- `03_KK_OWNER_TELEGRAM_LEDGER_TRANSPORT` (6176241): paused/off, Google and Telegram connections both `ok`, zero incomplete executions. Historical auto runs on 2026-09-15 repeatedly succeeded; observed idle-poll runs consumed 1 credit each.
- `02_KK_TELEGRAM_CONTROL` (5901592): Make reports `status=paused` while `isActive=true`; all surfaced Google/Telegram connections are `ok`. Latest observed successful runtime is 2026-09-04; old validation failures also exist. Direct business outbound route is structurally quarantined behind a false business-send gate.

Make B findings:
- `02_KK_CONTROL_GATEWAY_CLEAN_STAGING` (5988323): inactive/off, 15 stored incomplete executions and `isWaitingOnIncompleteExecutions=true`. Google, Telegram and AI-provider connections surfaced by the scenario are present; this staging scenario is a separate backlog/blocker and must not be confused with canonical Make A CRM/ledger health.
- Backup staging scenario is inactive with zero incomplete executions.

External platform check:
- Make's public status page reported no current incident for 2026-09-30; recent Sep 23 scenario-log UI incident is resolved.
- Make documentation confirms credit exhaustion can raise `OperationsLimitExceededError` and immediately disable scheduled scenario execution.

Classification:
1. Canonical CRM/Telegram architecture has historical runtime proof and healthy surfaced connections.
2. Current canonical blocker is paused/off runtime after the credit-exhaustion/quarantine boundary; it is not presently attributable to a Make-wide outage.
3. Make B has an independent stored-incomplete-execution backlog and should remain isolated from canonical production.
4. No scenario was run, enabled, disabled, replayed, or edited during this audit; no Telegram message or Sheet business write was generated.

Next acceptance after fresh credits are available: verify credit reset first, then use a bounded health/readback run before any canonical scheduling is re-enabled; do not replay stale staging incomplete executions into production.


## Execution update — exact-main Production parity + control-plane persistence refresh

Fresh evidence supersedes the earlier rate-limit checkpoint.

Production / CI:
- Current `main` is exactly `c0e7ca224e6e836601a27321b4ba6657454ec38a` (`Expose safe Private Reader runtime readiness (#340)`), parent `8b73699bfbe3acae4b9acc8a439efc9f52870511`.
- Vercel deployment `dpl_4AkRF5DDqX2RcBwHr953YqkvLyzd` is `READY`, target `production`, and reports the exact same GitHub SHA `c0e7ca224e6e836601a27321b4ba6657454ec38a`.
- GitHub Vercel commit status for exact current main is `success`.
- Admin Regression #1073 / run `36622184888` completed `success`; syntax, regression, continuous invariant, Code Intelligence benchmark, HF harness safety and fail-closed readiness steps all passed.
- Rental Analytics Production Watch #167 / run `36622185070` completed `success`; exact-main pinning, Vercel transport, read-only production watcher, durable-state publication and unsafe-state gate all passed.
- A direct Vercel runtime-log query timed out despite being scoped to the exact deployment; no runtime-log claim is made from that failed query. Production Watch success remains the durable runtime acceptance evidence.
- Therefore the prior `CURRENT_MAIN_DEPLOYMENT_PENDING / build-rate-limit` classification is resolved for current main. Exact-main Production parity is PASS at this checkpoint.

Scanner / Verifier task persistence:
- Fresh native task registry still shows canonical Scanner `6ab272b36b1881919577ff3367fa8245` OFF and canonical Verifier `6ab7e060fa788191b5f17a7028494c3a` OFF.
- Retired Verifier `6ab260ee56308191b76c305704cbeab8` remains OFF as required.
- The one-shot P0 Recovery Acceptance has already run and is disabled; no synthetic replacement acceptance was created.
- Per `CONTROL_PLANE_TASK_PERSISTENCE_ESCALATION_V444`, no re-enable, clone, replacement task, watchdog, reschedule or backfill was performed.
- Classification remains `RECURRING_TASK_STATE_PERSISTENCE_PLATFORM_DEFECT`; timer/last-run metadata receives zero natural-runtime credit.
- Daily Safety Report and consolidated Market + Safety Watch remain enabled; this audit did not change their schedules or prompts.

Safety:
- No Scanner/Verifier state mutation, Machine-SOT business write, booking/pricing/inventory mutation, Apps Script mutation, Make mutation, or customer/provider send was performed.


## Execution update — Gate 2 rebase-safe fresh-port + production timing evidence

- PR #339 was rechecked after current main advanced to `c0e7ca224e6e836601a27321b4ba6657454ec38a` through PR #340. #339 is now diverged from main: its merge base remains `8b73699bfbe3acae4b9acc8a439efc9f52870511`; main added Private Reader readiness changes in `api/kk-data.js` and `tests/public-data-proxy.test.js`.
- Direct merge of #339 was therefore rejected. A second fresh branch `gate2/apps-script-9-5-12-current-main-20260930` was created from exact current main and the same nine Gate 2 files were ported onto it.
- First copy strategy failed when missing candidate/doc/test paths were sent through update semantics. Recovery switched to create-missing/update-existing semantics; all nine Gate 2 paths were completed without reverting PR #340.
- New draft PR #341 `Fresh-port Apps Script Gate 2 onto exact current main` was opened at head `884f61f96dd710f3d2d1f09b44eed8b8898e9666`. Compare against main is clean: ahead 9, behind 0; exactly nine Gate 2 files differ.
- Exact-head Admin Regression #1078 / run `36624399179` was queued at this checkpoint. #341 remains draft and must not merge until CI completes and owner-authenticated runtime acceptance is complete.
- Production read-only Apps Script timing diagnostic returned `READBACK_COMPLETE`: effective UTC offset `+07:00`, `effective_utc_plus_7_verified=true`, and `backend_sheet_identity_verified=true`.
- The same diagnostic explicitly leaves `named_project_timezone=UNVERIFIED`, `installed_triggers=UNVERIFIED`, and `cleanup_trigger=UNVERIFIED`. These are not inferred from the effective offset.
- Diagnostic safety reported read-only execution with Apps Script writes=0, Sheet business writes=0, trigger mutations=0, timezone mutations=0, secrets exposed=false.
- Initial batched Vercel fetch failed at connector level; retrying the timing endpoint individually succeeded. No application failure was inferred from the connector-level batch error.
- Gate 2 runtime acceptance is therefore improved from fully-unverified timing to **effective timezone/backend identity verified**, while named Apps Script project timezone, installed triggers, cleanup trigger, controlled Apps Script deployment and legitimate write/readback remain pending.


## Execution update — Gate 2 CI closure + Private Reader runtime classification

Gate 2:
- PR #341 exact-head Admin Regression #1078 / run `36624399179` completed `success`.
- All job steps passed: syntax, regression, continuous invariant gate, Code Intelligence benchmark, HF benchmark safety, and HF fail-closed readiness.
- PR #341 is mergeable but intentionally remains Draft because runtime acceptance is incomplete.
- Repository search confirms the production timing endpoint intentionally leaves named Apps Script project timezone, installed triggers, and cleanup trigger `UNVERIFIED`; current deployed code has no owner-metadata readback that can authoritatively close those fields.
- Therefore no controlled Apps Script deployment or legitimate business write/readback was attempted. Gate 2 code candidate is PASS; owner-authenticated Apps Script metadata/deployment acceptance remains the blocker.

Private Reader:
- Exact current-main Production diagnostics were read for both `08_Web_Ready!A4:K` and `09_Web_Packages!A4:N`.
- Both returned HTTP 200, `no-store`, `X-KK-Private-Reader-Configured: 0`, `X-KK-Private-Reader-Auth: none`, `X-KK-Private-Reader-Strict: 0`, `X-KK-Private-Reader-Sheet-State: CRM_SHEET_ID_RESOLVED`, and `X-KK-Sheet-Source: public-gviz-fallback`.
- This resolves the previous ambiguity: Production does not currently have a usable Private Reader credential configuration. It is not merely an old-deployment visibility question.
- Strict mode was deliberately not enabled because `Configured=0`; enabling it now would fail closed and break public feeds.
- The available Vercel connector surface was searched again and exposes no environment-variable/secret read-write action, so credential provisioning cannot be safely performed from this session. No credential material was requested in chat or committed to GitHub.

Safety:
- No Apps Script deployment, trigger/timezone mutation, Vercel secret mutation, Sheet ACL change, business-data write, Scanner/Verifier mutation, Make mutation, or outbound customer/provider message occurred.


## Execution update — LINE webhook / Flex runtime acceptance

Read-only LINE acceptance was executed against exact-current-main Production without sending a LINE message.

Production route:
- `GET /api/line-webhook` returns HTTP 405 `Method Not Allowed`, `Cache-Control: no-store`, and `X-Content-Type-Options: nosniff`, proving the production rewrite is active and reaches the webhook handler's method guard.
- `vercel.json` rewrites `/api/line-webhook` to `/api/kk-data?__kk_line_webhook=1`; `api/kk-data.js` dispatches that marker to `server/line-booking-webhook.js`.
- Vercel grouped runtime errors for `/api/kk-data,/api/line-webhook` over the prior 24h returned no runtime errors. A broad text runtime-log query timed out and was not treated as evidence.

Security / behavior contracts:
- Webhook source requires both `LINE_CHANNEL_SECRET` and `LINE_CHANNEL_ACCESS_TOKEN`; missing configuration returns 503 before signature processing.
- Signature validation is HMAC-SHA256 over the raw request body with constant-time comparison; invalid/missing signature returns 401.
- Only LINE text message events with a parseable storefront booking template are handled.
- Poster lookup reads the public event feed and resolves only an exact normalized event-name + venue match.
- Reply path builds a Flex message and sends only through LINE's reply API using the channel access token.
- Flex builder accepts HTTPS poster URLs only; missing/invalid poster degrades to text-only Flex rather than failing the booking reply.

Regression evidence:
- `tests/line-webhook.test.js` covers exact raw-body signature validation, Thai storefront booking parsing, unrelated-text ignore, exact public-event poster resolution, and Flex reply construction.
- `tests/line-booking-flex.test.js` covers HTTPS hero poster, text-only fallback, rejection of unsafe/non-HTTPS URLs, Thai/long text, and no-send-side-effect builder behavior.
- Admin Regression #1073 on exact current main passed `npm test`, which executes `node --test tests/*.test.js`; therefore both LINE test files are included in the passing regression set.

Acceptance boundary:
- Route/security/parser/poster/Flex code and exact-current-main regression are PASS.
- Current connector surface does not expose Vercel env-variable values, so production readiness of `LINE_CHANNEL_SECRET` and `LINE_CHANNEL_ACCESS_TOKEN` is not authoritatively proven from this session.
- A legitimate signed LINE inbound event and resulting LINE reply/Flex delivery have not been generated in this audit. No synthetic signature, replay token, or customer/provider message was used.
- Final LINE E2E remains pending on legitimate inbound webhook evidence or a secure credential/readiness control-plane surface.

Safety: zero outbound LINE sends, zero Sheet business writes, zero credential mutation/exposure.


## Execution update — Gate 2 superseded PR cleanup

After #341 exact-head regression passed, stale Gate 2 candidates were reconciled:
- PR #325 was commented as superseded by #341 and closed unmerged.
- PR #339 was commented as superseded by #341 and closed unmerged.
- Both comments explicitly warn not to merge the stale candidate and preserve the owner-authenticated runtime-acceptance boundary.
- PR #341 remains open Draft as the single canonical Gate 2 candidate.
- No stale branch was deleted, preserving forensic history while removing accidental-merge risk.


## Execution update — repository-wide open PR reconciliation

All open PRs were reviewed against current main and classified conservatively.

Closed unmerged as clearly superseded:
- #338 LINE booking webhook production-acceptance documentation: superseded by current-main LINE implementation plus the newer durable audit/runtime acceptance.
- #324 public Sheets read-boundary hardening: superseded by later current-main read-boundary/Private Reader work including #340.
- #141 v4.9.23 Private Reader acceptance: superseded by current-main Private Reader implementation/readiness diagnostics and current Production classification.
- #152 standalone AI governance foundation: standalone landing path superseded by combined integration successor #181.
- #175 standalone Phase-0 control plane: standalone landing path superseded by combined integration successor #181.
Each PR received an explicit supersession comment before closure; no branch was deleted.

Kept open Draft with explicit reconciliation comments:
- #322 CSV Analysis Agent — distinct candidate; live OpenAI acceptance/release still separate.
- #314 GPT-6 Sol shadow — distinct shadow candidate; no live credential/eval/cutover acceptance.
- #237 Storefront UX Reviewer — distinct candidate; requires fresh current-main + visual acceptance.
- #238 Visual QA — stacked on #237; retain until dependency/reconciliation is resolved.
- #231 Operating Partner Phase 2 — gated by natural-runtime/control-plane evidence and fresh baseline.
- #200 bounded read-only Ops collectors — stacked on #185; retain pending stack reconciliation.
- #185 local read-only Ops pilot — stacked on #181; retain pending reconciliation.
- #184 Tracker-to-Core promotion gate — distinct fail-closed candidate; baseline historical.
- #181 combined Phase-0 integration — canonical successor for closed #152/#175, but current main has advanced and requires fresh-port/retest.
- #113 AI quality/observability/dedup shadow — distinct candidate requiring reconciliation with current AI stack.

Canonical operational/audit PRs retained:
- #341 Apps Script Gate 2 current-main candidate — Draft, code CI PASS, runtime acceptance pending.
- #335 full-system audit — Draft durable evidence branch.

Post-cleanup open PR count: 12, all Draft. No production deployment, business write, scheduler mutation, branch deletion or automatic merge was performed.


## Execution update — Storefront UX/Visual QA current-main fresh-port

PR #237 was not rebased or merged directly. Compare showed its head diverged materially from current main (main 73 commits ahead; old branch 28 commits ahead of the merge base), so a clean current-main port was used.

New canonical candidate:
- Branch: `ux/storefront-current-main-20260930`
- Base: exact current main `c0e7ca224e6e836601a27321b4ba6657454ec38a`
- Draft PR #342: `Fresh-port Storefront UX Reviewer onto exact current main`
- Current exact head: `68b6e123b4dd5b54c8eb996f9fb85de45efcdd94`

Reconciled changes:
- Ported the read-only Storefront UX policy/reviewer, skill, dry-run and regression test as clean new files.
- Reconciled Agent Registry/Task Router onto their newer current-main versions instead of overwriting them; added `storefront_ux_review` and `storefront_visual_qa` routes while preserving newer discovery/content/pricing routes.
- Reconciled current storefront CSS rather than copying the stale #237 stylesheet.
- Corrected the current mobile filter hotfix from 36px controls / 11–12px select text to a 44px interaction floor and 16px iOS-safe select text.
- Preserved a single horizontally scrollable mobile filter row, safe-area-aware fixed LINE CTA spacing, and moved the one-column event-card breakpoint from 400px to 340px so 375/390px devices retain two columns while 320px-class devices can collapse safely.
- Fresh-ported #238's zero-cost Playwright visual-QA workflow/harness/docs/test onto the same candidate and wired `ux:visual:accept`.

CI evidence boundary:
- Intermediate Visual QA runs #18/#19 failed because the workflow was committed before the harness during sequential file porting; logs show `MODULE_NOT_FOUND scripts/storefront-visual-acceptance.mjs`. These are classified PARTIAL_PORT_CI_RACE and are not candidate failures.
- Exact-final-head Visual QA run #22 / `36629590347` passed checkout, Node setup, harness syntax, runner Chrome setup and localhost storefront startup; screenshot/metrics acceptance was still in progress at the latest read.
- Exact-final-head Admin Regression #1089 / `36629590345` was queued at the latest read.
- No merge/deploy/production write is authorized until both exact-head gates complete and visual evidence is reviewed.

Safety: zero Production deploys, zero business-data writes, zero Sheet/Apps Script mutations, zero scheduler changes.


## Execution update — Storefront UX acceptance failure triage and repair

PR #342 exact-head `68b6e123b4dd5b54c8eb996f9fb85de45efcdd94` completed both gates with real code/contract failures, not infrastructure failures:
- Visual QA #22 / `36629590347`: harness executed successfully, produced 16 evidence files (artifact ID `11062486227`), but aggregate acceptance failed. Every 320/375/390/430/480/768 viewport had exactly one P1: `TAP_TARGET_TOO_SMALL` for FAQ; 1024 passed.
- Admin Regression #1089 / `36629590345`: 904 tests, 898 pass, 6 fail. Failures were three stale Registry V18 assertions after intentional V19 registration, two stale 400px narrow-grid assertions after intentional 340px breakpoint change, and one Code Intelligence route regression where Storefront UX context was not yet registered.

Repairs applied without lowering acceptance thresholds:
- `.mini-btn` now shares the 44px mobile hit-area floor with quick links, fixing the actual FAQ P1.
- Registry contract tests updated from V18 to V19 where the registry was intentionally extended.
- narrow-grid regression assertions updated from 400px to 340px, preserving two columns at 375/390 while allowing one column on 320-class devices.
- `config/kk-code-context-routes.json` storefront route now includes Storefront UX reviewer, tests, skill and Visual QA documentation, repairing Code Intelligence retrieval rather than weakening its test.

New exact candidate head: `403a6824e9450ad1261480a94932408fd90c790e`.
New exact-head gates:
- Admin Regression #1097 / `36630333036`: pending at latest read.
- Storefront Automated Visual QA #29 / `36630333037`: pending at latest read.

PR #342 remains draft/unmerged; Production unchanged. Safety: zero business writes, zero Sheet/Apps Script mutations, zero scheduler changes.


## Execution update — Storefront UX second acceptance repair

Exact-head `403a6824e9450ad1261480a94932408fd90c790e` results:
- Storefront Automated Visual QA #29 / `36630333037`: SUCCESS. The prior mobile/tablet FAQ P1 was eliminated without lowering thresholds.
- Admin Regression #1097 / `36630333036`: FAILURE with one remaining regression only: `Code Intelligence routes Operating Partner work to the new business brain`. The required `server/kk-operating-partner.js` was no longer selected after Storefront UX context expansion.

Root cause: shared Code Intelligence `max_files=10` capacity was saturated by legitimate route growth. This was treated as a cross-route capacity regression, not papered over by deleting Storefront UX context or weakening the Operating Partner assertion.

Repair:
- Increased Code Intelligence default `max_files` from 10 to 12, preserving both Storefront UX and Operating Partner context coverage within the existing token budget and ranking logic.
- New exact candidate head: `4906037d75e1eded98a004aadec60dddf7d1196e`.
- Admin Regression #1099 / `36630728113`: in progress at latest read.
- Storefront Automated Visual QA #30 / `36630728001`: in progress at latest read.

PR #342 remains Draft/unmerged; Production unchanged until both exact-head gates pass.


## Execution update — Storefront UX third acceptance repair

Exact-head `4906037d75e1eded98a004aadec60dddf7d1196e` results:
- Storefront Automated Visual QA #30 / `36630728001`: SUCCESS.
- Admin Regression #1099 / `36630728113`: FAILURE with the same single Operating Partner Code Intelligence selection regression.

The first capacity repair (`max_files: 10 -> 12`) was therefore insufficient. Further inspection of `server/kk-code-intelligence.js` showed selection also fails closed against `max_estimated_tokens`; the context pack was exhausting the 12,000-token budget before the required Operating Partner file could be selected.

Second repair:
- Preserve `max_files=12`.
- Increase default Code Intelligence context budget from 12,000 to 16,000 estimated tokens.
- Do not remove Storefront UX context and do not weaken the Operating Partner regression assertion.
- Ranking logic, large-file allocation cap and route matching remain unchanged.

New exact candidate head: `1c093dba2cccad59e59c6d4d33d26a2786d27180`.
New exact-head gates:
- Admin Regression #1102 / `36631052536`: in progress at latest read.
- Storefront Automated Visual QA #31 / `36631052500`: in progress at latest read.

PR #342 remains Draft/unmerged and Production remains unchanged pending both gates.


## Execution update — Storefront UX fourth acceptance repair

Exact-head `1c093dba2cccad59e59c6d4d33d26a2786d27180` results:
- Storefront Automated Visual QA #31 / `36631052500`: SUCCESS.
- Admin Regression #1102 / `36631052536`: FAILURE with three Code Intelligence invariant failures. Raising the shared token budget solved the Operating Partner selection symptom but violated the established bounded-context contract (`estimated_context_tokens <= 12000`) and retrieval benchmark budget.

This disproved the global-capacity expansion approach. The candidate was repaired by separation of concerns:
- Restore Code Intelligence defaults to `max_files=10` and `max_estimated_tokens=12000`.
- Remove Storefront UX reviewer/test/skill/docs only from the generic `storefront` Code Intelligence retrieval route.
- Keep the Storefront UX reviewer implementation, explicit `storefront_ux_review` / `storefront_visual_qa` task routes, tests, skill, policy and Visual QA workflow/harness intact.
- No acceptance threshold was weakened.

New exact candidate head: `8576e7368ef900785e6e977a41da681de8f59911`.
New exact-head gates:
- Admin Regression #1104 / `36631359508`: in progress at latest read.
- Storefront Automated Visual QA #32 / `36631359478`: in progress at latest read.

PR #342 remains Draft/unmerged; Production unchanged.


## Execution update — Storefront UX fifth acceptance repair

Exact-head `8576e7368ef900785e6e977a41da681de8f59911` results:
- Storefront Automated Visual QA #32 / `36631359478`: SUCCESS.
- Admin Regression #1104 / `36631359508`: FAILURE with one remaining Operating Partner Code Intelligence selection failure.

With Storefront UX removed from the generic storefront retrieval route and the original `10 files / 12,000 tokens` contract restored, the remaining failure proved the root defect was allocator behavior: a large file explicitly listed by the winning route could be skipped entirely when its allocation did not fit the remaining budget.

Allocator repair:
- Preserve the 12,000-token global ceiling and 10-file limit.
- Preserve normal dependency pruning.
- For an explicit direct-route file that does not fully fit the remaining budget, allocate only the remaining budget and force `symbols_or_targeted_ranges_first` rather than dropping the file entirely.
- This keeps route recall while maintaining the bounded-context invariant.

New exact candidate head: `01e64dab7ef8d21b4d87aea8525e44502e5a7e5e`.
New exact-head gates:
- Admin Regression #1106 / `36632081638`: in progress at latest read.
- Storefront Automated Visual QA #33 / `36632081725`: in progress at latest read.

PR #342 remains Draft/unmerged; Production unchanged.


## Execution update — Storefront UX merged; Production convergence pending

Final pre-merge candidate `01e64dab7ef8d21b4d87aea8525e44502e5a7e5e` passed both exact-head gates:
- Admin Regression #1106 / `36632081638`: SUCCESS, including regression tests, continuous invariant gate, Code Intelligence retrieval benchmark, HF benchmark safety, and fail-closed HF readiness.
- Storefront Automated Visual QA #33 / `36632081725`: SUCCESS, including exact checkout, localhost capture, reviewer acceptance, screenshot/metrics evidence upload.

Freshness/merge:
- Pre-merge `main` remained `c0e7ca224e6e836601a27321b4ba6657454ec38a`, matching PR #342 base; PR was mergeable.
- PR #342 was marked ready and squash-merged successfully.
- New canonical `main` / merge SHA: `66c55c79a9d943c94e298fb6db2575d5a308e9c6`.
- Post-merge Admin Regression #1109 / `36632403338`: SUCCESS on exact merge SHA.
- Rental Analytics Production Watch #168 / `36632403575`: in progress at latest read on exact merge SHA.

Vercel convergence at latest read:
- No deployment for merge SHA `66c55c79...` was yet visible in the latest deployment list.
- Current READY Production remained `dpl_4AkRF5DDqX2RcBwHr953YqkvLyzd` at prior main `c0e7ca224e6e836601a27321b4ba6657454ec38a`.
- Therefore code/CI acceptance is complete, but Production acceptance is intentionally NOT declared yet. No forced deployment was performed.

Next closure gate: wait for/read exact-SHA Vercel Production convergence, then run Production runtime/visual readback before final closure.


## Execution update — Storefront Production recovery exhausted safely

Canonical Storefront UX merge remains `66c55c79a9d943c94e298fb6db2575d5a308e9c6`, with pre-merge Admin #1106 + Visual #33 PASS and post-merge Admin #1109 PASS.

Production convergence investigation:
- Git-integrated Vercel status for the merge reported failure with target URL indicating `build-rate-limit`; no exact-SHA Production deployment was created.
- Production Watch #168 / `36632403575` was cancelled during its bounded poll. Its always-run summary then attempted to parse a partially written JSON file and failed; this is a secondary watcher robustness issue, not a storefront code regression.
- Serving Production remained `dpl_4AkRF5DDqX2RcBwHr953YqkvLyzd` at `c0e7ca224e6e836601a27321b4ba6657454ec38a`.

Recovery attempt #491 / `36632866957`:
- Owner-authorized prebuilt recovery was requested for `66c55c79...`.
- It stopped at the exact-current-main gate before any Vercel mutation because main had advanced to `fc4972da995728ceaf21ad4163380664467f11f1`.
- Comparison proved `fc4972da...` is one commit ahead and zero behind `66c55c79...`; the additional commit only changed `server/admin-direct-writer-phase1.js` and its test.

Recovery attempt #492 / `36632980152`:
- Approved exact current main `fc4972da995728ceaf21ad4163380664467f11f1`.
- Exact checkout, current-main/lineage gate, full source acceptance, Vercel credential check, rollback-source resolution, Vercel CLI install, Production settings pull, local Production prebuild, and final pre-mutation main recheck all PASSED.
- Candidate creation was rejected by Vercel with: `Resource is limited - try again in 24 hours` / code `api-deployments-free-per-day`.
- Candidate was not created; no promotion occurred; no rollback was needed; Production/business writes remained zero.
- This confirms the remaining blocker is an external Vercel Free deployment quota, not source/build/test failure.

Current acceptance classification:
- Code Accepted: YES.
- CI Accepted: YES.
- Local Production Prebuild Accepted: YES.
- Production Deployment Accepted: NO — externally blocked by Vercel daily deployment quota.
- No safe additional deployment path remains that bypasses the provider's deployment quota without changing plan/quota or waiting for reset.


## Execution update — Storefront UX Production blocked by Vercel build quota; current-main target advanced

Production convergence investigation after PR #342:
- PR #342 remains safely merged; its merge SHA `66c55c79a9d943c94e298fb6db2575d5a308e9c6` passed post-merge Admin Regression #1109.
- Production Watch #168 was cancelled while waiting for Vercel. Logs show the exact GitHub Vercel commit status was `failure` with target `upgradeToPro=build-rate-limit`; the cancellation also left a truncated watcher JSON, causing the summary parser to fail. This is classified as deployment-quota/infrastructure, not Storefront code failure.
- Vercel deployment inventory contained no deployment for `66c55c79...`; the latest READY Production remained `dpl_4AkRF5DDqX2RcBwHr953YqkvLyzd` at `c0e7ca224e6e836601a27321b4ba6657454ec38a`.

Current-main advancement:
- While investigating, canonical `main` advanced one commit to `fc4972da995728ceaf21ad4163380664467f11f1` via PR #343 (preserve generated package price formulas on override updates).
- Compare confirms `fc4972da...` is one commit ahead of `66c55c79...`; therefore the Storefront UX merge is retained in current main and deploying the older merge SHA alone is no longer permitted.
- Admin Regression #1112 on `fc4972da...`: SUCCESS.
- Production Watch #169 on `fc4972da...`: SUCCESS as a safe non-mutating watcher, with state `BLOCKED_BUILD_RATE_LIMIT`, severity `waiting`, Production writes 0 and business writes 0.

Safe fallback assessment:
- Existing `rental-analytics-prebuilt-production-recovery.yml` can build exact current main on a GitHub Actions ephemeral runner, create an unaliased prebuilt Production candidate, validate it, promote only after exact-main rechecks, verify live boundaries, and rollback on mismatch.
- Its issue-comment trigger intentionally requires a repository-owner-authored command. A connector-authored attempt was skipped before mutation, proving the authorization gate remains fail-closed.
- A separate owner-authorized recovery attempt for the previous SHA reached authorization but failed the exact-current-main pin after main advanced; all deployment mutation steps were skipped. This is correct fail-closed behavior.
- No forced Vercel build, paid-plan upgrade, Production write, business-data write, or rollback was performed in this investigation.

Current terminal state:
- Code/CI acceptance for Storefront UX: PASS and merged into current main lineage.
- Current main CI: PASS.
- Production convergence: WAITING on build-rate-limit or a newly owner-authorized prebuilt recovery for exact current main `fc4972da995728ceaf21ad4163380664467f11f1`.
- Production runtime/visual acceptance for the new code is not declared until an exact-current-main Production candidate is READY and promoted.


## Execution update — Storefront UX exact-current-main Production acceptance

Acceptance target:
- Current main and Production SHA: `29d034d1339f105a944b9020c2eeabc887ee8b53` (PR #345, with PR #342 Storefront UX already in lineage).
- Production deployment: `dpl_9SLxoZWUCzdBXGvAfqiJBEymebEW`.
- Vercel deployment state/readyState: `READY`; target: `production`; source: `git`; alias includes `kk-phone-rental.vercel.app`; aliasError: null.
- Production HTTP root returned 200 HTML from the canonical domain.
- Runtime error telemetry for the selected last-hour window reported no runtime errors.

Post-deploy gates:
- Admin Regression #1117 (run `36658917982`): SUCCESS; syntax, regression, invariant, Code Intelligence, HF safety and fail-closed readiness steps all passed.
- Rental Analytics Production Watch #172 (run `36658917985`): SUCCESS.
- Watch evidence: `production_matches_current_main=true`, reason `Current main is serving; runtime self-audit and v6 route-shape probes are accepted`, state `ROUTE_WIRING_ACCEPTED`, Production writes 0, business writes 0.

Storefront UX evidence:
- Production HTML contains the expected UX surfaces introduced/retained by the Storefront work: search control, month selector, status filters, clear-filter control, language controls, FAQ trigger, primary LINE CTA and sticky LINE CTA.
- The exact Storefront UX candidate had already passed Storefront Automated Visual QA #33 before merge across 320/375/390/430/480/768/1024 using the zero-cost Chrome/Playwright harness.
- The repository now contains a fail-closed `production` mode in `.github/workflows/storefront-visual-qa.yml` that validates Vercel project, READY state, exact approved SHA and production target before running the same screenshot/metrics reviewer harness.
- The connected GitHub tool surface available in this execution does not expose workflow_dispatch, so a new manual Production-mode visual-QA run could not be started from this session. This limitation does not change the exact-SHA deployment/runtime evidence above and must not be misreported as a visual failure.

Acceptance classification:
- Deployment identity: PASS.
- Current-main convergence: PASS.
- Runtime/route acceptance: PASS.
- Regression acceptance: PASS.
- Storefront source visual acceptance: PASS.
- Fresh Production-browser screenshot matrix: NOT RUN in this session due connector dispatch/browser-execution limitation.
- No Production/business data mutation was used for acceptance.
