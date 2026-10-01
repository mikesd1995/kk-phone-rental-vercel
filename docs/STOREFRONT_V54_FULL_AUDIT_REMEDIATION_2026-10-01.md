# Storefront V5.4 Full Audit Remediation — 2026-10-01

## Scope
Read-only storefront UX/UI remediation. No booking, pricing, inventory, event-truth, or production business-data mutation.

## Findings addressed
- Geometry-only visual QA could pass without exercising search/filter/modal/FAQ/language interactions.
- Technical visual status and owner visual acceptance were difficult to distinguish in the summary.
- Mobile event-card affordance dropped below the 44px target.
- 320x568 composition delayed the first event unnecessarily.
- Public SEO discovery files were absent.

## Changes
- Added read-only Playwright interaction checks for search empty/restore, status filters, FAQ open/Escape close, event modal open/Escape close, and TH/EN switching.
- Added explicit technical_visual_pass, interaction_pass, and owner_visual_acceptance evidence.
- Kept forms_submitted and production_writes at zero; external LINE booking links are never clicked by the interaction test.
- Restored .pi-tap to a 44px minimum on mobile.
- Compacted the short <=350px / <=650px hero and event-heading spacing.
- Added robots.txt and sitemap.xml.

## Safety
- No pricing mutation.
- No booking mutation.
- No inventory mutation.
- No production business-data write.
- No auto-merge or production deploy in this remediation.


## Follow-up regression findings
- Admin Regression at `90b7df9`: 1019/1020 passed. The sole failure was the obsolete automation contract that prohibited all click/fill/press operations; it was updated to allow only read-only in-page interaction checks while preserving zero form submissions and zero production writes.
- The new interaction QA then exposed a real 375px defect: `.filter-clear-btn` overlaid the `งานทั้งหมด` status filter and intercepted pointer events after a filter change.
- Corrected the mobile clear-filter row to participate in normal document flow, retain a 44px touch target, and remain hidden when inactive.
- Validation rerun requested on exact HEAD `9e2f08300e06426a3a265d1fab6fe20086f30554`.


## Exhaustive artifact review follow-up
Reviewed the exact-head Visual QA screenshots at 320x568, 375x812, 390x844, 430x932, 480x932, 768x1024 and 1024x768.
- Technical visual QA and read-only interaction QA passed on `501db5b`; the workflow remained red only because owner visual acceptance is intentionally BLOCKED and must not be synthesized.
- Admin Regression passed on `501db5b`.
- Found a navigation gap not classified by the previous metric gate: mobile CSS hid the header FAQ entry point with no replacement. Added a 44px footer FAQ entry and bound it to the existing accessible FAQ dialog.
- Found browse friction in long mobile catalogues: the search/filter shell had been demoted to non-sticky despite staying inside the reviewer sticky-height budget. Restored compact safe-area-aware sticky behavior on <=600px.
- Extended the read-only QA to exercise the visible FAQ entry on mobile as well as desktop.
- Existing evidence also confirms no tap targets below policy budget, 16px minimum form controls, one-row mobile filters, no root horizontal overflow, and successful search/filter/modal/language interactions.


## Catalogue readiness race remediation
Exact-head run `36861234823` exposed a deterministic acceptance race at 320px: interaction QA started while `#content` still contained skeleton cards, producing false search/filter/FAQ failures and a pointer interception timeout on the skeleton grid.
- Added an explicit 15s readiness gate requiring the skeleton grid to detach and a real `.concert-card:not(.skeleton-card)` to become visible.
- Interaction selectors now target only real event cards.
- Added dedicated fail-closed code `STOREFRONT_DATA_NOT_READY` with bounded readiness diagnostics.
- Added regression assertions locking this readiness contract.
- No production/business write path was changed.
