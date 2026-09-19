---
name: kk-discovery-source-watch
description: Use for KK Phone Rental source monitoring and change-detection design or operation across official sites, ticketing, venues, agencies, and competitor sources. Normalizes watch evidence and only escalates meaningful changes into discovery staging.
---

# KK Discovery Source Watch

Use this skill when configuring or reviewing source monitoring before a deep scan.

## Purpose

Avoid paying crawler/AI cost for pages that have not changed. A watcher is an early signal, not a business writer.

Supported normalized providers in the repository contract:
- CHANGEDETECTION_IO
- EXA
- CRAWL4AI
- FIRECRAWL
- OFFICIAL_SOURCE_WATCH

Supported source tiers:
- OFFICIAL
- TICKETING
- VENUE
- ARTIST_AGENCY
- COMPETITOR
- SECONDARY

## Observation contract

Normalize every source observation through:

`server/discovery-source-watch-contract.js`

Required evidence:
- observation ID;
- provider;
- source tier;
- HTTPS source URL;
- observed timestamp;
- state;
- content hash for non-error states;
- previous hash for CHANGED state.

## State behavior

`UNCHANGED`
- stop;
- downstream discovery call count must remain zero.

`NEW` or `CHANGED`
- allow one downstream discovery/extraction stage;
- result remains staging-only and Verifier-required.

`ERROR`
- retain bounded provider failure class;
- do not invent or recover a candidate from missing evidence.

## Security and authority

Reject:
- non-HTTPS or credential-bearing source URLs;
- stale or future-dated observations;
- unsupported providers/source tiers;
- malformed hashes;
- CHANGED observations whose before/after hashes are identical;
- outputs claiming verified/final authority;
- direct Sheet, Machine-SOT, booking, pricing, inventory, or notification writes.

## Rollout

Repository contract staging does not equal provider activation. External service credentials, schedules, runtime wiring, and production imports require a separate controlled acceptance.
