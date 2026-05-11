# KK Phone Rental Frontend v13.4 — Lean Compatibility Report

## Updated for backend v13.4

- `config.js` now reads event data from `08_Web_Ready!A4:K`.
- `config.js` now reads package data from `09_Web_Packages!A4:L`.
- `script.js` now supports the lean package headers: `price`, `package_status`, `model_display`, `lens_display`, `web_note`.
- Hidden package rows are excluded when `package_status = hidden`.
- Full package rows are kept in the data layer but not shown as bookable.
- Existing fallback behavior for old package headers is still preserved where possible.

## Backend expectations

- Do not edit `08_Web_Ready` or `09_Web_Packages` manually.
- Add events in `01_Events`.
- Add physical phones/lenses in `02_Assets`.
- Add standard packages in `03_Packages`.
- Use `04_Event_Overrides` only for special event-level price/note/active changes.
