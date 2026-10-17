# Make owner ACK: reject SQL NULL provider evidence — 15 October 2026

The sections through "JavaScript regression and remaining gates" below preserve the historical 15 October source-only candidate based on exact PR #697 head `46520953c9d3fcf439e3602c34e89a3521a9c9bc`. The 17 October current-main carrier is recorded separately at the end. Neither candidate applies staging SQL, activates Make, sends a notification, changes Machine SOT, or recovers canonical Scanner/Verifier execution.

## Defect and minimum change

The non-STRICT ACK RPC previously tested only `p_provider_message_id !~ '^[0-9]{1,20}$'`. SQL NULL makes that expression UNKNOWN, so PL/pgSQL skipped the rejection and allowed a live RESERVED row to become SENT with a NULL provider ID. The fix explicitly rejects `IS NULL` before the existing regex test. Receipt/notification identity, one-shot status, two-minute expiry, SECURITY INVOKER, empty search path, RLS and grants are unchanged.

## Actual PostgreSQL proof

The new executable fixture `tests/sql/make-owner-ack-provider-evidence.sql` runs the actual staged RPC as local `service_role`. It compares full stored target rows with `IS DISTINCT FROM` and checks all other rows for mutation. All fixtures are local and rolled back.

- RED before the candidate source edit: NULL returned `[{"status":"SENT","provider_message_id":null}]`; the stored row changed RESERVED → SENT and set delivered_at. Exactly that case failed the SQL assertion; the other nine cases passed. Rollback left zero fixture rows.
- GREEN after the edit: 10/10 cases passed in a clean isolated PostgreSQL database. Reapplying the actual staging SQL in that same database and rerunning the fixture passed another 10/10. Both rounds rolled back to zero rows.
- Matrix: NULL; empty/alphabetic/21-digit IDs; valid `123456`; same and different numeric ACK replays; expired receipt; wrong notification; wrong UUID receipt. Valid delivery changes only status/provider ID/delivery time. Replays preserve the original provider ID and time. The delivery-time assertion uses PostgreSQL's transaction-start `now()`, rather than an incorrect post-BEGIN wall-clock lower bound.
- Engine: external temporary `@electric-sql/pglite@0.5.10`, PostgreSQL WASM, Node `v24.13.1`. No repository dependency or package lock changed. Local roles only: anon, authenticated and BYPASSRLS service_role.

The retained external runner is `outputs/canonical-loop-followup-20261015/run-ack-sql-regression.cjs` relative to the parent project directory. Install its pinned package outside the repository, then run from the repository:

```powershell
npm install --prefix "$env:TEMP/kk-pg-ack-20261015" --no-save --package-lock=false --ignore-scripts @electric-sql/pglite@0.5.10
node ../../outputs/canonical-loop-followup-20261015/run-ack-sql-regression.cjs green
```

It loads the checked-in staging SQL, runs the checked-in SQL fixture, writes exact JSON RPC/before/after receipts, reapplies the source in the same database, and verifies rollback. To run against an ordinary disposable PostgreSQL instance, create the three roles above first, then use:

```powershell
psql -v ON_ERROR_STOP=1 -f supabase/staging/kk-make-owner-notification-v1.sql -f tests/sql/make-owner-ack-provider-evidence.sql
```

Use only an isolated test database. RED source and receipts are retained in the parent output packet as `ack-null-before-staging.sql`, `ack-null-red-sql-result.json` and `ack-null-green-sql-result.json`.

## JavaScript regression and remaining gates

The four zero-send transport test files passed **36/36**. Repository `code:test` unexpectedly selected the unrelated Hugging Face route because `semantics` contains its `semantic` keyword; those **55/55** passing checks are not full regression. A separate bare `npm test` ran once and reported **1464 passed / 23 failed / 1487 total**. The full branch is not green or accepted.

The full failures cover Admin symlink/Inbox and workflow assertions, content/gateway evidence, monthly query planning, old runtime ingress assertions and storefront contracts. One separately authorized baseline run temporarily restored only the two then-changed tracked files from exact #697, ran the same full suite, and restored both candidate files in `finally` with matching SHA256. It produced the identical 1487/1464/23 counts and exact failure names/locations. No new full-suite failure was introduced by that candidate, but the divergent branch remains red. Exact failures/output and machine comparison remain in `ack-null-full-suite.log`, `ack-null-baseline-full-suite.log` and `ack-null-baseline-comparison.json` in the parent output packet. This candidate does not repair or weaken those unrelated assertions. This baseline comparison does not replace independent review.

