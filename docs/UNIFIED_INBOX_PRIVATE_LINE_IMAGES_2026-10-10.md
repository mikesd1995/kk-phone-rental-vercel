# KK Unified Inbox — Private LINE image archive (2026-10-10)
Status: IMPLEMENTED ON PR #688; PREVIEW READY; PRODUCTION ACTIVATION BLOCKED BY GITHUB ACCEPTANCE; LIVE CUSTOMER-IMAGE ACCEPTANCE STILL PENDING.

## Root cause from real production evidence (read only)
- Production deployment at start of incident: dpl_AmYtTipVdrzuT1i5XdYBGp3wdY1L, main 69390a94972b8c636317bbf00d62ab677c0cc66f.
- Existing admin/inbox-preview.js rendered image messages as placeholders, no image fetch.
- kk-line-webhook.js used webhookEventId as external_message_id and discarded original LINE message.id.
- Supabase connected project kk-unified-inbox (mxjnjujqjybqughsnqbz): 32 conversations, 180 messages (154 text, 17 image, 9 sticker); 0/17 images had a separate provider content message ID or URL; old image bytes cannot be reconstructed from the current rows.
- Old historic images cannot be promised recovered, regardless of future fix. Check LINE OA Manager or ask customer to re-send.

## Code (PR #688)
1. Store exact LINE message.id independently of immutable idempotency webhookEventId in normalized inbound payload.
2. Persist incoming image binary immediately in private Supabase Storage bucket kk-inbox-media, max 8 MiB, image magic-byte MIME allowlist (JPEG, PNG, GIF, WebP). Public URLs forbidden.
3. storage failure is fail-soft for existing LINE booking and inbound message persistence; media error codes logged without provider credentials or customer content.
4. Server-only exact conversation_id + message_id membership RPC kk_inbox_media_metadata; only service_role EXECUTE.
5. Existing admin PIN or signed-session authorization before inboxGetImage binary stream; no cache; no token in browser. If archive missing, use persisted provider message ID to attempt LINE content recovery while retained by LINE and save.
6. Admin Inbox now loads secured thumbnail blob, allows click to view, revokes blob URLs on thread rerender, and displays genuine legacy unavailable state.
7. Add 30-second webhook function max duration due bounded image download + private archive; no paid provider.
8. Existing booking/price/event/write rules are untouched; no AI auto-send.

## Verified state
- Supabase migration kk_inbox_private_line_media_20261010 applied successfully; bucket id=kk-inbox-media is public=false, max=8388608 bytes; allowed MIME whitelist. anon EXECUTE=false, authenticated EXECUTE=false, service_role EXECUTE=true. No storage.objects public policies.
- Vercel deployment dpl_ATTVGNJMYCBUL37k8Ez7YDunwMER executed all media/LINE/Admin focused tests: 18/18 PASS, 0 FAIL; Ultra Deep recall 48/48 PASS, Siam poster 1/1 PASS; npm run check passed. The deployment itself failed ONLY because a temporary buildCommand override conflicted with the existing Vercel Output Directory contract; the override was reverted.
- Fresh Vercel Preview READY: dpl_8vjdBBiNx3XbCGmc9BHvR37va7dh, source commit 46565e350b8b68311401c968fe91e485af5cf568.
- GitHub PR #688 is draft. Two repo-wide Acceptance workflow runs (Ultra Deep V2 Acceptance / Booking E2E Acceptance) report failure; job log fetch returns BlobNotFound, so not safe to claim they're green or code-caused. Do NOT bypass that preexisting governance without explicit resolution/approval.
- PROD MAY STILL SERVE OLD CODE. No confirmed actual new photo sent after patch; do NOT claim live E2E success or that future images are guaranteed visible until production merges/deploys and real LINE send/readback succeeds.

## Final release gates
1. Restore/verify existing GitHub action acceptance or document scoped exemption with owner approval; check PR mergeability and no source conflict.
2. Promote PR #688 only after accepted guardrails; require Vercel Production READY on exact merged SHA, without paid upgrade.
3. Send one fresh JPEG/PNG from a LINE test account, verify the specific image is stored in private bucket AND appears in KK Admin thread, full-size open works.
4. Confirm an unauthorized request cannot fetch it, and existing LINE booking auto-reply/inbox message persistence is intact.
5. Reconcile new-image image_type counts and storage object counts; monitor timeouts/media_errors with zero credentials leaked.
6. If no new image appears: check LINE webhook response time, media capture errors, bucket path line/msg_<sha>, RPC exact metadata, admin image fetch HTTP response. Do not substitute webhookEventId for LINE message.id.
