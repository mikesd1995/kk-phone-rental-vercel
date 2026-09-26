# Event Control Center month-scope + operational truth — 2026-09-26

## Problem

The Event Control Center had become hard to operate as the event catalog grew. On the live dataset there were 92 open current/future events spread across four months:

- September 2026: 8
- October 2026: 48
- November 2026: 29
- December 2026: 7

The operator had to scroll a combined list. The KPI cards were calculated against all upcoming events while the table could be filtered to "needs action", so counts such as 92 on top vs 81 below were individually correct but operationally misleading.

The event-card column also reflected `active_on_web` rather than effective storefront visibility, even though storefront publication additionally depends on Web Ready, data health, and poster availability.

## Changes

### Month-scoped operations

Event Control Center now includes a Month selector with live counts.

Default behavior:

1. Use the current Bangkok month when that month contains open current/future events.
2. Otherwise select the earliest upcoming month with events.
3. Remember the operator's selected month for the Admin session.
4. "All months" remains available for broad review.

### KPI scope consistency

The green/yellow/red/card KPI cards now use the same Month + Search scope as the table.

Status filtering is applied after that scope, so the KPI totals and the table context are understandable together.

KPI cards are clickable filters.

### Smarter "needs action"

"Needs action" no longer treats every intentionally visible package or owner-hidden card as an error.

It targets:

- partially hidden packages;
- missing Web Package snapshot state;
- effective storefront blocks such as data health, Web Ready, or poster problems.

### Effective storefront status

The card-status column is now based on effective storefront truth:

- 👁 แสดงจริง
- ⛔ เจ้าของซ่อน
- ⚠️ Data Health
- ⚠️ ไม่มี Web Ready / Web Ready = hide
- ⚠️ ไม่มี Poster

This is distinct from the owner's raw `active_on_web` preference.

### Selection and batch safety

- Selection is capped in the UI at 12 events.
- Select-visible fills only the remaining safe capacity.
- Changing Month/Search/Status clears the previous selection to avoid hidden cross-scope writes.
- "ดูเฉพาะที่เลือก" and "ล้างที่เลือก" were added.
- Selected count is shown as `x / 12`.
- Batch controls stay available in a sticky action bar while scrolling.

Existing batch preflight still skips rows already in the requested state.

### Row-level quick actions

Each row now exposes:

- แก้ราคา/Package
- ซ่อน Package / ซ่อนให้ครบ / เปิด Package
- ซ่อน/เปิดการ์ด
- ดูหน้าเว็บ when the card is effectively visible

### Poster and date presentation

Poster state is deliberately truthful:

- มี URL
- ยังไม่เข้า Web Ready
- ขาด URL

It does not claim that a remote image URL is network-loadable without an actual fetch check.

Date changes receive stronger visual grouping and the table supports explicit sorting:

- nearest date
- farthest date
- package attention first

## Safety

No business data is changed by deployment.

All writes still require explicit operator actions. Existing meanings remain:

- hiding an Event card sets event visibility and removes the card from storefront publication;
- hiding Packages removes package choices while leaving an otherwise publishable Event card available for waitlist behavior.

No Booking, price, stock, asset, Event visibility, Package visibility, Sheet row, Apps Script setting, secret, or environment value is mutated by this UX rollout itself.
