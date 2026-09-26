# KK Phone Rental — Admin Bulk Event Price Edit

Date: 2026-09-27  
Scope: Admin > Package > Override > แก้ราคาเฉพาะงาน

## Problem

The existing Override card could edit only one package at a time. Creating a new event already had a multi-package price matrix, so correcting prices for an existing event required repeating the same flow package by package.

## Change

Added a **แก้ราคาหลายแพ็กเกจ** panel directly inside the existing event override card.

After selecting an event, Admin now renders all active master packages in one matrix with:

- ราคาเฉพาะงาน
- สถานะ: ใช้ค่าหลัก / เปิดขาย / ซ่อน
- Note

The operator can change multiple rows and press **บันทึกทั้งหมด** once.

The existing single-package editor remains available under **แก้ทีละแพ็กเกจ / รายละเอียดขั้นสูง** for Sort Order and Use Case.

## Write behavior

No new backend endpoint was introduced. The bulk UI uses the existing `upsertEventOverride` write path sequentially for only the rows that changed.

This intentionally reuses the proven write policy, validation, audit routing, and current Vercel/Apps Script compatibility instead of introducing another write surface.

For each changed package the bulk editor also preserves the current:

- `sort_order_override`
- `use_case_override`

so a price-only edit does not erase advanced override metadata.

## Failure behavior

Writes are performed sequentially.

If one or more rows fail:

- successful rows remain saved;
- Admin refreshes the current server state;
- failed rows are restored into the editor as unsaved drafts;
- the operator gets a saved/total result and can retry only the remaining rows.

## UX safeguards

- Save is disabled until an event is selected and at least one row changed.
- Reset is disabled when there is nothing to discard.
- Reset asks for confirmation before dropping unsaved bulk edits.
- Save asks for confirmation with the selected event and number of changed packages.
- Rows with no override stay blank and therefore inherit the master package value.

## Files changed

- `admin/index.html`
- `admin/admin.js`
- `tests/admin-bulk-event-price-edit-20260927.test.js`
- cache-key expectations in existing Admin regression tests
- this audit/change record

## Cache bust

Admin JS cache key changed to:

`bulk-event-price-edit-20260927`

This forces browsers to load the new Admin behavior after deployment.

## Regression coverage

New tests assert that:

1. the bulk editor and controls exist;
2. only changed rows are collected;
3. advanced Sort Order / Use Case values are preserved;
4. the existing `upsertEventOverride` write path is reused;
5. failed rows are restored as retryable drafts;
6. the new Admin JS cache key is active.

Required merge gates remain:

- `npm run check`
- `npm test`
- Vercel Preview / deployment status
