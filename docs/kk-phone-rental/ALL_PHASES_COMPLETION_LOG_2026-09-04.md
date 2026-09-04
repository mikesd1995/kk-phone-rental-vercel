# KK Phone Rental — All-Phase Implementation Log

Date: 2026-09-04 (Asia/Bangkok)
Branch: `skills/x-scanner-v2`
Authority: live Machine SOT + highest compatible Active policy. This log is a continuity/audit mirror, not runtime authority.

## Executive classification

**IMPLEMENTATION HARDENED ACROSS B–G / REAL RUNTIME EVIDENCE PRESERVED / EXTERNAL PROVIDER-OR-PERMISSION GATES REMAIN FAIL-CLOSED.**

This work intentionally does **not** call every phase provider-complete. Where an external account, exact official media asset, canonical Make permission, KYC attestation or post-event evidence is missing, the implementation now rejects the transition rather than manufacturing PASS.

Core v1 was preserved. No new Scanner/Verifier/Canary was created. `main` was not merged.

## Authority and fencing

- Machine SOT: `1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo`.
- CRM/Booking SOT: `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`.
- exactly one Active `POLICY_VERSION`: `v4.9.2 BALANCED SOURCE COVERAGE`.
- stale implementation lease v167 was normalized to RELEASED after expiry and no later heartbeat.
- fresh monotonic implementation lease v168 acquired as `CHATGPT-20260904T160400-ALLPHASES-R2`, token `CX-20260904T160400-ALLPHASES-R2-V168`.
- heartbeat/readback performed before final protected work.

## Phase A — runtime stability / control plane

Previous ordinary Scanner and Verifier runtime proof remains valid; Core v1 is preserved.

Recurring control-plane drift was observed again: the canonical Scanner and Verifier Scheduled Tasks changed to disabled after being restored. No actor/root cause is proven. No duplicate task was created and no missed slot was backfilled as a fake run.

Canonical task IDs remain:
- Scanner `6a992c91ba688191ad428cbdc2e8cf35` — hourly `:00`.
- Verifier `6a992d4d0c248191914e6c73c4f17db4` — hourly `:30`.
- Canary `6a992bbe16d081918553ca3eb7f81058` — daily 08:15 Asia/Bangkok.

Final cleanup must keep only these canonical tasks and continue to treat repeat disablement as an external/control-plane incident, not a reason to create another runner.

## Phase B — Business Brain / CRM truth

A real governed CRM→Machine-SOT proof was completed using OH MY FOURTH CONCERT, with exact CRM IDs for 16/17/18 Oct 2026.

Live CRM evidence showed per-date current availability:
- 2 `VIVO_X300_PRO` phones;
- 2 `ZEISS_2_35X` lenses;
- 2 phone+lens bundles;
- `LENS-002` G2 is inactive/non-rentable.

`_Inventory_Collision` was refreshed from real CRM truth and exact-read back. CRM remains canonical writer; the Machine SOT projection is read-only.

Protected transaction:
`TX|CRM_PROJECTION|OHMYFOURTH|20260904T1142` — COMMITTED after exact readback.

Branch implementation:
- `lib/kk-crm-projection.js`
- `scripts/kk-crm-projection.test.js`

Actual regression execution: **7/7 PASS**.

Safety properties include exact verified crosswalk only, no fuzzy event-name join, stale/negative/impossible availability rejection, and no customer PII projection.

## Company semantics hardening

Machine policy row 155 is authoritative:
`EVENT_COMPANY_CLASSIFICATION_MODE = THAI_TALENT_AFFILIATION|FOREIGN_EVENT_ORGANIZER`.

Added:
- `lib/kk-company-semantics.js`
- `scripts/kk-company-semantics.test.js`

Actual regression execution: **6/6 PASS**.

The strict module:
- Thai performer → talent affiliation;
- foreign performer → local event organizer/promoter;
- organizer remains a separate field;
- unknown performer origin fails closed;
- no performer-name/company heuristic is used.

Legacy `api/kk-rental-dashboard.js` still contains historical affiliation inference and must not be treated as authoritative company semantics until it consumes this strict projection/module or receives authoritative Event-SOT company fields. The large endpoint was not blindly rewritten without an atomic full-file migration.

## Phase C — exact content and creative gate

NONT TANONT ARENA ENCORE V2 is owner-approved on the exact current version:
- Version ID `CONTENT|NONTENCORE|20261003-04|X|V2`;
- selected variant `1`;
- selected angle `THEME`;
- callback token `2a268b61b806d5df8d45311c`;
- Telegram message `229`;
- approval fingerprint `305d014bbec42d057960ec9d71475ec87cd75498f6dd37a81ca58ff30f6b89f7`;
- state `APPROVED` / `APPROVED_VARIANT_1`.

Owner approval transaction:
`TX|CONTENT|NONTENCORE|V2|OWNER_APPROVAL|20260904T1130` — COMMITTED after exact readback.

