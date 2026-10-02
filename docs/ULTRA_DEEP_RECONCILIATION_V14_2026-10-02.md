# Ultra Deep Reconciliation V14 — 2026-10-02

## Runtime evidence

Direct Full Loop run `37033205010` on V13:
- 301 discovery candidates;
- 35 raw reference candidates;
- 6 eligible structured references;
- 4 matched references;
- 2 reconciliation gaps;
- automatic RUNNING/checkpoint/terminal notifications all worked.

The two gaps had different causes:
1. `Fan Meeting - Eventpop` at `/g/fan-meeting` was a generic Eventpop group/listing page, not an event-detail page.
2. The 25 October Bai Lu fanmeeting was a real event. Independent X reference and Discovery found different titles for the same event. The deterministic known-miss corpus already identifies both as case `bai-lu-meet-love-20261025`.

## V14 correction

- Eventpop `/g/` group pages and generic search/category paths are excluded from hard event reconciliation.
- Known-miss canonical alignment is allowed only when:
  - the independent reference matches a deterministic known-miss case;
  - a discovered candidate independently matches the same case;
  - the case/date rules in the known-miss matcher pass.
- No broad title fuzzy matching is introduced.
- Alignment evidence is counted in the runtime artifact and direct checkpoint.

## Handoff integrity

The runtime acceptance artifact now preserves all discovered candidates instead of truncating to the first 100. Candidate identity/date/time/venue/artist/source/confidence fields are retained so downstream Verifier/commercial stages do not silently lose discovery rows.

## Safety

- Scanner remains production_writes=0.
- At least one eligible structured independent reference remains mandatory.
- Excluded listing/search pages cannot satisfy reference proof.
- Verifier, owner/tombstone/booking policy, governed Admin writer and exact production readback remain required before COMPLETE.
