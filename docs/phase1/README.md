# Phase 1 — local read-only operations pilot

This candidate builds on PR #181 at `41ff5f89ebea96de61343bb1a9db8010c70c0273` and includes the three exact gate/source/test documentation files from PR #184 at `cbcbffa451671eef46245e86c5651136fa23d414`. It is intended as a stacked draft against the Phase-0 integration branch. It does not merge either PR or activate production.

## Delivered behavior

- `platform/ops/reconcile.js` validates a minimized, explicitly scoped evidence snapshot, detects missing/stale/future evidence, verifies lineage records against the repository bridge contract, checks canonical/monthly consistency and Core/Web identity parity, and calls the existing promotion decision gate with the writer disabled.
- The adapter recognizes `v4.9.35` and `v4.9.36` only. The host must pin the expected version from a fresh authority read. Later versions fail with `POLICY_ADAPTER_UNSUPPORTED` until compatibility is reviewed. Policy input cannot grant execution authority.
- v4.9.36 adds score/top-pick/observed owner-decision eligibility and capacity checks. Snapshot capacity and owner decisions are observations, not independent approval or booking evidence. Packages, actual public API, notifications, rental lifecycle, writer acceptance and natural scheduled execution remain separately required.
- `platform/ops/local-pilot.js` reuses the existing local ControlPlane and SQLite adapter. It records task/run/audit/evidence/checkpoint, grants only local ledger capabilities, and never stages an outbox action. `SUCCEEDED` means the local diagnostic completed, not business success.
- Same occurrence plus identical snapshot/configuration returns the stored historical observation. Changed input under the same occurrence is rejected. A new observation requires a new occurrence and fresh evidence.
- Interrupted nonterminal work returns `RECOVERY_REQUIRED`. The pilot does not replay work automatically, steal a stale lock or claim distributed fencing. The existing Phase-0 recovery APIs remain unchanged.

## Run locally

Requires Node 24.13.1 (built-in experimental `node:sqlite`). Production's Node setting and dependencies are unchanged.

```text
node scripts/run-kk-ops-readonly.js --input <snapshot.json> --state-dir <new-empty-local-directory> --occurrence <unique-id> --policy v4.9.36 --output <new-report.json> --initialize local-only
```

Repeat without `--initialize`, using the same occurrence/input and a new output path, to obtain the historical result. Initialization only accepts an empty directory. The marker, DB and ancestors cannot be symbolic links. All report writes use exclusive creation, preserving prior artifacts. The trusted CLI host owns this local state; do not expose it as an agent-accessible SQL service.

The local kill-switch observation expires after one hour and the local capability certificate after one day. Neither is silently refreshed. A stale authority stops work. Preserve the old directory as audit evidence; new, explicitly initialized local sessions have separate history. A crash may leave `worker.lock`; a human host must inspect process state and the ledger before any recovery. There is deliberately no automatic unlock operation.

## Snapshot contract

See `tests/platform/ops-fixtures.js` for a **synthetic** schema example. The envelope requires `schema_version: kk-ops-snapshot-v1`, strict UTC `observed_at`, policy version plus exactly one active version, selected family scope, and named surfaces: canonical, monthly, lineage, core, web_ready.

Every supplied surface has `status: COMPLETE | PARTIAL | UNAVAILABLE`, UTC observation time, source reference and bounded rows. Missing means unavailable. UNAVAILABLE may not contain rows. COMPLETE means the collector attests coverage for that selected scope; it does not independently prove a whole-system scan. The current connector capture uses PARTIAL because bounded row slices do not prove completeness. Never manufacture monthly Show IDs from display-name similarity or expand a multi-day aggregate into invented canonical days.

Inputs are closed schemas, at most 64 KiB and 128 rows per surface. Reuse the Phase-0 secret/prototype/accessor guard. Event-day comparisons use the Bangkok calendar day and strict Gregorian ISO dates. Missing conflict or capacity facts remain unresolved. RAW/HOLD/VERIFIED_HOLD do not become actionable by displaying them.

Report status is UNKNOWN, NO_OBSERVATIONS, ATTENTION_REQUIRED or CONSISTENT_OBSERVATION. Every report has `execution_authorized=false`, `full_system_verified=false`, `production_writes=0`, `model_calls=0`. Core/Web parity only compares observed event ID, name and date plus visible disposition. It is not provider, booking, pricing or complete publication acceptance.

## Preserved boundaries and remaining work

All Project Pack flags stay OFF. There is no scheduler, network collector, AI model invocation, provider activation, credential broker, external executor or operating-system sandbox in this pilot. Its fixed local authority permits persistent diagnostic records only. The production import-isolation barrier remains active. Existing Scanner/Verifier, Machine SOT, Apps Script, Make, Core, booking, pricing, notifications and runtime environment settings are untouched.

An operational AI assistant still requires a separately reviewed host identity and secret broker, allowlisted read-only collector, model/provider adapter, actual sandbox, bounded scheduling under the existing single-runner policy, and natural-run acceptance. An improvement pipeline still needs a real independent evaluator, versioned benchmark, candidate review and governed promotion/rollback. This delivery supplies executable deterministic diagnostics and evidence persistence for that later integration; it does not claim autonomous learning.

## Validation and rollback

Run `npm run check`, `npm run check:platform`, `npm test`, `npm run test:platform`. The existing GitHub workflow also runs on PRs targeting the Phase-0 integration branch, with exact source-head checkout, Node 20 regression and Node 24 platform jobs. Windows checkout CRLF and symlink limitations must be reported separately from Linux CI; do not weaken tests to hide them.

Reject/close the draft or revert its reviewed commits to remove the pilot. No live service or database rollback is needed because this candidate does not activate one. Retain local state/audit files and evidence reports for review.