Approval evidence is bound to exact S1 + APP1 callback provider/Make executions. V1 approval is not reused for V2.

Added exact creative binding gate:
- `lib/kk-creative-binding-guard.js`
- `scripts/kk-creative-binding-guard.test.js`

Actual regression execution: **8/8 PASS**.

Creative publish eligibility now requires:
- exact APPROVED content version and approval fingerprint;
- exact selected body;
- official/authorized source authority;
- source asset reference + SHA-256;
- Canva design ID;
- creative SHA-256;
- no placeholder/generic art.

Current NONT provider state is intentionally fail-closed because an exact official poster asset URL/hash has not yet been safely bound. Eventpop provides authoritative event facts and official hashtags, but the crawled page did not expose a safe exact poster asset reference usable for this gate. No generic Canva art was promoted to production creative.

## Phase D — Telegram owner control

Temporary compatibility scenario `5901592` was repaired after a validation failure introduced by prior UI-edit branches.

Repairs/evidence:
- isolated failing UI-edit branches were removed;
- scenario returned ACTIVE;
- exact V2 callbacks S1 and APP1 that had queued were preserved and replayed successfully;
- callback command identity uses exact `chat + message_id + callback_query_id` dedup;
- V2 open-state gate requires current content state `DRAFT` before accepting new callback intent;
- after approval, stale message-229 callbacks are therefore closed;
- `_Command_Queue` contains exact S1 and APP1 V2 audit records with no duplicate callback IDs.

Telegram message 229 was edited provider-side after approval:
- HTTP 200;
- `ok=true`;
- same message ID 229;
- visible terminal state `🔒 ✅ อนุมัติแบบ 1 แล้ว`;
- inline keyboard removed.

The one-shot renderer was deactivated immediately after the provider edit.

`5911509 — 01_KK_GEMINI_SCOUT` remains INACTIVE because its legacy direct-send/HOLD behavior is unsafe under current Ledger-only policy.

Canonical Phase-D scenario `5988323` remains inaccessible to the current Make identity with `organization view` permission required. It is not considered deleted and `5901592` is not promoted as the permanent canonical substitute.

## Phase E — X publish boundary

Added:
- `lib/kk-x-publish-guard.js`
- `scripts/kk-x-publish-guard.test.js`

Actual regression execution: **11/11 PASS**.

Authorization now requires all of:
- exact APPROVED content;
- `EXTERNAL_SEND_AUTHORIZED=true`;
- `PRODUCTION_PUBLISH_AUTHORIZED=true`;
- exact ready creative binding;
- exact version/fingerprint/hash match;
- idempotency key with no conflicting prior provider record.

Provider verification is a separate function and cannot return `PUBLISHED` without:
- provider acknowledgment;
- `post_id`;
- `post_url`;
- valid provider receipt time.

Current NONT flags remain **FALSE/FALSE**, correctly blocking X because creative binding/provider account gates are not complete. No public X post was made merely to manufacture PASS.

Metricool was surfaced as a possible X/social provider connector, but it is not installed/authorized in the current session. No provider claim is made.

## Phase F — Booking / CRM / KYC / LINE

Canonical booking write boundary remains the existing CRM/Admin `createBooking` API. Existing Apps Script uses document locking. Direct Machine-SOT booking append is prohibited.

Added/hardened:
- `lib/kk-booking-intake-guard.js`
- `scripts/kk-booking-intake-guard.test.js`

The earlier top-level `kyc_verified=true` boolean was judged insufficient and replaced by evidence-bound `kyc_attestation` requiring:
- `verified=true`;
- exact opaque `subject_ref == customer_ref`;
- nonblank `evidence_ref`;
- nonblank verification authority;
- valid `verified_at` timestamp.

Other gates:
- raw customer/KYC/payment PII forbidden at Machine-SOT intake boundary;
- exact CRM event identity;
- CURRENT governed availability projection;
- exact bookable package and quantity;
- phone/lens availability as required by package type;
- exact request idempotency;
- existing CRM API only.

Actual hardened regression execution: **14/14 PASS**.

The audited CRM schema contains no dedicated canonical KYC authority surface. Therefore no real customer booking/KYC/LINE E2E was fabricated. A real verified KYC attestation source/reference is required before a production booking can pass this guard.

## Phase G — Outcome Learning

`_Business_Outcome` currently has schema only; no final live rows were fabricated.

Added/hardened:
- `lib/kk-outcome-projector.js`
- `scripts/kk-outcome-projector.test.js`

The projector now requires:
- exact verified Machine↔CRM crosswalk;
- exact CRM event snapshot, including for zero-booking observations;
- policy version;
- explicit observation stage.

Stages:
- `PRE_EVENT_SNAPSHOT` → not eligible for final Business Outcome learning;
- `POST_EVENT_FINAL` → may be mapped to the exact 38-column `_Business_Outcome` schema.

X status is tri-state. No X evidence means unknown/null, not a fabricated `false`. A positive X state requires provider evidence with post ID/URL/time.

