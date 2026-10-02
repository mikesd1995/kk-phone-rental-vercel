# Ultra Deep DDGS Fallback V8 — 2026-10-02

## Incident evidence

October full-loop run `37012778157` failed closed at live discovery acceptance.

Observed evidence:
- source universe: 30/30 complete
- deterministic known-miss regression: 10/10 complete
- live known-miss recall: 7/10
- discovery: 48/48 tasks executed, 0 live candidates
- reference sweep: 4/4 tasks executed, 0 live candidates
- blockers: `DISCOVERY_EVIDENCE_EMPTY`, `REFERENCE_SWEEP_INCOMPLETE`
- DDG/Bing were bound; `DDGS_TRAFILATURA` was declared in the provider chain but remained `NOT_BOUND`
- production/business writes remained 0

This is provider-coverage failure, not a reason to weaken FULL.

## Remediation

- Add bounded `scripts/kk-ddgs-search.py` using the credential-free `ddgs` metasearch library.
- Bind the existing `DDGS_TRAFILATURA` provider slot only when explicitly enabled.
- Normalize only HTTPS search results into non-authoritative discovery candidates.
- Keep subprocess execution shell-free, bounded by timeout, result count, and buffer size.
- Pin `ddgs==9.14.4` in owner-gated Ultra Deep runtime workflows.
- Add adapter regressions proving explicit binding and HTTPS filtering.
- Keep DDG/Bing and all existing providers as fallbacks.

The historical provider name is retained for compatibility; V8 uses DDGS for unknown-URL discovery and does not claim page extraction unless a later reviewed extractor is added.

## Safety

- no storefront writes
- no pricing writes
- no booking/inventory writes
- no production deploy
- Verifier remains mandatory
- FULL remains fail-closed
- a provider error or empty result remains evidence of a gap, never a fabricated candidate
- production_writes=0

## Acceptance target

A live rerun must prove:
- at least one current-month discovery candidate
- at least one independent reference candidate
- source universe complete
- reconciliation complete
- deterministic known-miss regression complete
- verifier_required=true
- production_writes=0
