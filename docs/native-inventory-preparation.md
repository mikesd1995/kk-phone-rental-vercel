# Native inventory preparation — current-active lane, 13 November 2026

This is a source-only preparation contract. It does not install a migration, query a database, contact Support, arm a row, allocate an attempt, resume a project, change a runner or authorize runtime. Source tests do not establish containment, native queue contents, C1, provider delivery, a durable ACK or natural occurrence.

The owner requested P0 backend privacy and Supabase preparation while keeping senders OFF. The independently observed management status for runtime project `zehlsagzrpromtfqqflt` on the `kk phone` connection is now `ACTIVE_HEALTHY`; the 7 November `INACTIVE` observation is historical. No cause, transition time, actor, worker state, queue state or native fence state follows from that status. Do not confuse this project with the separate Primary project `mxjnjujqjybqughsnqbz`.

## Offline interface

Use the existing local checkout, with no runtime credentials required:

```text
node scripts/native-inventory-preflight.cjs --template
node scripts/native-inventory-preflight.cjs --input <local-preparation-packet.json>
node --test tests/native-inventory-preflight.test.js
```

No arguments is equivalent to `--template`. These are the only accepted CLI forms. There is no execute, probe, repair, reset, retry, arm, health, SQL, send or activation option. The module imports only Node's local filesystem. It never imports the active runtime-ledger/claim helper. Input filenames must be ordinary relative or local absolute drive paths: UNC/network paths, URI schemes, drive-relative names, device prefixes/reserved device names and alternate data streams are denied before filesystem access. Use a trusted local regular JSON file; this is not a symlink/junction isolation mechanism. Input is bounded to 64 KiB of UTF-8 JSON; output from validation contains fixed classifications and aggregate requirements only, never input values, rows, IDs, tokens, nonces, payloads, URLs or error bodies.

The template intentionally starts with UNKNOWN states and null counts. Write safe evidence **hash references** such as `sha256:<64 lowercase hex>` only after the corresponding bounded, authorized evidence has been captured elsewhere. A hash proves neither authenticity nor completeness. Raw nonce values, provider request metadata, credentials and customer rows do not belong in this packet. All fields and the category/disposition sets are exact; unknown, duplicate, missing or additional fields are rejected.

The checker applies a local maximum evidence age of 900 seconds, with no future timestamps and a project observation no later than the aggregate collection. This is a conservative preparation guard, **not a new Machine SOT business policy**. Library tests can supply a deterministic evaluation clock and a stricter age limit; CLI validation uses the current machine clock. The evaluator does not authenticate that clock or any submitted assertion. Every reference must still be matched to its actual provider observation, inspected interval, project and named source SHA by the independent reviewer. Source SHA is syntax checked, not fetched or proven deployed by this tool.

Even a complete synthetic packet returns `STRUCTURALLY_COMPLETE_REQUIRES_INDEPENDENT_EVIDENCE_REVIEW`, `evidenceAuthenticityVerified=false`, `containmentAccepted=false`, `workerState=UNKNOWN`, `c1Decision=NOT_ASSESSED_KEEP_OFF`, `executionAuthorized=false`, `runtimeGo=false` and all operation budgets zero. A zero exit code means structural preparation only. A blocked packet exits 2 with fixed blocker codes. Neither outcome authorizes a protected action.

## Required inventory and safe collection plan

Collection is **not executed in this task**. A future collector must first establish the exact authorized inspection method and its effect on runtime. Do not run SQL simply because a command is labelled read-only, or use an application GET as an accidental health/probe. Do not turn anything ON, restore/clone/resume or silently drain pending work to obtain inventory. If the only available route would violate the zero-operation boundary, retain UNKNOWN and prepare the exact bounded method for review. Support contact budget remains zero.

These 11 inherited C1 categories cover native, provider and external surfaces. Native catalog metadata alone cannot cover provider jobs or callers outside Postgres. The inspection needs a bounded interval, matching entry/exit evidence and a completeness attestation from the responsible reviewer. Store only aggregate counts, reviewed held/none classifications and references in the packet.

