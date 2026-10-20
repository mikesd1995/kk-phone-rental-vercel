# Live owner-notification ACK NULL guard acceptance — 20 October 2026

## Outcome and scope

The existing runtime-ledger ACK function now rejects a NULL provider message identifier before reaching its UPDATE statement. This is an installed and read-back-verified database reliability correction, not notification delivery or natural Scanner/Verifier acceptance.

Owner requested completion of remaining fixes according to current evidence/policy and detailed cross-chat persistence. Current Machine SOT v4.9.44 active row148 includes Notification Ledger/reliability UAT; row462 requires independent candidate acceptance. Reconciliation1282 still prohibits canonical enable/manual business/send. No policy, task, transport or sender activation was performed.

## Exact production identity

- Account: kk phone; Supabase project `zehlsagzrpromtfqqflt`, `kk-phone-rental-runtime-ledger`, PostgreSQL17.6.
- Existing function: `public.kk_make_owner_notification_ack(text,uuid,text)`; OID17933 retained.
- Native migration version: **20261020130318**; name `kk_owner_notification_ack_null_guard_20261020`.
- Applied 20 October 2026 20:03:18 Asia/Bangkok.
- Reviewed/applied atomic SQL SHA256: `e9b1865b6dbd35f296b94dee1af475a5efa31cc3d1a447b20f3b44ed4b8dc88a`.
- Before body MD5: `8fef9726aabb7c8c629b900173897067`.
- After body MD5: `9a9190bc72adbdfa771d628d0b3216e8`.

The sole runtime definition change adds `p_provider_message_id is null or` to the existing rejection condition. The applied wrapper derives the exact existing definition under a DB transaction advisory fence and a SHARE ROW EXCLUSIVE table lock NOWAIT; it aborts on source/identity/ACL drift, a nonempty outbox, changed function attributes, changed claim function, or changed table ACL/RLS/constraints/policies. It does not replay the staging schema.

## Verification and limits

An independent reviewer verified the original failure on actual PostgreSQL17 in a READ ONLY transaction with service_role: NULL incorrectly reached UPDATE and raised SQLSTATE25006; malformed input returned zero rows. After the migration, eight invalid cases including NULL return zero before DML. One-digit and 20-digit numeric controls still reach the read-only DML barrier (25006), demonstrating that the pre-existing valid-ID path remains reachable. anon and authenticated calls remain denied (42501). No fixture or notification row was created and no provider was called.

The OID, owner, service-only ACL, empty search_path, invoker security and remaining independently captured catalog attributes remain unchanged. The atomic migration asserted all pg_proc fields except prosrc equal before/after, and claim/table constraints/policies/RLS/ACL unchanged. Outbox remains zero. Independent current catalog and migration history agree with root's readback. Security Advisor reports only ten INFO notices for intentionally private RLS tables without end-user policies; no WARN/ERROR. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Fresh local full regression on exact released source265203ce passed1978/1978 plus poster ACL29/29. SQL-specific actual PostgreSQL probes are separate from those JavaScript tests and from previous isolated local SQL fixtures.

## Unchanged production and remaining gates

PR766 remains merged, canonical production READY `dpl_EsEQNVEdb22uMQB9Lgz14qaZxnoa`, runtime source `265203ce12a4093a46607fe3a365684794a5b382`. Fresh19/19 static hashes match the accepted Header/Hero digest `2b970d7e749e61207bb664b52a565f6c819e8abcae46e418a76cbdf1433e5c00`; no web deployment occurred in this maintenance.

Scanner and Verifier remain PAUSED. The earlier same-ID Verifier results unarchive remains verified. Scanner's historical task-update input remains unavailable. The approved follow-up was sent in existing OpenAI case17503357 at19:52:01; native Gmail ID `1a1595e688915dde`, existing thread `1a149ab1c7d902e2`, independent dispatch verification14/14. No new reply at20:04:49; Gmail dispatch does not prove Support read/processing acknowledgement.

MakeA6176241/A6600107/B5988323 remain held/inactive. Active on-demand manual senders are not canonical ledger consumers. No producer/adapter/transport activation or provider/customer send occurred. Natural scan→verify→Sheet→notification→durable ACK remains NOT_VERIFIED, and the project remains open. Admin browser currently shows PIN login; authenticated Inbox HTTP acceptance remains separate and unverified.

## Evidence and recovery

Detailed fresh evidence is outside the checkout at `../../outputs/kk-scanner-support-continuation-20261020/`: exact atomic SQL, native migration receipt/history, before/after catalog and READ ONLY probes, authority snapshots, independent reviews, mail dispatch/readback, static production readback, full regression log and final checkpoint. Historical proposal/before files intentionally retain their pre-apply status; use the later native migration/post-readback/final checkpoint for current state.

All earlier sealed packets remain unchanged. Recovery must preserve receipts, held transports and ambiguous-delivery history. Any future compensating migration requires fresh exact state and review; never remove expiry/receipt/NULL/ACL safeguards, automatically replay old queues, reopen legacy senders, or use a replacement scheduler. No further task restore is authorized merely by this ACK correction.

