# KK Phone Rental — owner review of durable LINE outbound attempts
Date: 2026-10-13. Status: **Draft PR #700 / RELEASE HOLD / no Production migration**.

## User-selected scope

Add an authenticated owner-facing history and evidence-review workflow for
`RESERVED`, `UNCERTAIN`, and `SENT` outbound attempts, and a genuinely
deliberate same-text repeat flow. Owner verification and a new explicit
approval must be required; review itself must NEVER contact LINE, modify a
booking, or release uncertain requests.

## New Draft changes

1. `supabase/migrations/20261013163000_kk_inbox_outbound_owner_review.sql`
   runs AFTER `20261013152000_kk_inbox_durable_outbound_reservations.sql`
   on a TEST database only until accepted. Adds private review status/evidence,
   review audit fields and a self-referencing original-attempt ID for intentional
   repeats; no customer phone, name, message text, retry token or HMAC is
   exposed in the public Admin response. Supabase PostgREST role permissions
   are revoked from `public/anon/authenticated`; only the server
   `service_role` can use:
   - `kk_inbox_list_outbound_attempts` (read-only, limited to 50, exact LINE room)
   - `kk_inbox_review_outbound` (one owner-confirmed evidence annotation/audit)
   - updated `kk_inbox_reserve_outbound` (atomic pre-send, deliberate repeat
     allowed only under restrictive conditions)
   The legacy 3-parameter reserve function is dropped inside the migration
   transaction; PostgREST schema cache is reloaded.
2. `server/kk-inbox-postgrest-store.js` uses the private RPCs.
   `api/kk-admin-guard.js` puts the two new actions behind existing
   Admin signed-session/PIN controls. A review mutation also requires explicit
   `owner_approved===true`. No unguarded public review API.
3. `server/kk-inbox-outbound-delivery.js` requires a new request UUID, a
   reference to the prior attempt, a 12–240 character justification, and
   a **separate** explicit repeat approval. A repeat without all three
   fails BEFORE contacting LINE.
4. `admin/index.html`, `admin/inbox-preview.js`, `admin/admin.css`
   provide an owner-only manual history panel, selectable ledger attempts,
   evidence reference, review outcome and repeat justification. No automatic
   send is attached to viewing history or saving a review.
   - `NEEDS_INVESTIGATION`: an annotation only, never repeat permission.
   - `VERIFIED_SENT`: only if ledger status is `SENT`, there is a real
     provider message ID, and owner supplies an external LINE OA receipt
     reference of at least six characters.
   - To repeat, owner must select `VERIFIED_SENT` history, type the exact
     message and 12+ character reason, confirm preparation, separately press
     Send, and confirm again. Approval is memory-only and single-use.
   - Selecting a different conversation discards prepared repeat approval.
     Network errors or unknown provider acceptance do not authorize retry.
5. `tests/kk-inbox-owner-reconciliation.test.js` includes **10 tests**
   for denied unapproved/short-reason repeats, approved verified SENT
   repeat with one provider attempt, UNCERTAIN/RESERVED rejection, unreviewed
   and non-latest parent rejection, private RPC authentication, RPC outage
   fail-closed, SQL contract and UI no-auto-send/uncertain-repeat guards.
   This suite has been added to `test:inbox:ship-gate`; existing
   postinstall/test dependencies were preserved.

## Deliberate repeat eligibility: hard rules

An identical message in the same conversation within 30 days is rejected
unless **all** of these hold:

- Same prior message is the *latest* matching fingerprint, and no
  `RESERVED` or `UNCERTAIN` matching attempt exists in the 30-day window.
- The latest attempt's durable status is `SENT`, has a genuine LINE
  provider message ID, and owner review is `VERIFIED_SENT` with a documented
  LINE OA evidence reference.
- Owner deliberately enters a new reason and approves a **new** send.
- A fresh request UUID and previously committed, unique server-side
  LINE retry UUID are issued atomically before the provider call.
