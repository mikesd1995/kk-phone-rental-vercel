# KK Phone Rental — Current State Checkpoint

Checkpoint: 2026-09-04 01:05 Asia/Bangkok
Branch: `skills/x-scanner-v2`

> Live highest Active `_Policy_Registry`, Machine SOT, provider/runtime state and exact readback are authoritative. This file is a continuity mirror only.

Full system audit: `docs/kk-phone-rental/FULL_SYSTEM_AUDIT_2026-09-04.md`
Previous phase audit: `docs/kk-phone-rental/PHASE_AUDIT_2026-09-03.md`

## Operating workflow

`READ DOC -> RECONCILE LIVE STATE -> EXECUTE NEXT ACTION -> READBACK/VERIFY -> WRITE BACK DOC -> SET NEXT ACTION`

Do not rebuild Core v1. Fail closed when authority, ownership, fencing, provider access or runtime evidence is ambiguous.

## Overall state

**Classification: SAFE CORE / PHASE A COMPLETE / BUSINESS-CONTENT-INTEGRATION PARTIAL / NOT END-TO-END COMPLETE.**

- Core v1: runtime verified and preserved.
- Phase A: `RUNTIME STEADY-STATE VERIFIED / COMPLETE`.
- Scheduled Scanner, Verifier and Canary are currently enabled.
- Phase C/D remains blocked before canonical command routing by Make access plus five unreconciled preview inputs.
- A second authoritative operational data domain was confirmed: the Web/CRM backend spreadsheet used by GitHub/Vercel.

## Authority and data domains

### AI/Event/Policy Machine SOT

Spreadsheet: `1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo`

Exactly one Active policy: `v4.9.2 BALANCED SOURCE COVERAGE`.

Current company semantic: Thai performer => talent agency/label/management; foreign performer => local organizer/promoter; organizer remains separately captured.

### Web/CRM/Booking backend

Spreadsheet: `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`
Title: `KK Phone rental backend`.

This is the real application/CRM backend used by `api/kk-data.js` and contains bookings, events, assets, packages, web output, customer stats and admin health/error logs.

Important architecture conclusion: Event/AI Machine SOT and Web/CRM backend are separate data domains. Their authority/synchronization boundary must be explicit.

## Core v1

Status: **RUNTIME_VERIFIED / COMPLETE / PRESERVE**.

`Scanner -> Verifier -> Google Sheet -> Notification Ledger -> Telegram + LINE`

No Core-v1 rebuild was performed.

## Phase A runtime stability

Status: **RUNTIME STEADY-STATE VERIFIED / COMPLETE**.

Evidence includes:

- ordinary Scanner 20:00 run, fencing v202, actual coverage/readback, lease released;
- ordinary following Verifier 20:30 run, fencing v201, correct no-operational-packet semantics, lease released;
- subsequent Verifier monotonic fencing through v204 with readback/release;
- manual Scanner cutover validation v203 released correctly;
- missed slots preserved as gaps rather than fabricated backfills;
- no competing Scanner/Verifier writer proven during cutover observation.

At the full-audit start Scanner and Verifier tasks had drifted to disabled. After confirming no active role-lock conflict, Scanner was re-enabled first and Verifier second. Exact task-state readback confirmed both enabled; Canary remains enabled.

Current cadence:

- Scanner: hourly `:00`.
- Verifier: hourly `:30`.
- Canary: daily 08:15 Asia/Bangkok.

## Make / owner transport

### `5911509` — `01_KK_GEMINI_SCOUT`

Status: **INACTIVE / CONTAINED**.

During the full audit it was unexpectedly found active again. Fresh blueprint inspection confirmed legacy P0 bypasses still existed:

- direct `_AI_Inbox`/GPT result -> Telegram;
- historical `HOLD_TRANSPORT_QUARANTINE` -> Telegram -> mark `SENT`.

Action taken: deactivated again; config/history preserved. The fact that it was externally reactivated is a governance P0 that still needs root-cause/retirement work.

### `5901592` — `02_KK_TELEGRAM_CONTROL`

Status: **ACTIVE owner intake/acknowledgement**.

Its `/team` route writes `_AI_Inbox` and acknowledges; it does not populate the canonical `_Command_Queue`. Do not substitute it for Phase C/D.

### `5988323`

Exact Phase C/D scenario remains inaccessible through current Make identity. Direct access requires `organization view` permission. Do not claim it is deleted.

## Phase C/D routing

Status: **BLOCKED BEFORE CANONICAL COMMAND/JOB ROUTING**.

Five historical `/team PREVIEW 1c830e214878f883a92e5f42` inputs remain `_AI_Inbox=NEW` with Telegram message IDs 201, 203, 205, 207 and 218.

Exact token reconciliation previously showed zero matching rows in `_Command_Queue`, `_Job_Queue_STAGING` and `_Decision_Inbox`.

A real `_Content_Workspace_STAGING` draft exists but remains `EXTERNAL_SEND_AUTHORIZED=false` and `PRODUCTION_PUBLISH_AUTHORIZED=false`.

No sixth preview injection is allowed.

## Phase B / CRM integration

Status: **PARTIAL**.

The CRM backend clearly contains real booking/assets/package availability, but Event Machine SOT `_Inventory_Collision` still carries many `inventory feed unavailable` / `CRM feed unavailable` states.

Main remaining Phase-B integration requirement: define an authority-safe CRM -> Machine-SOT read/projection contract so Business Brain can use real availability/collision data without creating a competing canonical inventory writer.

## CRM health audit and fix

`10_Admin_Health_Check` previously reported `Booking risk not OK = 128`.

Root cause: the formula counted formula-filled blank rows in `00_Master_Booking`, not 128 real bad bookings.

