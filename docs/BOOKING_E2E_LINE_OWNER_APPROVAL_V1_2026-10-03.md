# Booking E2E + LINE Owner Approval v1 — 2026-10-03

## Locked objective
This is the current Critical Path for KK Phone Rental. The owner should only need to:
1. approve/reject a booking;
2. later mark physical fulfillment states;
3. approve marketing posts in a separate phase.

All unrelated feature work is paused until this booking path reaches production acceptance.

## Flow implemented
```text
signed LINE booking message
  -> canonical event/package resolution
  -> createLineBookingPending (idempotent request_id)
  -> pending active hold reserves package capacity
  -> push LINE approval card to owner
  -> owner Confirm / Reject postback
  -> HMAC verification + exact owner user verification
  -> decideLineBookingPending under Apps Script DocumentLock
  -> pending -> confirmed OR pending -> cancelled only
  -> exact Sheet readback
  -> automatic LINE result to customer
```

## Safety properties
- Existing LINE signature verification remains the public ingress boundary.
- Automation stays fail-closed unless `KK_LINE_BOOKING_AUTOMATION_ENABLED=true`.
- Activation also requires:
  - `KK_ADMIN_SCRIPT_URL`
  - `KK_ADMIN_API_KEY`
  - `LINE_CHANNEL_ACCESS_TOKEN`
  - `LINE_CHANNEL_SECRET` (or optional dedicated `KK_LINE_APPROVAL_SECRET`)
  - `KK_OWNER_LINE_USER_ID`
  - optional `KK_OWNER_LINE_TARGET_ID` (defaults to owner user ID; useful when notifications go to a group)
- Booking creation still uses the dedicated `createLineBookingPending` action; it never routes to legacy `createBooking`.
- The LINE webhook does not directly call generic `updateBooking` for owner decisions.
- Owner actions are HMAC-signed and bound to the decision + booking ID.
- Customer LINE ID is not embedded in the approval button; after decision the notification target is read back from the canonical Booking row.
- Only the configured owner LINE user can execute the decision postback.
- The backend decision is atomic and pending-only. Repeating the same decision is idempotent; a conflicting second decision is rejected.
- Pending/confirmed remain active stock holds by existing package-count formulas. Physical asset IDs stay blank until prepared/picked_up, preserving current allocation policy.
- If canonical event/package resolution is uncertain, no Booking business write occurs.

## Activation / acceptance gate
Repository merge is not production activation by itself.

Before enabling the flag in Production:
1. deploy the repository `apps-script/Code.gs` authority containing `decideLineBookingPending` through the controlled Apps Script deployment path;
2. verify authenticated `phase1Health`/source equivalence;
3. configure owner LINE IDs and activation flag server-side (never commit secret values);
4. send one legitimate signed booking message;
5. verify exactly one pending booking and exact `booking_id` readback;
6. verify owner receives one approval card;
7. Confirm once and verify `confirmed` readback + customer confirmation;
8. redeliver the original webhook and repeat the same owner action; require no duplicate booking and idempotent decision;
9. create a controlled second pending request and Reject; verify `cancelled` releases package capacity;
10. confirm storefront availability/revenue Future refresh from the canonical Sheet.

No synthetic customer/business row should be left behind after controlled acceptance.
