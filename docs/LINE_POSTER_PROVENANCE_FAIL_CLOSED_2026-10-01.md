# LINE poster provenance fail-closed repair — 2026-10-01

## Incident
A LINE booking confirmation for Nineentertain 24th Anniversary Charity Concert displayed a social/news screenshot as the Flex hero. The canonical event row uses a Sina social-mirror image URL.

## Root cause
The poster proxy already rejects non-approved poster hosts, but the booking webhook advertised the same-origin proxy URL whenever a canonical row merely contained a non-empty poster_image_url. Validation was split: the Flex could advertise a hero whose upstream source the proxy itself would reject.

## Repair
- Reuse `server/line-poster.safePosterSource` in the booking webhook before attaching a hero.
- Unsupported/social-mirror sources now produce text-only Flex instead of an invalid or misleading hero.
- Approved Drive/googleusercontent/local event-poster sources retain the same-origin `/api/line-poster` delivery route.
- No business data, booking, event price, or canonical poster field is mutated.

## Price integrity
PR #365 canonical package-price repair remains intact: confirmation price resolves from `08_Web_Ready` + `09_Web_Packages`, never calculates a Lens markup, and fails closed to shop price review when no unique package price resolves.

## Regression
The Nineentertain Sina fixture must resolve to no hero. A separate approved Drive fixture must retain the proxy hero URL.
