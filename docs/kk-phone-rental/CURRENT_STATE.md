# KK Phone Rental — Current State Checkpoint

Checkpoint: 2026-09-04 01:25 Asia/Bangkok
Branch: `skills/x-scanner-v2`

> Live highest Active `_Policy_Registry`, Machine SOT, provider/runtime state and exact readback are authoritative. This file is a continuity mirror only.

Detailed references:

- Full system audit: `docs/kk-phone-rental/FULL_SYSTEM_AUDIT_2026-09-04.md`
- Previous phase audit: `docs/kk-phone-rental/PHASE_AUDIT_2026-09-03.md`
- Temporary Telegram button bridge: `docs/kk-phone-rental/TEMP_TELEGRAM_INLINE_UI_BRIDGE_2026-09-04.md`

## Operating workflow

`READ DOC -> RECONCILE LIVE STATE -> EXECUTE NEXT ACTION -> READBACK/VERIFY -> WRITE BACK DOC -> SET NEXT ACTION`

Do not rebuild Core v1. Fail closed when authority, ownership, fencing, provider access or runtime evidence is ambiguous.

## Overall state

**Classification: SAFE CORE / PHASE A COMPLETE / TEMP TELEGRAM UI BRIDGE CONFIGURED / PHASE C-D CANONICAL RUNTIME STILL INCOMPLETE.**

- Core v1: `RUNTIME_VERIFIED / COMPLETE / PRESERVE`.
- Phase A: `RUNTIME STEADY-STATE VERIFIED / COMPLETE`.
- Scanner, Verifier and Canary Scheduled Tasks are enabled.
- Phase B remains partial because live CRM/booking/inventory truth is not yet governed into Event Machine-SOT Business Brain decisions.
- Phase C content generation is local/synthetic PASS with real DRAFT staging content.
- Phase D canonical runtime remains incomplete because Make scenario `5988323` is inaccessible through the current identity.
- Phase E X publish remains provider-runtime pending.
- Phase F CRM/booking backend is real and operational but unified AI/CRM E2E is incomplete.
- Phase G remains staging-only.

## Data authority

### AI / Event / Policy Machine SOT

Spreadsheet: `1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo`

Exactly one Active policy remains `v4.9.2 BALANCED SOURCE COVERAGE`.

### Web / CRM / Booking backend

Spreadsheet: `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`

This is the application/CRM backend used by GitHub/Vercel for bookings, events, assets, packages, web output, customer/admin health and related operational data.

The two data domains must remain explicit; do not create a second canonical inventory/booking writer.

## Core v1

Canonical verified chain remains:

`Scanner -> Verifier -> Google Sheet -> Notification Ledger -> Telegram + LINE`

No Core-v1 rebuild was performed.

## Runtime / Make containment

### `5911509 — 01_KK_GEMINI_SCOUT`

Must remain **INACTIVE / CONTAINED**.

Fresh audit confirmed legacy bypasses still exist in that scenario, including direct AI/GPT-result owner transport and historical quarantine-to-SENT behavior. Do not reactivate it as a production transport path.

### `5901592 — 02_KK_TELEGRAM_CONTROL`

Status: **ACTIVE**.

It remains the visible Telegram owner-intake scenario. On 2026-09-04 a temporary compatibility bridge was added because the owner explicitly requested usable inline buttons before Codex completes the canonical Phase-D migration.

Temporary Make lastEdit after patch: `2026-09-03T18:23:18.631Z`.

### `5988323`

Still the canonical Phase C/D owner-control target.

Current Make identity cannot read it because provider access requires `organization view`. Do not claim it is deleted and do not permanently substitute `5901592` for it.

## Temporary Telegram Inline Preview UI Bridge

Status: **CONFIG_READBACK_PASS / PROVIDER RUNTIME BUTTON EXERCISE PENDING**.

Changes applied to scenario `5901592`:

1. Generic `/team` intake route now excludes `/team PREVIEW` so testing the temporary preview path does not create a sixth historical `_AI_Inbox=NEW` duplicate.
2. New module 20 reads `_Content_Staging` by callback token and requires `STATUS=DRAFT`.
3. New module 21 sends the three content variants with a Telegram Inline Keyboard.
4. Buttons now configured:
   - `1️⃣ เลือกแบบ 1`
   - `2️⃣ เลือกแบบ 2`
   - `3️⃣ เลือกแบบ 3`
   - `✅ อนุมัติ`
   - `✏️ แก้ไข`
   - `❌ ปฏิเสธ`
   - `🚫 ยกเลิก`
5. New module 22 records button intent into `_Command_Queue` with `STATUS=RECEIVED_TEMP_UI` and explicit no-publish/no-LINE/no-customer guards.
6. New module 23 calls Telegram `answerCallbackQuery` so pressed buttons receive acknowledgement instead of remaining in a loading state.

