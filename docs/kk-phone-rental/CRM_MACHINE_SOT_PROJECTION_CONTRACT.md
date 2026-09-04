# KK Phone Rental — Governed CRM → Machine-SOT Projection Contract

Status: **DESIGN CONTRACT / BRANCH ONLY / NOT RUNTIME INSTALLED**

Checkpoint: 2026-09-04 Asia/Bangkok

## 1. Purpose

Close the current Phase-B integration gap without creating a second booking/inventory writer.

The Web/CRM backend already contains real booking, asset, package and web-availability truth, while the Event/Policy Machine SOT still contains historical `_Inventory_Collision` rows with `inventory feed unavailable` / `CRM feed unavailable`. The correct fix is a governed read/projection boundary, not guessed capacity values and not a competing canonical inventory table.

## 2. Authority and ownership

### CRM / Booking canonical owner

Spreadsheet: `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`

Canonical for:
- bookings and booking status;
- phone/lens asset state;
- package/template state;
- event-specific package overrides;
- current bookable availability;
- active booking allocation and asset conflicts.

The Event/Policy Machine SOT must never write booking, customer, asset or package truth back into this spreadsheet through this projection.

### Event / Policy Machine SOT canonical owner

Spreadsheet: `1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo`

Canonical for:
- active policy;
- verified event/business truth;
- evidence authority and lifecycle;
- Scanner/Verifier control and fencing;
- Business-Brain decision inputs/outputs;
- inventory-collision decision projection;
- owner-notification eligibility;
- content/publish governance.

## 3. Projection direction

`CRM authoritative read → normalized read-only projection → Event/Policy decision layer`

Never:

`Event Machine SOT → silently overwrite CRM booking/assets/packages`

No new schedule, second inventory writer, second booking writer, or shadow CRM is authorized by this contract.

## 4. Minimum projection identity

Every projection record must carry:
- `crm_event_id`;
- normalized event date;
- Machine-SOT family/show identity when an authoritative mapping exists;
- `projection_as_of` in an unambiguous timezone-aware timestamp;
- source spreadsheet ID;
- source tabs/surfaces used;
- projection schema/version;
- freshness state;
- exact readback evidence or reproducible source snapshot identity.

If exact event identity cannot be mapped safely, availability is `UNKNOWN_IDENTITY` and must not be joined by fuzzy name alone.

## 5. Minimum availability fields

For the exact event/date being evaluated, project at least:
- current active booking count;
- current available Vivo X300 Pro count;
- current available compatible lens count;
- current bookable package availability by template/package type;
- current package status (`available`, `full`, `hidden`, etc.);
- active allocated phone asset IDs when operationally required;
- active allocated lens asset IDs when operationally required;
- same-day active-booking count;
- same-day asset/collision summary;
- manual/event override presence without overwriting the override;
- source freshness timestamp.

PII is not required for Business-Brain capacity decisions. Do not project customer name, phone number, contact identifier, KYC material, payment evidence, or private notes unless a separately approved operation explicitly requires it.

## 6. Current CRM read surfaces

Preferred current read surfaces:
1. `08_Web_Ready` for event-level current available phone/lens counts and public booking state;
2. `09_Web_Packages` for current package-level availability/status/price projection;
3. `00_Master_Booking` for collision/allocation verification when a decision requires booking-level exactness;
4. `02_Assets` for current physical asset status/rentable state;
5. `04_Event_Overrides` only to preserve and explain event-specific override state.

`08_Web_Ready` / `09_Web_Packages` may be used as fast projections, but a protected allocation/booking decision must still rely on the canonical CRM guards that reject overbooking and unavailable assets.

## 7. Freshness / fail-closed semantics

The consumer must resolve an explicit freshness threshold from current policy/config. Until such a threshold is formally added to an authoritative control surface, the integration must not invent one and call stale data current.

Required states:
- `CURRENT` — freshness and identity both proven;
- `STALE` — source was read but freshness gate is not satisfied;
- `UNKNOWN_IDENTITY` — event mapping is not authoritative;
- `SOURCE_UNAVAILABLE` — CRM projection could not be read;
- `CONFLICT` — authoritative CRM surfaces disagree materially.

Anything except `CURRENT` must not become `AVAILABLE` by assumption.

## 8. Collision decision semantics

`_Inventory_Collision` is a Business-Brain projection/history surface, not the CRM canonical inventory database.

When a current CRM projection is available:
- write decision facts with `Last Checked` / equivalent timestamp;
- preserve source/provenance in an approved notes/evidence field;
- distinguish baseline capacity from actual remaining availability;
- do not rewrite historical rows merely to make old `inventory feed unavailable` text disappear;
- append/update only the current decision boundary according to current Machine-SOT transaction/readback rules.

When CRM is unavailable/stale:
- availability remains unknown;
- recommendation confidence is reduced;
- booking acceptance is not inferred;
- no fabricated `2 phones / 2 lenses` final availability claim.

## 9. Same-day collision behavior

For any candidate event date, the projection must evaluate all active bookings/allocations on that date before recommending availability.

The global physical baseline does not equal event availability. Example: two active phones in `02_Assets` can produce event availability 0, 1 or 2 depending on same-day allocation.

Routing/logistics collision remains separate from stock collision. Two assets available does not automatically mean two geographically incompatible events can both be served safely.

## 10. Booking write boundary

Business Brain may recommend an action, but booking writes remain behind the existing CRM/Admin API and its guards.

Do not bypass the canonical CRM API by directly appending a booking row merely because the Machine SOT has enough event information.

The existing backend guards for:
- package visibility/bookability;
- available asset selection;
- duplicate/conflicting allocation;
- historical asset preservation;
- write locking;
must remain authoritative for CRM mutation.

## 11. Pricing boundary

CRM package/base prices and event overrides are not automatically the same concept as a temporary X campaign price.

Projection must label price source/scope explicitly. A content-campaign price must not silently overwrite a valid CRM package or event override.

## 12. Analytics company/organizer boundary

This projection contract does not authorize event-name heuristics to manufacture company/organizer truth.

For analytics, authoritative company semantics must ultimately be projected from verified Event Machine-SOT truth:
- Thai performer → agency/label/management;
- foreign performer → local organizer/promoter;
- organizer captured separately where schema permits;
- unresolved stays unknown.

Existing heuristic affiliation inference may remain as legacy/non-authoritative analytics metadata only until an authoritative field is projected.

## 13. Required implementation tests

A runtime implementation is not PASS until all applicable tests succeed with exact readback:
1. exact event/date with 2 available phones and 2 lenses;
2. exact event/date with 1 remaining phone/lens;
3. full event with 0 capacity;
4. inactive historical asset is excluded;
5. same-day allocation reduces availability;
6. hidden/full package is not bookable;
7. stale CRM read returns unknown/stale, never available;
8. event identity mismatch does not fuzzy-join;
9. event override is preserved;
10. no PII is projected into Business-Brain capacity surfaces;
11. no direct CRM mutation occurs during read-only projection;
12. protected Machine-SOT decision write follows current fencing/transaction/readback requirements.

## 14. Completion gate

Phase-B live inventory integration may be called runtime-complete only after one controlled real event/date proves:

`CRM canonical state → governed projection → Machine-SOT collision decision → exact readback`

and a subsequent CRM booking operation still passes the existing canonical CRM overbooking/allocation guards.

Until then the implementation status is **CONTRACT_DEFINED / RUNTIME_INTEGRATION_PENDING**.
