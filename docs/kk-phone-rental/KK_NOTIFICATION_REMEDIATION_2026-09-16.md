# KK Phone Rental — Notification Remediation — 2026-09-16

## Scope
Current-production investigation and bounded remediation of owner notifications (Telegram + LINE), upstream notification materialization, and durable operational evidence. No customer/public send and no replacement production writer were authorized or created.

## Current authoritative policy
- Exactly one active POLICY_VERSION was fresh-read from `_Policy_Registry`: `v4.9.15 AUTONOMOUS CLOSURE & OWNER NOTIFICATION HARDENING`.
- `OWNER_LEDGER_TRANSPORT_LIVE`: owner outbound is Ledger-only. Telegram = Make Ledger consumer; LINE = existing Apps Script Ledger consumer.
- `LINE_LEDGER_CONSUMER_RUNTIME`: existing authoritative LINE consumer is Apps Script `runKKLineMonitor`; do not introduce a second LINE sender.
- `PROVIDER_ACK_GATE_V499`: `SENT` requires provider acceptance evidence/id and sent timestamp; failures remain retryable, not falsely SENT.

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
- `_Notification_Ledger` has no row created on 2026-09-16 at the time of this investigation.
- `_Run_Manifest` has only one 2026-09-16 entry: Verifier scheduled 03:30 but actually started 04:28, finished `FINISHED_PARTIAL`, and explicitly reported no eligible NEW_EVENT/material-change Ledger staging due.
- No current 07:30 morning LINE brief row was present at the time of the fresh read.
- This means owner-channel silence is not only a transport problem: current-day upstream Scanner/Verifier/brief materialization is also not demonstrating the expected natural schedule coverage.

## Changes performed in this remediation pass
1. Fresh-read the live notification Ledger, active Policy Registry, Core v1 status, Run Manifest, and Reconciliation evidence instead of relying on historical chat state.
2. Verified Telegram Make scenario wiring and both live connection states.
3. Attempted to restore/run Telegram transport. Make confirmed the scenario itself is already active, but execution is blocked at organization/team level by exhausted quota/credits.
4. Did **not** mark any Telegram or LINE row SENT without provider ACK.
5. Did **not** create a second LINE sender because live policy requires a single authoritative Apps Script consumer.
6. Did **not** deploy repository `apps-script/Code.gs` because it lacks the current LINE runtime and is older than known production source.
7. Created this isolated operations branch/document so the investigation and decisions are durably recorded without modifying production code or `main` directly.

## Before vs after
| Area | Before | After this pass |
|---|---|---|
| Telegram root cause | Appeared as paused/no notifications | Proven account-level Make credit exhaustion; scenario config and provider connection separately verified |
| LINE root cause | No Make LINE scenario, unclear transport ownership | Correct ownership resolved: Apps Script `runKKLineMonitor`; current UAT proven stale/broken with Attempt=0, ACK absent |
| Upstream notifications | Silence could be blamed only on transports | Proven no 2026-09-16 Ledger materialization and only one late/partial Verifier manifest at read time |
| Delivery truth | Risk of treating scenario execution/config as success | Provider-ACK gate preserved; no false SENT state introduced |
| Production safety | Temptation to add second LINE sender or deploy stale Apps Script | Both unsafe actions explicitly avoided; single-writer/single-consumer policy preserved |
| Auditability | Findings existed across chat/tool output | Durable repo remediation record created on isolated branch |

## Open blockers / required next controlled actions
- **Make credits:** account owner must restore available Make credits/plan capacity. Immediately afterward, run scenario 6176241 once and require exact execution + Ledger/provider readback before Telegram is declared restored.
- **LINE live source/trigger:** recover the exact production Apps Script 9_5_9 source or inspect its bound project/trigger directly; locate `runKKLineMonitor`, verify the time-driven trigger exists/enabled, inspect execution failures and LINE credential/endpoint state, then re-run the existing row 41 or a new deterministic owner-only UAT without creating a competing sender.
- **Scheduler/producer:** verify current canonical Scanner/Verifier task registry and subsequent natural run boundaries; specifically require the 07:30 morning brief materialization contract and no silent missed slots before claiming notification E2E healthy.
- **Architecture follow-up:** the 15-minute Make polling transport consumes credits even when the Telegram queue is empty. After current service is restored, redesign this lane toward an event-driven or quota-bounded transport under the same Ledger/provider-ACK contract; do not weaken notification truth semantics merely to save credits.

## Current verdict
`SAFE_DEGRADED / NOTIFICATION E2E NOT RESTORED`

Telegram is blocked by exhausted Make Free-plan credits. LINE current consumer has a stale queued UAT and requires live Apps Script recovery/trigger inspection. Upstream current-day schedule/materialization evidence is also incomplete. No false PASS or provider success is claimed.
