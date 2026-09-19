# Admin fallback GViz header incident — 2026-09-20

## Incident

At approximately 2026-09-20 00:16 Asia/Bangkok, Production Admin authentication and protected assets remained healthy, but snapshot loads failed.

Observed Production evidence on main `991f958c5f2f142670da87a248441e8eca2f9f7c`:
- `/admin`, `/admin/app`, protected JS/CSS and `/api/kk-admin-auth` returned 200;
- `POST /api/kk-admin` returned 502 at least twice;
- upstream classification remained `APPS_SCRIPT_DEPLOYMENT_NOT_FOUND` / Google HTTP 404 HTML;
- the direct-Sheet fallback did not emit its success telemetry, so the Admin remained unavailable despite PR #83/#84 being merged.

No booking, event, customer, package or pricing write was performed during this investigation.

## Root cause

The fallback's public GViz reader requested most Core datasets starting at row 1, for example:

`01_Events!A1:I1000`

Several Core tabs contain a title/instruction area above the real schema header. Their real headers are on row 4.

Google GViz infers headers when the requested range starts above the schema. In the live workbook, the resulting first CSV field can be a derived label containing title text plus the logical column name rather than the exact literal `event_id`.

The fallback parser intentionally requires an exact schema header match. Therefore:

- expected header cell: `event_id`
- live A1 GViz interpretation: title-derived label containing `event_id`
- parser result: `Fallback schema header not found: event_id`
- Promise.all fallback result: the whole snapshot fails closed
- caller result: 502

This defect was not covered by the original fallback mocks because they returned a clean header as row 1.

## Live read-only verification

Read-only structural checks confirmed:
- Core workbook still exists and is readable;
- required tabs still exist;
- exact Google Sheets API header positions are row 4 for the operational tabs used here, except `11_Customer_Stats`, whose header is row 1;
- all ten exact anonymous GViz source reads were reachable at investigation time;
- Production public-data proxy returned 200 with `X-KK-Sheet-Source: public-gviz-fallback`.

No row payload, customer identity, phone number, contact, notes, link, secret or credential is recorded in this document.

## Remediation in this branch

### 1. Align GViz ranges to real header rows

Changed fallback source ranges:

- `01_Events`: A4:I1000
- `00_Master_Booking`: A4:T2000
- `02_Assets`: A4:G500
- `03_Packages`: A4:J500
- `04_Event_Overrides`: A4:G2000
- `08_Web_Ready`: A4:K1000
- `09_Web_Packages`: A4:N3000
- `11_Customer_Stats`: A1:H1000 (unchanged; header is row 1)
- `10_Admin_Health_Check`: A4:D500
- `Model_Master`: A4:E500

The fallback remains read-only.

### 2. Add safe fallback-failure telemetry

Fallback read failures now carry a bounded error code and dataset key such as:
- `FALLBACK_GVIZ_TIMEOUT`
- `FALLBACK_GVIZ_FETCH_FAILED`
- `FALLBACK_GVIZ_HTTP_<status>`
- `FALLBACK_GVIZ_HTML`
- `FALLBACK_SCHEMA_HEADER_MISSING`

`KK_ADMIN_DIRECT_SHEET_FALLBACK_FAILED` logs only:
- requested action;
- upstream trigger class/status;
- bounded fallback error code;
- dataset key.

It does not log source rows or PII.

### 3. Regression coverage

Added coverage that:
- pins each fallback dataset to the actual schema-header-aligned range;
- reproduces the production-style GViz header inference failure when a title row is treated as part of the header;
- verifies the public reader requests the configured range;
- binds the snapshot outage fallback regression to those corrected ranges.

## Safety boundary

This branch does not:
- change `KK_ADMIN_SCRIPT_URL`, API keys, PINs or any Vercel secret;
- deploy or modify Apps Script;
- change Google sharing;
- write booking/event/customer/package/pricing data;
- mutate Scanner, Verifier, Canary, Make, HF or Machine SOT;
- merge to main or promote Production.

Issue #9 remains the authoritative blocker for recovering the exact live Apps Script 9_5_9 source/deployment. This patch repairs only the emergency read-only Admin availability path.

## Acceptance required before merge

1. `npm run check` PASS.
2. `npm test` PASS.
3. Exact-head Vercel Preview READY.
4. Preview/Admin authenticated snapshot acceptance shows a healthy degraded read-only snapshot when Apps Script is unavailable.
5. No write action is enabled in degraded mode.
6. Only after acceptance, review merge/promotion separately.
