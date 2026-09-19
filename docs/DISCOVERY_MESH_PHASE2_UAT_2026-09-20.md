# Discovery Mesh Phase-2 UAT — 2026-09-20

Branch: `discovery-crawl4ai-uat-20260920`  
PR: #91  
Tracking: #90

## Objective

Validate the next two read-only discovery components against live public event sources without writing KK Phone Rental business state:

1. Exa semantic discovery / source corroboration.
2. Crawl4AI controlled direct-page extraction.

This UAT does not authorize production Scanner integration.

## Exa controlled UAT

Execution surface: connected ChatGPT Exa plugin only.

No Exa runtime credential, Vercel environment variable, cron, queue, or production network path was created.

### Bounded search groups

| Group | Result |
| --- | --- |
| GMMTV official-domain October 2026 | 0 results |
| ThaiTicketMajor official-domain | 5 results |
| Ticketmelon official-domain | 5 results |
| IMPACT official-domain | 5 results |
| Broad October Bangkok, official-first | 5 results |

Observed query groups with results: `4/5`.

### Validated examples

Full-page read validation confirmed structured event evidence from:

- IMPACT — LINGORM THE WORLD BETWEEN US CONCERT: 17–18 October 2026, IMPACT Arena.
- IMPACT — NONT TANONT Arena Encore: 3–4 October 2026, IMPACT Arena.
- IMPACT — PLAVE World Tour: 10 October 2026, IMPACT Arena.
- One Bangkok — Gong Yoo fan meeting: 10 October 2026, One Bangkok Forum.
- UOB LIVE — Tiffany Young: 25 October 2026, UOB LIVE.

Exa also returned multi-source evidence for PLAVE from ticketing and venue sources, which is useful for corroboration but requires deduplication before final truth.

### Exa classification

```text
EXA_DISCOVERY_UAT = PASS_WITH_COVERAGE_GAP
Recommended role = semantic discovery / gap-finding / corroboration
Rejected role = sole official-source watcher or final verifier
```

Reason for the coverage gap: the constrained `gmmtv.com` query returned no result.

## Crawl4AI live UAT

GitHub Actions workflow:

`Discovery Crawl4AI UAT`

First controlled execution:

- run ID: `35470045970`
- head SHA: `2ea7d5b09ccb3f753f6a392e8a7c072287767ff6`
- Crawl4AI version proven by install log: `0.9.3`
- mode: `FIXED_URL_ZERO_WRITE`
- LLM use: none
- secret/token use: none

### Fixed official source set

1. IMPACT — LINGORM event page.
2. One Bangkok — Gong Yoo event page.
3. UOB LIVE — Tiffany Young event page.

### Results

| Source | HTTP | Markdown chars | Required markers | Elapsed |
| --- | ---: | ---: | --- | ---: |
| IMPACT LINGORM | 200 | 20,886 | 3/3 | 4,635 ms |
| One Bangkok Gong Yoo | 200 | 17,782 | 3/3 | 5,518 ms |
| UOB LIVE Tiffany Young | 200 | 15,444 | 3/3 | 1,421 ms |

Summary:

```text
urls_planned = 3
urls_successful = 3
marker_complete = 3
quality_gate = PASS
production_writes = 0
final_truth_mutation = false
notification_sends = 0
authoritative = false
verifier_required = true
```

Content hashes were captured for every successful page.

### Evidence artifact

- artifact ID: `10592402361`
- name: `discovery-crawl4ai-uat-35470045970`
- digest: `sha256:5dac623384688c20f3e46fb6c1730b1f7d681d081da94acc4b63d5ffcd6b7903`
- retention: 14 days
- expires: 2026-10-03

## Safety cleanup after live UAT

The temporary PR trigger used to obtain one controlled live run was removed after PASS.

Retained workflow is now:

- `workflow_dispatch` only;
- requires exact confirmation `RUN_CRAWL4AI_ZERO_WRITE_UAT`;
- pins proven Crawl4AI `0.9.3`;
- fixed official URLs only;
- no secrets;
- no LLM calls;
- evidence artifact only.

## Authority boundary

Neither Exa nor Crawl4AI is allowed to:

- mark an event verified/final;
- write Event Tracker business rows;
- write pricing;
- write booking/inventory/customer data;
- mutate Machine SOT;
- send LINE/Telegram/X;
- bypass GPT Verifier.

Both remain discovery evidence providers.

## What improved

Before this UAT:

- Exa and Crawl4AI were architectural candidates only;
- no live KK-specific extraction evidence existed for Crawl4AI;
- no measured Exa coverage gap had been captured.

After this UAT:

- Exa role is empirically bounded: useful semantic discovery, not sole watcher;
- Crawl4AI directly extracted event/date/venue evidence from three different official sites;
- live provider output remains zero-write and Verifier-required;
- Crawl4AI version is pinned to the exact tested version;
- recurring automatic live crawling is not enabled.

## Production state

```text
EXA_CHATGPT_PLUGIN = CONNECTED
EXA_PRODUCTION_RUNTIME = OFF
CRAWL4AI_ZERO_WRITE_UAT = PASS
CRAWL4AI_PRODUCTION_RUNTIME = OFF
CHANGEDETECTION_IO_PRODUCTION_RUNTIME = OFF
FIRECRAWL_PRODUCTION_RUNTIME = OFF
HF_PRODUCTION_RUNTIME = OFF
BUSINESS_WRITES = 0
```

## Recommended integration order

1. keep Exa available as manual/controlled discovery enhancement;
2. retain Crawl4AI as direct extraction fallback for known official URLs;
3. use the merged `discovery-source-watch-v1` contract to gate source-change evidence;
4. do not create a new competing Scanner runner;
5. do not activate recurring provider calls until current control-plane persistence acceptance allows it;
6. when recurring runtime becomes eligible, route all provider results to Discovery Staging -> GPT Verifier only.

This UAT is a provider capability PASS, not production activation.
