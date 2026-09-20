# Gate 2 Data Integrity Repair Execution — 2026-09-20

Status: **PARTIALLY REPAIRED / ONE DUPLICATE GROUP REQUIRES BUSINESS REVIEW**

This document records the production-safe Gate 2 repair carried out after Apps Script recovery. The repair intentionally separates objective identity corrections from ambiguous business decisions.

## Safety snapshot

Before any production row mutation, a full Google Sheet copy was created:

- title: `KK Phone rental backend - PRE_GATE2_DATA_REPAIR_2026-09-20_2310`
- spreadsheet id: `1ZBgOYUHFYs93XB5jvX_7WgyzNf2jPKSkXPkLhU18u5o`
- source spreadsheet: `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`

No Vercel secret, API key, PIN, Apps Script deployment, Scanner, Verifier, Canary, Make workflow or Machine SOT was changed by this Gate 2 repair.

## Objective event_id/date drift repair

Three event ids encoded a date different from the authoritative `event_date`. The migration preserved the entire event-id suffix and changed only the YYYYMMDD segment.

| Event | Before | After | References explicitly updated |
| --- | --- | --- | --- |
| LYKN REFLEXION CONCERT | `EVT-20261025-LYKN-REFLEXION-CONCERT-2` | `EVT-20261023-LYKN-REFLEXION-CONCERT-2` | `01_Events`, booking `BK-20261023-001`, two override rows |
| GEMINI ART-VENTURE CONCERT | `EVT-20260904-GEMINI-ART-VENTURE-CONCERT-2` | `EVT-20260905-GEMINI-ART-VENTURE-CONCERT-2` | `01_Events`, three override rows |
| PLAVE KEEP IT MANIC | `EVT-20261026-2026-PLAVE-WORLD-TOUR-KEEP-I` | `EVT-20261010-2026-PLAVE-WORLD-TOUR-KEEP-I` | `01_Events` |

Formula-driven `08_Web_Ready`, `09_Web_Packages` and `_Rental_Dashboard_Data` recalculated to the new ids automatically. Readback confirmed names, dates, venues, status, availability and event prices remained unchanged.

Result: **event_id/date drift 3 → 0**.

## Logical duplicate repair

### LABX — repaired

Two rows represented the same normalized event identity on 2026-09-15.

The base id row was inactive on web and had no booking. The `-2` row was active and was referenced by booking `BK-20260915-001`. Therefore the `-2` row was retained as the canonical live record.

Archived before clearing:
- old event row 24 → `13_Event_Archive!102`
- old override rows 20:22 → `14_Event_Override_Archive!251:253`

The archived event's generated Web Ready row became blank as expected. Two hard-coded generated price cells left behind in `09_Web_Packages!H62` and `H64` were restored to blank-safe formulas so a future event cannot inherit stale LABX prices.

### MITH — intentionally not auto-merged

The two 2026-09-16 MITH rows have the same normalized name/date/venue, but their business state is not equivalent:
- different poster assets;
- the `-2` record explicitly hides the lens package while the base record does not;
- neither record currently has a booking reference.

There is no evidence-safe automatic canonical choice, so this group remains **REVIEW_REQUIRED**. No row or price was changed for MITH.

Result: **logical duplicate groups 2 → 1**, with the remaining group explicitly held for business review.

## Post-repair readback

Independent reads after mutation:
- live Events: 72
- Bookings: 26
- current workflow-open bookings: 5
- Assets: 5
- event_id/date drift: 0
- logical duplicate groups: 1
- Health Check duplicate event_id: 0
- Health Check duplicate overrides: 0
- Health Check booking risk: 0

The count change from 73 to 72 events is intentional: one unused hidden LABX duplicate was archived, not deleted without trace.

## In-system audit evidence

Rows were appended to `15_Admin_Audit_Log` for:
- backup creation;
- each of the three event-id migrations;
- LABX duplicate archive;
- generated-price formula restoration;
- MITH review-required hold.

The audit source is `manual-gate2-integrity-20260920`.

## Apps Script recovery provenance

The production backend remains:
`v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX`

Recovered source fingerprints:
- original uploaded 9_5_9 source SHA-256: `03ac8b889ed531c432425e99145dba37a6b264b19aa6ee8558c477c352085a6c`
- deployed recovery source SHA-256: `40fffe288d55c1991fda1bd133670b7b41f90822acd834ec887e00c1f0f1b87e`

The recovery hotfix does not change the API/business contract. It:
- caches Spreadsheet/Sheet handles only for one Apps Script execution;
- changes `kkGetValues_()` from a display-value scan plus a second value read to one value read followed by in-memory trimming;
- reuses the cached spreadsheet handle for diagnostics and snapshot identity.

Observed before recovery: upstream timeout around 12 seconds.
Observed after recovery: System Guard received valid 9_5_9 JSON and the user-observed snapshot round trip was 6.862 seconds.

## Preventing recurrence

`server/event-integrity-plan.js` provides a pure dry-run planner:
- proposes only date-aligned id changes that preserve the suffix;
- blocks collisions;
- enumerates snapshot references;
- never chooses a canonical logical duplicate automatically;
- never mutates the supplied snapshot.

Use:
```bash
node scripts/verify-event-integrity.js snapshot.json
```

A logical duplicate remains a human/business review item until its poster/package semantics and references are explicitly resolved.
