# KK Phone Rental — Notification Remediation — 2026-09-16

## Scope
Current-production investigation and bounded remediation of owner notifications (Telegram + LINE), upstream notification materialization, Make quota behavior, and recurring Scanner/Verifier control-plane failure. No customer/public send, replacement production writer, watchdog, competing LINE sender, or stale Apps Script deployment was authorized or created.

## Current authoritative policy
- Exactly one active `POLICY_VERSION`: `v4.9.15 AUTONOMOUS CLOSURE & OWNER NOTIFICATION HARDENING`.
- Owner outbound is `_Notification_Ledger` only.
- Telegram authoritative consumer = Make scenario `6176241`.
- LINE authoritative consumer = existing Apps Script `runKKLineMonitor`; a second LINE sender is prohibited.
- `SENT` requires provider acceptance evidence/id and sent timestamp.
- Natural 07:30 Verifier must materialize exactly one LINE MORNING_BRIEF, including zero-change proof; a missed brief may only be recovered later as `LATE_RECOVERY`.

## Telegram / Make findings and repair
- Scenario `6176241` (`03_KK_OWNER_TELEGRAM_LEDGER_TRANSPORT`) still uses the intended 900-second polling trigger and healthy Google + Telegram connections.
- Prior owner-only UAT row `UAT|TRANSPORT|TG|20260914T1635` is `SENT`, Attempt=1, HTTP200, provider `message_id=234`. Make execution `f045eecc668241bc92fc4e3d15fd0d4b` ran filterRows → Telegram send → Ledger update successfully.
- Historical Sep 6 Make errors showed an older Google Sheets range defect containing `_Notification_Ledger!Aundefined:Zundefined`. Fresh current module config proves that undefined-range defect is no longer present: spreadsheet, sheet and row mappings are populated.
- A smaller schema drift remained: current `_Notification_Ledger` is exactly 23 columns `A:W`, while scenario modules 1, 3 and 4 still used `tableFirstRow=A1:Z1`.
- Bounded repair performed on the existing scenario only: modules 1, 3 and 4 changed `tableFirstRow` from `A1:Z1` to `A1:W1`. Filters, field mappings, Telegram chat, provider-ACK semantics, error-handler retry logic and 15-minute cadence were left unchanged. Make accepted the atomic patch; new scenario lastEdit is `2026-09-16T04:13:40.096Z`.
- Durable Machine-SOT readback is `_Reconciliation_Log` row 948: `CHANGELOG|NOTIFICATION|MAKE-LEDGER-SCHEMA-HARDENING|20260916T1116`.
- Live post-patch send acceptance cannot execute yet: Make organization `KK Phone Auto` is paused because included credits/operations are exhausted.
- Execution history proves scenario 6176241 continued succeeding approximately every 15 minutes through 15:01 ICT on Sep 15; the Make quota-exhaustion notice followed at about 15:02 ICT. Empty-queue polls consume 1 credit each, so the polling lane consumes capacity even when no Telegram message is sent.
- Active-state Make topology remains narrow: `6176241` polling transport + `5901592` Telegram webhook control. CRM/temp/scout scenarios are inactive. No unnecessary active temporary scenario was found to disable.

## LINE findings
- Owner-only UAT row `UAT|TRANSPORT|LINE|20260914T1636` remains `QUEUED`, Attempt=0, no last attempt and no provider ACK. This is consumer-side stale/broken evidence, not merely an empty producer queue.
- Repository `apps-script/Code.gs` does not contain `runKKLineMonitor` and is older than observed production Apps Script 9_5_9. Connected Drive surfaces do not expose an accessible live Apps Script project/source copy.
- No repository/Drive backup of the exact live 9_5_9 implementation was found. GitHub Issue #9 remains the recovery authority.
- Issue #9 was updated in this pass to record that live 9_5_9 recovery now blocks LINE transport repair as well as booking atomicity. Required LINE acceptance after recovery: identify exact `runKKLineMonitor`, bound project and trigger, inspect execution/provider state, then run one deterministic owner-only Ledger UAT and require provider ACK + exact Ledger `SENT` readback.
- No second LINE sender and no stale repo Apps Script deployment were created.

## Upstream producer / scheduler findings
- At the initial investigation read, `_Notification_Ledger` had no Sep 16 materialization and `_Run_Manifest` contained only a late 03:30 Verifier occurrence that actually began 04:28 and ended `FINISHED_PARTIAL` without eligible NEW/material notification staging.
- Durable Machine-SOT evidence today proves repeated control-plane failure: Scanner 04:00, 05:00, 08:00, 09:00, 10:00 and 11:00 lacked valid natural runtime; Verifier 07:30, 08:30, 09:30 and 10:30 lacked valid natural runtime; Canary missed 08:15; the 07:30 on-time Morning Brief was not materialized.
- The 11:00 Scanner recurrence was observed live during this remediation: registry showed the exact current Scanner task OFF with `updated_at=2026-09-16T11:00:50+07:00`; fresh `_Run_Lock`, `_Run_Manifest` and `_Scan_Status` reads showed no 11:00 runtime boundary and no current valid writer. The same Scanner ID was re-enabled at 11:19:37 ICT with prompt/cadence/ID unchanged. The missed 11:00 occurrence remains MISSED/NOT_PROVEN. Durable readback is `_Reconciliation_Log` row 949.
- Current registry after mitigation: Scanner ON, Verifier ON, Canary ON, Control Plane Guard OFF. Manual re-enable is eligibility restoration only; Scanner and Verifier acceptance remain `0/6` consecutive natural cycles.
- The root actor/mechanism remains `UNKNOWN`. Historical prompt compaction/hardening was already performed Sep 10–11 and recurrence continued afterward, so prompt length/stale embedded policy is not a newly supported root cause.
- Google Drive plugin permission currently allows all actions, which weakens the ordinary ask-before-write hypothesis. A separate Scheduled Task (`Merge PR 30 Gate`) has a fresh successful run today, showing account-level Scheduled Tasks are not globally down. Platform pause/additional-action classes remain hypotheses only because the task registry exposes no actor/pause-reason telemetry.
- GitHub Issue #14 was updated with today’s recurrence through 11:00, the narrowed hypotheses, and continued `0/6 + 0/6` acceptance requirement.

