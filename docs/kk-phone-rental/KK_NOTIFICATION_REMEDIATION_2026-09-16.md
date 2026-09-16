# KK Phone Rental — Notification Remediation — 2026-09-16

## Scope
Current-production investigation and bounded remediation of owner notifications (Telegram + LINE), upstream notification materialization, and durable operational evidence. No customer/public send and no replacement production writer were authorized or created.

## Current authoritative policy
- Exactly one active POLICY_VERSION was fresh-read from `_Policy_Registry`: `v4.9.15 AUTONOMOUS CLOSURE & OWNER NOTIFICATION HARDENING`.
- `OWNER_LEDGER_TRANSPORT_LIVE`: owner outbound is Ledger-only. Telegram = Make Ledger consumer; LINE = existing Apps Script Ledger consumer.
- `LINE_LEDGER_CONSUMER_RUNTIME`: existing authoritative LINE consumer is Apps Script `runKKLineMonitor`; do not introduce a second LINE sender.
- `PROVIDER_ACK_GATE_V499`: `SENT` requires provider acceptance evidence/id and sent timestamp; failures remain retryable, not falsely SENT.
- `BRIEF_LEDGER_MATERIALIZATION_V415`: the natural 07:30 Verifier occurrence must materialize exactly one LINE MORNING_BRIEF, including a zero-change proof; a missed brief may only be recovered later as explicit `LATE_RECOVERY`.

## Findings

### Telegram
- Make scenario `6176241` (`03_KK_OWNER_TELEGRAM_LEDGER_TRANSPORT`) is configured correctly as a 900-second `_Notification_Ledger` poller for `TELEGRAM_OWNER_ALERTS` rows in `QUEUED` / due `RETRY_WAIT`.
- Google and Telegram Make connections report `ok`.
- Prior UAT row 40 (`UAT|TRANSPORT|TG|20260914T1635`) is `SENT`, Attempt=1, HTTP=200, provider `message_id=234` — proving the transport path worked previously.
- Current Make run attempt on 2026-09-16 was rejected by Make with: `Scenario cannot be run because its organization or team is paused. Resolve the exceeded operations or data transfer limit and try again.`
- Separate account evidence from Make identifies the concrete cause: organization `KK Phone Auto` has used all included credits on the current Free plan, and scenarios were paused.
- Therefore the present Telegram outage is account-level Make credit exhaustion, not a Telegram mapping/credential defect.

### LINE
- Current policy explicitly binds LINE to the existing Apps Script `runKKLineMonitor` Ledger-only route and forbids a competing second LINE sender.
- Current UAT row 41 (`UAT|TRANSPORT|LINE|20260914T1636`) remains `QUEUED`, Attempt=0, with no provider ACK as of fresh read on 2026-09-16.
- `_Core_V1_Status` already classifies LINE as `CURRENT_UAT_QUEUED_PROVIDER_PENDING`.
- `_Reconciliation_Log` contains the original queue evidence (`RECON|NOTIFICATION|LINE-UAT-QUEUED|20260914T1636`) but no later ACK/closure for that UAT.
- The repository `apps-script/Code.gs` does not contain `runKKLineMonitor`; the repository Apps Script source is known to be older than the production 9_5_9 source. No accessible Drive Apps Script project was found through the connected Drive surface.
- Therefore the current LINE consumer must be treated as broken/stale until the live Apps Script source/trigger is recovered and inspected. Replacing production from the stale repository copy is prohibited.

### Upstream producer / scheduler
- `_Notification_Ledger` had no row created on 2026-09-16 at the investigation read.
- `_Run_Manifest` had one 2026-09-16 entry at the initial read: Verifier scheduled 03:30 but actually started 04:28, finished `FINISHED_PARTIAL`, and explicitly reported no eligible NEW_EVENT/material-change Ledger staging due.
- Durable Machine-SOT reconciliation now proves repeated current-day control-plane failure, not merely missing notification consumption:
  - Scanner 04:00 missed after task OFF immediately before boundary.
  - Verifier was switched OFF during the late 04:28–04:33 governed runtime.
  - Scanner 05:00 had no evidenced runtime and was OFF.
  - Verifier 07:30 had no natural runtime, task changed OFF, and the on-time LINE Morning Brief was not materialized.
  - Scanner 08:00 and 09:00 missed with task-OFF recurrence; Canary 08:15 also missed.
  - Verifier 08:30 missed.
  - Verifier 09:30 remained enabled around the boundary but produced no Machine-SOT runtime, then became OFF at 09:34.
  - Scanner 10:00 and Verifier 10:30 again produced no Machine-SOT runtime and subsequently became OFF.
- Canonical Scanner and Verifier tasks have been manually restored to their same existing IDs after no-writer validation by the control-plane remediation lane; current registry readback shows them enabled, but natural acceptance remains `0/6` for both roles and their `last_run_time` remains historical Sep14 metadata. Manual re-enable is mitigation, not proof of repair.
- Root actor/mechanism for the recurring task OFF/no-runtime behavior remains `UNKNOWN`. Existing forensic notes identify platform pause/approval as a plausible class only; there is no direct evidence sufficient to attribute the cause.
- Therefore owner-channel silence has three independent layers: Make transport capacity failure, stale/broken LINE consumer acceptance, and upstream natural Scanner/Verifier scheduling/materialization failure.

