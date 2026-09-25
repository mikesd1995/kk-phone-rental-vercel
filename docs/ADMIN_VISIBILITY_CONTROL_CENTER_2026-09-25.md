# Admin visibility control center — 2026-09-25

## Owner semantics

The Admin Package Override card is now the single control center for storefront visibility.

- **ซ่อนงานจากหน้าบ้าน** changes only `01_Events.active_on_web=false`. The entire event card disappears from the storefront.
- **ซ่อนทุกแพ็กเกจ** changes package visibility only. Package choices disappear, but the event card remains online as a full/waitlist card so customers can still join the queue.
- Re-opening the event restores the card using the package visibility state that already exists.
- Re-opening packages does not automatically re-open a hidden event card.

## UX consolidation

The Event visibility button was removed from the separate Edit Event card and placed beside:

- ซ่อนทุกแพ็กเกจ
- เปิดทุกแพ็กเกจ
- ใช้สถานะจากแพ็กเกจหลัก

This keeps all storefront-visibility actions for one selected event in the same operational panel.

The Package Override event selector now includes hidden open future events so an event hidden from the storefront can be selected and restored from the same panel.

Selector annotations distinguish the two layers:

- package state: 🟢 hidden / 🟡 partial / 🔴 visible
- event-card state: 👁 การ์ดแสดง / ⛔ การ์ดซ่อน

## Safety

The event-card quick action sends only `event_id` and `active_on_web` through the existing `updateEvent` action. It does not change package visibility, price, booking, stock, event status, or assets.

The package bulk actions remain separate and continue to use `bulkSetEventPackageVisibility`.
