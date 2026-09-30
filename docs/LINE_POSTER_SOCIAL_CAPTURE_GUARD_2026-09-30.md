# LINE poster social-capture guard — 2026-09-30

## Incident
Customer screenshot showed the Nineentertain 24th Anniversary booking confirmation Flex card using a social-post screenshot as its hero image. Canonical package pricing was checked separately: the 590 THB bundle is correct (phone 490 + lens 100) and was not changed.

## Root cause
The canonical 08_Web_Ready row used a wx2.sinaimg.cn image. server/line-poster.js explicitly allowed sinaimg.cn, so a mirrored social screenshot was considered a valid LINE poster merely because it was JPEG/PNG.

## Scope audit
At investigation time, exactly one canonical 08_Web_Ready row used sinaimg.cn: EVT-20260930-NINEENTERTAIN-24TH-ANNIVERSARY. Other supported LINE poster sources were Google Drive/googleusercontent and same-origin KK assets.

## Fix
Removed sinaimg.cn from the LINE poster source allowlist. Unsupported/social-mirror sources now fail closed and the booking Flex falls back to text-only instead of showing an unsuitable screenshot. No pricing, booking, event, inventory, or customer data was mutated.

## Regression
Updated tests/line-poster-delivery.test.js to require rejection of sinaimg social-mirror URLs while preserving canonical Google Drive poster normalization/resolution and image delivery safety checks.

## Acceptance
Required closure: regression CI -> merge -> exact-main Production deployment -> runtime/readback. A past LINE message cannot be edited retroactively; the guard applies to new confirmations after deployment.
