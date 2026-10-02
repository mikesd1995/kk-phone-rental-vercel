# Ultra Deep Generic Reference V13 — 2026-10-02

## Runtime evidence

Direct Full Loop run `37030462536` on V11/V12:
- started immediately from the owner command;
- posted RUNNING, DISCOVERY CHECKPOINT, and terminal result automatically;
- found 284 discovery candidates and 33 reference candidates;
- reduced reconciliation gaps from six to one;
- remained fail-closed with `RECONCILIATION_GAPS_REMAIN`.

The remaining hard gap was `Home - Bangkok Festivals` with an inferred date. It was a generic homepage/search result, not a verified event identity.

## V13 correction

Reference scoping now excludes:
- generic titles beginning with `Home`;
- root/homepage URLs that are not recognized event-detail paths.

This exclusion happens before reconciliation. It does not weaken independent-reference proof: FULL still requires eligible structured reference evidence after exclusions.

The runtime acceptance artifact now preserves:
- raw reference candidate count;
- eligible reference candidate count;
- reference scope exclusion reason counts;
- structured/excluded reconciliation counts.

This makes the direct-run checkpoint and artifact show why rows were excluded instead of reporting `n/a`.

## Safety

- Scanner remains production_writes=0.
- Source-universe, reference execution, reconciliation, and known-miss gates remain mandatory.
- Verifier, governed writer, tombstone/booking protections, and exact production readback are unchanged.