Safe fix applied: gate the count on raw nonblank `event_id` column D.

Exact readback after fix: **3 / CHECK**.

The remaining three are real historical completed bookings with missing customer/contact. They were preserved; no values were invented.

Other current CRM notes:

- one asset is marked unavailable and needs operations confirmation;
- Error Log includes recent safe-fail write-lock contention around admin price override;
- CRM spreadsheet timezone is `Etc/GMT`, not Asia/Bangkok. Do not change it without dedicated formula/Apps-Script/date regression.

## GitHub / application audit

Repo: `mikesd1995/kk-phone-rental-vercel`.
Branch: `skills/x-scanner-v2`.
Draft PR #1 remains open/unmerged. No `main` merge authorized.

### Analytics semantic drift

Rental Analytics V4 still treats talent affiliation as primary and intentionally excludes organizer/promoter as primary. This conflicts with current Machine-SOT foreign-performer semantics.

CRM `01_Events` currently has no organizer/promoter/company field, so do not patch this with guessed heuristics. Required fix is an authoritative Event-SOT -> analytics projection/join, then update dashboard semantics.

### Syntax check coverage fix

Existing `npm run check` omitted the rental analytics files.

Branch-only update now checks:

- `admin/rental-analytics.js`
- `api/kk-rental-dashboard.js`

in addition to existing JavaScript files.

Commit: `e7cfcebacaf2c91b48177173a631713ef5ef608a`.

Readback confirms package.json contains the expanded command. This change improves check coverage but does **not** prove the command has executed/passed; no such claim is made.

## Phase status

- Core v1 — **RUNTIME_VERIFIED / COMPLETE**.
- A Runtime Stability — **RUNTIME STEADY-STATE VERIFIED / COMPLETE**.
- B Business Brain — **PARTIAL; live CRM/inventory not unified into Machine-SOT decisions**.
- C Content + Creative — **LOCAL/SYNTHETIC PASS; runtime UAT blocked before command routing**.
- D Telegram Owner Control — **LOCAL/SYNTHETIC PASS; runtime UAT blocked before command routing**.
- E X Publish — **LOCAL/SYNTHETIC PASS; provider runtime pending**.
- F LINE / Booking / KYC — **PARTIAL; real CRM operational but unified AI/CRM E2E incomplete**.
- G Outcome Learning — **STAGING ONLY; `_Business_Outcome` currently header-only**.

## X Scanner V2.1

Status: **STAGING_REVIEWED / NOT RUNTIME INSTALLED**.

- on-demand only;
- exact-event first;
- existing `EVIDENCE_VERIFIER` promotion gate;
- `CONTENT_GATE=PASS` before three variants;
- no hourly Core hook;
- no automatic publish/owner-send;
- Draft PR only, no `main` merge.

## Canary

Current `_Canary_Suite` contains enabled synthetic tests through CANARY-51. Historical rows report synthetic expected-match results with Production Writes 0.

The current scheduled Canary prompt is stricter and now requires independent assertion evidence, enabled-definition identity/completeness gates and exact readback. Historical synthetic PASS must not be retroactively described as production/provider PASS or as satisfying the new stronger evidence standard without a new compliant run.

## Current P0

1. Restore Make organization/team access to exact scenario `5988323`.
2. Reconcile the five existing preview inputs before any new preview.
3. Keep legacy `5911509` inactive and determine why it was externally reactivated; permanently retire/neutralize the bypass through controlled migration, not ad-hoc deletion.

## Current P1

1. CRM/booking/assets -> Event Machine-SOT availability/collision integration.
2. Analytics company semantics using authoritative projected company/organizer data.
3. Dedicated CRM timezone regression before any timezone change.
4. CRM write-lock/contention review.
5. Confirm whether the one unavailable asset is intentional maintenance/inactive state.
6. One compliant hardened Canary scheduled run/readback.
7. Real Canva design/source binding after C/D runtime preview.
8. One controlled X provider publish/readback after exact content + creative approval.
9. Booking/KYC/LINE E2E and subsequent live outcome capture.

## Changes applied in full audit 2026-09-04

1. Re-deactivated unsafe Make `01_KK_GEMINI_SCOUT` after detecting reactivation.
2. Re-enabled migrated Scanner and Verifier after Phase A steady-state proof; exact task readback confirmed enabled.
3. Upgraded Phase A to COMPLETE from live scheduled fencing/readback/release evidence.
4. Discovered and documented the second Web/CRM backend data domain used by GitHub/Vercel.
5. Fixed CRM Health Check false booking-risk count from 128 to 3 with exact readback.
6. Expanded GitHub syntax-check coverage to both rental analytics JavaScript files on branch only.
7. Added `FULL_SYSTEM_AUDIT_2026-09-04.md` documenting target user requirements, full target flow, actual architecture, gaps, fixes and next work order.

## Explicit non-actions

- No Core v1 rebuild.
- No merge to `main`.
- No sixth preview.
- No substitute Make worker.
- No bulk quarantine release.
- No invented CRM/customer data.
- No blind CRM timezone change.
- No heuristic organizer/company fabrication.
- No production X/customer/provider send to manufacture PASS.

## Next Exact Action

1. Maintain Scanner/Verifier/Canary operation and verify no unexpected task/scenario drift.
2. Restore `5988323` Make visibility and audit its exact blueprint before any controlled run.
3. Reconcile the five preview inputs and perform exactly one Phase C/D runtime UAT.
4. Define and test a read-only/governed CRM inventory/booking projection into Machine-SOT collision/business decisions.
5. Then proceed C/D -> real Canva binding -> controlled X publish -> Booking/KYC/LINE E2E -> live Outcome Learning.
