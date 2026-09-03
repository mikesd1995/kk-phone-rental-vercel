# KK Phone Rental — Full System Audit

Audit checkpoint: 2026-09-04 01:05 Asia/Bangkok
Branch: `skills/x-scanner-v2`

> Authority order for this audit: highest Active `_Policy_Registry` -> live Machine SOT/runtime/provider/readback -> live CRM/Web backend -> current GitHub branch/code -> historical docs. This document is a continuity/audit mirror, not a replacement for live authority.

## 1. User intent / target system

The intended KK Phone Rental system is an auditable AI-assisted business operating system, not a standalone chatbot. The desired end-to-end behavior is:

1. Discover concerts, fan meetings and other event opportunities automatically.
2. Verify exact official/authorized event facts: identity, performer, date, time, venue, organizer/promoter/agency/label, ticket truth/stage/price and source freshness.
3. Scan competitor rentals exact-event first, exclude KK Phone Rental itself, deduplicate same-business evidence, keep comparable fallback separate, and never invent market prices.
4. Keep role boundaries: Scanner discovers/raw-stages; Verifier/final writer promotes canonical business truth and pricing only under current policy.
5. Check real inventory, bookings, collision/logistics and customer/CRM state before recommending availability or accepting work.
6. Generate exactly three evidence-bound Thai X variants: Theme / Artist / Fandom, using current product/pricing/footer/official-hashtag rules only.
7. Bind a source-safe poster/Canva creative without changing factual poster content or inventing faces/facts.
8. Give the owner a concise Telegram control flow bound to exact token + message + content version/fingerprint, supporting SELECT 1/2/3, APPROVE, REVISE, REJECT and CANCEL.
9. Publish X only from exact approved copy + approved media, idempotently, and persist provider `post_id` + canonical URL readback before `PUBLISHED`.
10. Continue into LINE/booking/inventory/KYC/customer operations with no oversell, correct phone/lens allocation and PII minimization.
11. Persist business outcomes and learn which event, price, content and operation convert best. Learning may recommend changes but must not autonomously mutate policy.
12. Keep Google Sheets as operational/backend data domains and GitHub/Vercel as application/frontend/API/integration layer.
13. Make every critical action auditable through policy, evidence, fencing/locks, transactions, exact readback and documentation continuity.

## 2. Actual architecture discovered

### 2.1 AI/Event/Policy Machine SOT

Spreadsheet ID: `1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo`

Purpose: event discovery/verification, policy/runtime control, evidence, queues, locks, transactions, notifications, content staging, Canary and business-outcome surfaces.

Key tabs include `_Policy_Registry`, `_Run_Manifest`, `_Run_Lock`, `_Write_Transaction`, `_AI_Inbox`, `_Command_Queue`, `_Job_Queue_STAGING`, `_Decision_Inbox`, `_Notification_Ledger`, `_Inventory_Collision`, `_Business_Outcome`, `_Canary_Suite`, `_Core_V1_Status` and related evidence/source surfaces.

Current authority: exactly one Active policy version, `v4.9.2 BALANCED SOURCE COVERAGE`.

### 2.2 Web/CRM/Booking backend

Spreadsheet ID: `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`

Title: `KK Phone rental backend`.

Purpose: real web/CRM/booking/assets/packages/customer/admin data used by the GitHub/Vercel application layer.

Important tabs include `00_Master_Booking`, `01_Events`, `02_Assets`, `03_Packages`, `04_Event_Overrides`, `06_Accessory_Stock`, `08_Web_Ready`, `09_Web_Packages`, `10_Admin_Health_Check`, `11_Customer_Stats`, archives and admin audit/error logs.

The public/API layer reads this backend; it is not the same spreadsheet as the AI/Event Machine SOT.

### 2.3 GitHub/Vercel application layer

Repository: `mikesd1995/kk-phone-rental-vercel`.

Important runtime/application files include `script.js`, `admin/admin.js`, `admin/rental-analytics.js`, `api/kk-admin.js`, `api/kk-data.js`, `api/kk-rental-dashboard.js` and the public/admin pages.

`api/kk-data.js` uses the Web/CRM backend spreadsheet as its default data source. GitHub therefore represents frontend/admin/API/integration behavior; it is not the canonical event-policy Machine SOT.

