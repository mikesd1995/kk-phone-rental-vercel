# KK Phone Rental — Temporary Telegram Inline Preview UI Bridge

Date: 2026-09-04 Asia/Bangkok
Status: **TEMPORARY COMPATIBILITY BRIDGE / STAGING-ONLY CALLBACKS**
Canonical Phase-D owner-control target remains Make scenario `5988323`.

## Why this temporary bridge exists

The owner requested Telegram preview choices to have real inline buttons instead of requiring manual `1 / 2 / 3` typing. The canonical Phase C/D Make scenario `5988323` is still inaccessible to the current Make identity because provider access requires `organization view` permission.

The currently visible active intake scenario `5901592 — 02_KK_TELEGRAM_CONTROL` previously accepted `/team` messages into `_AI_Inbox` but had no `callback_query` route and no inline keyboard for content preview messages.

This bridge was added only so the owner can receive and press Telegram Inline Keyboard buttons now. It is explicitly **not** the final Phase-D implementation.

## Runtime change applied

Scenario: `5901592 — 02_KK_TELEGRAM_CONTROL`
Current Make lastEdit after lookup fix: `2026-09-03T18:35:05.288Z`
Scenario state after readback: **ACTIVE**.

### Route-D change

Module `15 — Search TEAM Duplicates` excludes commands starting with `/team PREVIEW` from the old generic TEAM intake route.

Reason: avoid creating a sixth duplicate `_AI_Inbox=NEW` preview row while the five historical preview inputs remain unreconciled.

### Module 20 — Content lookup

`google-sheets:filterRows`

- Reads the live tab `_Content_Workspace_STAGING` from the Event/AI Machine SOT.
- Accepts owner-only `/team PREVIEW <callback-token>` in Telegram chat `-5405977132`.
- Matches callback token in column O and requires `STATUS=DRAFT`.
- Limit = 1.

The first implementation mistakenly referenced `_Content_Staging`. A real Telegram runtime test then failed at module 20 with:

`400: INVALID_ARGUMENT - Unable to parse range: '_Content_Staging'!O2:O1000000`

Live spreadsheet metadata subsequently proved the actual tab name is `_Content_Workspace_STAGING` with 2,000 rows and 30 columns. The DRAFT row and token were read back directly from that live tab, with both `EXTERNAL_SEND_AUTHORIZED=false` and `PRODUCTION_PUBLISH_AUTHORIZED=false`.

Safe fix applied: module 20 was repointed from `_Content_Staging` to `_Content_Workspace_STAGING`. Make accepted the patch with no patch errors. A new owner Telegram update is still required to runtime-exercise the repaired route because this scenario is webhook/event-driven and Make cannot synthesize the owner's incoming Telegram message.

### Module 21 — Telegram preview with Inline Keyboard

`telegram:SendReplyMessage`

The preview renders the three content bodies and attaches these inline actions:

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

The preview warns that this is a temporary staging-only bridge and does not authorize X/LINE/customer publishing.

### Module 22 — Callback staging intake

Owner-only Telegram callbacks are appended to `_Command_Queue` with:

- `STATUS=RECEIVED_TEMP_UI`
- `REQUESTED_OUTCOME=TEMP_PHASE_D_UI_CALLBACK`
- callback token preserved in `RAW_COMMAND`
- callback query ID and preview message ID preserved in `NOTES`
- `temporary_compatibility_path=true`
- `canonical_phase_d_scenario=5988323`
- `no_external_publish=true`
- `no_line_send=true`
- `no_customer_send=true`

### Module 23 — Telegram callback acknowledgement

`telegram:UniversalAPICall` calls `answerCallbackQuery` so button presses do not remain spinning in Telegram.

Approval acknowledgement explicitly says it is staging-only and not published.

## Safety boundary

This temporary bridge does **not**:

- set `_Content_Workspace_STAGING.EXTERNAL_SEND_AUTHORIZED=true`;
- set `_Content_Workspace_STAGING.PRODUCTION_PUBLISH_AUTHORIZED=true`;
- publish to X;
- send LINE/customer messages;
- release historical Notification Ledger quarantine;
- claim canonical Phase-D completion;
- replace scenario `5988323` as the target architecture.

The callback path records owner intent only.

## Verification state

Confirmed:

- `5901592` remains the active Telegram owner-intake scenario;
- modules `20`, `21`, `22`, `23` exist;
- inline keyboard JSON is configured;
- callback staging intake is configured;
- `answerCallbackQuery` is configured;
- live spreadsheet metadata confirms `_Content_Workspace_STAGING` exists with rowCount 2000 / columnCount 30;
- live DRAFT row contains callback token `1c830e214878f883a92e5f42`;
- production authorization fields remain false;
- the failed first button exercise reached module 20 through the intended PREVIEW route and stopped before any Telegram preview send or production mutation;
- module 20 has now been corrected to the live tab name.

Current classification: **LOOKUP ROOT CAUSE FIXED / REPAIRED ROUTE RUNTIME RETEST PENDING**.

## Runtime retest

Send:

`/team PREVIEW 1c830e214878f883a92e5f42`

Expected repaired flow:

Telegram owner update -> PREVIEW compatibility route -> `_Content_Workspace_STAGING` token/DRAFT lookup -> Telegram message with 7 inline buttons.

After one button press, verify exactly one `RECEIVED_TEMP_UI` row in `_Command_Queue`, callback acknowledgement, no sixth historical `_AI_Inbox` preview duplicate, and no production authorization/publish state change.

## Codex cleanup / migration requirement

When access to canonical scenario `5988323` is restored, Codex should:

1. audit the exact canonical Phase-D blueprint;
2. implement inline keyboard and callback handling there with exact `token + version + Telegram chat + Telegram message_id + approval fingerprint` binding;
3. enforce stale/duplicate callback rejection;
4. implement true SELECT/APPROVE/REVISE/REJECT/CANCEL transitions under canonical protected-write/readback rules;
5. ensure APPROVE still does not publish until downstream creative/X gates authorize it;
6. reconcile any `RECEIVED_TEMP_UI` rows created by this bridge;
7. remove/disable modules 20–23 and restore `5901592` to owner-intake-only scope after canonical runtime UAT passes.

Do not leave two Phase-D callback writers active after cutover.
