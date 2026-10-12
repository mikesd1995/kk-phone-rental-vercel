# Make owner transport v1 — migration, hardening and production acceptance
_As of 2026-10-12 (Asia/Bangkok). Source work and Make draft are NOT a production release._

## Business contract (non-negotiable)

- Make is an **owner-only notification / preview transport**. Canonical Backend + owner-authoritative Google Sheets control booking, availability, price, event visibility and financial state. Supabase outbox is a **delivery reservation ledger**, not a second business truth.
- The owner must approve X posts and bookings. A notification or `OWNER_APPROVAL_PREVIEW` is **not** approval. Telegram callbacks must be independently authenticated, version-bound and revalidated at the Backend; this PR intentionally does NOT implement automated owner approval.
- Zero deposit: confirmed booking is unpaid; collect full rental payment at physical `picked_up`; verify return and Drive upload before `completed` Actual. Future is booked value; no ghost deposit or advance payment.
- Preserve booked-day locks, owner-hidden tombstones, manually locked prices, and official event posters. No AI-created event poster, auto-price write, auto-X publish or customer-directed Telegram recipient.

## Live Make changes and safe rollback
Source of truth for all preceding changes: [Issue #696](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/696).

**2026-10-12** Make A (org `8618622`) & B (org `8709610`) Free plans, each 1000 unused credits at final inspection, auto purchasing OFF. All legacy 15 scenarios inactive; original webhook backlog admin 2, staging 1 remains isolated. Never activate to flush.

Previous safety patches:
- A Admin Bridge `6336390`: disable Google writer #6, queue 2.
- A CRM Sync `6274697`: disable 8 bulk Clear (#51–58) and 8 bulk Write (#3,6,9,12,15,18,21,24).
- A Gemini `5911509`: disable AI #20.
- A Telegram Control `5901592`: disable all 12 add/update/send modules.
- B Staging Gateway `5988323`: disable all 17 add/update/send/AI modules, queue 1.
- A Telegram Ledger `6176241`: change 900s->21600s while inactive; six-hour cadence is *not suitable for urgent alerts* and not the target production architecture.
- Permanent Make canvas notes created (#356413–#356420), with exact module IDs and rollback.

**New** Make A Scenario `6600107`: `KK_OWNER_EVENT_DRIVEN_GATEWAY_V1_STAGING_BLOCKED`, webhook trigger #1 -> 503 deny response #2, **INACTIVE**, queue 0. Fresh webhook does NOT inherit the 2+1 legacy requests. Neither the webhook URL nor bot credentials are in repository source. Until acceptance it sends no Telegram and writes no booking/Sheet records. Link: https://us2.make.com/2671496/scenarios/6600107

## Branch source now staged

- `server/admin-make-gate.js` old credit-exhausted reason corrected to `MAKE_LEGACY_QUEUE_AND_ACCEPTANCE_PENDING`. **BRIDGE_RUNTIME_ENABLED still false**; do not switch it on as a side effect of credit restoration.
- `server/make-owner-transport-contract.js`: versioned, HMAC-SHA256 owner-only event envelope. Exact notification ID/request ID/type/entity ID/revision/time/text hash; <=2min TTL, explicit deny for chat_id/recipient/booking_status/price_write/publish_x.
- `server/make-owner-transport-contract.js#prepareDispatch`: refuses sending unless a **durable atomic reservation** explicitly returned `RESERVED + receipt_id`. Duplicate, replay, uncertain delivery or missing owner config fail closed. Only server configuration supplies Telegram owner chat.
- `supabase/staging/kk-make-owner-notification-v1.sql`: non-business delivery outbox, RLS, service-role-only access, atomic `QUEUED->RESERVED` RPC with exact event/revision/hash; exact receipt `RESERVED->SENT` ACK RPC; no automatic retry from an ambiguous `RESERVED`. SQL is a **staging migration**, not applied merely because the file exists.
- `api/kk-make-owner-notify.js`: server-only Prepare/ACK API with correct Supabase project ref check, server signing secret, owner chat env and enable switch. Defaults to HTTP503, no provider sends. Requires existing `QUEUED` outbox row from a canonical producer. No source wiring/publisher in this PR.
- Tests for signature tampering, replay/expiry, forbidden business mutations, duplicate reservation, owner chat binding, disabled endpoint, invalid receipt and ACK conflicts.

## Required server-side environment (not committed)
```text
KK_MAKE_OWNER_TRANSPORT_ENABLED=false
KK_MAKE_OWNER_TRANSPORT_PROJECT_REF=<exact existing runtime-ledger project ref>
SUPABASE_URL=<matching https Supabase project URL>
SUPABASE_SECRET_KEY=<server-only service/secret key>
KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET=<dedicated >=32-character secret>
KK_OWNER_TELEGRAM_CHAT_ID=<trusted owner chat ID>
```
Do not reuse admin PIN/LINE token as signing secret. A Free-plan Make bot connection already exists; don't buy credits or set auto-purchase.

## Proposed event-driven runtime (NOT LIVE)

1. Canonical Verifier/Backend emits `OWNER_ALERT` or `OWNER_APPROVAL_PREVIEW` with exact immutable `notification_id`, `request_id`, `entity_id`, content_version hash, message and signed TTL. Outbox reservation row must be created from verified canonical data (no reader of Telegram/user-provided input may insert it).
2. Backend sends signed envelope to the **fresh** Make webhook (not 6336390 or 5988323).
3. Make POSTs `{stage:"prepare",envelope}` to `/api/kk-make-owner-notify`, stops on non-2xx; server HMAC-verifies, checks expiry and atomically claims exact outbox row. Only `send_allowed:true` gives owner chat/text/receipt.
4. Telegram sends only to returned trusted owner chat with the existing Telegram connection; never map raw webhook text/chat into Telegram directly.
5. Make POSTs `{stage:"ack",envelope,receipt_id,provider_message_id}` and verifies `status:SENT`. If send succeeds but ACK fails, outbox stays `RESERVED`; **do not auto-resend** until reconciled against the provider.
6. Owner decisions must use a separate authenticated callback: verify actor, exact approved content revision, current backend availability and booking guard under atomic lock; no X/booking writes from Make itself.

## E2E acceptance to permit activation

1. Independent SQL migration review: default RLS, service-role-only RPC grants, no business table mutation, approved existing project binding.
2. Backend: stage a canonical **non-customer** alert in the outbox; HMAC verification, expired/wrong version/wrong entity/bad key/cross-project all fail.
3. Make: attach HTTP Prepare -> Telegram Send -> HTTP ACK ONLY after response mapping established via safe staging sample and actual deployed endpoint. Do not activate while the draft still returns 503.
4. Confirm one new owner Telegram message, provider ID, `SENT` receipt, exact entity/version and credits before/after. Repeat same envelope: 0 additional sends, 0 booking/price/event writes.
5. Inject ack timeout and provider ambiguity; require `RESERVED` hold (not automatic duplicate), manual reconciliation and useful error alert.
6. Budget: <=1000 credits/month/account; no 15-minute polling; conservative monthly reserve; max two *active* scenarios/Free org; auto purchase OFF.
7. Production E2E and owner acceptance of every changed action; deployment should remain blocked until exact-head CI + staging + safety gate pass.

## Exact outstanding blockers / no false completion

- This patch does NOT deploy the SQL migration, bind a canonical notification producer, provision env vars or activate a Telegram sender; **0 end-to-end delivery receipts** are verified.
- Existing 2+1 legacy Make queued deliveries could not be safely selectively removed via available connector; all legacy side effects remain disabled and bridges quarantined.
- The CRM destination data was stale (72 vs 79 customers, 80 vs 97 bookings, ฿80,365 vs ฿94,655 forecast); previous bulk-clear/write sync stays disabled pending schema-reviewed incremental reconciliation.
- No merge, no paid service, no owner booking confirmation or X posting is performed by source changes alone.

## Rollback
Keep all legacy scenarios inactive; new Scenario 6600107 can remain disabled. Revert the feature branch without affecting Production and set `KK_MAKE_OWNER_TRANSPORT_ENABLED=false` to fail-close if ever deployed. Do not clear or recycle `RESERVED` receipts without verifying provider delivery. Never rollback by replaying old webhooks.
