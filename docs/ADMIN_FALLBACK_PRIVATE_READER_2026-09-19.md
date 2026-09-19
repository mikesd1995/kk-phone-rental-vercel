# Admin fallback private-reader preference + telemetry — 2026-09-19

The emergency Admin snapshot fallback remains read-only. This hardening changes its transport preference:

1. if Google service-account credentials are configured, read the Core workbook through the Google Sheets API first;
2. if the private read fails and `KK_ADMIN_FALLBACK_REQUIRE_PRIVATE` is not enabled, temporarily fall back to the historical public GViz path;
3. if `KK_ADMIN_FALLBACK_REQUIRE_PRIVATE=1`, missing/failed private reader fails closed.

No credentials or permissions are changed by this patch.

Successful fallback runtime logging is restricted to trigger class, reader/source, aggregate counts, and latency. Row data, customer names, phone numbers, contacts, IDs, notes, links, or other payload contents are not logged.

The long-term target remains: validate the private reader, share the Core workbook only with required identities, set the private-required flag, then remove anonymous operational-tab readability.
