# LINE Owner Decision — Durable Outbox Source Candidate (2026-11-12)

## Scope, predecessor, and release hold

Stacked on PR #852 (branch fix/p0-gas-webready-phone-only-preflight-20261108) to keep the single Apps Script writer and avoid conflicts with the phone-stock cutover. Source and isolated Staging deployment only. The owner authorized a release attempt; NO production merge/deploy, Booking/Sheets/Owner Lock or LINE provider mutation has occurred.

Touched: apps-script/Code.gs, server/line-booking-owner-approval.js, new server/line-owner-durable-outbox.js, dedicated synthetic tests and CI workflow. Existing LINE Inbox provider adapter kk-line-messaging-api.js is REUSED for real retry-key/receipt behavior. The owner-decision booking ledger is separate from Supabase operator Inbox outbound reservations because Booking is committed by the Google spreadsheet writer; their transaction boundaries are different.

## Correctness contract

Prior behavior: canonical approved/rejected booking was committed BEFORE an unrecorded LINE customer push; failures or restarts could leave the booking decided but notification lost.

New opt-in source:
1. Owner postback signature/identity verified. Authenticated read-only lineOwnerOutboxReadiness must verify the caller's exact dedicated dispatcher credential against GAS Script Properties and the private 11-column schema BEFORE mutating Booking. A server with a different (even correctly formatted) secret fails before approval.
2. Under the existing spreadsheet document lock, GAS writes and verifies an INTENT with booking ID + decision + immutable recipient + original governed request ID + message type BEFORE updating the booking status.
3. GAS commits confirmed/cancelled to 00_Master_Booking, checks exact ID/status/request/recipient readback, then marks the INTENT READY. A crash before READY is reconciled on the next matching owner decision, whether the Booking write has occurred or not; old bookings without an intent are never retroactively notified automatically.
4. Existing server versions see idempotent_replay=true on the GAS opted-in path, suppressing legacy unclaimed pushes. Opted-in server requires a one-time CLAIMED + persisted UUID LINE retry key under the same document lock and immutable recipient before provider send.
5. Reused provider adapter sends with X-Line-Retry-Key and requires real sentMessages[0].id. GAS then persists and reads back SENT + provider message ID. Only after this is the owner success reply attempted.
6. Provider rejection, timeout, missing provider receipt, failed finalization => UNCERTAIN or CLAIMED with mandatory manual review and NO blind automatic resend. Repeat webhooks never mint another retry key. Owner reply failure cannot retroactively authorize a second customer push.

This is a recoverable write-ahead state machine, NOT an atomic transaction across Sheets and LINE, exactly-once provider guarantee or proof a human read the message.

## Owner-private provisioning — NOT EXECUTED

Create a protected and non-public tab named exactly 19_Line_Decision_Outbox, A1:K1 columns exactly:

outbox_id | booking_id | decision | state | retry_key | provider_message_id | recipient | message_type | request_id | updated_at | created_at

Keep access restricted to the approved owner/GAS executor; it contains LINE user IDs. Do NOT expose via public API, Scanner, analytics, public Sheets, GitHub, or report exports. No runtime tab is auto-created by source. Missing/drifted header blocks a decision. At >20,000 rows new writes fail pending an approved archive/retention plan.

The new GAS property and server env are both KK_LINE_OWNER_OUTBOX_V1_ENABLED, with value true required. Additionally set a separate, non-admin KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET in protected GAS Script Properties and the server-only Vercel environment (32-128 characters, URL-safe letters/digits/hyphens/underscores). Never reuse the admin key, publish this secret, or place it in GitHub. Preflight, canonical decision, claim and settlement actions require BOTH the existing admin API key and this dedicated credential; absent or mismatched credentials fail BEFORE booking mutation. Owner-decision audit summaries omit customer contact and the dispatch key is redacted from generic GAS errors. Default missing/false preserves legacy source path. Do not enable these flags or deploy in this task. A half-rolled-out feature will suppress, not duplicate, notifications: coordinate both flags in an approved maintenance window with owner booking automation paused. On incident, pause KK_LINE_BOOKING_AUTOMATION_ENABLED first; do not revert to legacy sends on already-decided bookings. Legacy approved bookings without an intent require MANUAL delivery reconciliation.

## Mandatory release/operational gates

- Reconcile stacked PR with #852 without overwriting its formula preflight; audit #862/#865/#866 integration and deployed GAS drift #22.
- Exact-head native Node 20 CI of synthetic crash/claim/provider/settlement tests, full repository regression and Apps Script syntax, independent code+security review.
- Verify deployed GAS source SHA, private protected Sheet ACL/schema and Booking/Owner Lock snapshot. Prepare private rollback and an outbox incident/review UI with owner operational SLA.
- Stage real provider tests: first and replay approve/reject, blocked contact, provider accepts then timeout, lost settlement ack, app restart, concurrent owner click, recipient drift and capacity exhaustion. Ensure no Inbox duplicate and no PII in public logs.
- Obtain independent approval and explicit owner signoff, then authorized release with exact-SHA and production alias/readback. Do NOT close #861/#489 until provider and owner acceptance gates are evidenced.

## Cross-chat continuation

Working branch: feat/line-owner-durable-outbox-stacked-20261112, based on #852 head d478702760fb7fdb49b65e30bdc4ca11ee967552. Source remains behind release gates, NOT live. Read the latest PR HEAD and workflow run, not prior CI of other commits.

## 2026-11-12 owner-authorized staging and tightened security

Actual Vercel Staging deployment `dpl_2fNavVpvXPEMZrAPwatUwDuyRf34` returned READY, at earlier exact source SHA `d6e7f2de59cb2184a2de199c446c876c5e4d43d6`. Protected Staging build success does NOT establish live LINE/GAS E2E; it is no longer the latest source candidate after subsequent security work. Production remains independently verified at `dpl_2CyyhK7vyUm2cUMeiDzEgBdSBN2n`, main SHA `735bbf7c159df7f2fd6b93e5324df131727f91c9`. Subsequent source changes require a NEW exact-head CI pass and Staging build before any release.

Security remediation: the old readiness path only checked the *existence* and format of the GAS dispatch secret, not equality with the server secret. That allowed approving a canonical Booking even when the server would be denied the subsequent claim. The readiness API now requires the supplied private dispatch credential and compares it before any decision; canonical decide itself also requires it, preventing a generic Admin API key from approving the governed LINE path. Tests cover mismatched credentials, no decision mutation, no provider traffic, and exact secret redaction in Apps Script audit output.

Vercel production configuration inventory (key names only, no values decrypted) still lacks `KK_LINE_OWNER_OUTBOX_V1_ENABLED`, `KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET`, `KK_LINE_BOOKING_AUTOMATION_ENABLED`, and `KK_OWNER_LINE_USER_ID`. Owner-private GAS deployment identity, protected outbox tab, matching secret, provider test identities and independent reviewer are not evidenced. Leave flags OFF; an unreviewed production release would have an incomplete notification pipeline.
