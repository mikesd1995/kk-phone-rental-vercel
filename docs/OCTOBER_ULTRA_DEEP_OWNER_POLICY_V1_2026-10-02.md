# October Ultra Deep Owner Policy V1 — 2026-10-02

Owner rules locked for the October full-loop run:
- owner-hidden/tombstoned events must never be recreated;
- any date with an existing booking is skipped from repeated discovery;
- if a date has a booking and stock remains, current event price is locked and is not repriced;
- otherwise fresh exact-event competitor evidence continuously aligns KK price to the market median: KK above market reduces, KK below market increases;
- absence of fresh competitor evidence never invents a market adjustment;
- verified changed official artwork requests a poster update; unverified art cannot replace storefront art;
- every price/poster mutation must use the existing governed Admin write path and exact production readback;
- Scanner remains staging-only and has zero production writes.

This policy does not create a second writer and does not override owner visibility history.
