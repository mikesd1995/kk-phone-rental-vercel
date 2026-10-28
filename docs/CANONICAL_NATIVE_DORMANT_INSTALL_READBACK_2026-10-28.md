# Canonical native v2 dormant installation — actual runtime readback, 2026-10-28

Status: DORMANT_NATIVE_SCHEMA_INSTALLED_VERIFIED. Scope is the installed empty native schema and preserved OFF controls, not canonical runtime or whole-project completion.

## Exact authority, source and target

The owner explicitly authorized the unchanged SQL on runtime zehlsagzrpromtfqqflt after correcting the plan and passing independent review. The earlier Primary/mxjnjujqjybqughsnqbz proposal was wrong for this runtime and was never applied. The later explicit actual-target approval was used; no approval was silently transferred.

- Supabase account: kk phone; project zehlsagzrpromtfqqflt / kk-phone-rental-runtime-ledger.
- Actual PostgreSQL: 17.6, installer postgres.
- Original source HEAD: 4ef58bf8ec62724311adbaf8c29e5c5dda537ed6; Production carries merged cdaa7a4c5513dfb338be1117bede19bbdc2f0b25.
- Original SQL: supabase/staging/kk-owner-ledger-canonical-v2.sql.
- Original SQL SHA-256: fe0ae5a98fb251b0a9b10670a91fc1bd4ce2f7b92ad514481c38f475e15ba64f.
- Reviewed one-statement safety bundle SHA-256: f9314754bc25bb47bebd89cdbd6ce609c5955e428cec867c7ce523f370ad600d.
- Actual provider migration version: 20261027172601.
- Actual migration name: kk_owner_canonical_v2_dormant_20261028.
- Native migration history readback: statement_units=1; stored statement SHA-256 equals the reviewed bundle exactly.
- One Production apply_migration call succeeded. No DDL was applied to Primary/mxjn.

## Actual installation and independent review

Installation took place at approximately 2026-10-28 00:26 Asia/Bangkok (migration version uses UTC). Actual PG17 catalog readback at 2026-10-27T17:26:24.746826Z independently matched the complete approved-source manifest: six tables, 65 columns, 37 explicit PRIMARY/UNIQUE/FOREIGN/CHECK constraints, 17 indexes, two functions and one enabled BEFORE UPDATE ROW trigger. Constraints and indexes are valid.

All six tables have RLS, no allow policies and only owner explicit table ACLs. All 144 application-role table privilege checks (anon/authenticated/service_role across eight privileges and six tables, including MAINTAIN) deny access. The guard is SECURITY INVOKER with no app execution; the operation is SECURITY DEFINER with empty search_path and only service_role app EXECUTE. Both function-body LF-normalized MD5 values match frozen source:

- cutover guard: f1791396a97ab47f88bd78d02348d678
- operation: 0114c8836b97258887349270d73bd6e2

All six new tables contain zero rows. Enabled cutover count is zero. No canonical operational RPC, cutover/seed/test-fixture or business-data write, GAS execution or provider send occurred.

Pre-existing platform superuser/global reader/writer/maintenance capabilities are classified separately; this migration neither adds nor claims to remove them. Exact role/membership metadata is unchanged.

The old 16 migration history entries are unchanged. Narrow legacy table/function/schema/ACL/trigger/policy/default-ACL fingerprints match before and after. This proves metadata equality, not a scan of legacy business rows.

## Preserved runtime controls

Fresh live Machine SOT has one compatible active GLOBAL v4.9.44. Runtime source, current plain Production PROJECT_REF and active Edge project all identify zehlsagzrpromtfqqflt. No policy was changed.

Production remains dpl_77gsEsu32smJxWweeFkRDW9BbQPy READY at cdaa7a4c5513dfb338be1117bede19bbdc2f0b25. No deployment was made. Transport and producer flags remain false; canonical enable is absent/default false.

Independent final Make A 6176241 readback: inactive/on-demand, incomplete0, original modules5/6/8/9/10/11/12/13 preserved, provider8/11/12/13 disabled, connection metadata healthy/unchanged, lastEdit2026-10-27T15:22:39.079Z unchanged. No Make graph/schedule/run/activation occurred.

Existing native control rows4, enabled0 before and after. Point-in-time native metadata showed no other active client or idle-in-transaction backend and no legacy write-mode lock; this does not promise absence of future sessions.

Public boundary checks at 2026-10-27T17:27:19.128Z: storefront200; ownerGET405/sendfalse; operational prepare503/sendfalse; unsigned marked readiness401/sendfalse. These are containment checks, not positive provider readiness.

Security advisors show only INFO RLS-enabled/no-policy findings: 11 existing plus six intentionally private new tables. No allow policy was added to suppress this expected notice.

## Review fixes and verification limits

Before Production DDL, independent review caught missing in-transaction dependency assertions and PG18-versus-PG17 NOT NULL catalog representation. Both wrapper defects were corrected without changing original SQL or weakening source guards. Local tests cover success, forced late failure rollback, version rejection, unexpected default grants, custom global-reader inheritance rejection and known platform capability classification. They remain synthetic PG18 evidence; actual PG17 catalog and stored migration digest above provide installation readback, not behavioral/concurrency proof.

Full approved-head source/CI evidence was reused because source did not change. No unchanged broad regression was rerun as a substitute for native readback.

## Next gates, no activation implied

The missing native schema blocker is removed. Remaining runtime work must separately establish deployed Edge and private GAS executable parity, actual owner OAuth/API execution, trusted adapter/canonical binding and governed cutover. Preserve all OFF controls while preparing these checks. Positive Telegram/LINE provider receipts, durable exact ACKs, Sheet projections, real PG17 locking/retry behavior and natural Scanner/Verifier execution are not established by this installation.

Never reinstall the successful non-idempotent SQL, seed cutover rows, replay old fixtures/queues, restore Scanner/Verifier or introduce an alternate sender from this installation approval. Do not repeat owner OAuth/consumer-key setup that already has attestation. Support case17503357 was not read or resent by this scope.

## Evidence

Current packet: outputs/kk-native-off-install-20261027 (folder name retained from preparation date; this successful installation is 28 October Asia/Bangkok).

Key files: OWNER_AUTHORIZATION_RUNTIME.json, CORRECTED_OFF_INSTALL_PLAN.md, INDEPENDENT_INSTALL_REVIEW.json, PREWRITE_GATE.json, MIGRATION_APPLY_RESULT.json, MIGRATION_HISTORY_AFTER.json, MIGRATION_STATEMENT_DIGEST.json, POST_INSTALL_CATALOG.json, INDEPENDENT_POST_INSTALL_REVIEW.json, LEGACY_BEFORE_AFTER_COMPARISON.json, ROLE_MEMBERSHIP_AFTER.json, FINAL_OFF_READBACK.json, FINAL_VERCEL_FLAGS.json, FINAL_PRODUCTION.json, PUBLIC_CONTROLS.json and final MANIFEST/SEAL.

Historical sealed packets remain unchanged. Earlier files stating Primary/mxjn was the runtime target or native schema was absent are superseded only for current target/installation state by this readback; their observed historical facts remain retained.

