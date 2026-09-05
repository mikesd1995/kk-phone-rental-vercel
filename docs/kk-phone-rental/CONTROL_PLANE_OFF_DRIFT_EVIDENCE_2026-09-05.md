# KK Phone Rental — Scanner/Verifier Control-Plane OFF Drift Evidence

Evidence window: 2026-09-05 through 2026-09-06 Asia/Bangkok  
Purpose: preserve observed timing without attributing an unproven actor/root cause.

## Canonical tasks / policy boundary

- Scanner `6a992c91ba688191ad428cbdc2e8cf35`
- Verifier `6a992d4d0c248191914e6c73c4f17db4`
- Canary `6a992bbe16d081918553ca3eb7f81058`

Active Machine-SOT P0 policy `RUNNER_CONTROL_PLANE_SELF_MUTATION_PROHIBITED` forbids Scanner/Verifier self-disable, self-pause, self-reschedule, task create/delete and cross-runner task management.

## 2026-09-05 post-run observation

1. A live automation read showed Scanner=OFF, Verifier=OFF, Canary=ON.
2. Canonical Scanner/Verifier task IDs were restored; no replacement task/watchdog was created.
3. Machine-SOT evidence: `RECON|CONTROL_PLANE|OFF_DRIFT|20260905T2329`.
4. Verifier was enabled before scheduled run `GPTV494-20260905T233021`.
5. That run completed and released Verifier lease v217.
6. A subsequent automation read showed Verifier=OFF again while Scanner=ON and Canary=ON.
7. Machine-SOT evidence: `RECON|CONTROL_PLANE|VERIFIER_POSTRUN_OFF|20260905T2335`.
8. Canonical Verifier was restored again; no duplicate scheduler/watchdog was created.

## 2026-09-06 broad recurrence

At approximately 03:15 Asia/Bangkok a fresh continuation read found:

- Scanner `is_enabled=false`, metadata `updated_at=2026-09-06T00:03:12+07:00`.
- Verifier `is_enabled=false`, metadata `updated_at=2026-09-06T01:29:35+07:00`.
- Canary remained `is_enabled=true`.

Canonical Scanner and Verifier were restored only. Exact post-repair readback showed Scanner=ON, Verifier=ON, Canary=ON and `paused_count=0`.

Machine-SOT evidence:
`RECON|CONTROL_PLANE|OFF_DRIFT|20260906T0315`

Status:
`CURRENT_STATE_REPAIRED_ROOT_CAUSE_OPEN`

## 2026-09-06 03:30 Verifier post-run recurrence

The restored Verifier remained enabled long enough for the scheduled 03:30 boundary to execute a real v4.9.4 run:

- Run ID `GPTV494-20260906T033204`
- Manifest `MANIFEST|VERIFIER|20260906T033204`
- Verifier lease version `218`
- Fencing token `VF-494-20260906T033204-218`

The run performed only packet-state reconciliation: an already-adjudicated FAREWELL packet still exposed stale `READY_FOR_VERIFIER`; it was reconciled to `COMPLETED_HOLD` from prior evidence. No new business adjudication was fabricated.

Exact runtime evidence:

- VERIFIER_GLOBAL v218 released at `2026-09-06T03:34:10+07:00`.
- Manifest reached `FINISHED` at `2026-09-06T03:34:20+07:00`.
- Post-reconciliation operational packet count = 0.
- Recovery unresolved PREPARED/COMMITTING = 0.
- ChatGPT Result remained blank.
- No canonical lifecycle/monthly/ticket/pricing/Audit/Notification Ledger/provider/owner mutation occurred.

Immediately afterward a fresh automation read showed:

- Verifier `is_enabled=false`
- Verifier control-plane `updated_at=2026-09-06T03:35:06+07:00`
- Scanner remained enabled
- Canary remained enabled

This is a second strong observed post-run temporal correlation. It was persisted as:

`RECON|CONTROL_PLANE|VERIFIER_POSTRUN_OFF|20260906T0335`

The canonical Verifier task was restored at approximately 03:36 and subsequent exact task readback showed all three canonical tasks enabled.

## Interpretation boundary

What the evidence supports:

- repeated unexpected OFF state is real;
- at least two Verifier observations show a strong temporal correlation between a valid scheduled Verifier completion and a subsequent Verifier disable event;
- a broader overnight recurrence also affected Scanner and Verifier at different control-plane update times;
- Canary can remain enabled while Scanner/Verifier are disabled;
- restoring the existing canonical task allows scheduled runtime to resume.

What the evidence does **not** prove:

- which actor or subsystem issued the disable;
- that Verifier code itself disabled its task;
- that Scanner code disabled either task;
- that a human, Codex, Astra, Make or another agent issued the mutation;
- that a platform automatic-pause rule definitely caused the mutation.

Do not attribute root cause without control-plane audit evidence identifying the writer/action/reason.

## Platform auto-pause hypothesis — candidate only

OpenAI Scheduled Tasks help documentation states that scheduled tasks may pause when inactive, when additional user action is required, or when the associated chat is deleted, and that unattended tasks may automatically pause after a period of inactivity.

Reference:
`https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt`

That behavior is compatible with an external control-plane hypothesis, but the currently exposed task metadata does not identify which condition, if any, caused these KK events.

Therefore:

- treat platform auto-pause as a candidate cause only;
- do not change business/runtime truth to compensate;
- do not add a duplicate Scanner/Verifier/watchdog merely to mask the symptom;
- use control-plane/audit/support evidence if available to distinguish automatic pause from explicit mutation.

## Current repair state

At latest exact task readback after the 03:30 recurrence repair:

- Scanner = enabled
- Verifier = enabled
- Canary = enabled
- paused_count = 0

This is current-state repair, not proof that root cause is fixed.

## Remaining P0 review target

Investigate narrowly:

- whether Scheduled Tasks automatic-pause semantics apply to these canonical tasks;
- whether the task was classified inactive or requiring user action immediately after completion;
- whether associated task-chat state can invalidate or pause a recurring task;
- whether task history exposes mutation actor/reason beyond `updated_at`;
- whether task `updated_at` can be correlated with execution completion consistently;
- whether a platform/control-plane remediation exists without a competing scheduler/watchdog.

Preserve the canonical three task IDs.