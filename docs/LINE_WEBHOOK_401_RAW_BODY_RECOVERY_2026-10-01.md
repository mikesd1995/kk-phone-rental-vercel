# LINE webhook 401 raw-body recovery — 2026-10-01

## Incident evidence
Production runtime logs showed `POST /api/line-webhook 401` at 13:02:59 and 13:13:49 Asia/Bangkok. The latter matches the owner's real Storefront→LINE send evidence. The request reached Vercel but failed before parsing/canonical resolution/Flex reply.

## Root cause
`/api/line-webhook` was a rewrite to `/api/kk-data?__kk_line_webhook=1`. The webhook handler then verified LINE's HMAC against `req.body`. Vercel's Node request helper parses `application/json` into an object when possible. The fallback `JSON.stringify(req.body)` is not the exact byte sequence LINE signed, so valid requests can fail HMAC verification.

LINE signature verification must use the exact raw request bytes; disabling verification is not acceptable.

## Fix
- Add a dedicated `api/line-webhook.js` function.
- Disable body parsing for that endpoint.
- Capture the request stream as a Buffer and pass it as `req.rawBody`.
- Keep HMAC-SHA256 + constant-time comparison unchanged.
- Remove the rewrite through `api/kk-data`.
- Add regression tests proving whitespace/order-preserving raw bytes verify while parse/re-serialize bytes do not.

## Safety
No LINE secret/token is logged or exposed. No Booking/Pricing/Inventory/Sheet SOT write is introduced. This fix only restores authenticated webhook ingress and the existing Flex reply path.
