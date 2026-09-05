# KK Phone Rental — Scanner/Verifier Control-Plane OFF Drift Evidence

Evidence window: 2026-09-05 through 2026-09-06 Asia/Bangkok  
Purpose: preserve observed timing without attributing an unproven actor/root cause.

## What is proven

Canonical task IDs:
- Scanner `6a992c91ba688191ad428cbdc2e8cf35`
- Verifier `6a992d4d0c248191914e6c73c4f17db4`
- Canary `6a992bbe16d081918553ca3eb7f81058`

Unexpected OFF drift has recurred across Scanner/Verifier history while Canary may remain enabled. Active Machine-SOT P0 policy `RUNNER_CONTROL_PLANE_SELF_MUTATION_PROHIBITED` forbids Scanner/Verifier self-disable, self-pause, self-reschedule, task create/delete and cross-runner task management.

## 2026-09-05 finalization observation

1. A live automation read during finalization showed Scanner=OFF, Verifier=OFF, Canary=ON.
2. Scanner and Verifier canonical existing task IDs were restored; no replacement task/watchdog was created.
3. Reconciliation evidence was written as:
   `RECON|CONTROL_PLANE|OFF_DRIFT|20260905T2329`.
4. Verifier was confirmed enabled at approximately 23:29:57 Asia/Bangkok.
5. The scheduled Verifier run `GPTV494-20260905T233021` then executed under v4.9.4 and released its Verifier lease v217 at approximately 23:33.
6. A subsequent automation live read at approximately 23:34 showed Verifier=OFF again while Scanner=ON and Canary=ON.
7. This tighter correlation was recorded as:
   `RECON|CONTROL_PLANE|VERIFIER_POSTRUN_OFF|20260905T2335`.
8. The existing canonical Verifier task was restored again. No duplicate schedule/watchdog was created.

## 2026-09-06 recurrence

A fresh continuation read at approximately 03:15 Asia/Bangkok found another recurrence:

- Scanner `is_enabled=false`; automation metadata showed `updated_at=2026-09-06T00:03:12+07:00`.
- Verifier `is_enabled=false`; automation metadata showed `updated_at=2026-09-06T01:29:35+07:00`.
- Canary remained `is_enabled=true`.

The existing canonical Scanner and Verifier tasks were restored only; no new task, runner or watchdog was created.

Post-repair exact automation readback showed:

- Scanner = enabled
- Verifier = enabled
- Canary = enabled
- paused_count = 0

The recurrence was persisted in Machine SOT as:

`RECON|CONTROL_PLANE|OFF_DRIFT|20260906T0315`

with status `CURRENT_STATE_REPAIRED_ROOT_CAUSE_OPEN`.

## Interpretation boundary

The 2026-09-05 evidence supports a **strong temporal correlation between one Verifier run completion and a subsequent task-disable event** in that observed window.

The later 2026-09-06 recurrence shows the defect is broader than a single immediate post-run event: both canonical tasks were again found disabled at different control-plane update times while Canary remained enabled.

Therefore:

- retain the prior post-run correlation as valid historical evidence;
- do **not** narrow the root cause to Verifier completion alone;
- do **not** attribute the action to Verifier code, Scanner code, the automation platform, another agent, Make, Codex, Astra, or any human without control-plane audit evidence identifying the writer/action.

## Current repair state

At the latest exact readback in the 2026-09-06 continuation session, all three canonical tasks were enabled.

The repair is current-state recovery only. It does not prove the underlying root cause is fixed.

## Review target

Treat this as an unresolved P0 control-plane reliability defect. Investigate narrowly:

- whether the scheduled-task execution environment has automatic disable/completion semantics;
- whether any agent/tool action issued after or between runs can mutate `is_enabled`;
- whether task history/audit metadata exposes the mutation actor;
- whether task `updated_at` timestamps can be correlated with execution boundaries or external tool calls;
- whether prompt-level control can materially prevent a self-issued disable;
- whether a safe platform/control-plane fix exists without creating a competing scheduler/watchdog.

Preserve the canonical three task IDs. Do not solve this by creating duplicate Scanner/Verifier/Canary schedules.