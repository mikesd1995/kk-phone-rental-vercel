# Ultra Deep Social Profile False Positive Guard — 2026-10-03

## Incident

Full Loop run 37043175753 wrote one event that passed verifier incorrectly:
- event id: EVT-20261018-THE-MALL-LIFESTORE-BANGKAPI-
- source: https://www.facebook.com/themalllifestorebangkapi/
- source shape: Facebook profile/root page, not an event permalink
- title: merged search text from multiple sources/platforms (253 chars)
- venue inferred from unrelated aggregated page text
- poster selected from Facebook profile image

This is a verifier acceptance defect, not valid event evidence.

## Remediation

The candidate verifier now fail-closes when:
- a title exceeds 220 characters, indicating merged/aggregated result text; or
- a Facebook/X/Twitter/Instagram/TikTok URL is a profile/root page rather than an event/post/status permalink.

Event-specific social permalinks remain eligible for normal downstream verification.

## Production repair

The false-positive Core event is hidden, annotated, and protected with a persistent visibility lock instead of being deleted. This preserves audit/history while preventing automatic recreation.

## Safety

No other event is modified. The verifier stays zero-write. Governed production paths and exact readback remain mandatory.
