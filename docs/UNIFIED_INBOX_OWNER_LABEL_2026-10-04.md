# Unified Inbox owner customer label — 2026-10-04

## Goal
Match the useful LINE OA behavior where the shop can rename a conversation for internal operations, e.g. customer name + booking date + rented model, without changing the customer's real LINE profile name.

## Data model
- `display_name` remains provider truth from LINE/X and continues to refresh from the provider.
- `owner_label` is the shop-controlled label and takes precedence in Admin display/search.
- Clearing `owner_label` falls back to the provider display name.
- `owner_label_updated_at` and `owner_label_updated_by` preserve update metadata.
- Rename operations are appended to Inbox audit as `owner_label_updated`.

This separation is deliberate: LINE profile hydration must never overwrite the shop's internal label.

## UX
- The selected Inbox thread has a dedicated `แก้ชื่อ` button.
- The dialog is prefilled with the current effective name.
- Suggested format: `ชื่อลูกค้า · วันที่จอง · รุ่นที่จอง`.
- Maximum 80 Unicode characters.
- When a custom label exists, the original provider profile name is still visible underneath for identity verification.
- `ใช้ชื่อ LINE` clears the custom label and returns to provider display name.

## Runtime/API
- Admin action: `inboxSetOwnerLabel`.
- Requires the existing authenticated Admin session/PIN gate.
- No provider message is sent.
- No Booking/Event/Pricing path is touched.
- X outbound and AI auto-send behavior are unchanged.

## Database
Canonical Inbox Supabase project: `mxjnjujqjybqughsnqbz`.

Migration applied successfully:
`add_inbox_owner_customer_labels`.

The migration adds the three owner-label columns, updates list/get RPCs so owner labels are returned and searchable, and adds server-only RPC:
`public.kk_inbox_set_owner_label(text,text,text)`.

## Acceptance plan
1. repository syntax/regression gates for the exact branch head;
2. Vercel Preview READY;
3. merge;
4. exact merged commit reaches Production READY;
5. production Admin: select a real conversation, rename it, reload, confirm the custom label persists and the provider profile name remains visible;
6. clear with `ใช้ชื่อ LINE`, reload, confirm fallback to provider name.

Do not use a real customer's label as automated acceptance data. Final interactive rename proof should be performed deliberately by the owner in Admin.
