# Ultra Deep Real Provider Binding V1 — 2026-09-28

## Change
The Agent Router now supplies two zero-cost, credential-free provider implementations to the bounded Ultra Deep provider executor: OFFICIAL_DIRECT and RSS_OR_PUBLIC_FEED.

OFFICIAL_DIRECT fetches only explicit HTTPS seed URLs with timeout/size bounds. RSS_OR_PUBLIC_FEED reads explicit HTTPS feed URLs and emits only HTTPS item links. Both are discovery evidence only and retain the downstream verifier requirement.

## Important boundary
This does not make SearXNG, DDGS/Trafilatura, Crawl4AI or Exa production-bound. Crawl4AI has prior fixed-URL zero-write UAT evidence but remains a separate Python/manual workflow. Search discovery for unknown URLs still needs a real zero-cost search adapter or an accepted external provider.

No scheduler, business data, pricing, booking, inventory, visibility, Sheet or production write authority changed.
