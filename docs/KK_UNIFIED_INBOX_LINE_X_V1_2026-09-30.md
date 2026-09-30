# KK Unified Inbox — LINE + X v1

Date: 2026-09-30
Status: FOUNDATION / NO PRODUCTION SENDS
Branch: feat/unified-inbox-line-x-v1

## Scope
รวมบทสนทนา LINE และ X ไว้ใน KK Admin โดยยังไม่เพิ่ม Instagram/Facebook

## Safety invariants
- LINE/X identities are channel-scoped and MUST NOT auto-merge.
- Duplicate/redelivered inbound messages use deterministic internal IDs.
- AI may draft/summarize but MUST NOT send automatically in v1.
- Outbound draft is fail-closed: owner_review_required=true, send_authorized=false.
- Existing Booking/Event/Pricing write paths are untouched.
- Secrets never enter browser code or repository.
- Webhook payloads must be authenticated before normalization/persistence.

## LINE connector contract
Official LINE Messaging API supports inbound webhook events and reply/push messages.
Implementation gate:
1. KK_LINE_CHANNEL_SECRET and KK_LINE_CHANNEL_ACCESS_TOKEN exist only server-side.
2. Verify x-line-signature against the exact raw request body using HMAC-SHA256 before parsing/processing.
3. Persist webhookEventId/external message id for idempotency.
4. Return 2xx quickly; do non-trivial processing asynchronously where possible.
5. Redelivery must not create duplicate customer messages.
6. Reply token is short-lived/one-use; delayed operator replies should use an eligible push path rather than assume replyToken remains valid.

## X connector gate
Do not implement production DM ingest/send until the currently entitled X developer project is verified against the live X API product/access level. No browser automation fallback is allowed for customer messaging.
Required evidence before enabling:
- authenticated account/project
- DM read entitlement and endpoint
- DM send entitlement and endpoint
- rate limits/cost applicable to the account
- webhook/event delivery mechanism if available to that access tier
- successful staging read + owner-approved staging send

Until those are proven, X remains adapter-ready but disabled.

## Data model
Conversation:
- conversation_id
- channel: line|x
- external_user_id
- display_name
- status: new|open|waiting_customer|booked|closed
- linked_customer_id (manual/verified link only)
- linked_booking_id
- last_message_at

Message:
- message_id
- conversation_id
- direction: inbound|outbound
- external_message_id
- message_type
- text
- received_at/sent_at
- redelivery
- send_authorized
- authorized_by

Audit:
- actor
- action
- conversation_id
- message_id/draft_id
- timestamp
- provider request id/status
- error class

## Delivery phases
P0 (this branch): contract + regression tests + implementation record.
P1: LINE signed webhook ingress + persistence adapter, no outbound auto-send.
P2: Admin Inbox UI (filters/search/conversation timeline) + manual customer/booking link.
P3: owner-approved LINE send.
P4: X connector only after entitlement acceptance passes.
P5: AI summarize/draft + booking/price context, still owner-reviewed.

## Acceptance
- spoofed LINE webhook => rejected, zero writes
- duplicate/redelivery => one logical message
- LINE/X same-looking identity => never auto-merged
- AI draft => zero sends until owner action
- provider error => visible failure + audit evidence, no fake success
- existing Admin/Booking regression suite remains green

## Implementation log — 2026-09-30 P1 ingress core
- Added `server/kk-line-webhook.js`.
- Signature validation uses HMAC-SHA256 over the exact raw request bytes and timing-safe comparison.
- Invalid/missing signature: HTTP 401 contract, zero persistence writes.
- JSON is parsed only after signature acceptance.
- LINE empty-events verification request: HTTP 200 contract.
- Message identity prefers `webhookEventId`; redelivery flag is retained.
- Missing persistence adapter with message events: HTTP 503 fail-closed, zero writes.
- Added `tests/kk-line-webhook.test.js` covering spoofing, raw-body mutation, verification request, redelivery normalization, and persistence outage.
- Added unified inbox modules to `npm run check` syntax gate.
- No provider secret/token, production webhook route, production persistence, or outbound send was enabled.

