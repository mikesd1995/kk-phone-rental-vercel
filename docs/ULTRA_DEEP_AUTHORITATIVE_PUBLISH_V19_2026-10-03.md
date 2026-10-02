# Ultra Deep V19 — authoritative publish hardening

## Triggering incident

Run `37043175753` proved the direct Full Loop can execute end-to-end:
- Discovery FULL passed.
- Verifier/commercial passed.
- Governed production write executed.
- Exact storefront readback passed.

However, the one created event was a malformed aggregate search result derived from a Facebook/The Mall page and multiple search-result snippets. Exact competitor-price evidence was also zero, so the owner-approved rental-fit fallback was used.

## V19 changes

### Authoritative event verifier
Auto-publish now requires authoritative event proof:
- trusted event/ticketing/promoter event-detail URL; or
- exact-date structured Event JSON-LD on a non-social/non-search page with venue and poster evidence.

Social/search pages remain valid discovery/reference inputs but cannot independently authorize production publishing.

The verifier rejects:
- aggregated search-result titles;
- titles longer than the bounded event-name limit;
- platform/search concatenations such as Facebook + X/Twitter + news/search-result fragments.

### Competitor price coverage
The exact-event competitor scanner still uses zero-cost public search. It now:
- keeps the generic exact-event rental queries;
- adds one bounded X search for each locked competitor account;
- reports the full competitor universe in the handoff/checkpoint.

No exact-event result does **not** block the Full Loop by itself. The existing locked policy remains:
exact event evidence → comparable evidence → owner-approved KK rental-fit/baseline fallback.

### Self-repair
The production runtime now identifies malformed rows only when:
- the event is currently visible;
- it carries the `Verifier-approved discovery promotion` automation marker; and
- the deterministic V19 title-quality rule fails.

Those automation-created malformed rows are hidden through the existing governed `updateEvent` path and counted only after exact readback confirms the storefront is hidden.

Owner-created rows are never included by this cleanup rule.

## Safety invariants

- Scanner remains zero-write.
- Social/search evidence cannot authorize publish by itself.
- Owner-hidden/history locks and booking-date guards remain intact.
- Existing governed Admin writer remains the only production mutation surface.
- Production COMPLETE still requires exact storefront readback.
