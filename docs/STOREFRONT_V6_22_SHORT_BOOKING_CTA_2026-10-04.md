# Storefront V6.22 — Short booking CTA — 2026-10-04

## Scope

Owner-requested conversion cleanup for the package modal after production iPhone review.

## Change

- Thai package CTA: `จองแพ็กเกจนี้ผ่าน LINE` → `จองเลย`
- English package CTA: `Book this package on LINE` → `Book now`
- Thai modal helper copy now points to the short CTA: `ถ้างานยังว่างให้กด “จองเลย” ถ้างานเต็มให้เข้าคิวรอผ่าน LINE ได้เลย`.
- English helper copy uses the same hierarchy when that exact prior string exists.
- Script cache marker: `storefront-v622-short-booking-cta-20261004`.

## Rationale

The previous CTA was too long for the compact right-hand booking control on mobile. The shorter verb-first CTA is faster to scan, preserves intent, and keeps the channel detail in surrounding helper/LINE flows rather than inside the button label.

## Guardrails

No changes to:
- package price
- package availability
- booking eligibility
- LINE booking URL/message construction
- inventory
- event visibility
- TH/EN switching
- Light/Dark theme
- modal scroll behavior

## Acceptance

Require:
1. exact source readback of `จองเลย` / `Book now`;
2. production deployment on current main;
3. production `script.js` marker/readback;
4. no claim of real-device visual acceptance without rendered evidence.
