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
