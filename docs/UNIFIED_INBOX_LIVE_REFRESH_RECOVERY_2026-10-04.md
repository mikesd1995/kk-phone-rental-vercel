# Unified Inbox live refresh recovery — 2026-10-04

## Confirmed defect
New inbound LINE conversations/messages were persisted by the webhook, but an already-open Admin Inbox did not refresh automatically. The browser fetched Inbox data only on explicit UI events such as opening the tab, changing filters/search, sending, or renaming. Logging out/in caused a page lifecycle reload, which made the new rows appear and created the false impression that authentication was required.

This is not an HTTP cache defect:
- Admin Inbox fetch already uses `cache:'no-store'`.
- `/api/kk-admin-guard` already returns `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`.

## Fix
`admin/inbox-preview.js` now:
- polls the conversation list every 4 seconds only while the Inbox tab is active and the document is visible;
- refreshes the selected thread only when its conversation version changes, avoiding a second API call on idle cycles;
- performs an immediate catch-up refresh when the browser regains focus, becomes visible, comes back online, or the Inbox tab is opened;
- wires the existing Admin Refresh button to force an Inbox/thread readback;
- prevents overlapping poll requests;
- keeps the current composer text untouched;
- preserves thread scroll position when the owner is reading older messages, but follows the newest message when already near the bottom;
- keeps prior content visible during a transient polling failure instead of replacing the whole Inbox with an error state.

The UI exposes `#inboxLiveStatus` so the owner can see the last successful refresh time.

## Safety
- Read-only polling only; no Booking/Event/Pricing writes.
- LINE owner-confirmed send semantics are unchanged.
- No AI auto-send.
- No provider token is exposed to the browser.
- Media/Flex parity is a separate defect and is not falsely claimed fixed by this change.

## Acceptance
1. exact source syntax/regression gate;
2. Preview/Production deployment when Vercel quota allows;
3. with Admin Inbox already open, send a legitimate customer LINE message and verify the new message/conversation appears without logout/login, target <= 4 seconds plus webhook latency;
4. keep a selected thread scrolled upward and verify polling does not jump it to the bottom;
5. return to the browser tab after backgrounding and verify immediate catch-up refresh.
