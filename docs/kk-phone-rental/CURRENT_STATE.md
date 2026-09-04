# KK Phone Rental — Current State Checkpoint

Checkpoint: 2026-09-04 17:35 Asia/Bangkok
Branch: `skills/x-scanner-v2`

> Live highest Active `_Policy_Registry`, Machine SOT, provider/runtime state and exact readback are authoritative. This file is a continuity mirror only.

Read first:
- `docs/kk-phone-rental/ALL_PHASES_COMPLETION_LOG_2026-09-04.md`
- `docs/kk-phone-rental/FULL_SYSTEM_AUDIT_REPAIR_2026-09-04.md`
- `docs/kk-phone-rental/CRM_MACHINE_SOT_PROJECTION_CONTRACT.md`
- `docs/kk-phone-rental/TEMP_TELEGRAM_INLINE_UI_BRIDGE_2026-09-04.md`

## Operating rule

`READ DOC -> RECONCILE LIVE STATE -> EXECUTE NEXT ACTION -> READBACK/VERIFY -> WRITE BACK DOC -> SET NEXT ACTION`

Do not rebuild Core v1. Fail closed when authority, ownership, fencing, provider access, exact identity or runtime evidence is ambiguous.

## Current classification

**CORE SAFE / B–G IMPLEMENTATION HARDENED / REAL EVIDENCE PRESERVED / EXTERNAL PROVIDER-PERMISSION-EVIDENCE GATES FAIL-CLOSED.**

- Core v1: `RUNTIME_VERIFIED / COMPLETE / PRESERVE`.
- Phase A: ordinary runtime proof complete; canonical task enabled-state has recurring unexplained drift and is a P0 control-plane incident.
- Phase B: real CRM→Machine-SOT availability proof completed; governed adapter/test suite exists.
- Phase C text: exact NONT V2 owner approval committed and provider-evidenced.
- Phase C creative: exact binding guard complete; final official poster/hash→Canva binding not yet proven.
- Phase D: temporary Telegram/Make path hardened and provider-proven; canonical scenario `5988323` remains organization-view permission blocked.
- Phase E: exact X authorization/provider receipt guard complete; no X provider post evidence and production flags remain false.
- Phase F: governed Booking/KYC intake guard complete; canonical CRM backend is real; no real KYC authority/attestation E2E is available yet.
- Phase G: governed final outcome projector complete; `_Business_Outcome` remains empty because no safe exact eligible post-event crosswalk/evidence was found.

## Authority

### Machine SOT
`1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo`

Exactly one Active `POLICY_VERSION`: `v4.9.2 BALANCED SOURCE COVERAGE`.

Company semantic rule:
`THAI_TALENT_AFFILIATION|FOREIGN_EVENT_ORGANIZER`.

### CRM / Booking SOT
`12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`

Canonical for bookings, assets, packages and current CRM availability. Do not create a competing inventory/booking writer.

CRM timezone remains `Etc/GMT`; no blind change without dedicated regression.

## Current implementation fencing

Prior stale implementation lease v167 was released by stale recovery.

Current implementation wave used monotonic lease v168:
- holder `CHATGPT-20260904T160400-ALLPHASES-R2`;
- token `CX-20260904T160400-ALLPHASES-R2-V168`;
- heartbeat/readback performed before final protected work.

Historical lock rows are preserved.

## Scheduled tasks / Phase A

Canonical task IDs only:
- Scanner `6a992c91ba688191ad428cbdc2e8cf35` — hourly `:00`;
- Verifier `6a992d4d0c248191914e6c73c4f17db4` — hourly `:30`;
- Canary `6a992bbe16d081918553ca3eb7f81058` — daily 08:15 Asia/Bangkok.

Scanner/Verifier repeatedly become disabled after being restored. Root actor/cause is not proven. Never create duplicate schedules or fabricate missed-window runs. Restore only the existing canonical tasks after fresh ownership checks and continue investigating the control plane separately.

## Phase B — CRM / Business Brain

OH MY FOURTH CONCERT 16–18 Oct 2026 was used for a real exact-identity integration proof.

Current CRM proof per date:
- phone available = 2;
- ZEISS G1 lens available = 2;
- bundle available = 2;
- G2 rentable = 0 because `LENS-002` is inactive.

Machine `_Inventory_Collision` was refreshed from real CRM data and exact-read back.

Transaction:
`TX|CRM_PROJECTION|OHMYFOURTH|20260904T1142` — COMMITTED.

Code:
- `lib/kk-crm-projection.js`
- `scripts/kk-crm-projection.test.js`
- actual execution **7/7 PASS**.

No fuzzy join and no PII projection.

## Company semantics

Added strict policy-aligned module:
- `lib/kk-company-semantics.js`
- `scripts/kk-company-semantics.test.js`
- actual execution **6/6 PASS**.

Thai performer uses talent affiliation; foreign performer uses local organizer/promoter. Unknown origin fails closed. No name-based inference.

Legacy `api/kk-rental-dashboard.js` still contains historical affiliation inference. It is **not authoritative** for current Machine-SOT company semantics until migrated to the strict module/authoritative fields.

## NONT V2 content state

`CONTENT|NONTENCORE|20261003-04|X|V2`

Current state:
- `STATUS=APPROVED`;
- selected variant `1`;
- selected angle `THEME`;
- Telegram message `229`;
- callback token `2a268b61b806d5df8d45311c`;
- approval fingerprint `305d014bbec42d057960ec9d71475ec87cd75498f6dd37a81ca58ff30f6b89f7`;
- `LAST_ACTION=APPROVED_VARIANT_1`;
- `EXTERNAL_SEND_AUTHORIZED=FALSE`;
- `PRODUCTION_PUBLISH_AUTHORIZED=FALSE`.

