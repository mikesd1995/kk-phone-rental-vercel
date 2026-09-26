# Smart Health Root-Cause Triage — Zero-Cost Audit — 2026-09-26

## Objective

Close as much of the remaining KK Phone Rental operational-health debt as possible without paying for another provider, inventing physical inventory, mutating customer/business truth, or weakening the existing fail-closed Apps Script timing gate.

This pass starts from exact `main` `de6be16fa6227e3f3dfed9e2b43c5724d5848471`.

## Live evidence before the change

The canonical Core spreadsheet `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU` currently reports:

- Duplicate event ID: 0 / OK
- Event data health failures: 0 / OK
- Duplicate asset ID: 0 / OK
- Duplicate package template ID: 0 / OK
- Duplicate event overrides: 0 / OK
- Negative package availability: 0 / OK
- Duplicate Booking ID: 0 / OK
- Booking integrity risk: 0 / OK
- Spreadsheet timezone: `Etc/GMT` / CHECK
- Atomic reservation timing readiness: CHECK only because Apps Script Project timezone + installed triggers still lack authenticated readback
- Accessory kit capacity shortfall: 1 / CHECK
- Payment follow-up due: 2 / INFO

Google Sheets metadata independently confirms:

- spreadsheet locale: `th_TH`
- spreadsheet timezone: `Etc/GMT`

The current physical-stock register in the Sheet records:

- rentable phones: 2 (`PHONE-001`, `PHONE-002`)
- powerbank available: 1
- phone bag available: 1

Therefore the accessory CHECK is not a formula/UI false positive. The Sheet records one fewer complete accessory kit than rentable phones. This pass does **not** increase that stock because there is no evidence that another physical powerbank or phone bag exists.

## Apps Script authenticated-readback attempts

The required timing gate is still:

1. open the bound Apps Script project;
2. read Project Settings → Time zone;
3. read installed Triggers and confirm `kkCleanupOldData30DaysAuto`;
4. only then decide whether any timezone/trigger mutation is justified.

Zero-cost evidence paths were exhausted as follows:

- Google Drive search for accessible files with MIME `application/vnd.google-apps.script`: no accessible project returned;
- targeted Drive search for the KK project: no Apps Script project returned;
- the connected Google Drive/Sheets connector exposes spreadsheet data/metadata but not Apps Script Project Settings or installed triggers;
- plugin-directory search did not provide a dedicated accessible Google Apps Script project-settings/trigger connector;
- anonymous Production Admin health endpoints correctly return 401 and do not expose privileged Apps Script diagnostics.

Historical Audit rows containing `cleanupOldData` are not sufficient proof of an installed daily trigger because the automatic handler calls the cleanup function directly and does not pass through the API audit wrapper.

Result: **Apps Script project timezone and installed triggers remain UNVERIFIED, fail-closed.**

No paid browser automation, connector subscription, Vercel plan, or other paid workaround was used.

## UX / operational change

The Admin previously surfaced three raw CHECK rows:

1. Spreadsheet timezone
2. Atomic reservation timing readiness
3. Accessory kit capacity shortfall

The first two are not independent incidents. They share one authoritative blocker: authenticated Apps Script timing readback.

The new Root Cause Triage layer therefore reports two root causes:

### Apps Script timing verification — EXTERNAL_AUTH

Combines Spreadsheet timezone + Atomic timing readiness.

The Admin explicitly instructs the operator to read Project Settings and Triggers before mutation and warns against:

- changing timezone merely to make Health green;
- reinstalling the trigger merely to make Health green;
- deploying repository `Code.gs` over the observed Production 9_5_9 lineage.

### Accessory kit capacity — PHYSICAL_STOCK

Preserves the CHECK and computes the current rentable-phone count from the Admin snapshot.

The action is evidence-driven:

- verify real powerbank + phone-bag stock;
- only update `06_Accessory_Stock` if the physical item actually exists;
- otherwise leave the CHECK open.

## Operator workflow improvements

- Overview System Attention counts **root causes**, not duplicate derivative CHECK rows.
- Health tab adds Root Cause Triage with gate type, evidence and exact next action.
- The triage checklist can be copied for owner/manual follow-up.
- Raw Sheet Health Check remains visible unchanged underneath; evidence is consolidated for UX, not rewritten.
- Payment follow-up remains INFO and stays an operational Action Center concern rather than being misclassified as data-integrity failure.

## Mutation boundary

This change performs zero business-data mutations.

It does not change:

- Booking/customer/payment values;
- prices or stock counts;
- Event or Package visibility;
- Google Sheet timezone;
- Apps Script Project timezone;
- installed triggers;
- Apps Script source/deployment;
- Vercel secrets/environment variables;
- Scanner/Verifier/Canary/HF state.

## Next acceptance gate

The timing root cause can only close after authenticated readback of the bound Apps Script Project Settings and installed Triggers. If the project timezone is already Asia/Bangkok, follow the existing Gate 2 migration checklist before considering a Sheet timezone change. If it is not Asia/Bangkok, stop and reconcile trigger/date-key behavior before any migration.

Accessory capacity can close only from verified physical inventory or an explicit business decision to reduce rentable-kit capacity—not by editing the number for cosmetic health.
