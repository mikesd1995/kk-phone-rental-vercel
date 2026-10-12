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


## 2026-10-12 continuation: canonical producer + opaque secret-key authentication

A new internal, **disabled-by-default** module was added: `server/make-owner-alert-producer.js`. The caller supplies an entity lookup key only. It requires an independently passed `canonicalReadbackFn` to return exact entity ID, source `KK_CANONICAL_VERIFIER_READBACK_V1`, `status=VERIFIED`, SHA256 revision, allowed event type, and text. Fake `verified=true` inputs or caller-supplied chat, Booking/status, publishing, or recipient are not accepted as a source of authority. Identifier = deterministic hash of type/entity/revision/content; durable `QUEUED` insert must be independently acknowledged **before** signed Make handoff. Duplicate insert, DB failure, wrong entity, unsigned/unknown changes, or unbound/disabled feature flags never start Make dispatch. Only `OWNER_ALERT` currently allowed; `OWNER_APPROVAL_PREVIEW` is deliberately blocked pending separate actor/immutable-version/PII governance.

Config requires all server-only: `KK_MAKE_OWNER_PRODUCER_ENABLED=true`, `KK_MAKE_OWNER_TRANSPORT_ENABLED=true`, exact `KK_MAKE_OWNER_TRANSPORT_PROJECT_REF` matching `SUPABASE_URL`, server key, dedicated signing secret, and vetted `KK_MAKE_OWNER_WEBHOOK_URL` (HTTPS Make webhook host). All flags remain OFF in Production and no webhook URL/secret is committed.

`insertOutbox` uses `Prefer:resolution=ignore-duplicates,return=representation` and exact insert readback, accepts either legacy service-role JWT or new `sb_secret_` server key. `api/kk-make-owner-notify.js` RPC authentication was corrected: new opaque `sb_secret_` keys are passed in **apikey only**; the legacy JWT keeps `Authorization:Bearer` for compatibility. Confirmed by current Supabase official migration docs.

`postToMake` is a bounded signed POST that accepts only the exact notification-id `SENT` claim from Make. Critically this returns `MAKE_ACK_CLAIMED_NOT_DB_VERIFIED`: it is **not evidence** that Telegram delivered nor that `provider_message_id` was durably read back; the parent module continues returning `PENDING_PROVIDER_ACK`. Without explicit durable readback evidence, nobody may claim `SENT`.

Added `tests/make-owner-alert-producer.test.js`: nine test cases for default-disabled, wrong project/webhook, forged/outdated readback, deterministic IDs, ordering (canonical -> outbox -> signed transport), duplicate DB rows, network ambiguity and correct opaque key handling. Added the test and syntax check to the existing **manual-only** GitHub workflow. Additional API test covers `sb_secret_` vs JWT header modes. Relevant commits: `63929bf`, `54b48bc`, `4a60b3a`, `a2e35a1`, `fd51cca`, `8325577`, `7bc576f`, `84e84f2`, `8cc1f33`. Source JS syntax checks were performed; the new producer test suite **has not been executed on a working GitHub runner**, so do not claim a passing CI after these commits. The previous 21/21 offline Contract+API tests apply to an earlier head, not the whole new PR.

**Current blocker and exact next route:** verified canonical `canonicalReadbackFn` runtime binding, approved Supabase outbox migration to the exact project with readback/grants review, server-only env configuration, Make #6600107 mapping to Prepare -> existing owner Telegram connection -> ACK and provider/DB readback; staged non-customer E2E test with real receipt, duplicate=0, provider ambiguity hold. No paid providers, no automatic approvals or customer sends. Make #6600107 remains inactive/HTTP503 until then.

### Cross-project owner artwork policy
Owner explicitly permitted temporary non-official visuals on storefront when official event posters cannot be found. This is **presentation only**, not permission to override `SOURCE_DATE_UNVERIFIED`, `action_for_web=hide`, owner tombstones, booked-day restrictions, inventory 0 or price locks. Independent Draft **PR #704** https://github.com/mikesd1995/kk-phone-rental-vercel/pull/704 handles client blank-poster visibility with tagged temporary exact-event artwork. The live Core Sheet read found two active records without poster, `EVT-20261017-THE-PASEO-POP-THE-STAGE` and `EVT-20261030-VVV-SHOW-GO-WHOLESALE-RAMA2`, both `data_health=SOURCE_DATE_UNVERIFIED` and derived `hide`/0 stock. Do not auto-reopen them; source verification is separate. Existing valid `TEMP_IMAGE_2026-10-12` markers and their provenance are retained.

