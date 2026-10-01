# LINE empty customer fields recovery — 2026-10-01

## Evidence
Production real acceptance at 14:03 Asia/Bangkok restored the Flex card and returned HTTP 200, but blank optional fields in the Storefront prefill were misparsed: pickup consumed the following nickname label and nickname consumed the following phone label.

## Root cause
The parser used `\\s*` after the field colon. In JavaScript regex, `\\s` includes newline characters, so an empty value allowed the matcher to advance onto the next labelled line before capturing `[^\\n]*`.

## Fix
Keep whitespace after the colon horizontal-only (`[ \\t]*`) and keep capture line-bounded (`[^\\r\\n]*`). Empty pickup/nickname/phone values now remain empty. Existing Flex behavior then omits those optional rows rather than rendering a neighboring label as customer data.

## Safety
Required event/date/venue/package parsing is unchanged. Canonical package/price validation is unchanged. No booking write, inventory write, pricing write, or LINE signature behavior is changed.

## Acceptance
Regression coverage uses the exact field layout observed in the 14:03 production message, plus a filled-fields case and Flex omission assertion.
