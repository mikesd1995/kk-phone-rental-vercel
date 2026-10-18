# Runtime readiness and canonical cadence audit — 2026-10-16 ICT

Status: **SOURCE FIX STAGED; PRODUCTION COMPLETION HOLD**. Read-only observations were collected on 2026-10-15 at approximately 18:00–18:20 UTC (2026-10-16 01:00–01:20 Asia/Bangkok). Source baseline is draft #744 commit `edcc8146f86ac81a573529412e1f035b4e0eb4d8`; observed Production source is `a54a348dd3258d87b1ec0c70e6ffd255d4678018`.

No task, prompt, schedule, Make scenario, queue, database/schema, environment, permission, booking, stock, price or customer state was changed. No provider send, workflow dispatch, hosted build, merge, deployment or paid operation was requested. Local source tests are not natural runtime acceptance.

## Canonical tasks and Machine SOT — #14 / #47 / #50

| Role | Exact task ID | Enabled | Bangkok cadence | Last task-run metadata, UTC |
| --- | --- | --- | --- | --- |
| Scanner | `6ab272b36b1881919577ff3367fa8245` | false | 01:00, 09:00, 12:00, 15:00, 18:00, 21:00 | 2026-10-01 02:03:03.943773 |
| Verifier / Closure | `6ab7e060fa788191b5f17a7028494c3a` | false | 01:30, 07:30, 09:30, 12:30, 15:30, 18:30, 21:30 | 2026-09-28 14:26:29.472500 |

Both schedules end on 2026-12-31 and specify Asia/Bangkok. Scanner task state was last updated 2026-10-07 02:01:54.177160 UTC; Verifier 2026-10-07 00:35:46.848680 UTC. Both next-run fields are null. The returned registry contains 25 tasks, of which three ancillary tasks are enabled; they do not replace either canonical role. Current plan entitlement/capacity was not independently verified from account billing/product state.

Fresh bounded reads of the owner-controlled Event Tracker `1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo` established:

- `_Policy_Registry!A1:I2000`: exactly one active `POLICY_VERSION`, row 555, `v4.9.44 VERIFIER TASK IDENTITY REPLACEMENT`. Row 556 binds the exact IDs and sparse daily times above. Layered historical rules include the earlier v4.9.28 pause and later v4.9.29 resume; an old active rule must not override later policy semantics merely because a text search finds `OWNER_PAUSE=TRUE`.
- `_Run_Lock!D1:H2000`: 910 rows with nonblank status cells: 907 `RELEASED`, one `RELEASED_INVALID_SCHEMA`, two historical malformed status values, and zero literal `ACTIVE` statuses. This is a bounded status observation, not permission to bypass immutable identity/fencing or clear malformed rows. Exact row 1427 is a `POLICY_MAINTENANCE` / `CONTROL` lock, released at 2026-10-15 19:38:21 +07:00. Maintenance activity is not a natural Scanner/Verifier run.
- `_Write_Transaction!E1:F5000`: 171 records, 167 `COMMITTED`, three `RECOVERED`, one `COMPENSATED`, zero `PREPARED` / `COMMITTING` status cells.
- `_Run_Manifest!C1:F5700` plus `S1:T5700`: latest populated entries remain October 7. There are no October 15/16 creation timestamps in these bounds. A September 30 02:00 Verifier manifest at row 5210 remains `RUNNING` with no finish timestamp; other historical nonterminal/malformed rows also remain. Do not infer an active lease from stale manifest status or fabricate terminal runtime history.
- Searches of `_Scan_Status!A1:F2000` and `_Run_Coverage!A1:B6500` for `2026-10-15` returned zero matches. These are bounded representation results.

Current natural persistence acceptance remains unproven. Before any separately approved same-ID runtime action, re-resolve current policy, owner intent, exact task identity, task capacity, attributable maintenance writer and protected leases/transactions. Policy `CONTROL_PLANE_TASK_PERSISTENCE_ESCALATION_V444` prohibits looping task re-enable as a substitute for root-cause resolution after recurrence. No clone, replacement scheduler, watchdog, backfill or synthetic occurrence can earn acceptance.

## Proven offline auditor defect and source correction

