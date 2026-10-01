# KK resource efficiency optimization — 2026-10-01

## Goal
Reduce avoidable Vercel deployments, GitHub Actions minutes, duplicate manual UAT work, and artifact storage without weakening production/business-data safety gates.

## Changes
- Vercel ignored-build guard now evaluates known diffs on `main` instead of forcing every main commit to deploy.
- Docs/tests/workflow-only main commits can be skipped; runtime/unknown changes still deploy fail-safe.
- Rental Analytics Production Watch keeps immediate `push: main` coverage and changes the recovery clock from hourly to every 6 hours.
- Changed-state watcher evidence retention reduced from 30 days to 7 days.
- HF manual UAT now cancels stale duplicate in-progress runs and retains evidence 7 days instead of 30.
- Crawl4AI manual UAT evidence retention reduced from 14 days to 7.

## Safety invariants
- No business data or production data is written by this change.
- Unknown/missing git diff information still fails safe by building.
- Runtime, API, UI, dependency, Vercel config, and ignored-build guard changes still require a deployment.
- Production watcher remains read-only and still runs immediately after every main push.
- Existing production/business-write guardrails are unchanged.

## Resource rationale
Vercel Hobby has finite deployment creation limits, while this repository generates frequent preview deployments. GitHub Actions also meters runner minutes and artifact storage. The optimization removes work that cannot change the deployed runtime and shortens retention for reproducible UAT/watch evidence.