Callback payloads are token-bound (`KKC|S1|...`, `KKC|APP|...`, etc.).

### Temporary bridge safety boundary

The bridge does **not**:

- set `EXTERNAL_SEND_AUTHORIZED=true`;
- set `PRODUCTION_PUBLISH_AUTHORIZED=true`;
- perform true canonical SELECT/APPROVE state transitions;
- publish X;
- send LINE/customer messages;
- release Notification Ledger quarantine;
- make Phase D COMPLETE.

The temporary APPROVE button records owner intent only and acknowledges `staging only, ยังไม่ publish`.

Previously sent Telegram messages cannot gain inline buttons retroactively. A new `/team PREVIEW <token>` delivery is required to exercise the patched UI.

Current known DRAFT token available for controlled exercise:

`1c830e214878f883a92e5f42`

Expected command:

`/team PREVIEW 1c830e214878f883a92e5f42`

Because PREVIEW is now excluded from the legacy generic TEAM route, this test should not create the historical sixth `_AI_Inbox` duplicate. After one button press, verify one `RECEIVED_TEMP_UI` row in `_Command_Queue` and verify production authorization fields remain false.

## Existing historical preview issue

Five earlier preview requests remain unreconciled in `_AI_Inbox=NEW` with Telegram message IDs:

- 201
- 203
- 205
- 207
- 218

These historical rows must be reconciled during canonical Phase-D migration. Do not rewrite them merely to make status appear clean.

## Codex migration requirement for Phase D

When `5988323` access is restored, Codex must:

1. audit the exact canonical blueprint;
2. implement the inline keyboard there;
3. bind callbacks to exact `token + content version + Telegram chat + Telegram message_id + approval fingerprint`;
4. enforce stale and duplicate callback rejection;
5. implement true SELECT / APPROVE / REVISE / REJECT / CANCEL transitions under protected-write/readback rules;
6. keep X publishing behind downstream creative/provider gates;
7. reconcile any `RECEIVED_TEMP_UI` rows from the temporary bridge;
8. remove/disable Make modules 20–23 from `5901592` after canonical runtime UAT passes;
9. restore `5901592` to owner-intake-only scope so two Phase-D callback writers are never active simultaneously.

## Phase B / CRM gap

The real CRM backend contains booking, asset and package availability, but Event Machine SOT Business Brain still has historical `inventory feed unavailable` / `CRM feed unavailable` states.

Required architectural fix: create an authority-safe read/projection contract from CRM backend to Event Machine-SOT decisions without creating a competing inventory writer.

## CRM health fix already applied

`Booking risk not OK` false count was corrected from 128 to 3 by gating the health formula on real nonblank booking rows. The remaining three historical records were preserved; no customer data was invented.

Other CRM items still requiring dedicated work:

- one unavailable asset needs operations confirmation;
- recent admin price-override lock contention needs review;
- spreadsheet timezone remains `Etc/GMT` and must not be changed without regression testing.

## GitHub / application state

Repo: `mikesd1995/kk-phone-rental-vercel`
Branch: `skills/x-scanner-v2`

Draft PR #1 remains unmerged. No `main` merge is authorized.

Known application gap: Rental Analytics V4 company/affiliation semantics still conflict with current Machine-SOT foreign-performer organizer/promoter rules. Do not fix with guessed heuristics; project authoritative company/organizer data first.

Syntax-check coverage was already expanded on this branch to include rental analytics JavaScript files, but a config change is not by itself runtime/CI PASS evidence.

## X Scanner V2.1

Status: **STAGING_REVIEWED / NOT RUNTIME INSTALLED**.

On-demand only, exact-event first, existing `EVIDENCE_VERIFIER` promotion gate, `CONTENT_GATE=PASS`, no hourly Core hook and no automatic publish/owner-send.

## Current priority order

### P0

1. Keep `5911509` inactive and determine why it was externally reactivated.
2. Restore Make organization/team access to canonical scenario `5988323`.
3. Runtime-exercise the temporary button UI once, verify `_Command_Queue` staging readback and zero production authorization mutation.
4. Reconcile the five historical preview inputs during canonical Phase-D migration.

### P1

1. CRM/booking/assets -> Event Machine-SOT governed availability/collision integration.
2. Canonical Phase C/D runtime UAT under `5988323`.
3. Real Canva design/source binding.
4. Controlled X provider publish/readback after exact content + creative approval.
5. Booking/KYC/LINE E2E.
6. Live Outcome Learning.

## Explicit non-actions

- No Core v1 rebuild.
- No merge to `main`.
- No true production approval/publish from the temporary Telegram bridge.
- No X/LINE/customer send from temporary callbacks.
- No bulk quarantine release.
- No invented CRM/customer/event data.
- No blind timezone change.
- No claim that Phase D is complete until canonical runtime UAT passes.
