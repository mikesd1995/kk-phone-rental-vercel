# Unified Inbox LINE Send + Profile Recovery — 2026-10-04

## Owner request
Make KK Admin Inbox usable for replying to LINE customers and stop showing raw LINE user IDs when a display name can be resolved. Preserve fail-closed behavior, no AI auto-send, and record progress so another chat can continue from exact state.

## Root cause confirmed
- Admin compose controls were hard-disabled in HTML.
- `api/kk-admin-guard.js` exposed only Inbox read actions.
- LINE webhook normalized `source.userId` but never called the LINE profile endpoint, so `display_name` remained blank.
- Durable Inbox SQL did not refresh a conversation display name on later inbound messages.

## Implementation on branch
Branch: `fix/inbox-line-send-profile-20261004`

Implemented:
- `server/kk-line-messaging-api.js`: server-only LINE get-profile + push-message client; push uses `X-Line-Retry-Key`.
- `server/kk-line-inbox-tee.js` + `server/line-booking-webhook.js`: verified inbound LINE events hydrate display name before persistence; profile failure is fail-soft and must not drop inbound messages.
- `server/kk-inbox-postgrest-store.js`: added get-conversation, profile-update and outbound-record RPC adapters.
- `api/kk-admin-guard.js`: authenticated profile backfill and owner-approved LINE send actions. X outbound remains disabled. Provider success followed by persistence failure is reported explicitly and is not treated as unsent.
- `admin/inbox-preview.js` + `admin/index.html`: automatic backfill request for blank LINE names and governed compose/send UI. Every send requires an explicit browser confirmation and `owner_approved=true`.
- `supabase/kk_inbox_v1.sql`: inbound display-name refresh, conversation lookup, LINE profile update and outbound persistence/audit RPCs.
- Regression coverage added/updated for provider client, tee hydration, PostgREST RPCs and Admin UI.
- `package.json` syntax gate includes the new LINE Messaging provider client.

## Database state
Canonical Inbox Supabase project: `mxjnjujqjybqughsnqbz` (`kk-unified-inbox`).
Migration applied successfully: `enable_line_inbox_profile_and_owner_send`.
This migration is backward-compatible and does not send any customer message.

## Safety / invariants
- No AI auto-send.
- No X outbound.
- Owner-authenticated Admin session plus explicit owner confirmation is required for LINE send.
- Provider token stays server-side.
- A failed profile lookup never blocks inbound persistence.
- LINE push uses a retry key to reduce duplicate sends on retries.
- Booking/Event/Pricing write paths are not modified by this change.

## Production acceptance still required
Do not claim fully live until all of these are proven:
1. repository syntax + regression checks pass for exact branch head;
2. PR is merged;
3. exact merged commit reaches Vercel Production READY;
4. opening Admin Inbox backfills resolvable blank LINE display names;
5. one owner-approved LINE send is accepted by provider and appears as an outbound Inbox message/audit row;
6. no regression in the existing LINE booking webhook path.

## Continuation rule
A new chat should start here, inspect the latest PR/deployment/runtime evidence, and continue from the first unproven acceptance item. Do not reimplement the old read-only Inbox and do not re-disable profile hydration or owner-approved LINE send unless there is confirmed regression evidence.
