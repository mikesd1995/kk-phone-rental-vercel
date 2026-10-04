# Admin backend small-cleanup audit — 2026-10-04

## Scope
Owner requested a full pass over the Admin backend and to close small, low-risk defects without weakening fail-closed behavior or mixing in larger unfinished platform work.

## Structural audit
Verified against current Admin source:
- 193 static HTML ids, no duplicate ids.
- 12 navigation tabs and 12 matching tab panels; no orphan nav target or orphan panel.
- 8 Admin forms are all referenced by the Admin client runtime.
- Inbox reads already use browser `cache:'no-store'`.
- `/api/kk-admin-guard` already returns `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`.
- The stale-message defect was therefore refresh lifecycle, not an HTTP cache/session defect; that fix is already merged separately.

## Small defects closed in this batch

### 1. Inbox unread count never cleared
Confirmed production Inbox rows can accumulate unread counts even after the owner opens the thread.

Implemented:
- server-only RPC `kk_inbox_mark_read`;
- authenticated Admin action `inboxMarkRead`;
- opening a thread marks it read;
- live polling marks newly arrived messages read only when the owner is already at/near the bottom of the visible thread;
- if the owner is scrolled upward reading history, new messages remain unread;
- read changes are audited as `conversation_read`;
- Inbox-only metadata write; no Booking/Event/Pricing mutation.

Synthetic Supabase acceptance: PASS. Test row and audit row were removed after verification.

### 2. Raw UTC/ISO timestamps
Admin thread previously rendered database timestamps verbatim.

Implemented:
- Thai-readable timestamp formatting;
- fixed display timezone `Asia/Bangkok`;
- original raw timestamp remains in the HTML title for diagnostic readback.

### 3. Blank non-text messages
Image/sticker/audio/file messages with empty `body_text` rendered as empty bubbles.

Implemented safe fallbacks:
- sticker → `สติกเกอร์`;
- image → clear image placeholder;
- video/audio/file/location → readable Thai labels;
- conversation list uses the message-type label if last-message text is blank.

This is presentation cleanup only. Actual LINE media retrieval/rendering remains a separate larger Media parity task.

### 4. Unread badge/copy polish
- hide the unread badge at zero;
- show `N ใหม่` instead of `N unread`;
- improve unread badge contrast;
- rename reset action from `ใช้ชื่อ LINE` to channel-neutral `ใช้ชื่อโปรไฟล์`;
- reduce internal engineering jargon in the Inbox header/safety copy.

## Known larger work intentionally not folded into this small-cleanup PR
These are real gaps but should remain separate because they change message ingestion/provider behavior or business-write authority:
- actual LINE image/sticker/media download and rendering;
- mirror system-generated Booking Flex cards into the Admin timeline;
- reconcile messages sent directly from LINE OA Manager into the KK Inbox;
- Apps Script 9.5.13 source-equivalence/controlled deployment gate;
- Admin Direct Writer dedicated production identity;
- Issue #489 full data-integrity/SOT audit;
- Vercel production activation of recent Admin commits after quota reset.

## Production status
At audit time, Vercel Production READY is still on commit `e1afe310afa46ec69290baef6e1dd6dd2fb316b1`.
Current main descendants are blocked from deployment by `api-deployments-free-per-day`.

Therefore repo/database work can be complete while the browser Production UI remains older until a later deployment reaches READY.

## Continuation
Do not re-open the small defects above unless exact runtime evidence shows regression.
Continue next from:
1. deploy a verified descendant after Vercel quota reset;
2. production acceptance of live refresh + owner labels + read-state cleanup;
3. then address Media/Flex/OA-manager parity as a separate bounded Inbox project.