`server/control-plane-persistence.js:evaluatePersistenceWindow()` previously generated six hourly slots regardless of the explicit canonical cadence. A zero-write reproduction using six valid current Scanner receipts and six valid current Verifier receipts gave `PERSISTENCE_WINDOW_GAP`, four invented missing hours per role, and zero credit. The test fixture's individual occurrences all passed. This is a deterministic offline denominator defect, separate from the unresolved service-side task-OFF cause.

The staged fix uses the existing `canonical_tasks[role].cadence` and `timezone` authority. It supports only explicit hourly rules already covered by the historical tests and daily `BYHOUR` rules matching the current Machine SOT shape. It derives the required preceding schedule slots, including Bangkok midnight and optional DTSTART/UNTIL boundaries. Missing, malformed, duplicate, unsupported or role-mismatched schedule fields fail closed; off-cadence natural receipts are rejected. A VEVENT with nonzero DTSTART seconds must explicitly override them with `BYSECOND=0`; unsupported inherited seconds cannot be silently treated as zero. Historical standalone hourly RRULE inputs retain their documented zero-second behavior. The auditor never infers an expected schedule from whichever receipts happen to exist.

Existing locks, immutable Manifest identity, exact Planner/coverage proof, task identity/ON readback, manual/backfill rejection and six-occurrence requirements remain mandatory. The auditor continues to report `production_writes=0`, `task_mutations=0`, `production_stable_authorized=false` and `hf_production_activation_authorized=false`. No runtime/task state is repaired by this source change.

Validation before implementation: existing selected tests **48/48 PASS**; after adding the first persistence cases, **13/20 PASS, 7 FAIL**, including the reproduced sparse-cadence failures. Independent source review then identified the inherited DTSTART-seconds edge: its added rejection case was RED (**21/22 PASS, 1 FAIL**) before the two-line guard, while the explicit override case passed. Final `node --test tests/control-plane-contract.test.js tests/control-plane-persistence.test.js tests/external-scanner-transition-gate.test.js` is **58/58 PASS**. Final full `npm test` exited 0: **1,885/1,885 PASS** across its two Node test reports (1,859 + 26), zero failed/cancelled/skipped/todo. These are local results for this isolated #744-based source tree, not GitHub-hosted exact-head CI. Parent integration review and required release readback remain gates; local tests do not establish Production acceptance.

## Make credit, quarantine and notification readiness — #696 / #740

| Account | Organization | Free operations used / allowance | Unused | Auto purchase | Next reset, UTC |
| --- | --- | --- | --- | --- | --- |
| A | 8618622 | 1 / 1,000 | 999 | false | 2026-11-10 07:55:43.067 |
| B | 8709610 | 1 / 1,000 | 999 | false | 2026-10-19 08:56:04.328 |

Both organizations are Free and not paused. Full bounded scenario lists returned 20 scenarios across A standard/private and B standard/private spaces: 18 inactive and two active **on-demand** owner-manual senders, A `6634223` and B `6634224`. No incomplete executions were reported in these lists. The two active manual senders do not prove recurring notification delivery or replace the quarantined gateways. No scenario was run during this audit.

Fresh trigger readback shows exactly four held deliveries:

| Scenario | Queued count |
| --- | ---: |
| A Admin bridge `6336390` | 2 |
| A legacy Telegram control `5901592` | 1 |
| B staging gateway `5988323` | 1 |
| A event-driven gateway `6600107` | 0 |
| B historical backup `6032622` | 0 |

Pending item identities/content were not read or guessed. Delivery-log IDs are not pending queue IDs. No replay, delete, bulk flush or activation is justified by these counts.

Structural readback confirms these inactive fences remain in place:

- Admin bridge `6336390`: legacy Google Sheets write module 6 disabled.
- Transport `6176241`: Telegram send 2 and Sheets outcome writers 3/4 disabled; on-demand.
- Event gateway `6600107`: Prepare 3, Telegram 4 and ACK 5 disabled.
- A legacy control `5901592`: all 12 surfaced legacy send/write modules disabled.
- B staging `5988323`: surfaced Telegram, AI and Sheets writer sinks disabled.
- B backup `6032622`: writer 6 and sender 10 disabled.
- CRM sync `6274697`: 16 clear/write modules disabled; on-demand.

