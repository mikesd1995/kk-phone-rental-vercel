# Admin smart package visibility status — 2026-09-25

## Problem

As the event catalog grows, the operator can no longer reliably remember which events already had their storefront packages hidden. Re-clicking **ซ่อนทุกแพ็กเกจ** wastes time and risks unnecessary duplicate write attempts.

## Owner workflow

The Package Override event selector now exposes storefront package visibility before any write:

- 🟢 **ซ่อนแล้ว** — every `09_Web_Packages` row for the event is hidden.
- 🟡 **ซ่อนบางส่วน** — some package rows are hidden and some remain visible.
- 🔴 **ยังแสดง** — no package rows are hidden.
- ⚪ **ไม่มี Web Package** — the snapshot has no web package rows for the selected event.

The selected event also shows a compact live status strip with hidden/total counts.

## Smart guards

- When all packages are already hidden, **ซ่อนทุกแพ็กเกจ** is disabled and relabeled **ซ่อนแล้ว ✓**.
- When no packages are hidden, **เปิดทุกแพ็กเกจ** is disabled and relabeled **เปิดอยู่แล้ว ✓**.
- The click handler also has a second guard that refuses redundant hide/show writes even if the button state is bypassed.
- After any successful bulk action, the existing Admin refresh/readback updates the indicator and event selector.

## Source of truth

The indicator reads `state.data.web_packages`, which reflects `09_Web_Packages.package_status`. It does not guess from button history or local browser state.

## Safety

This feature is read-only until the operator explicitly presses an existing bulk visibility action. The indicator itself does not mutate Event, Package, price, Booking, Stock, or Sheet data.
