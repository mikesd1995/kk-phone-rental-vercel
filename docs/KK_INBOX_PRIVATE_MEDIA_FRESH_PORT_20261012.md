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
