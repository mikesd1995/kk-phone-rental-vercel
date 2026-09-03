# KK Phone Rental — Temporary Telegram Inline Preview UI Bridge

Date: 2026-09-04 Asia/Bangkok
Status: **TEMPORARY COMPATIBILITY BRIDGE / TELEGRAM PREVIEW RUNTIME PASS / CALLBACK RUNTIME TEST PENDING**
Canonical Phase-D owner-control target remains Make scenario `5988323`.

## Purpose

The owner requested real Telegram Inline Keyboard controls for the three content choices before Codex completes the canonical Phase-D migration. The canonical scenario `5988323` remains inaccessible to the current Make identity because provider access requires `organization view` permission.

This bridge lives temporarily inside `5901592 — 02_KK_TELEGRAM_CONTROL`. It is not the final owner-control architecture and must be removed after canonical Phase-D runtime UAT passes.

## Temporary runtime design

### Generic TEAM route containment

Module `15 — Search TEAM Duplicates` excludes `/team PREVIEW` so preview tests do not create new legacy `_AI_Inbox` rows.

### Module 20 — Content lookup

`google-sheets:filterRows`

- Live sheet: `_Content_Workspace_STAGING`
- Owner-only `/team PREVIEW <callback-token>`
- Telegram chat: `-5405977132`
- Callback token match in column O
- Requires `STATUS=DRAFT`
- Limit 1

The first implementation mistakenly referenced `_Content_Staging`. Runtime exercise failed with:

`400: INVALID_ARGUMENT - Unable to parse range: '_Content_Staging'!O2:O1000000`

Live spreadsheet metadata proved the real tab is `_Content_Workspace_STAGING` with 2,000 rows and 30 columns. Module 20 was corrected to that live tab.

### Module 21 — Telegram preview + Inline Keyboard

The preview renders three variants and these buttons:

- `1️⃣ เลือกแบบ 1`
- `2️⃣ เลือกแบบ 2`
- `3️⃣ เลือกแบบ 3`
- `✅ อนุมัติ`
- `✏️ แก้ไข`
- `❌ ปฏิเสธ`
- `🚫 ยกเลิก`

Callback payloads are token-bound:

- `KKC|S1|<callback-token>`
- `KKC|S2|<callback-token>`
- `KKC|S3|<callback-token>`
- `KKC|APP|<callback-token>`
- `KKC|REV|<callback-token>`
- `KKC|REJ|<callback-token>`
- `KKC|CAN|<callback-token>`

### Module 22 — Temporary callback staging intake

Owner callbacks append to `_Command_Queue` with:

- `STATUS=RECEIVED_TEMP_UI`
- `REQUESTED_OUTCOME=TEMP_PHASE_D_UI_CALLBACK`
- callback token preserved
- callback query ID and preview Telegram message ID preserved
- `temporary_compatibility_path=true`
- `canonical_phase_d_scenario=5988323`
- no X publish
- no LINE/customer send

### Module 23 — Callback acknowledgement

Calls Telegram `answerCallbackQuery` so a pressed button receives an acknowledgement. Temporary APPROVE acknowledgement explicitly states staging-only and not published.

## Runtime exercise result — PASS for preview delivery

### First exercise

The owner sent `/team PREVIEW 1c830e214878f883a92e5f42`.

The update reached module 20 but failed because of the stale `_Content_Staging` tab reference. No Telegram preview was sent and no production mutation occurred.

### Repair

Module 20 was repointed to the live `_Content_Workspace_STAGING` tab. The prior failed run had placed Make scenario `5901592` into `error` state, so the scenario was explicitly re-activated. Make confirmed it was active again.

### Second exercise / provider readback

After re-activation, Make successfully executed the repaired preview flow:

`Telegram WatchUpdates -> module 20 content lookup -> module 21 SendReplyMessage`

Provider output proved the Telegram message contained a real `reply_markup.inline_keyboard` with all seven configured buttons.

Successful Telegram provider message IDs:

- `224`
- `225`

Both messages contained version `CONTENT|NONTENCORE|20261003-04|X|V1` and callback token `1c830e214878f883a92e5f42`.

### Why two previews were sent

Make re-activation replayed the earlier failed Telegram delivery while also processing the newer accepted owner delivery. This produced two successful preview executions at nearly the same time and therefore two equivalent Telegram preview messages.

This is a temporary-bridge idempotency/stale-message limitation and is additional evidence that the canonical Phase-D implementation must bind callbacks to exact `token + version + Telegram message_id + approval fingerprint` and reject stale/duplicate callbacks.

For temporary testing, use the latest preview (`message_id=225`) and ignore the older duplicate (`224`).

## Safety readback after runtime delivery

Exact live readback confirmed:

- `_AI_Inbox` still contains exactly the same five historical matching preview requests only: Telegram message IDs `201`, `203`, `205`, `207`, `218`.
- No sixth `_AI_Inbox` duplicate was created by the temporary PREVIEW route.
- `_Content_Workspace_STAGING.STATUS` remains `DRAFT`.
- `EXTERNAL_SEND_AUTHORIZED=false`.
- `PRODUCTION_PUBLISH_AUTHORIZED=false`.
- No X publish, LINE/customer send, or quarantine release occurred.

Current classification:

**TELEGRAM INLINE PREVIEW = PROVIDER RUNTIME PASS**

**TEMPORARY CALLBACK ACTION = CONFIGURED / BUTTON-PRESS RUNTIME TEST PENDING**

Canonical Phase D remains incomplete.

## Next controlled test

Press exactly one button on the latest Telegram preview (`message_id=225`). Recommended first test: `1️⃣ เลือกแบบ 1`.

Then verify:

1. exactly one new `_Command_Queue` row with `STATUS=RECEIVED_TEMP_UI`;
2. callback query ID and Telegram preview message ID are preserved;
3. Telegram callback acknowledgement succeeds;
4. `_Content_Workspace_STAGING` production authorization fields remain false;
5. no X/LINE/customer provider action occurs.

Do not use temporary `✅ อนุมัติ` as production authorization; it records owner intent only.

## Codex cleanup / canonical migration requirement

When access to scenario `5988323` is restored, Codex must:

1. audit its exact canonical Phase-D blueprint;
2. implement Inline Keyboard there;
3. bind callbacks to exact `token + content version + Telegram chat + Telegram message_id + approval fingerprint`;
4. reject stale and duplicate preview/callback messages;
5. implement true SELECT / APPROVE / REVISE / REJECT / CANCEL protected state transitions with exact readback;
6. keep X publishing behind downstream creative/provider gates;
7. reconcile temporary `RECEIVED_TEMP_UI` rows;
8. remove/disable temporary modules 20–23 from `5901592`;
9. restore `5901592` to owner-intake-only scope;
10. never leave two Phase-D callback writers active after cutover.
