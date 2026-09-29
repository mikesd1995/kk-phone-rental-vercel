# LINE Booking Webhook Production Acceptance — 2026-09-30

## Scope
- LINE Messaging API booking webhook and Flex poster reply.
- Vercel Hobby serverless-function budget remediation.
- No business-data, pricing, inventory, or Sheet SOT mutation.

## Implemented
- PR #336: verified LINE webhook routed through existing kk-data serverless function.
- HMAC-SHA256 x-line-signature verification and fail-closed credentials.
- Current storefront booking-text parser, canonical poster lookup, Flex reply.
- PR #337: v5 compatibility implementations moved outside /api to server/legacy while v6 and regression tests retain compatibility coverage.
- Removed retired v5 serverless entrypoints/config so deployment stays within the Hobby function budget.

## Gates
- PR #336 Admin Regression #1057: PASS.
- PR #337 first relocation attempts failed and were not merged.
- PR #337 final revision Admin Regression #1066: PASS.
- PR #337 merged as 8b73699bfbe3acae4b9acc8a439efc9f52870511.

## Production acceptance
Pending a production deployment containing commit 8b73699 or later, followed by:
1. /api/line-webhook negative-path check.
2. LINE Developers webhook Verify.
3. Use webhook enabled.
4. One real storefront booking confirming customer text reaches OA and Flex poster reply is rendered.

## Security
LINE_CHANNEL_SECRET and LINE_CHANNEL_ACCESS_TOKEN are environment secrets only and are not committed.
