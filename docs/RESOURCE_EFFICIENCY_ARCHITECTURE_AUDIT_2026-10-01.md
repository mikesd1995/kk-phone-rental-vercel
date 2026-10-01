# Resource Efficiency Architecture Audit — 2026-10-01

## Scope
Second-layer audit after PR #413: repository schedules, CI/watchers, artifact storage, and ChatGPT task overlap.

## Findings
- Repository search found one recurring GitHub Actions cron: Rental Analytics Production Watch. PR #413 already reduced its fallback cadence from hourly to every 6 hours while preserving immediate main-push execution.
- Admin Regression uses concurrency cancellation, but still runs the full suite for documentation-only PR/push changes. This is known waste. It was not path-skipped in this change because a required-check configuration could make skipped checks block merges; optimize only after required-check semantics are verified.
- Storefront Visual QA already uses path scoping, cancel-in-progress, and 3-day artifact retention.
- HF Event Assist and Crawl4AI UAT are manual-only. PR #413 already enabled stale-run cancellation for HF and reduced reproducible UAT artifact retention to 7 days.
- Ultra Deep Runtime Acceptance and production recovery workflows intentionally retain 30-day evidence and keep cancel-in-progress false where serialization/forensic evidence matters. These were not weakened.
- Content bridge workflows serialize per issue and are event-driven rather than scheduled; no cadence reduction is justified.
- Storefront Poster Health Audit is path-scoped and reproducible; its artifact retention is reduced from 30 to 7 days in this layer.
- ChatGPT automation audit found the active hourly KK Market + Safety Watch already consolidates event discovery, competitor watch, and runtime safety. Its prompt contained expired 2026-09-29 acceptance-specific instructions and repeated policy text. The task was compacted in place while preserving cadence, alert conditions, SOT blackout/minimum-read constraints, fail-closed behavior, and no-business-write boundary.
- Separate legacy competitor/fail-closed watches are disabled, so they do not create duplicate hourly load.
- Canonical Scanner and Verifier tasks are currently disabled; this audit does not re-enable or replace them because their policy explicitly forbids watchdog/replacement behavior.

## Safety decisions
- No business data or production truth changed.
- No Scanner/Verifier schedule or enabled state changed.
- No acceptance/recovery evidence retention was shortened.
- No required CI check was path-skipped without proving branch-protection semantics.

## Expected improvement
- Less hourly prompt/context processing from removal of expired/redundant monitor instructions.
- Lower GitHub artifact storage for reproducible poster audits.
- Existing reductions from PR #413 remain active: fewer fallback watcher runs, fewer avoidable Vercel deployments, shorter reproducible artifact retention, and stale UAT cancellation.

## Remaining optimization candidate
Verify whether Admin Regression is a required status check. If safe, preserve a successful required check while short-circuiting expensive test/benchmark steps for exact documentation-only diffs instead of skipping the workflow itself.
