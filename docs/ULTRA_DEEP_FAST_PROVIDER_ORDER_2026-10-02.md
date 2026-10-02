# Ultra Deep Fast Provider Order — 2026-10-02

## Runtime finding

Direct-command triggering and bounded task concurrency removed request-PR and serial-task delays, but the live sweep could still spend most of its time exhausting DuckDuckGo/Bing HTML query variants before reaching the newly installed credential-free DDGS provider.

## Change

Free unknown-URL search now prefers DDGS before HTML SERP fallbacks in:
- monthly generic discovery;
- named source-universe tasks;
- known-miss probes;
- independent reference sweep;
- provider preflight ordering.

Direct Full Loop sets `KK_ULTRA_DEEP_TASK_CONCURRENCY=6`. The executor hard cap remains 8.

Direct/feed providers remain ahead of unknown-URL search when a task actually carries direct URLs or feeds.

## Safety invariants unchanged

- HTTPS evidence normalization remains mandatory.
- Provider/query fallback remains fail-closed.
- Source-universe, discovery, independent reference, reconciliation, and known-miss gates remain required.
- Scanner remains non-authoritative and zero-write.
- Verifier remains mandatory.
- No storefront, pricing, booking, inventory, or customer write authority is added.
