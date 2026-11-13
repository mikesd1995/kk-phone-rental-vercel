# KK Phone Rental — First-visit Terms, clean LINE booking message (2026-11-11)

## Customer-reported UX problem
The checkout Terms modal interrupts booking and can deter customers. The web-generated LINE OA message also includes two redundant-looking legal statements. This patch moves the explicit checkbox to first arrival on the website and removes both automatic Terms/Privacy statement lines from the booking and waitlist drafts.

## Contract implemented
1. On the first browser visit, before browsing/booking, show the unchecked Thai/English Terms confirmation with direct links to the same-version Terms and Privacy documents. The sole button stays disabled until explicitly checked. The dialog is not dismissible using Escape/backdrop; no silent implied acceptance.
2. On confirmation, store only the current Terms version in first-party localStorage + a functional, Secure SameSite=Lax cookie (180-day maximum), with current-page fallback. Do not store name, phone, LINE ID, booking, timestamp or proof. A new version/cleared storage/new isolated in-app browser requires another first-visit prompt. The existing version is `KK-TERMS-2026-11-06`.
3. Confirmation never opens LINE or submits a booking. After confirmation, all booking/waitlist/LINE buttons use the existing native deep links without a second Terms modal, unchanged stock/price/event/Owner Locks gates.
4. The LINE draft carries only rental or waitlist details. Remove two automatically appended legal acknowledgement lines. The existing LINE webhook's legacy exact-line verification remains strict and never fabricates acceptance: requests without those customer-origin lines are `TERMS_NOT_CONFIRMED`. Direct LINE users may still voluntarily send the explicit lines and can be validated.
5. Keep the existing customer-facing LINE OA Flex acknowledgement card (receipt, not consent) and owner's booking approval/price/inventory safeguards. No provider send or booking write is triggered from browser code.

## IMPORTANT evidence gap / release risk
A first-party browser cookie or localStorage flag **does not identify the LINE customer** and cannot legally or technically establish that a particular LINE account accepted the Terms. Removing the two LINE legal lines means an ordinary web-originated booking has no existing authenticated LINE consent evidence. The governed pending booking note must therefore remain `TERMS_NOT_CONFIRMED`, with the existing owner warning and manual verification obligation. **Do not relabel these cases as confirmed, remove the owner warning, or infer server consent from the cookie.**

If the business requires a LINE-identity-linked, auditable one-time acceptance without further LINE text, that is a separate authenticated LINE Login plus server receipt feature (Draft PR #856), not part of this low-friction browser UI patch. No silent migration or invented cross-device feature.

## Modified surfaces / regressions
- `assets/kk-booking-agreement.js`, `index.html`, `script.js`
- `terms/index.html`, `en/terms/index.html`, `privacy/index.html`, `en/privacy/index.html`
- `tests/storefront-booking-agreement*.test.js`, `tests/kk-booking-terms-evidence.test.js`, `tests/public-legal-documents.test.js`
- `scripts/qa/storefront-booking-agreement-qa.cjs`: 8 viewport widths, first-entry screenshot in TH, stale-version screenshot EN, blocked localStorage cookie fallback, no outbound LINE traffic.

## Safety / rollout
- Branch `fix/first-visit-terms-clean-line-20261111`, based on Main `735bbf7c159df7f2fd6b93e5324df131727f91c9`, separate from completed PR #859 and draft PR #856.
- Require exact-head tests, independent review, candidate-bound owner visual acceptance, governed release authorization and production readback. Do not infer approval from previous owner exception.
- No production, LINE provider, real customer data, booking or inventory writes by tests.
- If customer-facing/operational behaviour is unacceptable, revert only this scoped PR; the legacy two-line LINE evidence behaviour can be restored without changing canonical booking data.
