# Mandatory Product / UX / UI Agent Gate — 2026-09-30

## Decision
KK Phone Rental interface work now requires the registered `kk-storefront-ux-reviewer` as an executable Agent Gateway gate, not an informal recommendation.

## Scope
Applies to storefront, Admin UI, product flow, navigation, forms, filters, modals, sticky/fixed controls, responsive behavior and accessibility.

## Required flow
`storefront_ux_review -> scoped implementation -> regression guard -> storefront_visual_qa -> CI -> production runtime/readback`

P0/P1 UX findings block acceptance of the affected surface. The reviewer is read-only and cannot change business truth, merge, deploy or publish.

## Why
A 390px iPhone screenshot on 2026-09-30 showed the clear-filter control compressed/wrapped in the mobile filter toolbar. The reviewer already existed and was callable, but repository engineering policy did not make its invocation mandatory for every interface change. This change closes that governance gap.

## Regression
`tests/kk-product-ux-enforcement.test.js` proves:
- the repository contract names both required UX routes;
- both routes require the real reviewer and persistent invocation evidence;
- a 390x844 iOS three-row filter toolbar is P1 and fails Visual QA;
- the task router returns evidence that `kk-storefront-ux-reviewer` was actually invoked.

## Non-goals
No pricing, booking, inventory, event visibility, Google Sheets, Apps Script or production storefront data is changed by this governance patch.
