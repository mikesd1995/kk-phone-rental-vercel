# Seamless UX Phase 4 — Storefront + Admin — 2026-09-26

## Goal

Reduce operator mistakes, reduce repeated scrolling/clicking, keep availability fresher, and shorten the most common booking workflow without changing rental business rules.

## Storefront

### Smart freshness

The public page now records the last successful data load. When the browser returns to the foreground after more than three minutes, availability is refreshed in the background unless an Event Detail modal is open.

This closes the gap where a customer could leave a tab open while stock changed through a new Booking.

### Retry before LINE fallback

Transient feed errors now show two choices:

- retry data loading in place;
- contact the shop through LINE.

The previous behavior exposed only the LINE escape path.

### Browsing flow

Search + month + availability filters are wrapped in a mobile sticky browse control surface so customers can change scope without scrolling back to the top.

The page now also exposes a semantic main landmark and keyboard skip link.

Very narrow displays (<=400px) use a one-column event grid for legibility.

Reduced-motion users receive a no-animation fallback.

## Admin

### Unsaved work protection

Operational forms are marked dirty on input/change. The Admin now:

- displays an unsaved-work badge;
- warns before navigating to another Admin tab;
- warns before closing/reloading the page;
- clears dirty state after successful writes/reset.

Automatic foreground snapshot refresh is suppressed while unsaved forms exist.

### Smart foreground refresh

When the Admin regains visibility and the last accepted snapshot is older than three minutes:

- no dirty form -> refresh snapshot in the background;
- dirty form -> keep the operator's work and display a warning instead.

### Quick Booking

The everyday Booking path now keeps the highest-frequency fields visible:

- Event
- Package
- Customer
- Contact
- Phone
- Payment state
- Amount

Less common overrides are collapsed under “ตัวเลือกเพิ่มเติม”:

- Booking status
- contact channel
- pickup time
- manual phone/lens assignment
- lead reference
- note

Backend field names and payload semantics are unchanged.

### Batch Change Preview

Event Control Center batch actions now display the exact Event list that will be mutated and the count that will be skipped before the first write is sent.

Existing safety remains:

- maximum 12 effective writes;
- redundant target-state rows skipped;
- sequential write/readback behavior;
- Event-card Undo where exact reversal is safe.

### Global Admin Search

Ctrl/Cmd+K now opens a cross-entity command search across:

- Events
- current Bookings
- Customer History

Results route directly to the relevant operational surface.

The slash key still focuses the search control in the current workspace.

### Mobile / accessibility

- operational mini-buttons receive >=44px touch targets on mobile;
- Admin also honors reduced-motion preference;
- Package/Price navigation labels are clarified as “ราคา & หน้าบ้าน” and “ตรวจสอบราคา”.

## Safety boundary

Deployment itself does not mutate Booking, price, stock, Asset, Event visibility, Package visibility, Apps Script settings, Sheet business rows, secrets, or environment variables.

All business writes still require explicit operator action.

## Deferred intentionally

These items remain separate future work because they require broader information-architecture or data-contract changes and are not needed for this safe UX hardening:

- merging Today and Action Center into one canonical workflow;
- merging Package workspace and Pricing Center into a single tab structure;
- Audit Log UI backed by snapshot/API audit rows;
- persistent Saved Views beyond existing Event Control session state;
- Notification Center;
- GA4 activation, which still requires a real Measurement ID.
