# Full-stack bug audit — 2026-09-29

Scope: storefront, Admin UI, public/admin API paths, Apps Script/SOT contracts, regression/CI and deployment guards.

## Confirmed fixes

1. Admin booking final-status refresh race
   - Symptom: updateBooking persisted cancelled but stale Admin state could keep the booking visible.
   - Cause: refresh() returned immediately when state.loading was already true.
   - Fix: mutation readback waits for an active refresh to finish and then performs a new authoritative snapshot.
   - Regression: snapshot-health.test.js locks the post-updateBooking refresh contract.

2. Storefront poster precedence drift
   - Symptom: events with a historical emergency storefrontPosterOverride could keep an old poster after canonical poster_image_url was updated.
   - Cause: override was evaluated before the canonical public feed value.
   - Fix: canonical poster_image_url now wins; emergency override is fallback-only.
   - Regression: storefront-image-fallback.test.js locks canonical-first precedence.

## Preventive rules

- Every successful mutation must have an authoritative post-write readback; never silently drop a mutation refresh because another read is active.
- SOT/canonical feed values must outrank emergency UI overrides. Overrides are fallback-only and should be removable.
- Every confirmed bug fix requires a regression test reproducing the failure mode before merge.
- Production data writes remain guarded by existing stale-snapshot, lock, tombstone, reservation and owner-visibility controls.
- CI must run syntax + full regression on every PR and push to main.
- Do not treat intentional RED contract tests or deployment quota/resource limits as application bugs.
- Keep public endpoint allowlists and public-text sanitization fail-closed.
- Audit emergency overrides periodically; migrate verified values into SOT and delete obsolete hard-coded exceptions.

## Acceptance evidence

- PR #315 Admin Regression run #1006: success, including syntax checks, full regression tests, Code Intelligence benchmark and HF fail-closed checks.
- Vercel Preview for PR #315 reported Ready.
- This audit branch adds canonical-poster precedence hardening and its regression coverage.

## Remaining runtime acceptance

After merge/deploy, verify:
- cancelling one booking removes it from Edit Booking/current views without a second cancel;
- changing poster_image_url for an event with a legacy override displays the canonical image;
- /api/kk-data and Admin snapshot remain healthy and version/sheet identity guards show no failure.
