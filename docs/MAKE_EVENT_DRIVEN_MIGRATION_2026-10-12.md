# Make owner transport v1 — migration, hardening and production acceptance
_As of 2026-10-12 (Asia/Bangkok). Source work and Make draft are NOT a production release._

## Business contract (non-negotiable)

- Make is an **owner-only notification / preview transport**. Canonical Backend + owner-authoritative Google Sheets control booking, availability, price, event visibility and financial state. Supabase outbox is a **delivery reservation ledger**, not a second business truth.
- The owner must approve X posts and bookings. A notification or `OWNER_APPROVAL_PREVIEW` is **not** approval. Telegram callbacks must be independently authenticated, version-bound and revalidated at the Backend; this PR intentionally does NOT implement automated owner approval.
- Zero deposit: confirmed booking is unpaid; collect full rental payment at physical `picked_up`; verify return and Drive upload before `completed` Actual. Future is booked value; no ghost deposit or advance payment.
- Preserve booked-day locks, owner-hidden tombstones, manually locked prices, and official event posters. No AI-created event poster, auto-price write, auto-X publish or customer-directed Telegram recipient.

## Live Make changes and safe rollback
Source of truth for all preceding changes: [Issue #696](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/696).

**2026-10-12** Make A (org `8618622`) & B (org `8709610`) Free plans, each 1000 unused credits at earlier inspected baseline, auto purchasing OFF. All legacy 15 scenarios inactive; original webhook backlog admin 2, staging 1 remains isolated. Never activate to flush.

Previous safety patches:
- A Admin Bridge `6336390`: disable Google writer #6, queue 2.
- A CRM Sync `6274697`: disable 8 bulk Clear (#51–58) and 8 bulk Write (#3,6,9,12,15,18,21,24).
- A Gemini `5911509`: disable AI #20.
- A Telegram Control `5901592`: disable all 12 add/update/send modules.
- B Staging Gateway `5988323`: disable all 17 add/update/send/AI modules, queue 1.
- A Telegram Ledger `6176241`: changed 900s scheduled polling -> 21600s fallback -> **on-demand** while inactive; verified `trigger.kind=on-demand`, no periodic credit drain even if activated. Manual use remains prohibited until dedupe/replay acceptance.
- Permanent Make canvas notes created (#356413–#356420), with exact module IDs and rollback.

**New** Make A Scenario `6600107`: `KK_OWNER_EVENT_DRIVEN_GATEWAY_V1_STAGING_BLOCKED`, webhook trigger #1 -> 503 deny response #2, **INACTIVE**, queue 0. Fresh webhook does NOT inherit the 2+1 legacy requests. Neither the webhook URL nor bot credentials are in repository source. There are now 16 total stored scenarios across A+B (15 old + 1 new draft), all intended to remain inactive. Until acceptance it sends no Telegram and writes no booking/Sheet records. Link: https://us2.make.com/2671496/scenarios/6600107

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

### Final Make change (additional verified readback)

- On **2026-10-12 09:11 UTC** legacy Telegram Ledger #6176241 scheduling changed to **on-demand**, no scheduled polling. `scenario_get` verified Inactive, `trigger.kind=on-demand`, `scheduling.type=on-demand`, no module issues. This supersedes the six-hour fallback shown in earlier Issue #696 comments. Extra canvas note #356423.
- New Make webhook Scenario #6600107 Inactive and queue 0 as inspected; anchored canvas note #356422. **No incoming sample or provider delivery.**
- Source files passed JavaScript syntax parsing on fetched exact branch contents; **this is not a node:test execution**, and GitHub PR exact-head workflow runs were not available at the initial check.

### Additional credit safety: legacy autonomous ticks removed (2026-10-12)

- Gemini Scout `5911509`: schedule `indefinitely/900s + windows` -> **on-demand**; AI extraction module #20 remains disabled. Readback `inactive`, `kind=on-demand`, lastEdit `2026-10-12T09:15:10.920Z`.
- Shadow Observer main-team `6224679`: schedule `indefinitely/900s` -> **on-demand**; Readback inactive, lastEdit `2026-10-12T09:15:19.216Z`.
- Shadow Observer private-space `6224686`: 900s -> **on-demand**, saved after transient Make API rate-limits, lastEdit `2026-10-12T09:16:50.664Z` (readback follow-up required).
- Along with legacy Telegram Transport `6176241`, **four** nonessential scheduled jobs are configured on-demand. This reduces potential automatic operations; all have remained inactive, so no saved historical credit usage is claimed.

## 2026-10-12 follow-up: Verified offline tests, SQL privilege hardening, runner issue

### Actions committed on PR #697 this turn
- **SQL privilege correction** `supabase/staging/kk-make-owner-notification-v1.sql`: both `kk_make_owner_notification_claim` and `kk_make_owner_notification_ack` changed from `SECURITY DEFINER` to **`SECURITY INVOKER`**, preserve `RLS`, only service-role EXECUTE, explicit `pg_catalog` functions. Commit `2f472a2239dc08a9b7cba699dd46aff476cafe85`. No SQL executed on any Supabase project. Runtime-ledger project `zehlsagzrpromtfqqflt` existing tables inspected read-only: no `kk_make_owner_notification_outbox` yet.
- **Safer reservation**: validate owner target **before** consuming durable claim; require UUID-shaped receipt, not just non-empty. Commit `6a68220673726a7c80b27affe0098ea26a92de0b` and regression tests `3dd1148ec39866563d8db9d8b0c114c001bdedc5`.
- **Malformed-envelope and shadow data hardening**: null/array/primitive envelopes fail with a structured error (no thrown parse exception); reject any unrecognized unsigned envelope key, including `owner_approved`, `reply_markup`, `chatId`, `booking_id`, `price`. Commits `51047fcf639e2213df8d96e3f584955fe5552742`, `59a73d37a598bfb91e8e3b887802b13d7cf7f7fe`. No provider send paths added.
- **Targeted CI workflow** `.github/workflows/make-owner-transport-contract.yml`: read-only syntax, HMAC, API, SQL privilege/static gate. Initial PR-triggered GitHub Actions run **#38237515721**, job **#114771738544**, completed **failure**; it yielded **zero job steps**, and the log fetch returned **BlobNotFound**. Thus this was not evidence of a failing unit assertion nor a CI pass. To avoid repeated GitHub runner consumption during this unresolved runner/log incident, changed to `workflow_dispatch` only (commit `629a8b873b2d761d8acab55f888dd54255ea6ecf`), timeout 4 minutes. **CI run remains unresolved**, and must be retried manually only when the runner service/Free quota is ready.

### Independent exact-source Node test evidence
Network git clone of repository failed in execution container due DNS resolution. Alternative used: retrieved source files via authenticated GitHub connector, reconstituted them locally, then verified **git blob SHA** against current PR file contents. No secret credentials were copied.
- `server/make-owner-transport-contract.js`: exact git blob SHA `d06ad2d8b9be6fa7dc88a5afddbc8c44d07203f0`
- `tests/make-owner-transport-contract.test.js`: `f1626b374d6f72c7aa0aa729d58768f65ed2235e`
- `server/runtime-ledger.js` from main: `db45b163465d6bdab47577cac7c8775d3e6428e9`
- `api/kk-make-owner-notify.js`: `6ecf5c1bbde0782085bd0546366b818d24425d9d`
- `tests/make-owner-notify-api.test.js`: `381bea00fa1abc983958889ae6f4727ae056655d`
- Command: `node --test tests/make-owner-transport-contract.test.js tests/make-owner-notify-api.test.js` from equivalent reconstructed tree, Node **v22.16.0**. **21 tests passed, 0 failed**, duration about **77.5 ms**. This verifies offline Contract + API behavior with **mocked Supabase RPC responses only**. It does **not** execute PostgreSQL migration, real webhook processing, Telegram delivery, full `npm test`, or exact-head GitHub Actions CI. Do not conflate these.

### Latest live readback (no production changes)
- New Make A `6600107`: **INACTIVE**, 2 modules only (custom webhook -> fixed HTTP503 deny), queue **0**.
- Old Make A Admin Bridge `6336390`: queued **2**, deliberately not replayed.
- Old Make B staging `5988323`: queued **1**, deliberately not replayed.
- Make A/B quotas: each **1000/1000 remaining**, **0 used**, **0 active**, auto purchasing **OFF**. No Telegram sends or extra charge.
- Existing `6176241` legacy Telegram transport remains `INACTIVE`, schedule **on-demand**, not a polling source.
- PR #697 remains **DRAFT**; none of this code is merged/deployed. Canonical event producer, signed Make -> Prepare -> Telegram -> ACK mapping, live receipt and authorized owner decision path are still required. DO NOT activate or merge solely because 21 offline tests pass.

### Next safe acceptance steps
1. Run the manual bounded CI workflow on PR head once GitHub runner is healthy; reconcile any failures.
2. Verify RLS and invoker-only SQL on an approved no-business-write staging database before migration; do not run against unrelated/Production by assumption.
3. Implement controlled canonical producer and immutable outbox insertion with exact event/version and no customer PII.
4. Complete Make send/ack wiring against a deployed **staging** endpoint; test one owner-only non-customer alert, provider receipt, replay rejection, ambiguity hold and Free credits. Keep 3 old webhook deliveries quarantined.
5. Implement separate owner-authenticated decision callbacks (X/Booking), including exact-version, booking-day/hidden-event/price locks and no-deposit payment state.
6. Require Production acceptance proof before merge/deploy/activation. Zero business writes until then.

