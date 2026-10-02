# V6 production mobile storefront audit — 2026-10-02

## Evidence
Owner-supplied production screenshots from iPhone Safari at 08:17 Bangkok time showed the V6 storefront and the GMMTV FANIVAL 2026 package modal.

## Confirmed defects and root cause
1. The modal date used the Unicode calendar emoji before the real date. On iOS the glyph renders as a calendar page showing JUL 17, which visually contradicts the actual event date 02/10/2026.
2. The package rows retained mobile grid-template-areas from the legacy base stylesheet. V6 hides the old phone icon and changes the columns, but did not reset the inherited named grid areas. The package information was therefore forced into the second column, leaving a large ghost column on the left.

## Remediation
- Replaced the ambiguous calendar emoji with localized text labels: วันที่: / Date:.
- Reset V6 package rows with grid-template-areas:none and reset .ph-info/.ph-right grid-area to auto.
- Added regression assertions covering both failure modes.
- No booking, pricing, availability, API, Admin, Apps Script, inventory, or production-write behavior changed.

## Acceptance intent
Mobile modal must use the full content width, keep price and booking CTA readable, show the exact event date without a misleading glyph, and preserve all existing booking URLs and package data behavior.