### Current external blocker
A production LINE endpoint still requires server-side environment configuration and an approved persistence target. Do not put channel secret/access token in Git or browser code.


## Implementation log — 2026-09-30 P1.5 persistence/read model
- Added `server/kk-inbox-store.js` with an idempotent persistence boundary and in-memory reference adapter.
- Duplicate `message_id` returns `duplicate=true`, performs zero logical writes, and does not increment unread count.
- Conversation projection tracks channel-scoped external identity, latest message, unread count, status, and optional verified customer/booking links.
- Added `server/kk-inbox-read-model.js` for Admin-safe conversation list/search/channel/status filters and chronological thread reads.
- Added `tests/kk-inbox-store.test.js` for duplicate handling, unread invariants, channel/search filtering, and chronological threads.
- Added both modules to `npm run check`.
- Deliberately did NOT bind this layer to the existing Booking/Event/Pricing Google Sheet writer. The production persistence adapter remains a separate acceptance gate to avoid contaminating the current SOT/write-control path.
- No production message send or auto-merge behavior was enabled.

### Persistence decision gate
Before production ingress is enabled, choose/provision a durable inbox store with:
1. unique constraint on `message_id`;
2. atomic message insert + conversation projection update;
3. append-only audit evidence;
4. retention/back-up policy;
5. server-only credentials;
6. no dependency on public Google Sheet feeds.


## Implementation log — 2026-09-30 P2 Admin Inbox preview
- Added an `Inbox · LINE / X` navigation entry and dedicated `tab-inbox` workspace to the existing KK Admin shell.
- Added channel/status/search controls, conversation list area, thread area, safety notice, and responsive mobile layout.
- Added `admin/inbox-preview.js` as an intentionally network-free preview controller.
- Reply textarea/button are disabled in markup; preview declares `productionWrites=0`, `outboundEnabled=false`, and `autoMerge=false`.
- Added `tests/kk-admin-inbox-preview.test.js` to guard presence of the Inbox UI, disabled send controls, fail-closed flags, and absence of `fetch()` in the preview controller.
- Added preview controller to the repository syntax gate.
- Existing Booking/Event/Pricing forms and write handlers were not modified.

### P2 acceptance state
UI shell: implemented.
Live conversation data: blocked pending durable persistence adapter.
Outbound LINE/X: blocked pending explicit provider/send acceptance.
Production deployment: not authorized by this implementation record.


## Implementation log — 2026-09-30 P2.5 durable persistence candidate
Audit found the existing production route `/api/line-webhook` already rewrites to `api/kk-data.js` and delegates to `server/line-booking-webhook.js`, which performs the existing booking Flex auto-reply. Unified Inbox MUST NOT replace this route blindly.

Storage discovery:
- Repository has no durable database dependency.
- No connected Supabase project was available during this implementation pass.
- Therefore no database/project/environment variable was provisioned and production writes remain disabled.

Prepared fallback safely:
- Added `server/kk-inbox-postgrest-store.js`, a server-only PostgREST adapter that calls one transactional RPC.
- Added `supabase/kk_inbox_v1.sql` defining private message/conversation/audit tables, unique idempotency constraints, RLS, revoked browser roles, and a service-role-only SECURITY INVOKER RPC.
- Added adapter tests for RPC-only writes and fail-closed missing credentials.
- Added adapter to syntax gate.
- Credentials are intentionally named `KK_INBOX_SUPABASE_URL` and `KK_INBOX_SUPABASE_SERVICE_ROLE_KEY`; neither exists in browser code or repository.

Next acceptance gate:
1. provision/identify a dedicated durable Postgres/Supabase project;
2. review/apply schema and run DB security advisors;
3. run duplicate/concurrency acceptance against the real DB;
4. only then tee the already-verified LINE webhook into Inbox persistence while preserving the existing booking Flex behavior;
5. keep outbound Inbox sends disabled.


## Implementation log — 2026-09-30 P2.6 production-safe LINE tee preparation
Goal: remove the ChatGPT Supabase connector as a runtime dependency and prepare the existing verified LINE webhook for durable Inbox persistence without regressing Booking Flex.