- Every attempt is logged. No automatic replay, backfill, bypass of the
  existing 30-day duplicate check or replay of an existing request ID.

`RESERVED` and `UNCERTAIN` cannot be made sendable just by selecting
`VERIFIED_SENT` in the UI: the SQL review RPC expressly refuses it.
A failed/outdated readback never presents a green review state.

### What this cannot guarantee

At-most-once **attempt** is not guaranteed delivery. For a crash before
the provider call the ledger may remain `RESERVED`, and for lost
responses the ledger may be `UNCERTAIN` even after LINE delivered.
Only externally confirmed evidence and owner-led manual remediation
can resolve those cases; the current PR deliberately has no automatic
unblock for uncertain attempts. A manual evidence label alone cannot
rewrite `RESERVED/UNCERTAIN` to `SENT`. There is **no** approved
general recovery/re-send mechanism for uncertain delivery.

30 days is a duplicate-content window, **not** infinite protection.
Legitimate repeated templates can be blocked until explicit review.
An old unresolved attempt older than 30 days also requires operational
owner review before interpreting a new send as safe.

## QA evidence and strict no-go

- Source and test files were committed/read back through GitHub. Owner
  reconciliation test definitions passed **10/10 in V8 with mocked Node,
  PostgREST, DOM and LINE** (not native Node or a real database). Existing
  16 UI test definitions passed 16/16 under equivalent synthetic V8.
- The database migration is **NOT installed**: the active Supabase
  production project has no `kk_private.inbox_outbound_attempts` and no
  `kk_inbox_reserve_outbound`/`kk_inbox_finish_outbound` RPCs.
  This absence is deliberate. Do not run a migration against Production
  simply to make a demo work.
- No real LINE outbound, booking/data edits, Preview/Production deploy,
  merge, GitHub Actions bypass, Vercel upgrade or paid quota top-up.
- Required CI on this PR has historically failed before allocating
  runners (0 steps); its status MUST be rechecked on final SHA. Native
  Node tests and real PostgreSQL concurrent-writer tests are not yet proven.

## Next safe acceptance sequence

1. Obtain a truly isolated **free** PostgreSQL TEST database (current
   Supabase project has no development branches). Confirm cost is $0
   **before** creating anything. Do not use actual customer records
   to seed test data.
2. Apply the two ordered migrations to TEST, verify schema and function
   signatures, `anon/authenticated` EXECUTE denied, private table RLS,
   service-role RPC visibility. Test `RESERVED`/UNCERTAIN paths and
   concurrent same-body requests from two independent SQL connections;
   assert only one reservation and exactly one unique retry key.
3. On TEST: add synthetic LINE conversation; prove review `VERIFIED_SENT`
   fails for `UNCERTAIN`, `RESERVED` and missing provider receipt; check
   private audit row; prove newer unresolved attempts block override.
   Prove authorized deliberate latest-SENT repeat is a *new* request with
   one provider invocation only under mock transport.
4. Run exact SHA native Node Inbox ship-gate, all Required GitHub CI with
   actual runner steps using free included capacity, and exact-head
   FREE Vercel Preview with mobile/desktop owner Inbox testing.
5. Test real LINE E2E **only** with a consenting safe test account and
   explicit owner go/no-go; reconcile provider ID, the ledger and Inbox.
   Reconfirm 0 additional spend, private media controls, Booking data
   non-mutation, Storefront PR #711 compatibility and rollback strategy.
6. After all checks and explicit owner approval, coordinate migration
   and reviewed-source deploy, and verify actual Production SHA +
   permissions + provider send outcomes. Otherwise remain Draft.

## Cross-chat recovery

[PR #700](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/700),
[Issue #715](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/715),
[CI #707](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/707),
[Vercel free storage #692](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/692).
Compare exact current HEAD before future edits, never assume this writeup
proves Production release. Preserve zero-cost policy and owner business locks.