## Changes performed in this remediation pass
1. Fresh-read the live Notification Ledger, active Policy Registry, Core v1 status, Run Manifest, Reconciliation evidence, current Make scenario topology/connections, and current task registry instead of relying on historical chat state.
2. Verified Telegram Make scenario wiring and both live connection states.
3. Attempted to restore/run Telegram transport. Make confirmed the scenario is already active-state, but execution is blocked at organization/team level by exhausted quota/credits.
4. Confirmed the canonical Scanner/Verifier tasks are currently enabled after prior controlled same-ID mitigation; did not create a watchdog, duplicate task, replacement runner, or alter cadence/prompt.
5. Did **not** mark any Telegram or LINE row `SENT` without provider ACK.
6. Did **not** create a second LINE sender because live policy requires a single authoritative Apps Script consumer.
7. Did **not** deploy repository `apps-script/Code.gs` because it lacks the current LINE runtime and is older than known production source.
8. Did **not** fabricate the missed 07:30 Morning Brief or any missed Scanner/Verifier runtime boundary.
9. Created an isolated operations branch/document and Draft PR so the investigation and safety decisions are durably recorded without modifying production code or `main` directly.
10. Crosschecked existing `_Reconciliation_Log` records rather than appending duplicate incidents; the Machine SOT already contains current durable entries for Make pause, LINE UAT, Morning Brief miss, and repeated task-off/no-runtime recurrence.

## Before vs after
| Area | Before | After this pass |
|---|---|---|
| Telegram root cause | Appeared as paused/no notifications | Proven account-level Make credit exhaustion; scenario config and provider connection separately verified |
| LINE root cause | No Make LINE scenario, unclear transport ownership | Correct ownership resolved: Apps Script `runKKLineMonitor`; current UAT proven stale/broken with Attempt=0, ACK absent |
| Upstream notifications | Silence could be blamed only on transports | Proven repeated natural scheduler/runtime failure through 10:30 plus missed on-time 07:30 Morning Brief |
| Task state | Repeated manual recoveries were easy to mistake for repair | Current tasks are ON, but acceptance remains 0/6 and root cause remains open; no false stability claim |
| Delivery truth | Risk of treating scenario execution/config as success | Provider-ACK gate preserved; no false SENT state introduced |
| Production safety | Temptation to add second LINE sender, deploy stale Apps Script, or add a watchdog | Unsafe actions explicitly avoided; single-consumer and no-competing-runner boundaries preserved |
| Auditability | Findings existed across chat/tool output and scattered SOT rows | Durable repo remediation record + Draft PR added, cross-referencing current Machine-SOT evidence |

## Open blockers / required next controlled actions
- **Make credits:** account owner must restore available Make credits/plan capacity. Immediately afterward, run scenario 6176241 once and require exact execution + Ledger/provider readback before Telegram is declared restored.
- **LINE live source/trigger:** recover the exact production Apps Script 9_5_9 source or inspect its bound project/trigger directly; locate `runKKLineMonitor`, verify the time-driven trigger exists/enabled, inspect execution failures and LINE credential/endpoint state, then re-run the existing row 41 or a new deterministic owner-only UAT without creating a competing sender.
- **Scheduler/control plane:** preserve the same canonical Scanner/Verifier IDs and no-watchdog policy. A true repair requires evidence explaining/stopping the recurring OFF/no-runtime behavior, followed by at least 6 consecutive natural cycles per role with valid Machine-SOT runtime proof and task state still ON afterward. Manual re-enable does not count.
- **Notification producer acceptance:** after scheduler stability, require natural Verifier materialization of eligible dual-channel Ledger rows and a valid 07:30 Morning Brief. Missed historical boundaries must remain historical misses; late recovery must be labeled honestly.
- **Architecture follow-up:** the 15-minute Make polling transport consumes credits even when the Telegram queue is empty. After current service is restored, redesign this lane toward an event-driven or quota-bounded transport under the same Ledger/provider-ACK contract; do not weaken notification truth semantics merely to save credits.

## Current verdict
`SAFE_DEGRADED / NOTIFICATION E2E NOT RESTORED`

- Telegram: transport implementation and credential path are proven historically, but current execution is blocked by Make organization credit/quota exhaustion.
- LINE: current owner-only UAT remains queued with zero attempts; exact live Apps Script runtime/trigger is not accessible from the current connected surfaces and must be recovered before safe repair.
- Upstream: current scheduled Scanner/Verifier runtime remains unreliable, the 07:30 Morning Brief was missed, and natural acceptance is still 0/6 for both roles despite current same-ID tasks being enabled.
- No false PASS, retroactive runtime, duplicate sender, watchdog, provider success, or production Apps Script deployment is claimed.
