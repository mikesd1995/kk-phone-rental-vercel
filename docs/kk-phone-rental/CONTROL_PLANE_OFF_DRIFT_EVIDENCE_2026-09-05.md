# KK Phone Rental — Scanner/Verifier Control-Plane OFF Drift Evidence

Date: 2026-09-05 Asia/Bangkok  
Purpose: preserve observed timing without attributing an unproven actor/root cause.

## What is proven

Canonical task IDs:
- Scanner `6a992c91ba688191ad428cbdc2e8cf35`
- Verifier `6a992d4d0c248191914e6c73c4f17db4`
- Canary `6a992bbe16d081918553ca3eb7f81058`

Unexpected OFF drift has recurred across Scanner/Verifier history while Canary may remain enabled. Active Machine-SOT P0 policy prohibits Scanner/Verifier self-disable, self-pause, self-reschedule, task create/delete and cross-runner task management.

## Finalization observation

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

## Interpretation boundary

The evidence supports a **strong temporal correlation between Verifier run completion and a subsequent task-disable event** in this observed window.

It does **not** prove which actor, subsystem or mechanism performed the disable operation.

Do not attribute the root cause to Verifier code, the automation platform, another agent, Make, Codex, or any human without control-plane audit evidence that identifies the writer/action.

## Astra review target

Treat this as an unresolved P0 control-plane reliability defect. Review narrowly:
- whether the scheduled-task execution environment has any automatic disable/completion semantics;
- whether any agent/tool action issued after run completion can mutate `is_enabled`;
- whether task history/audit metadata exposes the mutation actor;
- whether prompt-level control can materially prevent a self-issued disable;
- whether a safe fix exists without creating a competing scheduler/watchdog.

Preserve the canonical three task IDs. Do not solve this by creating duplicate Scanner/Verifier/Canary schedules.