Connection metadata was OK on inspected scenarios; that is not delivery proof. Error-history reads since October 14 for transport `6176241`, event gateway `6600107` and B staging `5988323` returned no failures; inactive/no-run histories cannot establish healthy delivery.

Read-only Supabase catalog/count checks correct stale issue text: historic runtime-ledger project `zehlsagzrpromtfqqflt` now has `public.kk_make_owner_notification_outbox`, RLS enabled, **zero rows**, and `kk_make_owner_notification_claim` / `ack` RPCs. Unified project `mxjnjujqjybqughsnqbz` has no Make outbox or corresponding RPCs. Both projects report `ACTIVE_HEALTHY`. Therefore the blocker is **unproven approved producer/outbox/project binding and signed delivery/ACK acceptance**, not a universal claim that the outbox is absent.

Still required: exact reviewed source and approved canonical project binding; RLS/auth/signature/TTL/idempotency negative tests; safe disposition of the held queues; owner-approved synthetic recipient UAT and one-receipt/exact-ACK proof; free capacity and explicit release approval. Preserve legacy writer retirement and current Production fences.

## Ultra Deep readiness — #368

Production GET `/api/kk-scanner-dispatch` returned HTTP 200 with `machine_ingress_version=KK_ULTRA_DEEP_MACHINE_V26`, `external_scanner_enabled=false`, `runtime_ledger_enabled=false`, `runtime_ledger_configured=false`, `ready_for_execution=false`, `scanner_execution_capable=false`, and `business_writes_capable=false`.

Do not repair this by changing a version label. `docs/ULTRA_DEEP_V27_UNIFIED_CONTROL_PLANE_MIGRATION_2026-10-03.md` explicitly describes V27 control-plane actions used by V26 ingress. Current `server/admin-write-control-oidc.js` pins unified project `mxjnjujqjybqughsnqbz`; that project has commands/shards relations and `kk_ultra_deep_command_claim` / `complete` RPCs. Its `kk-admin-write-control` Edge function is ACTIVE v2, reported source hash `094636dc5d81aa12fa364826a290642293ee76eda2033283b7136c0fc39f82b9`. Catalog existence/function metadata does not prove approved Production OIDC orchestration, genuine source receipts, recall, Verifier or FULL acceptance. No command was claimed or executed.

## Hosting, booking and final release gates — #692 / #9 / #49

Current alias `kk-phone-rental.vercel.app` resolves to READY Production `dpl_6BpGtGqNPG246ekTL3nHa73bRpCn`, source `main a54a348dd3258d87b1ec0c70e6ffd255d4678018`, created 2026-10-15 07:13:15.658 UTC. Full returned inventory is **82 objects = 73 Preview + 9 Production**. Earlier Production `dpl_7TYLb87ir9qNzXRtkeb49543dwVm` and historical rollback `dpl_B4NFKuic55jMVHfXUXcp6tD9Yigz` remain present. No audit action created a deployment.

Current Deployment/Functions Storage GB was not measured. Counts and READY state do not prove reclaimed GB or free build capacity. Preserve current Production and rollback; do not delete deployments, purchase capacity or trigger hosted acceptance to manufacture a pass.

Production environment **names/types only**, read with `decrypt=false`, still omit `KK_LINE_BOOKING_AUTOMATION_ENABLED` and `KK_OWNER_LINE_USER_ID`. `server/line-booking-owner-approval.js:automationReadiness()` therefore stays fail-closed. Presence of sensitive LINE/Apps Script configuration entries is not token-health, source-equivalence or recipient acceptance. #9 still requires exact bound Apps Script deployment/source/rollback authority, canonical-source readback and separately approved signed booking/owner-decision/notification E2E. The issue's historical live Apps Script version was not re-certified in this audit.

Final #49 remains open: current canonical natural persistence, stale Manifest reconciliation, governed runtime adoption of #50 contracts, Apps Script/booking concurrency/source equivalence, private read-model/security/ACL acceptance, signed notification delivery, genuine Ultra Deep FULL evidence, exact approved release-head CI and measured free capacity all require their own fresh evidence. Local source tests cannot close these gates or authorize merge/deploy.