### 2.4 Make / owner transport and control

Visible Make scenarios:

- `5901592` — `02_KK_TELEGRAM_CONTROL`: active owner Telegram intake/acknowledgement.
- `5911509` — `01_KK_GEMINI_SCOUT`: legacy scenario currently deactivated for safety containment.
- exact Phase C/D UAT scenario `5988323`: inaccessible through the current connected Make identity; direct access requires organization-view permission.

## 3. Target finished flow

```text
Scheduled / on-demand discovery
  -> Scanner: source access + raw evidence + candidate/work packet
  -> Verifier: exact identity + official truth + lifecycle + pricing/evidence promotion
  -> canonical Event Machine SOT
  -> read live CRM/booking/assets availability
  -> Business Brain opportunity / collision / pricing / action decision
  -> eligible Notification Ledger business alert
  -> owner Telegram/LINE delivery with provider evidence

Owner asks for X content
  -> on-demand X Scanner
  -> official event + social/media + poster facts
  -> EVIDENCE_VERIFIER
  -> official hashtag gate
  -> exact-event competitor scan
  -> EVIDENCE_VERIFIER competitor promotion
  -> competitor evidence ranking
  -> completeness audit
  -> CONTENT_GATE=PASS
  -> exactly 3 Theme/Artist/Fandom variants
  -> source-safe Canva binding
  -> Telegram owner preview
  -> SELECT / REVISE / APPROVE / REJECT / CANCEL
  -> exact approved creative + content
  -> X publish adapter
  -> provider post_id + canonical URL readback
  -> booking / customer / inventory lifecycle
  -> business outcome capture
  -> recommendation-only learning
```

## 4. Current phase audit

### Core v1 — COMPLETE / RUNTIME VERIFIED

Canonical chain remains:

`Scanner -> Verifier -> Google Sheet -> Notification Ledger -> Telegram + LINE`

Live `_Core_V1_Status` retains dual-channel runtime/provider/readback PASS. No Core-v1 rebuild was performed.

### Phase A — COMPLETE / RUNTIME STEADY-STATE VERIFIED

Phase A may now be closed. Evidence includes:

- ordinary Scanner 20:00 run with monotonic fencing v202, runtime coverage/readback and released lease;
- ordinary following Verifier 20:30 run with fencing v201, correct `NO_OPERATIONAL_PACKET` semantics and released lease;
- later Verifier runs continued monotonically through v204 with release/readback;
- manual Scanner cutover validation used v203 and released correctly;
- missed windows remained explicit gaps instead of fabricated backfills;
- no competing Scanner/Verifier writer was proven during pause/cutover validation.

At audit time both migrated scheduled roles had drifted to disabled. After confirming no active Scanner/Verifier lease conflict, both were re-enabled separately and exact task-state readback confirmed Scanner `:00` and Verifier `:30` enabled.

### Phase B — PARTIAL

Business/event/evidence/pricing safety logic is substantial, but unified runtime truth is not complete.

Primary gap: `_Inventory_Collision` in the Event Machine SOT still contains many `inventory feed unavailable` / `CRM feed unavailable` states even though the separate Web/CRM backend has live bookings, assets and web availability. The AI Business Brain therefore does not yet consume the authoritative current CRM inventory/booking state as one unified decision domain.

Required design: read-only or explicitly governed projection/join from CRM/booking/assets truth into the Machine-SOT decision/collision layer. Do not create a competing inventory canonical writer.

### Phase C — LOCAL/SYNTHETIC PASS; RUNTIME UAT BLOCKED

The three-variant engine has local deterministic PASS history. A real staging content row exists, but it remains draft/non-publish-authorized.

Five historical `/team PREVIEW` inputs with the same callback token remain `_AI_Inbox=NEW`; exact searches show no matching canonical Command/Job/Decision routing. Therefore the block is before canonical command execution, not a slow worker.

### Phase D — LOCAL/SYNTHETIC PASS; RUNTIME UAT BLOCKED

Telegram owner-control contracts exist locally, but exact runtime UAT is blocked because scenario `5988323` cannot be read by the current Make identity and the five preview inputs have not entered the canonical queue.

`5901592` must not be repurposed as a substitute; its `/team` path only ingests into `_AI_Inbox` and acknowledges.

