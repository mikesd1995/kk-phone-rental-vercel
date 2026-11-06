# KK Phone Rental — LINE Terms Acceptance Evidence V1

Effective public Terms revision: `KK-TERMS-2026-11-06` (6 Nov 2026).
Public documents: https://kk-phone-rental.vercel.app/terms/ and https://kk-phone-rental.vercel.app/privacy/

## What has changed
- For **web-originated package bookings and waitlist requests**, customers must first check the existing Terms acceptance checkbox (unchecked on every attempt).
- The LINE message draft now includes two explicit, versioned lines following the booking details:
  `✅ ยืนยันยอมรับเงื่อนไขการเช่า KK Phone Rental (KK-TERMS-2026-11-06)`
  `ℹ️ รับทราบนโยบายความเป็นส่วนตัว: https://kk-phone-rental.vercel.app/privacy/`
- Customers must **press Send in LINE themselves**. A checkbox, LINE deep-link open, local click analytics, or unsent LINE draft is NOT evidence of customer acceptance.
- The existing LINE webhook authenticates the raw inbound payload using LINE's X-Line-Signature. Existing Inbox persistence, *when configured and operating*, stores the text, LINE-origin identifier and LINE-supplied timestamp. No new standalone customer/consent database is created.
- On an inbound booking text, the parser matches **both exact lines** for the current revision. The existing canonical pending-booking note appends `TERMS_ACK:KK-TERMS-2026-11-06` or `TERMS_NOT_CONFIRMED` to the existing hashed LINE request reference; no customer name, phone or secret is put into the evidence marker.
- The owner-approval notification shows confirmed versus missing acknowledgement. The existing owner approval button itself is **not automatically disabled**; operator must check the evidence before confirming.

## Direct LINE contact: operator procedure (manual, no new automation)
If customer messages LINE OA directly or removes the acknowledgement lines from a draft, send the following message from the shop's LINE chat, only when a rental agreement is being considered:

> ก่อนยืนยันคิว กรุณาอ่านเงื่อนไขการเช่า: https://kk-phone-rental.vercel.app/terms/
> และนโยบายความเป็นส่วนตัว: https://kk-phone-rental.vercel.app/privacy/
> หากยอมรับ โปรดตอบกลับด้วยข้อความ 2 บรรทัดนี้:
> ✅ ยืนยันยอมรับเงื่อนไขการเช่า KK Phone Rental (KK-TERMS-2026-11-06)
> ℹ️ รับทราบนโยบายความเป็นส่วนตัว: https://kk-phone-rental.vercel.app/privacy/

Check that the reply comes from the **same customer LINE conversation**, and matches the current Terms version, **before confirming the booking**. Keep the ordinary LINE conversation or existing access-controlled Inbox record as evidence, subject to the privacy notice and legitimate retention/erasure obligations. Do not copy identity documents or phone numbers into a new consent worksheet merely for proof.

## Hard boundaries
- The LINE webhook's existing signed message is the evidence source; the web checkbox is a UX gate only.
- The evidence marker is not proof of a booking, payment or a legally definitive signature.
- No retroactive acceptance is inferred for prior chats, bookings or checkboxes.
- If Inbox persistence is disabled or fails, a durable independent electronic consent ledger is **not guaranteed**. Consult the original LINE chat; do not claim an Inbox record exists.
- Direct-LINE acknowledgement **does not retroactively change** a previously generated pending Booking note. The owner must verify the subsequent reply in the customer chat before confirming; never edit business SOT without the proper owner process.
- Do not auto-message customers, enable LINE sends, grant provider permissions, change stock/prices or create/approve bookings as a side effect of these tests.
- Update the Terms date, version marker, both LINE draft builders, webhook matching and tests **in one reviewed change** whenever the substantive Terms change.
- The wording is an acknowledgement of *service terms* and notice of *privacy policy*, not a blanket PDPA marketing-data consent.