`amount_received` is never called accounting revenue. Gross/net revenue remain null without accounting authority. Unproved outcome metrics remain null.

Actual hardened regression execution: **14/14 PASS**.

Real CRM historical bookings were inspected only for aggregate/system validation; customer PII is not projected into Machine SOT or this log.

No safe exact historical post-event Machine-lifecycle↔CRM crosswalk was found for a completed event. Hao Yiran is an exact future/near-event overlap but is not yet a valid final post-event outcome. Therefore the correct runtime state is **NO FINAL OUTCOME ROW**, not an invented zero.

## Project check gate

`package.json` was expanded so `npm run check` now syntax-checks the governed libraries/tests and runs `test:governed` for:
- CRM projection;
- booking/KYC intake;
- outcome projection;
- company semantics;
- creative binding;
- X publish/provider boundary.

Individual suites executed during implementation:
- CRM projection 7/7 PASS;
- Booking/KYC 14/14 PASS;
- Outcome projector 14/14 PASS;
- Company semantics 6/6 PASS;
- Creative binding 8/8 PASS;
- X publish guard 11/11 PASS.

These are code/contract regression results. They are not provider-runtime evidence.

## Important commits from this implementation wave

- `89bbcc168cc4bfc28b9e306e478db2600c956201` — CRM projection adapter.
- `108c11916750f05f7a3ab66b20724a07f43edf89` — CRM projection tests.
- `64feed39baf25f81e19c5118352f5f1205ef72f3` — governed outcome projector foundation.
- `e7e92eb9669e983053045363447c33b9b4aa72a7` — outcome tests foundation.
- `1470cb2cb3dc996ccef2db1fde6f24a0c07cab86` — governed suites added to project checks.
- `5bc75a3cf9bc73e6a0c9f8ec282895c7cf274832` — KYC attestation hardening.
- `73b56ef98d23c16da74aee6ec51deeec8be11664` — expanded booking/KYC tests.
- `a26f944a14c0a840439ce8c972096bcad41ad933` — hardened outcome projector.
- `f4c2430b7bc87ad1cb80abe9319db9ec942a4c0c` — expanded outcome tests.
- `4489bdd26b32803029704df4c72e630461cab301` / `f7acb86cc08ecae73d422dc1c9e18ef4ba596152` — strict company semantics + tests.
- `78a19d463ae92e523824bb9346864f710771ec90` / `630d20a8f2708c88287bba289e6e193768e0f127` — creative binding guard + tests.
- `bedabd73d3732d4729b72e59be4139a38b7b9354` / `eb16b35e3a93d9ac1e235fb6ec49967ef3157774` — X provider boundary + tests.
- `be2c9dc4dc2094f1cdbeed7b8e3be7c8da5b5e6c` — C/E guards added to governed project checks.

## Final truth table

| Area | Implementation | Real runtime/provider proof | Current gate |
|---|---|---|---|
| Core v1 | Complete/preserved | Yes | none |
| Phase A | Complete | prior real Scanner/Verifier proof | recurring Scheduled-Task disable drift root cause unknown |
| Phase B | governed adapter + live CRM proof | Yes for OH MY FOURTH projection/readback | continuous canonical integration remains verifier-owned |
| Phase C content | Complete V2 approval | Yes | none for text |
| Phase C creative | strict guard complete | No final creative provider proof | exact official poster asset/hash + Canva binding |
| Phase D temp owner UI | hardened | Telegram/Make provider proof yes | canonical `5988323` permission |
| Phase E | exact publish/provider guard complete | No X post provider proof | creative + authorization flags + X provider connection |
| Phase F | governed booking/KYC guard complete | CRM canonical backend real | real KYC attestation/provider + customer E2E |
| Phase G | final outcome projector complete | no eligible final live row | post-event exact crosswalk/evidence |

## Explicit non-actions

- no Core v1 rebuild;
- no new/duplicate Scanner, Verifier or Canary;
- no competing inventory/booking writer;
- no permanent substitution for canonical Make scenario 5988323;
- no unsafe Gemini Scout reactivation;
- no historical HOLD release;
- no customer PII copied to Machine SOT/docs;
- no blind CRM timezone change;
- no generic creative promoted as official;
- no X/customer/LINE send merely to manufacture PASS;
- no fabricated Business Outcome;
- no merge to `main`.

## Codex review focus

Codex should review this branch against live Machine SOT, especially:
1. recurring external Scheduled-Task disable drift;
2. integration point for `kk-crm-projection` in the existing canonical writer path, without a new writer;
3. migration of legacy Rental Analytics affiliation heuristics to `kk-company-semantics` with authoritative origin/organizer data;
4. canonical Make `5988323` after permission is restored;
5. exact official poster→Canva binding before enabling NONT publish flags;
6. real X provider adapter and post ID/URL readback;
7. real KYC attestation authority and LINE/customer E2E;
8. first eligible post-event `_Business_Outcome` projection.
