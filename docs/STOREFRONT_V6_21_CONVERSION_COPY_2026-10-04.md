# Storefront V6.21 — Conversion Copy Pass — 2026-10-04

## Scope
Owner-requested copy/CTA rewrite from real iPhone production screenshot. Presentation/copy only; no event visibility, booking, inventory, availability, price, scanner, or writer semantics changed.

## Conversion hierarchy
Value proposition → trust → find event → availability → package → LINE booking.

## Changes
- Hero identifies the durable rental proposition: phones for concerts/fan meetings, without naming a specific model so the storefront remains valid as inventory expands.
- Model-agnostic rule: hero/global storefront copy must not hard-code a phone model; models belong in package/inventory data and event/package UI.
- Thai hero: “ไกลแค่ไหน ก็เก็บโมเมนต์ได้ใกล้กว่า”; English intent-equivalent: “BRING THE STAGE CLOSER.”
- Primary CTA changed to availability intent: “เช็กงานที่ยังว่าง” / “Check available events”.
- Secondary CTA shortened to “เช่ายังไง?” / “How to rent”.
- Benefits rewritten from feature labels toward customer outcomes while preserving locked commercial facts.
- Event heading changed from editorial “คืนนี้ของคุณ…” to task-oriented “เลือกงานของคุณ แล้วเช็กคิวว่างได้เลย”.
- Month/filter/card/LINE microcopy shortened around customer intent.
- TH/EN are implemented through the existing I18N runtime; language switching remains functional.
- Dark/light implementation is untouched: the existing data-theme, persisted theme, theme-color and theme toggle remain authoritative. No hard-coded light-only presentation was introduced.

## Acceptance gates
- Verify TH initial paint and TH runtime copy.
- Switch to EN and verify all changed strings update without stale Thai copy.
- Toggle light/dark in both languages.
- Verify hero CTA scroll target, booking journey link, filters, event-card CTA, modal CTA and LINE CTA.
- Confirm no business/data semantics changed.
- Production promotion only after preview/readback acceptance.