After baseline classification, the supplementary literal source-text assertion was removed: `tests/make-owner-outbox-sql-contract.test.js` is restored exactly to #697. The real SQL fixture remains the regression proof. Final scope is three files: staging SQL, executable SQL fixture and this dated document. No additional full-suite rerun was needed solely for removing that test-only assertion; the unchanged existing test had already executed in the baseline run. The guarded SQL and executable fixture bytes are unchanged from the actual GREEN proof.

No hosted CI, merge, deploy, live RPC, live migration, provider send or runtime E2E acceptance is claimed. The canonical pause cause, live transport authority/binding, canonical producer/Ledger join and natural run → Sheet → provider ACK/readback remain separate unresolved gates. A direct table-write CHECK constraint is outside this RPC-only fix and has not been installed.

## 17 October: isolated current-main staging specimen

The previous fix was carried onto a new local branch from exact current main `a54a348dd3258d87b1ec0c70e6ffd255d4678018`, without merging/cherry-picking the divergent #697 tree. Main did not contain any of these three paths. This carrier therefore **adds the entire unconnected staged schema specimen**, the executable SQL fixture and this document; it is not a two-line modification of an existing current-main runtime. It adds no API, producer, scheduler, workflow, runtime dependency or deployment hook. The SQL remains outside `supabase/migrations`.

Fresh native read-only Supabase evidence on 17 October identifies project `zehlsagzrpromtfqqflt`, outbox row count zero, thirteen columns and eight constraints. Exact normalized function-body comparison confirms both live claim/ACK bodies still equal the uncorrected foundation; the current live ACK still has the NULL gap. The existing functions are security invoker with empty search path and postgres/service-role execute ACL. This establishes compatibility for the local specimen only; no live function, row or migration was changed.

Fresh verification on this current-main carrier:

- Actual PostgreSQL RED using the unchanged uncorrected predecessor SQL and the checked-in fixture failed only `null-provider-id`, returned/persisted SENT with NULL provider evidence, and rolled back to zero rows.
- The actual carrier SQL passed 10/10, then same-database reapply passed another 10/10; both local rollback counts were zero. A separate independent reviewer run passed the same two ten-case rounds and preserved its own receipt.
- Repository-selected adjacent runtime-ledger checks passed **39/39**. These are regression checks, not a substitute for the explicit SQL fixture.
- The full current-main JavaScript suite passed **1717/1717**, zero failures, zero skipped. The old #697 branch's 23 inherited failures are historical and are not a blocker/result on this isolated carrier.
- Node `v24.13.1`, external temporary PGlite `0.5.10`, PostgreSQL `18.6` WASM; no repository dependency or lockfile change. This does not certify the live PostgreSQL 17 server or provider execution.
- The SQL was extracted as its exact Git blob with LF endings, SHA256 `24677e8ee68c3dd5183f7e57bad1daceb240925498fe31c26b1b559e939c9d54`. The prior Windows working-copy hash differed only in line endings. Fixture SHA256 remains `993d6ff9682550d9e344ba0a829783bed2b6fe036cf29120a8be0fd96e9b9824`. Today's executed-file hashes are retained in the new receipts.

All 17 October artifacts are under parent-project `outputs/make-dual-account-recovery-20261017`: `live-outbox-schema-readback.json`, `live-compatibility-comparison.json`, RED/GREEN SQL receipts, independent SQL receipt, `carrier-code-context.log`, targeted/full-suite logs and command exit summary. The copied external harness writes only to this new packet; no sealed 15 October receipt was overwritten.

The owner clarified two Make accounts. Fresh inventory confirms Make A has sixteen accessible scenarios and Make B four. Current policy still binds Telegram Ledger to Make A 6176241 and LINE Ledger to Apps Script; Make B's staged owner command/callback gateway is a separate role, currently inactive with one queued webhook. This source-only carrier neither resolves that transport/runtime authority gap nor authorizes opening/replaying either account's held scenarios.

Local regression is now green for this carrier. Hosted CI, release approval, migration/deployment/readback, canonical natural runtime, current provider ACK and project closure remain separate pending gates. The complete historical #697 branch remains held; this carrier does not certify or release it.

Fresh production alias readback at 17 October 03:13:30 UTC identifies READY deployment `dpl_5CNUZg2fyT7JGqvhegTQxG6wmcd6`, source `44de0066f0c7edd59e153b2d31c22d65b84de5af` on `fix/hero-theme-parity-20261016`. This differs from the carrier's current-main test base. The 1717/1717 result must not be attributed to that production source. Preserve the current hero/theme release; a later integration must reconcile the exact approved production tree before promotion, never deploy this main-based carrier as a replacement for the newer live UI.
