# KK Phone Rental — Temporary Telegram Inline Preview UI Bridge

Date: 2026-09-04 Asia/Bangkok
Status: **TEMPORARY COMPATIBILITY BRIDGE / TELEGRAM PREVIEW RUNTIME PASS / CALLBACK RUNTIME PASS / CANONICAL PHASE D STILL INCOMPLETE**
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

## Runtime exercise result — preview delivery PASS

The owner sent `/team PREVIEW 1c830e214878f883a92e5f42`.

The first runtime attempt reached module 20 but failed because of the stale `_Content_Staging` tab reference. No Telegram preview was sent and no production mutation occurred.

Module 20 was then repointed to `_Content_Workspace_STAGING`. The prior failure had placed scenario `5901592` into `error` state, so the scenario was explicitly re-activated.

After re-activation, Make successfully executed:

`Telegram WatchUpdates -> module 20 content lookup -> module 21 SendReplyMessage`

Provider output proved the Telegram message contained a real `reply_markup.inline_keyboard` with all seven configured buttons.

Successful Telegram provider message IDs:

- `224`
- `225`

Both messages contained version `CONTENT|NONTENCORE|20261003-04|X|V1` and callback token `1c830e214878f883a92e5f42`.

Make re-activation replayed the earlier failed Telegram delivery while also processing the newer accepted owner delivery, producing two equivalent preview messages. For temporary testing, `225` is the preferred/latest preview and `224` is a duplicate.

## Runtime exercise result — callback PASS

The owner pressed a real inline button on preview message `225`.

Latest verified callback execution:

`Telegram WatchUpdates -> module 22 _Command_Queue addRow -> module 23 answerCallbackQuery`

Latest verified selection was:

- `RAW_COMMAND=KKC|S1|1c830e214878f883a92e5f42`
- `preview_message_id=225`
- callback query id `2209307665265483892`
- `_Command_Queue` row `42`
- `STATUS=RECEIVED_TEMP_UI`
- `REQUESTED_OUTCOME=TEMP_PHASE_D_UI_CALLBACK`
- `APPROVAL_REQUIRED=FALSE`

Telegram acknowledgement readback:

- method `answerCallbackQuery`
- HTTP status `200`
- response `ok=true`, `result=true`
- acknowledgement text: `เลือกแบบ 1 แล้ว — บันทึก staging`

Therefore the temporary button path is provider-runtime proven for both preview delivery and callback acknowledgement.

### Multiple temporary callback rows observed

The callback token currently has 12 `RECEIVED_TEMP_UI` rows in `_Command_Queue` across preview messages `224` and `225`, representing multiple distinct button presses/actions during the interactive test session (`S1`, `S2`, `S3`, `REV`, `APP`, `CAN`). These rows are preserved as audit evidence and are not deleted or rewritten.

This confirms the temporary bridge does not implement canonical single-selection/idempotent state semantics. Codex must reconcile these rows and implement stale/duplicate/action-order guards in the canonical Phase-D worker.

The latest verified owner action is the row-42 `S1` callback on message `225`.

## Safety readback after callback runtime test

Exact live readback confirmed:

- `_Content_Workspace_STAGING.STATUS=DRAFT`.
- `EXTERNAL_SEND_AUTHORIZED=false`.
- `PRODUCTION_PUBLISH_AUTHORIZED=false`.
- No true canonical SELECT/APPROVE mutation occurred.
- No X publish occurred.
- No LINE/customer send occurred.
- No Notification Ledger quarantine release occurred.

The five historical `_AI_Inbox` preview rows remain the same historical set and are not rewritten merely to make status clean.

Current classification:

**TELEGRAM INLINE PREVIEW = PROVIDER RUNTIME PASS**

**TEMPORARY CALLBACK ACTION = PROVIDER RUNTIME PASS**

**CANONICAL PHASE D = INCOMPLETE**

## Codex cleanup / canonical migration requirement

When access to scenario `5988323` is restored, Codex must:

1. audit its exact canonical Phase-D blueprint;
2. implement Inline Keyboard there;
3. bind callbacks to exact `token + content version + Telegram chat + Telegram message_id + approval fingerprint`;
4. reject stale and duplicate preview/callback messages;
5. implement true SELECT / APPROVE / REVISE / REJECT / CANCEL protected state transitions with exact readback;
6. define valid action ordering so multiple button presses cannot create ambiguous owner state;
7. keep X publishing behind downstream creative/provider gates;
8. reconcile the temporary `RECEIVED_TEMP_UI` rows created during this bridge/UAT;
9. remove/disable temporary modules 20–23 from `5901592`;
10. restore `5901592` to owner-intake-only scope;
11. never leave two Phase-D callback writers active after cutover.
