# Active Helper quote reuse — source regression repair (2026-10-15)

**SOURCE ONLY. Production, feature flags, Google permissions and business data are unchanged. Release remains HOLD.**

## First failing boundary

Compared private-reader PR #739 HEAD `0e28eccb8cb963b1136533cb20ee820415b9d6da` and revenue PR #737 HEAD `943ccf4ea6f32bcb4ed95a135a04dfe1162b0bc5` with cleanup PR #744 HEAD `edcc8146f86ac81a573529412e1f035b4e0eb4d8`. The cleanup architecture retains private Core routing, strict Master column X schema, protected Apps Script endpoint validation, first-row preflight schema checks, fixed diagnostic allowlisting and credential/endpoint cache isolation. This is a bounded repair to existing revenue work, not a replacement reader or revenue architecture.

The cleanup integration omitted #737's active Helper identity duplicate guard. A synthetic fixture with **one** Master `(booking_id,event_id)` quote at 890 and **two** matching active Helper rows differing only in `created_at` returned Future=1,780 in both Core and Legacy strict aggregates. Their aggregate deduplication includes mutable Helper metadata, so it cannot authorize reuse of one canonical quote.

`server/rental-analytics-booked-quote.js` now rejects a second active Helper `(booking_id,event_id)` with `RENTAL_ACTIVE_HELPER_DUPLICATE`, before returning any priced rows to either dashboard. The strict CSV and Map adapters, Master column X requirement, exact status/package match and existing missing/duplicate Master errors remain intact. Reused Booking IDs on different events remain valid; inactive duplicate statuses contribute no revenue.

## Local evidence

- New duplicate regression against the original source: **FAIL — Missing expected exception** (7/8 tests passed).
- After the minimal guard: **63/63 focused private-reader/security/revenue tests PASS**.
- Native Node `v24.19.0`: `npm run code:test -- "rental analytics booked quote active Helper duplicate"` resolved no curated route and ran the complete suite: **1,851/1,851 tests PASS**, plus **26/26 poster ACL tests PASS**. A direct `npm test` confirmation also passed.
- Syntax checks for the changed source/test and `git diff --check`: PASS. No dependency install or real provider requests were needed.
- Regression variants cover identical active rows, differing creation time/date/customer key/status/source, both CSV and strict Map adapters, legitimate cross-event Booking ID reuse and excluded duplicate statuses.

The 890/1,780 figures are synthetic failure evidence, not live financial reconciliation. No customer values, credentials or real Sheet rows are stored here.

## Acceptance and next action

Independent reviewer (root agent) completed source review: **PASS**. The review confirmed that a duplicate active canonical identity is rejected before either aggregate, mutable rows are not silently selected or deduplicated, legitimate cross-event IDs and inactive rows remain covered, and the strict private transport is preserved. The engineering gate remains `BLOCKED` for `RELEASE_READBACK`; local source/test success is not production acceptance. The root integrator must independently rerun integrated tests after cherry-picking this isolated change.

Before any release, retain the existing owner-controlled bound Apps Script identity/revision and separate read-only key requirements, real authenticated private reads of all 13 sources plus negative authorization checks, Core/CRM functional and reconciliation acceptance, real Actual/Future/Forecast readback, current deployment-capacity evidence, all product/booking safety gates and required owner approval. Revoke public access only after the protected transport is proven and rollback is ready. This patch authorizes no merge, deployment, flag/secret/ACL change, booking/customer mutation, outbound message or automation action.

Rollback of this source repair is a revert of its isolated commit; no external rollback action exists because no external state changed.
