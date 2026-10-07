
## Business data audit — 2026-10-07 late night
Read-only canonical Master50 + Archive60 = helper110. Exact source/id/status/event/amount multiset matches. Actual65535, Future19530, Forecast85065 THB; formulas follow locked status policy. Inventory2 rentable phones/2 lenses,22 active holds, operations-engine collision check empty. Not transactional end-to-end acceptance.
Archive has2 duplicated booking IDs across different events (4 rows); these are identity collisions, not established duplicate transactions. Do not deduplicate revenue or delete rows automatically.5 confirmed current bookings have zero recorded amount despite positive current package prices; negotiated prices/payment evidence needed before changes.1 confirmed booking has Missing customer/contact risk. No invented contact, price, or reservation release.
Code.gs allocator checks both Master+Archive IDs; focused identity regressions9/9PASS. Deployed source equivalence still unverified. No business writes or messages. Next: reconcile historical identity/reference mapping and source payment/intake evidence via governed paths; leave correct revenue formulas intact.


Detailed row references (canonical sheet 12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU):
- Archive G6/G7: BK-20260606-001, different events; statuses cancelled/completed, amounts1390/0.
- Archive G25/G26: BK-20260718-001, different events; both completed, amounts690/890.
- Master zero amounts: rows50,53,54,55,56; IDs BK-20261121-003, BK-20261107-001, BK-20261206-003, BK-20261207-001, BK-20261108-001 respectively. Current formula package prices890,990,1390,1390,790 are NOT established agreed prices.
- Master row54 has missing customer/contact risk. Do not fabricate values.
- Across22 holds current price sum25080 versus recorded amount19530; difference5550 is not a proven receivable or correction amount.
- Revenue statuses across110 source rows: completed71,confirmed22,cancelled17.
- No duplicate IDs in50 current Master records.
- Read ranges: Master A5:D1000/I5:Q1000/U5:AE1000; Archive G2:J300/O2:W300; helper A1:G500/L1:O500; assets A5:C30/E5:G30; dashboard A4:L4 formulas.
- Closed historical Web inactive warnings are not permission to reopen events.
- Initial analysis adapter incorrectly joined cloned asset objects by reference; corrected by row index before evaluating operations-engine. Final inventory2+2, issues=[].
- PR metadata update failed twice with GitHub internal error; this document is the fallback cross-chat handoff.
- Existing blocker evidence remains in PR661: exhausted Actions included minutes notification, no runner allocated, production Apps Script9_5_9 vs expected9_5_13, Preview Apps Script CONFIG_BLOCKED.