Owner approval transaction:
`TX|CONTENT|NONTENCORE|V2|OWNER_APPROVAL|20260904T1130` — COMMITTED with exact readback.

Do not reuse V1 approval for V2.

## Phase C creative

Added:
- `lib/kk-creative-binding-guard.js`
- `scripts/kk-creative-binding-guard.test.js`
- actual execution **8/8 PASS**.

Publish-eligible creative requires exact version/fingerprint/body plus official/authorized source asset ref + SHA-256, Canva design ID and creative SHA-256. Placeholder/generic art is rejected.

Eventpop is authoritative for NONT event facts/hashtags, but an exact official poster asset URL/hash has not yet been safely bound. Therefore creative remains fail-closed and NONT publish flags remain false.

## Phase D — Telegram owner control

### `5901592 — 02_KK_TELEGRAM_CONTROL`
Temporary compatibility path only; ACTIVE at last Make reconcile.

Hardened properties:
- exact V2 token/chat/message/owner gate;
- content must still be `DRAFT` before new callback intent is accepted;
- exact callback-ID dedup via `chat + message + callback_query_id`;
- no external publish / LINE / customer send.

Real V2 callback evidence:
- S1 selection succeeded;
- APP1 approval succeeded;
- exact `_Command_Queue` audit rows exist without duplicate callback IDs.

Telegram message 229 provider-side terminal edit:
- HTTP 200 / `ok=true`;
- same message 229;
- text ends `🔒 ✅ อนุมัติแบบ 1 แล้ว`;
- keyboard removed.

### `6144260 — TEMP_KK_PREVIEW_ONESHOT_20260904`
INACTIVE after controlled provider edit.

### `5911509 — 01_KK_GEMINI_SCOUT`
INACTIVE / CONTAINED. Do not reactivate legacy direct-send/HOLD bypass behavior.

### Canonical `5988323`
Current Make identity cannot read it: `organization view` permission required. Do not call it deleted and do not make `5901592` the permanent canonical substitute.

## Phase E — X

Added:
- `lib/kk-x-publish-guard.js`
- `scripts/kk-x-publish-guard.test.js`
- actual execution **11/11 PASS**.

Authorization requires APPROVED exact content, both production flags true, exact creative binding and idempotency. `PUBLISHED` requires provider acknowledgment + post ID + post URL + receipt time.

Current provider truth: no X provider post receipt for NONT. Flags remain FALSE/FALSE. No public post was made just to create PASS.

A Metricool connector option was surfaced but is not installed/authorized in this session.

## Phase F — Booking / KYC / LINE

Added/hardened:
- `lib/kk-booking-intake-guard.js`
- `scripts/kk-booking-intake-guard.test.js`
- actual hardened execution **14/14 PASS**.

KYC no longer accepts a naked boolean. It requires opaque evidence-bound attestation:
- verified true;
- exact subject ref;
- evidence ref;
- authority;
- verified timestamp.

Other gates enforce exact CRM event/package, CURRENT governed availability, inventory availability, request idempotency, no raw PII and write through the existing canonical CRM API only.

The audited CRM schema has no dedicated KYC authority table. No real customer booking/KYC/LINE test was fabricated.

## Phase G — Outcome Learning

`_Business_Outcome` currently has header/schema only. No fake zero row was created.

Added/hardened:
- `lib/kk-outcome-projector.js`
- `scripts/kk-outcome-projector.test.js`
- actual hardened execution **14/14 PASS**.

The projector requires exact Machine↔CRM identity and exact CRM event snapshot. PRE_EVENT snapshots cannot become final learning rows. X is tri-state and requires provider evidence when known. Accounting revenue is not inferred from amount received. Unproved metrics remain null.

No safe exact completed/post-event lifecycle↔CRM crosswalk was found. The exact Hao Yiran overlap is not yet a valid post-event outcome. Correct state: no final outcome row.

## Governed project check

`package.json` now runs governed syntax/tests for:
- CRM projection;
- Booking/KYC guard;
- Outcome projector;
- Company semantics;
- Creative binding;
- X publish/provider guard.

This strengthens merge/Codex review coverage. Individual code tests are not provider proof.

## GitHub / PR

Repo: `mikesd1995/kk-phone-rental-vercel`
Branch: `skills/x-scanner-v2`
PR #1: Draft/open/unmerged.

`main` merge is not authorized.

PR text is older than this checkpoint; use this file and `ALL_PHASES_COMPLETION_LOG_2026-09-04.md` for current review context.

## External blockers only

1. **Control plane:** unknown actor repeatedly disables existing Scanner/Verifier tasks.
2. **Make canonical D:** organization-view access to scenario `5988323`.
3. **Creative:** exact official NONT poster asset/hash and final Canva binding.
4. **X:** authenticated provider connection and real post receipt.
5. **KYC/LINE:** real authoritative KYC attestation source + actual customer flow.
6. **Outcome:** first exact eligible post-event CRM↔Machine event and evidence.
7. **Legacy Analytics:** endpoint migration from name heuristics to strict authoritative company semantics.

These are not papered over with synthetic production records.

## Explicit non-actions

- no Core v1 rebuild;
- no duplicate Scanner/Verifier/Canary;
- no new canonical Phase-D worker;
- no merge to `main`;
- no bulk quarantine release;
- no invented CRM/customer/company/event data;
- no PII copied into Machine SOT/docs;
- no blind timezone change;
- no generic creative promoted as official;
- no X/LINE/customer send to manufacture PASS;
- no fabricated Business Outcome;
- no provider PASS without provider evidence.