Changes:
- Added `server/kk-line-inbox-tee.js` as a verified-event persistence boundary. It does not verify or parse the raw webhook itself; it is designed to run only after the existing LINE signature gate has accepted the request.
- Tee behavior is isolated per event: unsupported/malformed events are skipped; persistence errors are recorded per event; later valid events continue.
- Missing durable store returns `DISABLED_NO_STORE` with zero writes. This keeps Inbox fail-closed without changing the existing Booking response path.
- Duplicate receipts remain zero logical writes and are counted separately.
- Added `tests/kk-line-inbox-tee.test.js` covering disabled store, duplicate receipts, malformed-event isolation, and persistence-error isolation.
- Added the tee module to the repository syntax gate.
- Hardened `supabase/kk_inbox_v1.sql` for the existing `SECURITY INVOKER` RPC by explicitly granting the server-only `service_role` usage on `kk_private`, required table privileges, and audit identity-sequence privileges. Browser roles remain revoked and RLS remains enabled.

Important non-change:
- The production `server/line-booking-webhook.js` has NOT been wired to the tee yet.
- No Supabase project/schema/environment variable was created or changed.
- No LINE outbound Inbox send was enabled.
- Existing Booking Flex behavior is therefore unchanged by this preparation.

Activation gate:
1. obtain a real dedicated Supabase/Postgres project and server credentials;
2. apply/review `supabase/kk_inbox_v1.sql` and run security advisors;
3. prove real-DB duplicate/idempotency acceptance;
4. instantiate `kk-inbox-postgrest-store` server-side;
5. call the verified-event tee from the existing LINE booking webhook only after signature verification, with Inbox persistence failure isolated from Booking Flex;
6. expose authenticated Admin read APIs; keep Inbox outbound disabled until separate send acceptance.

Runtime dependency decision:
The Supabase ChatGPT plugin is a management convenience only. KK Unified Inbox runtime must communicate with the database directly through server-side credentials and does not depend on the ChatGPT plugin being connected.


## Implementation log — 2026-09-30 P2.7 durable DB + verified LINE wiring
Supabase management access recovered successfully.

Durable infrastructure:
- Organization: `mikesd`.
- Existing unrelated `accounting for TH` project was intentionally not reused.
- Created dedicated `kk-unified-inbox` project in `ap-southeast-1` after Supabase reported project cost as 0/month for this organization.
- Applied migration `kk_unified_inbox_v1` successfully.
- Real database acceptance was executed inside a rollback transaction using `service_role`: the same inbound logical message was submitted twice; final evidence was message_count=1, unread_count=1, audit_count=1.
- Supabase performance advisor returned zero findings.
- Security advisor returned three INFO-level `rls_enabled_no_policy` findings for the private Inbox tables. This is intentional deny-by-default: browser roles are revoked, RLS is enabled, and no browser policy is intended.

LINE integration:
- Updated the existing `server/line-booking-webhook.js`; no replacement webhook/API function was introduced.
- Signature verification and JSON parsing remain the existing gate.
- Only verified parsed events are passed to `kk-line-inbox-tee`.
- Durable persistence is enabled only when both `KK_INBOX_SUPABASE_URL` and `KK_INBOX_SUPABASE_SERVICE_ROLE_KEY` exist server-side.
- Without both credentials, Inbox persistence remains disabled and makes no network request.
- Inbox persistence runs independently from Booking event processing; per-event persistence failures are isolated and summarized to server logs without exposing credential/provider payloads.
- Added `tests/line-booking-inbox-tee.test.js` to guard disabled-without-credentials and dedicated server credential usage.

Remaining activation blocker:
The connected Supabase management tool deliberately exposes publishable keys but not the project's service-role/secret key. Therefore the server secret cannot be safely copied into Vercel by this implementation session. Production Inbox writes remain disabled until `KK_INBOX_SUPABASE_URL` and `KK_INBOX_SUPABASE_SERVICE_ROLE_KEY` are configured in Vercel server environment. Do not place the secret in Git, browser code, chat, or a public variable.