### Phase E — LOCAL/SYNTHETIC PASS; PROVIDER RUNTIME PENDING

X publish guard logic exists, but no production/provider PASS should be claimed until C/D and creative approval complete and one controlled exact-version publish returns matching `post_id` + canonical URL.

### Phase F — PARTIAL, REAL CRM EXISTS

The Web/CRM backend is operational and already contains real booking/assets/package guards. Positive behavior includes blocking unavailable/full packages, duplicate asset allocation and unsafe historical asset deletion.

Remaining gaps:

- AI/Event Machine SOT is not integrated with live CRM inventory/booking truth;
- CRM Admin Health has three real historical booking data-quality warnings (missing customer/contact) that must not be invented away;
- one asset is currently marked unavailable and needs owner/operations confirmation whether intentional;
- recent admin write history includes lock-contention failures/retry messages;
- customer/KYC/LINE E2E is not runtime verified as one complete automated flow;
- customer-facing LINE AI remains deferred by design.

### Phase G — STAGING ONLY

`_Business_Outcome` currently contains only its schema/header and no completed live outcome rows. Learning logic may be locally tested but cannot be described as learning from real production outcomes yet.

## 5. Critical findings

### P0 — Legacy Make transport can reappear

`01_KK_GEMINI_SCOUT` was found active again during this audit even though it had previously been safely deactivated. Fresh blueprint inspection confirmed the unsafe legacy paths still existed:

- direct `_AI_Inbox`/GPT result -> Telegram;
- historical `HOLD_TRANSPORT_QUARANTINE` -> Telegram -> mark `SENT`.

This violates current Ledger-only/quarantine policy.

**Fix applied:** scenario `5911509` was deactivated again; config/history preserved. The unresolved governance risk is that an external operator/process can reactivate it. Until the legacy routes are permanently retired or rebuilt under current policy, its inactive state must be monitored.

### P0 — Phase C/D exact Make access/routing

Exact scenario `5988323` remains inaccessible to the current connected identity (`organization view` required). Five existing preview requests remain before `_Command_Queue`. Do not send a sixth preview and do not substitute `5901592`.

### P1 — Cross-domain inventory/CRM integration missing

The application has a real CRM/backend spreadsheet, but the Event Machine SOT still reports unavailable CRM/inventory feeds. This is the central blocker to a genuinely unified Business Brain/Booking runtime.

### P1 — Analytics company semantics drift

Rental Analytics V4 still treats talent affiliation as the primary company concept and explicitly excludes organizer/promoter as primary. Current Machine SOT semantics instead require Thai performer -> agency/label/management and foreign performer -> local organizer/promoter.

The CRM `01_Events` schema currently lacks an organizer/promoter/company field, so patching analytics with another heuristic would create guessed business truth. Required fix is an authoritative projection/join from the Event Machine SOT into analytics data, then update dashboard semantics against that field.

### P1 — CRM spreadsheet timezone

`KK Phone rental backend` is configured with spreadsheet timezone `Etc/GMT`, while business operations are Thailand-based. This can become a booking/date cutoff risk if Sheets formulas or Apps Script use spreadsheet timezone. It was not changed during this audit because changing timezone can alter existing date behavior and requires dedicated regression.

### P1 — CRM write contention

Admin Error Log includes recent write-lock contention around event-price override writes. Existing guards fail safely, but user experience and write throughput need a dedicated lock/contention review.

### P1 — Canary evidence semantics

Current Canary rows report historical synthetic expected-match PASS with zero production writes. The hardened scheduled Canary prompt now requires independent synthetic assertion evidence and completeness/identity gates. Existing historical PASS rows should not be retroactively promoted to the stronger new standard without a new compliant run.

### P1 — GitHub automated check coverage was incomplete

The existing `npm run check` syntax command omitted both rental analytics JavaScript files.

**Fix applied on branch:** added `admin/rental-analytics.js` and `api/kk-rental-dashboard.js` to the check command. This improves future syntax coverage but does not itself prove the command was executed or passed.

## 6. Safe fixes applied during this audit