## 2026-10-12 runtime ledger outbox installed and rollback-tested (latest verified checkpoint)

This section supersedes the *earlier* pending-SQL statements above. Project identity was independently confirmed via the connected Supabase project list: **`kk-phone-rental-runtime-ledger`**, project ref `zehlsagzrpromtfqqflt`, active/healthy, AP Southeast 1. Preflight read `to_regclass('public.kk_make_owner_notification_outbox') = NULL` and confirmed the 11 existing KK tables were left alone. This is an **additive schema migration only**; no booking, event, pricing, inventory, Telegram or approval mutation was performed.

- Applied migration `kk_make_owner_notification_outbox_stage_gated_20261012` via Supabase migration API; response `{"success":true}`. Source is `supabase/staging/kk-make-owner-notification-v1.sql` at blob SHA `647272bbb6c632620d366edfda09ec1b09ee35c3`.
- Before installation, restricted transport and outbox event type to `OWNER_ALERT` only, not an unreviewed owner approval preview. Hardened `kk_make_owner_notification_ack` with `n.expires_at>pg_catalog.now()`, preventing a late/replayed provider acknowledgment from marking expired reservations as `SENT`.
- Live Postgres grants readback: table `public.kk_make_owner_notification_outbox` exists; RLS=TRUE; `anon` SELECT=FALSE; `authenticated` INSERT=FALSE; `service_role` SELECT/INSERT/UPDATE=TRUE. Both RPCs `kk_make_owner_notification_claim` and `kk_make_owner_notification_ack` are `SECURITY INVOKER` (not definer); neither `anon` nor `authenticated` may execute; `service_role` execute=TRUE.
- Real SQL transaction tested under `SET LOCAL ROLE service_role`: insert one synthetic `OWNER_ALERT`, **first claim succeeds**, duplicate claim returns zero, **first ACK succeeds**, repeated ACK returns zero, and ACK for a deliberately expired synthetic reservation returns zero. Entire test transaction was `ROLLBACK`ed. Independent post-rollback query confirmed **zero remaining outbox rows, zero synthetic test rows**.
- New source contract test `tests/make-owner-outbox-sql-contract.test.js` validates RLS, role restriction, the no-business-write scope, both functions' invoker security and live-lease checks. Run locally via `npm run test:make:outbox-sql`. **Do not include this source-only SQL test in Vercel postinstall:** `.vercelignore` deliberately excludes `supabase/`, and the initial Preview `dpl_57bfau3khXN16B7r4neB1XbDSwwV` failed with `ENOENT`, not a database/test assertion. This was corrected without removing the source test by separating the dedicated command from Vercel's build tests.
- Follow-up Vercel Preview `dpl_EmesTre5nq8BW4WVqbDCqujB3JxK` at commit `9eee9328a0b256ea5b0fbf60c37f5100da03e65f` is **READY**; targeted Make tests **42/42 PASS**, no-deposit Booking tests **4/4 PASS**, recall tests **48/48 PASS** (build logs). All are offline/Preview tests; the live DB claim/ACK tests above are separate evidence.

**Strict residual gates:** no `SUPABASE_URL`/Supabase service secret, dedicated Make signing key, verified canonical producer binding or owner Telegram chat ID has yet been configured for this new transport in Vercel. Staging Make scenario `6600107` remains inactive with its 503-deny webhook responder and no Telegram module, so **zero actual Telegram messages have been sent**. DO NOT activate scenario, change flags, or claim end-to-end delivery until an owner-only signed production-to-Make-to-Supabase replay-resistant receipt is captured. The stage migration alone does NOT authorize Make activation or automatic Booking/X approvals.

Provenance and checkpoints also posted to GitHub Issue #696. No paid services were enabled.
