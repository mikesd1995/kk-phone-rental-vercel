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