## Changes performed in this remediation pass
1. Fresh-read live policy, Notification Ledger, Run Manifest, Run Lock, Scan Status, Reconciliation evidence, Make topology/module config/execution history, task registry and connected-app permissions.
2. Proved Telegram’s current blocking condition is Make organization quota, not Telegram credential/mapping failure.
3. Reconciled historical `Aundefined:Zundefined` evidence against current config and confirmed that older defect is already removed.
4. Patched existing Make scenario 6176241 modules 1/3/4 from `A1:Z1` to exact canonical `A1:W1`; no topology/cadence/filter/provider mapping change.
5. Logged the Make schema hardening durably in Machine SOT row 948 and exact-read it back.
6. Detected a new 11:00 Scanner OFF/no-runtime recurrence, verified no current protected writer, re-enabled only the same canonical Scanner ID, and preserved 11:00 as a missed occurrence.
7. Logged the 11:00 control-plane incident durably in Machine SOT row 949 and exact-read it back.
8. Updated GitHub Issue #14 (scheduler recurrence) and Issue #9 (live Apps Script / LINE recovery) with current evidence and safety boundaries.
9. Kept Draft PR #40 as a documentation-only remediation record; production code and `main` remain unchanged by this branch.
10. Preserved provider-ACK truth: no Telegram/LINE row was marked `SENT` without provider evidence, and no historical missed runtime was backfilled as PASS.

## Before vs after
| Area | Before | After this pass |
|---|---|---|
| Telegram transport config | Historically proven but current range width drifted beyond Ledger schema | Existing scenario aligned exactly to `A:W`; filters/mappings/retry/provider-ACK logic preserved |
| Historical Make range defect | Sep 6 evidence included `Aundefined:Zundefined` | Current config proven fully populated; undefined-range defect is not present now |
| Make capacity diagnosis | Generic paused/no-send symptom | Quota exhaustion correlated to real execution cutoff; empty polls proven to consume credits |
| LINE ownership | Easy to misdiagnose as missing Make scenario | Single authoritative Apps Script consumer confirmed; current UAT remains consumer-stale |
| Scheduler recurrence | Evidence through 10:30 | New 11:00 Scanner recurrence captured, safely same-ID mitigated, and durably logged |
| Root-cause hypotheses | Broad | Prompt-hardening and ordinary Drive approval explanations weakened; global scheduler outage also weakened; root actor still UNKNOWN |
| Auditability | Evidence spread across tools/issues | Machine SOT rows 948–949 + GitHub Issues #9/#14 + Draft PR #40 record the current repair state |

## Open blockers / next controlled acceptance
- **Make capacity:** restore Make account execution capacity. Then run scenario 6176241 once and require a real execution plus provider ACK/Ledger readback. Until then the A:W patch is config-readback PASS, not runtime-provider PASS.
- **LINE live source/trigger:** recover exact production Apps Script 9_5_9 or inspect the bound project directly. Do not deploy repository 9_5_8 and do not add a second sender.
- **Scheduler/control plane:** same canonical Scanner/Verifier IDs only, Guard OFF. A true repair still requires the cause of repeated task OFF/no-runtime behavior to stop and at least 6 consecutive natural cycles per role with valid Machine-SOT runtime evidence and the task remaining ON afterward.
- **Notification producer acceptance:** after scheduler stability, prove natural dual-channel Ledger staging and the 07:30 Morning Brief contract. Historical misses remain misses; later recovery must be labeled honestly.
- **Make efficiency redesign:** 15-minute empty polling costs credits. Redesign toward event-driven or explicitly quota-bounded transport only as a controlled architecture change after current service is restored; do not silently reduce alert latency or weaken provider-ACK truth.

## Current verdict
`SAFE_DEGRADED / NOTIFICATION E2E NOT RESTORED`

- Telegram: scenario implementation is now schema-aligned and historically provider-proven, but current runtime is blocked by Make quota exhaustion.
- LINE: UAT remains queued/Attempt0; live 9_5_9 consumer source/trigger is inaccessible and must be recovered before safe repair.
- Upstream: recurring Scanner/Verifier control-plane persistence remains unreliable; 11:00 Scanner failed again and acceptance remains 0/6 for both roles.
- No false PASS, retroactive runtime, duplicate sender, watchdog, provider success, stale Apps Script deployment, or production code merge is claimed.
