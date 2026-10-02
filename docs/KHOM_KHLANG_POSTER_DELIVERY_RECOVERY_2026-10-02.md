# KHOM KHLANG storefront poster delivery recovery — 2026-10-02

## Failure
Storefront V6.3 Visual QA failed only because `EVT-20261005-KHOM-KHLANG-SPECIAL-EP5` fell back from its poster at desktop widths.

Canonical source:
`https://drive.google.com/thumbnail?id=1Vi_EOlbXPwHUb0EvMX2uWaKV0B4kVmIz&sz=w900`

Google Drive metadata proved that source file exists but was `shared=false` and owner-only, so unauthenticated storefront clients cannot render it.

## Recovery
- Preserved the canonical sheet URL as first source of truth.
- Created a 480x600 storefront copy from the same owner file.
- Uploaded that copy into the existing public KK `brand kit` Drive folder.
- Readback proved the new file is broadly shared through the folder.
- Public copy ID: `1f995RLhvIO-aSJb6Hu12lg8BBUgmMAYC`.
- Added only an exact-event fallback for 2026-10-05 KHOM KHLANG Special Episode 5.
- Added regression coverage so the fallback cannot silently disappear.

## Safety
No booking, pricing, inventory, customer-data, Apps Script, or production business mutation is involved. The Visual QA P1 gate remains unchanged and must pass on rerun.
