# P0 LINE + Telegram recovery runbook — 2026-10-14

Status: **NOT RECOVERED**. This runbook is a non-production, zero-cost investigation artifact. Source of truth: GitHub issue #740.

> Historical investigation only. The current live Machine SOT and Active policy
> take precedence over issue740 and this dated snapshot. Its LINE booking-approval
> and replacement-activation sequence is not authority for Scanner Ledger alerts.
> See [21 October preparation and admission boundaries](OWNER_LEDGER_IDENTITY_PREPARATION_2026-10-21.md)
> before using any recovery step. Policy225/235 still requires the existing
> Ledger consumers; no sender, task, production configuration or queue is released
> by this runbook.

## Live Make organization readback
| Account | Org | Free unused operations | Last reset UTC | Next reset UTC | Active scenarios | Free active scenario limit |
| --- | --- | ---: | --- | --- | ---: | ---: |
| Make A | 8618622 | 1000 | 2026-10-10T07:55:43Z | 2026-11-10T07:55:43Z | 0 | 2 |
| Make B | 8709610 | 1000 | 2026-09-19T08:56:04Z | 2026-10-19T08:56:04Z | 0 | 2 |

Both are unpaused, auto-purchasing disabled, 100000 unused centicredits, zero reported consumption. Credits are NOT the present blocker.

## Make A notification topology and quarantine
- 5901592 `02_KK_TELEGRAM_CONTROL`: legacy router, outbound Telegram and Sheets writer modules disabled, quarantine 2026-10-12.
- 6176241 `03_KK_OWNER_TELEGRAM_LEDGER_TRANSPORT`: on-demand legacy ledger reader; Telegram send #2, retry #4, success writer #3 disabled, P0 HOLD 2026-10-13. Latest surfaced execution 2026-09-15, 1-credit poll, **not** proof of delivery.
- 6600107 `KK_OWNER_EVENT_DRIVEN_GATEWAY_V1_STAGING_BLOCKED`: webhook trigger #1, signed Prepare #3 disabled, Telegram #4 disabled, ACK #5 disabled, webhook response #2 retains fail-closed 503. P0 HOLD.
- 5911509 deprecated Gemini Scout and 6274697 legacy CRM sync are also held; **never** activate as a notification shortcut.
- Make Telegram/Google connections return `ok`, not proof of sending or receiving.

## LINE direct path (independent of Make)
- `server/line-booking-owner-approval.js` readiness requires `KK_LINE_BOOKING_AUTOMATION_ENABLED`, valid `KK_ADMIN_SCRIPT_URL`, `KK_ADMIN_API_KEY`, `LINE_CHANNEL_ACCESS_TOKEN`, approval secret, owner user/target ID.
- `notifyOwner` pushes a Flex approval card to the owner through LINE API. `processOwnerPostback` verifies signed decision and owner identity, calls Apps Script, checks status readback, then sends customer result.
- `server/kk-line-messaging-api.js` implements a retry-key-based LINE push for Inbox, but that is **not evidence** the owner approval path is active.
- `api/line-webhook.js` preserves raw bytes for LINE signature verification.
- Actual production environment values, webhook delivery, provider response, owner receipt and booking idempotency are **not yet verified**.

## Recovery execution sequence (zero paid services)
1. Read-only inspect deployed Vercel env *presence* and production revision, LINE webhook response and logs, Apps Script version/readback, and current notification queue without exposing tokens or customer data.
2. Test LINE owner notification with mocked provider and controlled synthetic signed webhook in isolated environment; require missing-config fail-closed, unauthorized owner rejection, no booking write on bad signature, duplicate-event idempotency.
3. Test Telegram signed Prepare/outbox/ACK with mock transport: invalid signature, expired TTL, replay, duplicate ACK, retry-after-provider-error, wrong notification ID and stale queue must all fail closed.
4. Repair replacement gateway in a dedicated branch, not legacy Scenario 5901592 or 6176241. Require exact-head CI, signed E2E, owner-only target and UAT.
5. Enable at most one verified replacement per Make Free account, with credit budget and kill switch. Never activate all 16 or replay old runs.
6. Validate one explicitly controlled owner test notification on LINE and Telegram, record provider request ID, owner receipt, queue state transition and rollback evidence. No synthetic customer booking left behind.
7. Only after owner UAT and acceptance, turn on production flags/Scenario. Do not infer success from HTTP 200 alone.

## Governance
- No spending, no merge/deploy, no customer messaging or booking writes until gated acceptance.
- No auto-confirm/reject booking, no X posting.
- Current status is **blocked pending implementation and production verification**, not completed.
