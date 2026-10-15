# KK private LINE images fresh-port onto current main — 2026-10-12

## Owner scope
Use zero paid services, keep current Booking no-deposit, Vercel Hobby Source Contract, owner approvals, and original posters intact. Existing messages may not be recoverable if LINE provider ID was never persisted. No automatic LINE replies and no booking/SOT writes from this code port.

## Base/identity
Base production main d01acc5ae757ac4bc7d6d23fc008fd8ca9b8bf2d (P0 no-deposit PR #699 already on prod). Legacy image draft PR #688 branch `fix/unified-inbox-private-line-images-20261010`, source head 26e67ca46bf49fbc9bccc184995080bd9b304ff2. PR #688 is `mergeable_state=dirty` against main. Therefore its old commit MUST NOT be merged directly. This fresh-port composes the image feature with current main rather than discarding recent features.

## Root cause and evidence
The legacy branch exported `getMediaMetadata` without declaring it in `server/kk-inbox-postgrest-store.js`. Preview dpl_Gn37RgaHiuueLhx69WvAsCxKV9iF failed `ReferenceError: getMediaMetadata is not defined` 100/101. Implemented exact-membership service-role RPC and added test. Legacy branch new exact-head Preview dpl_B8xLXcGGiPXoGjSmXqP3EgCaUDPT READY and `test:inbox:ship-gate` **102/102 PASS**. No live inbound image was sent or downloaded during acceptance.

Connected Supabase `kk-unified-inbox` `mxjnjujqjybqughsnqbz` read-only SQL returned `private_media_bucket_count=1`, `media_rpc_count=1`, `anon_can_execute=0`, `service_can_execute=1`. Existing bucket and RPC are private. Migration included in repo source as documentation, but **do not reapply without migration history/idempotency verification**.

## Fresh-port change
- Copied only the 12 feature-specific source/UI/test/migration/docs files from PR #688 exact head unchanged. Three conflict-sensitive files were reconstructed from **current main**:
  * `api/kk-admin-guard.js`: preserve `NoDepositBooking.checkCreateBooking`, authenticated session gate, and add `InboxMedia`, `inboxGetImage` server-only membership read.
  * `package.json`: retain 71 existing postinstall contracts, add `test:inbox:ship-gate` with 102 tests and `npm run check`.
  * `vercel.json`: leave current main file EXACTLY unchanged (`git.deploymentEnabled={"*":false,"main":true}` and runtime configuration preserved); omit old #688 30-second `api/kk-data` override as unrelated.
- API validates exact `conv_...` / `msg_...` identity and user session, uses service-role metadata RPC, reads only private storage or qualified LINE provider recovery, caps media to 8MiB and safe image MIME. Clients get bytes, no public storage URLs.
- Unavailable historical images remain truthful. No secret is ever returned in a web page.

## Required exact-source acceptance
1. Vercel Preview READY on exact fresh-port head, combined `npm postinstall` tests 6 No-Deposit + 16 Vercel Contract + 48 Ultra Deep + 1 Poster + 102 Inbox and `npm run check` ALL PASS.
2. Preview public site, Admin unauthenticated, API data feeds parity against current production; private source 404.
3. Verify Supabase RPC/bucket security readback again. For true E2E media, need a NEW verified incoming LINE image and owner-authenticated Admin thumbnail read; no automatic customer messages.
4. Only after core gates pass, merge via pinned PR and exact production deployment + alias readback. The Inbox feature alone isn't proof old provider image IDs can be recovered.
5. Continue Issue #683 for Return/Drive/Completed atomicity and Revenue Future valuation column X separately.

## Cross-chat
No Google Sheet booking mutation, no manual customer send, no paid plan/credits, no Supabase migration reapply, no hidden event/owner-priced event release. Historical app-specific guide: `docs/UNIFIED_INBOX_PRIVATE_LINE_IMAGES_2026-10-10.md`.


## 2026-10-13 — stale-room and ambiguous-send safeguards (DRAFT ONLY)

**Continuation of owner-requested P0 repair.** This is an additional checkpoint, not evidence of
production acceptance. Source changes were committed to PR #700, branch
`fix/unified-inbox-private-media-current-main-20261012`, beginning at
`47f928548835992867205bc90bccf7fea12be0c6`.

### Reproduced source-level risks and fixes

1. Filtering/searching the Inbox could leave the *previous* selectedRow and shared
   composer active even after that conversation disappeared from the visible list.
   A stale row may misleadingly display one person's identity while targeting
   another conversation. Added `clearSelectionAfterFilter()`: save the unsent
   room-specific draft in ephemeral memory, invalidate in-flight thread requests,
   clear selected/selectedRow, revoke image object URLs, empty the shared composer,
   render an explicit choose-conversation placeholder, and require a fresh
   selected row before sending. `loadThread` rejects absent/mismatched
   `conversation_id` metadata without fetching.
   Commit: `c582e360884912302d7d2b25491e7435fbff536b`.

2. After LINE accepts a send, an Inbox write or provider/HTTP response can fail;
   the earlier UI always said "send failed", and another click generated another
   request with a fresh LINE retry key. This can create a duplicate customer
   message. An **uncertain per-conversation send hold** now disables sending
   for that room **within the current page session** and explicitly tells the
   owner to verify the actual LINE OA history before reloading. The shared
   button/composer stays disabled while the hold is set, and reply attempts also
   reject stale recipient-row identity. Nothing is sent or retried automatically.
   Commit: `32a8c37a5f32c208f93002baa10dae3cdb178aeb`.

3. Regression changes: test fixture alignment `65f09ce736c7e086db8f1a7c7b3cbfdb0cdcfdb7`;
   3 targeted tests for missing selected conversation, mismatched thread identity,
   and ambiguous-send double-send guard `16564b412088ef751f0bd3d68f56422fe55adf2a`;
   2 tests for disabled controls + warning and mismatched outgoing row
   `12e5b321089dde104112da5c994ee00ef3852c0a`.
   Existing 9 source test cases become **14 definitions total** in
   `tests/kk-admin-inbox-preview.test.js`; the five new tests
   have **NOT** been executed in Node.

### Evidence run and exact scope

- GitHub source/blob readback: `admin/inbox-preview.js` and
  `tests/kk-admin-inbox-preview.test.js` are the ONLY modified paths
  versus earlier head `47f92854` (5 new commits).
- `new Function` V8 source syntax compilation **2/2 PASS** (full current
  browser script and test source); this is a parser check, not a Node test run.
- Actual functions extracted from the GitHub exact-head browser source exercised
  with synthetic inputs in V8: **7/7 isolated checks PASS** for hidden selected
  row clearing, safe draft retention, invalidated stale thread, ambiguous
  send hold, draft preservation, recipient-row mismatch, and metadata mismatch.
  Also executed the latest source `composeState()` on simulated controls;
  both controls remained disabled and LINE OA warning was displayed.
  **No LINE API/provider sends or Supabase writes.**
- At exact pre-document SHA `12e5b321089dde104112da5c994ee00ef3852c0a`,
  GitHub Actions checks were **3/3 FAIL, 0 runner steps, runner null**:
  Ultra Deep `38362586432`, Vercel Source Contract `38362586584`,
  Booking E2E `38362586480`. They do not establish Node code failures.
  Included GitHub Actions usage alert earlier 2,032/2,000 with stated reset
  2026-11-01; current billing stop flag is not independently readable.
  No Actions rerun or extra paid usage was requested.
- Vercel **0 Preview** at that SHA; Production alias remains READY deployment
  `dpl_7TYLb87ir9qNzXRtkeb49543dwVm` on older `main d6dc3bfe...`.
  This patch is NOT live. No deploy/merge/paid build.
- Read-only Supabase 2026-10-13: 43 conversations and **zero**
  `linked_booking_id` values; 23 incoming LINE images with **zero**
  `payload.line_message_id` and **zero** storage.objects in the private
  `kk-inbox-media` bucket. Existing historical bytes CANNOT be represented
  as archived or recovered. Previous same-turn bucket/RPC readback:
  `public=false`, max 8MiB, `kk_inbox_media_metadata` executable only
  by service_role, not anonymous or ordinary authenticated roles.
  LINE-only international customer identity policy is staged, not Production.

### Important residual safety gates (not solved by UI-only controls)

- **Backend durable idempotency across reloads/processes is still not proven.**
  The client-side uncertain-send hold deliberately expires on page reload.
  The server currently calls `LineMessaging.pushText` with a newly generated
  retry key for each new send; until a tested provider receipt/atomic outbox
  protocol exists, never treat "timeout" or "post-send persist failure" as safe
  authorization to repeat a send. Require an explicit owner-reviewed receipt
  and a verified E2E attempt, never automatically replay customer messages.
- Need exact-head Node `test:inbox:ship-gate` and applicable booking/webhook
  suites + Required CI actually allocated (>0 steps) and green, with $0 usage.
- Need exact-head FREE Preview and authenticated Admin mobile/desktop real
  UI QA (all relevant focus, polling, filtering, drafts, send ambiguity),
  LINE owner-approved reply E2E, and **NEW consented legitimate incoming LINE
  image** to prove signed webhook, private archival, owner read and wrong-room
  denial; historical 23 image records are not currently recoverable.
- Owner-confirmed exact `conversation_id ↔ booking_id` linkage is still
  not implemented/proven. Never auto-link from similar names or phone numbers.
  Blank phone for a verified international LINE customer is valid, not a ghost.
- Verify overlap with separate Storefront Draft #711 booking prefill parser,
  Apps Script pending writer and real source-of-truth readback before release.
- Retain $0 top-up policy, existing booked-day locks, no-deposit lifecycle,
  no new sends, no business data changes and owner signoff. **RELEASE HOLD.**

### Operational cross-chat recovery

1. Read [PR #700](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/700)
   HEAD and this guide, plus Issues [#715](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/715),
   [#707](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/707) and
   [#692](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/692).
2. Read exact current GitHub SHA **again** before edits; inspect both changed
   files, source tests, and saved comments, then run only real zero-cost
   acceptance when entitlement and Preview storage gates are actually clear.
3. After all Required Checks, browser/media/reply/booking-link owner review,
   merge/deploy only the reviewed SHA and verify Production/rollback SHA.
   Otherwise remain Draft. Never claim full Inbox fix while 23 historic
   images remain unarchived or booking links remain unverified.

## 2026-10-15 — native source audit and isolated test-boundary repair

- Audited exact #700 source `e454967bb6668d3daa4bf9acd3e859b0fbed81fa`
  in a detached local worktree using Node `v24.19.0`; no hosted workflow,
  Preview, production operation, DB migration or provider send was requested.
- Native `test:inbox:ship-gate` initially reported **149/150 PASS**.
  The only failure was the no-phone pending-replay source assertion:
  its `writerBody()` helper ended at the later legacy create-booking
  function and accidentally included the sibling owner-decision function.
  The latter contributes two unrelated `customer_contact` fields, so the
  exact three-field pending-writer invariant incorrectly counted five.
- Repair only the test helper's end boundary to the next top-level
  function. The existing three-field assertion is unchanged; all runtime,
  UI, Apps Script and migration source remains byte-identical to #700.
  Native `test:inbox:ship-gate` now reports **150/150 PASS**.
- Full regression remains **FAIL**: before the repair **1,532/1,552 PASS**
  (20 failures), afterward **1,533/1,552 PASS** (19 failures). Comparing
  failure names proves only that exact test was removed and no failure
  was added. The remaining unrelated baseline failures must not be hidden
  or treated as release acceptance.
- Independent review accepted the bounded extraction repair without weakening
  the original invariant. The engineering gate remains **BLOCKED** on full
  risk regression and release readback; this is a test repair, not acceptance.
- This audit does not fresh-port #700 onto current canonical #744/main.
  #700 still includes broader outbound-review, international-contact,
  Apps Script, UI and migration changes and requires deliberate integration
  with current security, booking and LINE replay/bookability gates.
- Actual private media acceptance remains HOLD: a legitimate new consented
  incoming image, verified signed webhook persistence, private archival,
  authenticated owner image read, wrong-conversation denial and provider
  recovery/expiry behavior need fresh runtime evidence. Historical rows
  without original provider IDs/bytes cannot be called recovered. Outbound
  concurrency/receipt behavior needs an isolated free test DB and explicit
  owner-controlled provider acceptance. No production state was changed.
