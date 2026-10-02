# Ultra Deep Reference Relevance V11 — 2026-10-02

## Incident

Direct Full Loop run `37027524141` started immediately from the owner command and produced 230 discovery candidates, 33 reference candidates, complete source-universe proof, complete 4/4 reference execution, and deterministic known-miss 10/10. It still failed closed with `RECONCILIATION_GAPS_REMAIN`.

The six hard gaps were search noise rather than Bangkok event misses: a Hong Kong concert, a Bangkok travel article, Roblox code pages, a horoscope video, and a HoYoverse anniversary page outside the target month.

## V11 correction

Hard reconciliation gaps now require:
- structured event identity;
- event date inside the requested month;
- explicit Bangkok/metropolitan-area evidence for Bangkok scans;
- event intent or a recognized Thai event/ticketing source.

Rows explicitly marked ineligible no longer count as comparable independent references. If all structured references are filtered out, reconciliation remains fail-closed; V11 cannot pass FULL by deleting noisy evidence.

## Direct-run UX

The direct workflow remains owner-command driven with latest-command-wins concurrency. It now:
- records the scanner process exit code explicitly instead of relying on `continue-on-error` UI semantics;
- posts a discovery checkpoint before the FULL gate;
- keeps evidence upload and terminal notification under `always()`;
- mentions the repository owner in the terminal result comment;
- removes the redundant final failure step because the FULL gate itself is authoritative.

## Safety

- Scanner production writes remain zero.
- Independent reference execution remains mandatory.
- No hidden/tombstoned event resurrection is allowed.
- Verifier and governed writer/readback remain mandatory before any business mutation can be called complete.
- No Vercel Preview deployment is required to start a scan.