| Category | Required inspection scope; safe retained result |
| --- | --- |
| SCHEDULERS_CRON_STARTUP_PROCESSES | Database cron/startup/autostart and platform schedules; count and authority/hold evidence, without command strings. |
| BACKGROUND_OUTBOUND_EXTENSIONS | Installed/enabled extension capabilities and background outbound workers; reviewed count and hold/absence reference, without connection settings. |
| TRIGGERS_WEBHOOKS | Trigger and webhook registrations, including event/database hooks; count and hold/absence reference, without payload or target secrets. |
| QUEUES_OUTBOXES_RETRIES | All queue/outbox/retry mechanisms and pending, in-flight, lease, retry and recovery states; aggregate disposition, without message bodies or provider IDs. |
| NATIVE_ATTEMPTS_ARM_NONCE_FENCES | Existing attempt/control/nonce/ARM/fence surfaces, remaining authority and terminal/unknown outcomes; counts and safe disposition reference, never raw nonce values. |
| TRANSACTIONS_RECOVERY_REPLICATION | Active/prepared/recovery/replication mechanisms and their ability to continue work across the inspected interval; counts and authority/hold reference. |
| DATABASE_FUNCTIONS_PRIVILEGED_CODE | Callable privileged functions, ACL/default privileges, definer/invoker behavior and reachable write/claim paths; reviewed scope/count reference, without copying executable secret-bearing bodies. |
| EDGE_PROVIDER_PLATFORM_JOBS | Edge, provider/platform jobs, scheduled invocations and retries outside DB catalogs; provider control-plane evidence and bounded reviewed count. |
| EXTERNAL_CALLERS_WRITERS | All known callers, deployments, Make paths, old URLs, task runners and credential-bearing writer identities; reviewed enumeration plus proof of relevant OFF/hold, not merely ingress restrictions. |
| BUSINESS_DESTINATIONS_READERS | Reachable business destinations/readers and outbound authority; scoped permissions/fence references with no customer rows. Core private-reader acceptance remains a separate lane unless an actual dependency is evidenced. |
| COMPLETENESS_UNEXAMINED_CLASSES | Explicit reconciliation across native/provider/external sources; **zero unexamined classes**, with independent scope/completeness reference. A held item cannot substitute for an unexamined class. |

Every inventory class must be `EVIDENCED_NONE` with numeric zero counts, or `EVIDENCED_HELD` with a positive count and every item held. The final completeness category permits only evidenced zero unexamined classes. These are submitted assertions for review; the validator cannot discover omitted mechanisms or verify that a hold really fences every writer.

The separate disposition list must include **QUEUES, OUTBOXES, RETRIES, ATTEMPTS, NONCES, ARM and FENCES**, each with the same safe count/evidence contract. A complete catalog does not allow any UNKNOWN disposition to disappear. Existing pending notifications must be classified without replay; “zero in the bounded Sheet projection” would not prove zero native work. Evidence for consumed/expired/denied/uncertain claims must preserve the existing terminal fence and no-refund semantics. Never reset, rearm, reclaim, regenerate a nonce, mint a budget or clean up a queue for a green result.

Current source pointers are inspection leads, **not proof they are installed or exhaustive**: `supabase/staging/kk-owner-health-attempt-v1.sql` names `private.kk_owner_health_attempt_v1` and `public.kk_claim_owner_health_attempt_v1`; `server/make-owner-health-attempt.js` and `server/runtime-ledger-oidc-bridge.js` use the dedicated claim path. `server/runtime-ledger.js` reads/writes runtime expectations and is deliberately not used by this offline checker. Extend actual inventory from current provider evidence, never reinstall the staged schema or assume historical staging matches live.

## Containment, transition and next gate

The packet requires current-active native **and external** hold evidence, plus an explicit reference accounting for continuity from the historical INACTIVE observation to the current-active observation. Missing transition timing/actor cannot be filled by guessing. If continuity cannot be established, keep that blocker even if today's catalog appears empty. Observed external OFF flags do not prove global native quiescence, and an ingress/network restriction does not prove every background writer is held.

The next live stage remains separately governed: refresh live Machine SOT/highest compatible Active policy, current project/source/deployment bindings and exact authority; review a bounded collection method, secret-safe output, containment and entry/exit observability; independently decide whether evidence satisfies C1. Stage 2 and diagnostic budgets remain unopened. Any later source release, native inspection, install, credential change, ACL change, probe or activation requires its own applicable authorization and exact readback. Core private-reader/source preparation is not forced to wait on native C1 when no dependency is present.

No live changes in this lane means no production rollback is invoked. Source rollback is removal of these preparation-only files; it must not alter native fences, credentials, existing source writers or live OFF state.
