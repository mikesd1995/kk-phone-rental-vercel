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
