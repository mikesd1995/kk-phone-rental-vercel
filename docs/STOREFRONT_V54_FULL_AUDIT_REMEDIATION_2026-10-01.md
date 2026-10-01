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
