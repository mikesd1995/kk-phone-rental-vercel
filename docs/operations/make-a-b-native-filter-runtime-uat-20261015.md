# 2026-10-15: Make A/B Native Filter Runtime UAT (safe, zero external sends)

## Scope and verdict

**PASS: 11/11 synthetic predicate evaluations executed within Make, with 0 Make credits / 0 operations reported for every UAT execution.** This is NOT live Telegram webhook / LINE / booking / CRM / owner-approval E2E and does not authorize Production activation.

The two temporary UAT scenarios use **StartSubscenario -> ReturnData only**. They have no Google Sheets, Telegram, HTTP, AI Agent, database or other external actions; all test inputs are synthetic. A native Make filter attached to ReturnData decides whether an ALLOW result is returned. A blocked case reports execution **success with no declared `decision` output**; that is expected and must not be misrepresented as an allowed event.

Both UAT scenarios are **DEACTIVATED** after testing and their state was independently checked via `scenario_get`.

## Make A UAT

Scenario: [#6635094](https://us2.make.com/2671496/scenarios/6635094) — `KK_P0_LEGACY_TELEGRAM_GUARD_UAT_ONDEMAND_20261015`. Make canvas note **358193**.

| Case | Expected / observed | Execution ID |
|---|---|---|
| Human message in authorized group | ALLOW / ALLOW | `006c39abf9bd4723acc97e721e6fe3c4` |
| Bot message in authorized group | REJECT / REJECT (no output) | `ab00d6d29bef4f048d0cdeca857fd8ac` |
| Human message from wrong group | REJECT / REJECT (no output) | `ed21073a98d342a588f6152159585ea5` |
| Human callback in authorized group | ALLOW / ALLOW | `33f3412900be4564b39093599ef418c6` |
| Bot callback in authorized group | REJECT / REJECT (no output) | `6d76cd97893f4ff5a4233e0545542ae4` |

Make `scenario_execution_list` readback: **5 executions, all success, each 0 credits / 0 operations**. The corresponding historical legacy A Telegram #5901592 is still INACTIVE; its webhook queue was not replayed or touched.

## Make B UAT

Scenario: [#6635075](https://us2.make.com/2739250/scenarios/6635075) — `KK_P0_STAGING_GUARD_UAT_ONDEMAND_20261015`. Make canvas note **358194**.

| Case | Expected / observed | Execution ID |
|---|---|---|
| Owner message in allowed group | ALLOW / ALLOW | `ee41661445db4f769d2d8bde227e7671` |
| Different human in group | REJECT / REJECT | `9125ebfc676143f0a7b2a4788b4c179a` |
| Bot-origin message in group | REJECT / REJECT | `fc34995569ef47d0bc11fcadf502c58b` |
| Owner message from wrong group | REJECT / REJECT | `14f3beb03cdd4026b7c50aa14c412897` |
| Owner callback in private chat | ALLOW / ALLOW | `6998b986e6be4c159deaa7a152e80a95` |
| Bot-origin callback in private chat | REJECT / REJECT | `d6237e20f71f477e9dfec10929faba00` |

Make `scenario_execution_list` readback: **6 executions, all success, each 0 credits / 0 operations**. Production and old Staging #5988323 remain unchanged and INACTIVE.

## Current live queues and limits after UAT

- A Admin Write Bridge **#6336390**: **2** queued requests, content unavailable through connected webhook inspection; do not assume stale or delete blindly.
- A legacy Telegram **#5901592**: **1** queued diagnostic bot echo from B. Exact pending Queue ID not verified.
- B staging Telegram **#5988323**: **1** queued diagnostic bot echo from A. Exact pending Queue ID not verified.
- B backup **#6032622**: **0** queued.
- A new owner event gateway **#6600107**: **0** queued; all Prepare/Send/ACK sinks disabled and fail-closed.

**Queue total: 4**. The Make OAuth/Scenario connector has no `queued-item list` or `selective dequeue/delete` action. An alternate `make:makeApiCall` module exists in Make's app catalog, but Make A **and** Make B returned **no existing Make API app connection** for it. Connecting credentials requires an authorization step; do not embed API tokens or invent connection IDs. For now preserve the records; no webhook replay or bulk clearing.

**Two unresolved placeholder warnings** from Make validator: B Staging omitted module #34; B historical backup omitted module #7. `scenario_module_get` returned `notFound` for these IDs even though validator warnings mention them. No removal was attempted because full blueprint and dependencies are not visible.

## No spend / safety status

Organization readback after runs: **Make A Free 999/1000 unused; Make B Free 999/1000 unused**, both have exactly one active original manual-only transport scenario; `autoPurchasingActivated=false` in both. UAT scenarios are switched off. No external message, booking confirmation, X posting, Google Sheets edit, Make legacy activation, Merge or Deploy performed in this UAT.

## Required next safety gates

1. Read pending Queue IDs/contents in Make UI with proper authorization, redact private data; classify 2 Admin requests and match 2 bot-echo logs with actual queue item IDs. No blanket deletion.
2. Selective disposition only for items reliably identified and approved. Read back queued counts after, preserve audit trail.
3. Review the **raw Make blueprint** to resolve missing modules #34 and #7; no destructive guessing.
4. Repair registered webhook ownership/routing so inactive legacy hooks stop accumulating cross-bot updates. Downstream filters do not prevent queue storage.
5. Signed outbox/TTL + idempotency/ACK, fresh Telegram webhook end-to-end and negative owner-callback tests, exact-head CI/Verifier, owner release acceptance.

Related: [queue runbook](make-a-b-webhook-quarantine-20261015.md), GitHub Issues [#696](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/696) and [#740](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/740). This branch remains isolated; do not Merge/Deploy until gates pass.
