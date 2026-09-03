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
Make lastEdit after patch: `2026-09-03T18:23:18.631Z`
Scenario state after readback: **ACTIVE**, incomplete executions: 0.

### Route-D change

Module `15 — Search TEAM Duplicates` now excludes commands starting with `/team PREVIEW` from the old generic TEAM intake route.

Reason: avoid creating a sixth duplicate `_AI_Inbox=NEW` preview row while the five historical preview inputs remain unreconciled.

### New module 20 — Content lookup

`google-sheets:filterRows`

- Reads `_Content_Staging` from the live Event/AI Machine SOT.
- Accepts owner-only `/team PREVIEW <callback-token>` in Telegram chat `-5405977132`.
- Matches callback token in column O and requires `STATUS=DRAFT`.
- Limit = 1.

### New module 21 — Telegram preview with Inline Keyboard

`telegram:SendReplyMessage`

The new preview renders the three content bodies and attaches these inline actions:

- `1️⃣ เลือกแบบ 1`
- `2️⃣ เลือกแบบ 2`
- `3️⃣ เลือกแบบ 3`
- `✅ อนุมัติ`
- `✏️ แก้ไข`
- `❌ ปฏิเสธ`
- `🚫 ยกเลิก`

Callback payloads are short token-bound values:

- `KKC|S1|<callback-token>`
- `KKC|S2|<callback-token>`
- `KKC|S3|<callback-token>`
- `KKC|APP|<callback-token>`
- `KKC|REV|<callback-token>`
- `KKC|REJ|<callback-token>`
- `KKC|CAN|<callback-token>`

The preview itself warns that this is a temporary staging-only bridge and does not authorize X/LINE/customer publishing.

### New module 22 — Callback staging intake

`google-sheets:addRow`

Owner-only Telegram callbacks (`callback_query`) are appended to `_Command_Queue` with:

- `STATUS=RECEIVED_TEMP_UI`
- `REQUESTED_OUTCOME=TEMP_PHASE_D_UI_CALLBACK`
- callback token preserved in `RAW_COMMAND`
- Telegram callback query ID and preview message ID preserved in `NOTES`
- `temporary_compatibility_path=true`
- `canonical_phase_d_scenario=5988323`
- `no_external_publish=true`
- `no_line_send=true`
- `no_customer_send=true`

This status is intentionally non-canonical so an existing production worker should not treat the temporary callback as a final approval/publish instruction.

### New module 23 — Telegram callback acknowledgement

`telegram:UniversalAPICall` calls `answerCallbackQuery` so button presses do not remain spinning in Telegram.

The acknowledgement explicitly describes approval as `staging only, ยังไม่ publish` when the temporary APPROVE button is pressed.

## Safety boundary

This temporary bridge does **not**:

- set `_Content_Staging.EXTERNAL_SEND_AUTHORIZED=true`;
- set `_Content_Staging.PRODUCTION_PUBLISH_AUTHORIZED=true`;
- publish to X;
- send LINE/customer messages;
- release historical Notification Ledger quarantine;
- claim canonical Phase-D completion;
- replace scenario `5988323` as the target architecture.

The callback path records owner intent only.

## Verification completed

Fresh Make readback after patch confirmed:

- scenario `5901592` remains ACTIVE;
- new modules `20`, `21`, `22`, `23` exist in the blueprint;
- module `21` stores `replyMarkupAssembleType=reply_markup_enter` and the full `inline_keyboard` JSON;
- module `22` stores `_Command_Queue` staging mappings and owner/chat callback filter;
- module `23` stores `answerCallbackQuery` mapping;
- Telegram and Google connections report `status=ok`.

The Make save returned warnings that also reference pre-existing Telegram modules and describe mapper fields under `parameters`; fresh `scenario_module_get` readback confirmed the required mapper values are actually stored. This is therefore treated as **CONFIG_READBACK_PASS / RUNTIME_BUTTON_EXERCISE_PENDING**, not provider-runtime PASS.

## Runtime test still required

Previously sent Telegram messages cannot acquire inline buttons retroactively from this patch.

To exercise the temporary UI, send a **new** command using the existing content token, for example:

`/team PREVIEW 1c830e214878f883a92e5f42`

Under the patched route this command is excluded from the old `_AI_Inbox` route, so it should not create the historical sixth duplicate intake row. It should instead read the existing DRAFT content and return a new Telegram preview with the inline keyboard.

After one button press, verify exactly one temporary callback row in `_Command_Queue` and verify no production authorization/publish state changed.

## Codex cleanup / migration requirement

When access to canonical scenario `5988323` is restored, Codex should:

1. audit the exact canonical Phase-D blueprint;
2. implement the inline keyboard and callback handling there with exact `token + version + Telegram chat + Telegram message_id + approval fingerprint` binding;
3. enforce stale/duplicate callback rejection;
4. implement true SELECT/APPROVE/REVISE/REJECT/CANCEL state transitions under canonical protected-write/readback rules;
5. ensure APPROVE still does not publish until the downstream creative/X gates authorize it;
6. reconcile any `RECEIVED_TEMP_UI` rows created by this bridge;
7. remove/disable modules 20–23 and restore `5901592` to owner-intake-only scope after canonical runtime UAT passes.

Do not leave two Phase-D callback writers active after cutover.
