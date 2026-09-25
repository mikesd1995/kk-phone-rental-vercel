# Admin event visibility toggle — 2026-09-25

## Owner rule

Event visibility and package visibility are separate controls.

- **ซ่อนงานจากหน้าบ้าน** changes only `01_Events.active_on_web` to false.
- It does not close/delete the event.
- It does not change package prices or package visibility.
- It does not mutate bookings or stock.
- Hidden open future events remain selectable in **Edit Event** so they can be restored.
- **เปิดงานบนหน้าบ้าน** changes `active_on_web` back to true; storefront availability/waitlist behavior is then determined by current package/stock state.

## Admin UX

The Edit Event card now contains a dedicated state-aware button:

- visible event → **ซ่อนงานจากหน้าบ้าน**
- hidden event → **เปิดงานบนหน้าบ้าน**

The existing `active_on_web` select remains available for manual edits, but the button provides the normal one-click workflow.

Hidden events are marked `· ซ่อนเว็บ` in the Edit Event selector.

## Safety boundary

The toggle calls the existing `updateEvent` action with only:

- `event_id`
- `active_on_web`

No status, price, package, booking, asset, or stock field is sent by this quick action.