1. **Re-deactivated unsafe Make legacy scenario `5911509`** after detecting it had been reactivated. Exact scenario-list readback confirmed inactive.
2. **Restored scheduled Scanner and Verifier** after Phase A steady-state proof. Re-enabled Scanner first, then Verifier; task readback confirmed both enabled. Canary remained enabled.
3. **Fixed CRM Admin Health false-positive count.** `Booking risk not OK` incorrectly showed 128 because the health formula counted formula-filled blank rows. Updated the formula to gate on raw nonblank `event_id`. Exact readback changed 128 -> 3; the remaining three are real historical data-quality warnings and were preserved.
4. **Expanded GitHub `npm run check` coverage** on `skills/x-scanner-v2` to include `admin/rental-analytics.js` and `api/kk-rental-dashboard.js`. No `main` merge and no claim of executed test success.
5. **Upgraded Phase A status** from pending steady-state observation to `RUNTIME STEADY-STATE VERIFIED / COMPLETE` based on real scheduled fenced runs and release/readback evidence.

## 7. Requirement alignment

| Desired capability | Current alignment |
| --- | --- |
| Automated event discovery | Strong / runtime operational |
| Official evidence verification | Strong / Core runtime verified |
| Competitor exact-event evidence | Guardrails strong; runtime coverage depends on source access |
| Canonical pricing/business decision | Partial; safe boundaries exist, live inventory domain not unified |
| Live inventory/booking collision | Partial; CRM has data but Machine SOT integration missing |
| 3 X variants | Local/synthetic pass; runtime preview path blocked |
| Official hashtag gate | X Scanner V2.1 staging reviewed, not runtime installed |
| Canva source-safe creative | Local/synthetic pass; real design/source binding pending |
| Telegram owner approval | Local/synthetic pass; runtime C/D blocked |
| X exact-version publish | Local/synthetic pass; provider runtime pending |
| Booking/CRM | Real backend exists and works, but not unified with AI SOT |
| KYC/customer flow | Partial/deferred |
| Outcome learning | Staging only; no live outcome rows |
| Auditability | Strong in Core/runtime; cross-domain and Make governance still need closure |

## 8. Current system classification

**SAFE CORE / PHASE A COMPLETE / BUSINESS-CONTENT-INTEGRATION PARTIAL / NOT YET END-TO-END COMPLETE**

Core v1 and runtime stability are the strongest completed portions. The biggest remaining work is not another Scanner/Verifier redesign; it is cross-domain integration and completing the owner-content-publish runtime chain.

## 9. Exact next work order

1. Maintain Scanner `:00`, Verifier `:30`, Canary enabled and audit any unexpected enable/disable drift.
2. Keep `5911509` inactive; identify why it was externally reactivated and permanently retire/neutralize its legacy bypass only through a controlled migration.
3. Restore Make organization/team access to exact scenario `5988323`.
4. Reconcile the five existing preview inputs and perform exactly one controlled Phase C/D Runtime UAT; no sixth input before reconciliation.
5. Define an authority-safe CRM -> Machine-SOT inventory/booking projection contract; prove read-only/canonical ownership and add collision readback.
6. After C/D runtime PASS, bind one real Canva design/source poster and obtain creative approval evidence.
7. Perform one controlled X exact-approved-version publish and store canonical provider readback.
8. Complete Booking/KYC/LINE E2E against real CRM truth, with no oversell and PII-minimized evidence.
9. Add live outcome rows from real C-E work and only then validate Phase G recommendation learning.
10. Resolve analytics company semantics by projecting authoritative company/organizer classification from Event Machine SOT instead of adding heuristics.
11. Run dedicated CRM timezone and write-lock regression before changing spreadsheet timezone or lock strategy.

## 10. Explicit non-actions

- No Core v1 rebuild.
- No `main` merge.
- No sixth `/team PREVIEW` injection.
- No substitution of `5901592` for `5988323`.
- No fabricated CRM/customer values to clear the three remaining warnings.
- No bulk release of historical notification quarantine.
- No blind timezone change.
- No heuristic organizer/company fabrication in analytics.
- No production X/customer/provider action to manufacture PASS.

## 11. Continuity rule

Every subsequent work block must continue using:

`READ DOC -> RECONCILE LIVE STATE -> EXECUTE NEXT ACTION -> READBACK/VERIFY -> WRITE BACK DOC -> SET NEXT ACTION`

Read this file plus `CURRENT_STATE.md` before further implementation. Live Machine SOT/provider/readback remains authoritative over this document.
