# KK Phone Rental — durable owner-approved LINE outbound idempotency (2026-10-13)

## Result and exact boundaries

**DRAFT source complete for this phase; Production NOT changed. Release HOLD.**
Owner selected task 1, "LINE ส่งซ้ำแบบถาวร": stop repeat provider pushes
caused by double-clicks, overlapping serverless instances, page reloads,
lost provider response, post-send Inbox persistence failures, or pre-send
migration/database failures. Neither LINE API sends, Production SQL migration,
Booking/Sheet writes, Production/Preview deployment, CI runner dispatch nor
new paid service were performed in this task.

Branch: `fix/unified-inbox-private-media-current-main-20261012`; Draft
[PR #700](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/700).
GitHub base/main and unchanged Production: `d6dc3bfe4cc0c4dd6fdfec407823752da0572464`.
All new source commits are on the Draft branch, **not Production**.

## Confirmed root cause (previous behavior)

- Admin `inboxSendLineMessage` authorized the send then immediately called
  `LineMessaging.pushText()`. Its default `X-Line-Retry-Key` was a **new random
  UUID for each request**. The durable Inbox message write happened **after**
  LINE accepted the push.
- Network timeout / provider acknowledgment loss / `recordOutbound` failed
  after provider acceptance -> owner interface lacked a **cross-reload durable
  reservation**, so a new click could create a **second provider push**.
- Earlier source patch only held a failed room in ephemeral browser memory; the
  hold disappears on reload, browser crash, or a separate signed-in device.

## Draft implementation

1. **Additive service-role-only migration**:
   `supabase/migrations/20261013152000_kk_inbox_durable_outbound_reservations.sql`.
   Creates `kk_private.inbox_outbound_attempts` with immutable request UUID
   PK, conversation ID, HMAC body fingerprint, stable server-generated retry
   UUID, `RESERVED|SENT|UNCERTAIN` state and provider receipt IDs. No message
   body or customer phone is stored in the ledger. RLS enabled; no anon or
   ordinary-authenticated grants. Two service-role-only RPCs:
   `kk_inbox_reserve_outbound` and `kk_inbox_finish_outbound`.
   Reservation uses a PostgreSQL transaction-scoped advisory lock on
   (conversation, fingerprint) and atomic insert before provider contact.
   The original request UUID is blocked permanently by its primary key,
   including after restarts; **different request IDs with identical text for
   the same room are blocked for 30 days**. The 30-day duplicate-content
   window is deliberately conservative; this is **NOT lifetime text dedup**,
   and it also blocks legitimate repeated identical customer messages during
   that period. A separately reviewed explicit owner override/reconciliation
   feature is required before allowing such a repeat.
2. **New server orchestrator**:
   `server/kk-inbox-outbound-delivery.js` requires a real matching LINE
   conversation with a direct LINE user ID, valid owner-generated UUID,
   service-role reservation RPC and recorded immutable retry key *before*
   invoking `pushText`. Any reservation failure or missing migration
   **fails closed, with zero provider sends**.
   LINE timeout or ambiguous response -> best-effort mark `UNCERTAIN`;
   even if status update fails, the `RESERVED` row remains and blocks
   replay. Only actual LINE-supplied `sentMessages[0].id` counts as
   confirmed delivery identity; local retry keys cannot impersonate it.
   After success, it persists outbound Inbox content and finalizes `SENT`.
   Failure after provider acceptance remains blocked and not reported as
   safely retryable.
3. **Server route and PostgREST wiring**:
   `api/kk-admin-guard.js` continues signed Admin/PIN and owner_approved
   requirements, validates an explicit `send_request_id` UUID and uses only
   `DurableLineSend.sendOnce`, **not** the former direct unreserved push.
   `server/kk-inbox-postgrest-store.js` calls the two private RPCs.
   `server/kk-line-messaging-api.js` returns `provider_confirmed=false`
   if the actual provider message ID is missing.
4. **Client request identity**:
   `admin/inbox-preview.js` creates a UUID on owner-confirmed button action
   via the browser crypto API. Earlier per-room ephemeral draft separation,
   fixed approved recipient, and uncertain-send blocked UI are preserved.
   No auto-send, no localStorage of customer text, no automatic retry.
   Browsers lacking a secure random UUID API fail closed.
5. **Regression additions**:
   `tests/kk-inbox-outbound-delivery.test.js` adds 11 Node tests covering
   replay after reload, simultaneous requests, failed reservation/migration,
   ambiguous network acceptance, failed Inbox write after send,
   failed finalize, wrong room, wrong recipient, private-HMAC separation,
   missing LINE receipt and the SQL/backend/client contract.
   `tests/kk-line-messaging-api.test.js` adds 2 cases distinguishing
   real provider ID from the old local fallback.
   Existing Admin Inbox VM fixtures adapted to mandatory request UUID.
   Both suites are added to existing `test:inbox:ship-gate` without
   changing `postinstall` or unrelated acceptance suites.

## Evidence and what is **not** proved

- GitHub fetched source compiled in tool-local V8 for 7 JS source/test files
  plus package JSON; all syntax checks passed.
- Tool-local V8 executed **9/9 simulated orchestration conditions PASS** on
  the exact fetched `server/kk-inbox-outbound-delivery.js`, with mocked Node
  crypto, ledger, Inbox and LINE: successful one-send, replay blocked,
  new-click duplicate blocked, outbound receipt recorded, timeout -> uncertain,
  retry after timeout blocked, missing ledger -> zero LINE calls, post-send
  persistence failure -> uncertain, and simulated parallel one-winner logic.
  These are **not actual Node, PostgreSQL transaction or LINE network tests**.
- Real database **read-only** verified:
  `kk_private.inbox_outbound_attempts` **absent**; both new RPCs **absent**.
  43 Inbox conversations and 3 historically recorded LINE outbound text
  messages remained; no customer/Booking/SOT writes.
- GitHub Actions required tests still unallocated (zero-step runner failures
  under already-exhausted included Actions minutes). Do not label any Node
  tests passed. No Vercel exact-head Preview or browser acceptance.
- No SQL migration applied. This means the Draft code would block sending
  until an owner-approved, tested migration has been staged/read back;
  **do not bypass the missing-ledger check to restore sends**.

## Safety considerations and residual limitations

- This is **at-most-once provider invocation**, NOT guaranteed
  exactly-once delivery. A process crash between durable reservation and
  provider call leaves `RESERVED` even if the customer never received a
  message. It must be reviewed manually; unsafe automatic replays are banned.
- The 30-day same-text block may reject a *legitimate* repeated phrase.
  There is deliberately no auto-expiry/retry action or client bypass button.
  Owner will need reviewed status/receipt and an explicit new-send flow.
- HMAC is keyed by the private Supabase service-role secret in server
  environment. If that key rotates, fingerprint continuity changes; reconcile
  existing unresolved reservations before rotation/release. No secret is
  persisted in GitHub, ledger, logs, or the browser.
- No direct send to rooms/groups is supported by the new guard, only verified
  LINE user IDs. Owner-initiated sending and per-customer authorization
  remain mandatory.
- Do not deploy migration blindly. First inspect migration history,
  existing object/schema names, grants, permissions, and ensure standalone
  TEST database acceptance. Validate advisory lock at PostgreSQL concurrency
  level, accepted/duplicate/rollback semantics, and service-role-only RPC.
- Existing **23** historical LINE image messages still have **0** provider
  IDs and **0** private archived files. Image recovery and Booking linking
  remain separate P0 acceptance gates.

## Exact release acceptance order (zero additional spend)

1. Re-read PR #700 exact head, `main`, `tests`, migrations and #715/#707/#692.
   Never merge another branch or change business data on assumption.
2. Verify **zero-cost** Postgres TEST path before any migration. Run the
   migration only in a controlled TEST environment with owner approval
   and pre/post DDL, RLS, service-role privilege/readback. Exercise two
   concurrent SQL RPC reservations; prove one wins, second blocked;
   prove prior reservation cannot be reused from another server instance.
3. Run real `node --test tests/kk-inbox-outbound-delivery.test.js
   tests/kk-line-messaging-api.test.js tests/kk-admin-inbox-preview.test.js`
   plus complete `npm run test:inbox:ship-gate` and existing postinstall
   checks. Require actual logs, no fake or zero-step CI greens.
4. Only after GitHub Actions free minutes and Vercel Hobby free deployment
   storage are **positively** verified available, require exact-HEAD
   GitHub Required Checks, Vercel Preview READY and authenticated mobile/
   desktop Admin acceptance. Do not purchase capacity or bypass checks.
5. With explicit owner approval, test one safe legit send E2E using an
   authorized test LINE identity, verify one provider receipt and matching
   Inbox + ledger row. Test network failure/simultaneous POST/reload under
   controlled conditions **without contacting real customers**.
6. Add owner-reviewed status/reconciliation UX and reviewed policy for
   intentional identical messages; never auto-resend an uncertain request.
7. After all gates pass and owner approves, apply the accepted migration
   and release the exact reviewed SHA in coordinated order, then verify
   Production alias SHA, observed message count, denied anonymous RPCs,
   no duplicate sends, rollback path. Otherwise keep Draft/Release HOLD.

## Durable cross-chat handoff

Use this document alongside [PR #700](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/700),
[Issue #715](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/715),
[CI #707](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/707),
[Vercel Hobby #692](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/692).
No production writes or paid services were authorized by creating this Draft.
