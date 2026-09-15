# KK Phone Rental — Private Reader Access Recheck

Time: 2026-09-15 03:43 Asia/Bangkok
Updated: 2026-09-15 10:29 Asia/Bangkok

## Purpose

Recheck the remaining Production Private Reader blocker after the full 8-dataset Core→CRM values-only read model acceptance passed, and exhaust safe connector-side production inspection paths without exposing credentials or mutating production state.

## Confirmed identity

- GitHub repository: `mikesd1995/kk-phone-rental-vercel`
- Repository default Vercel homepage: `https://kk-phone-rental-vercel.vercel.app`
- Frontend production alias: `https://kk-phone-rental.vercel.app/`
- Vercel workspace slug: `mikesd1995s-projects`
- Vercel team ID disclosed by Vercel: `team_uaeOdVIjXMSW690ZM2wPuJyt`
- Intended Vercel project slug: `kk-phone-rental-vercel`

## Latest live authorization / observability checks

The connector authorization gate was re-tested at additional production-observability surfaces using the authoritative team ID.

1. Direct project lookup: **403 Forbidden**.
2. Production runtime error-cluster query for the last hour: **403 Forbidden**.
3. Production runtime log query for the last hour: failed at page 0 with **403 Forbidden** and explicit `You don't have permission to access this resource.`
4. Prior deployment listing remains **403 Forbidden**, with Vercel explicitly identifying missing authorization for scope `mikesd1995s-projects`.
5. Prior Vercel-authenticated fetch of `/api/kk-intelligence-health` could not reach application health evaluation because deployment authorization failed first.

The observability tests are significant because they establish that the same authorization boundary covers project metadata, deployments, protected deployment fetch, runtime error aggregation, and runtime logs. There is no remaining connector-side production inspection route that can provide trustworthy Private Reader acceptance evidence without first fixing workspace authorization.

No Admin PIN, Vercel token, Google service-account secret, environment value, or other credential was requested, guessed, logged, or exposed.

## Current diagnosis

**ROOT CAUSE: VERCEL CONNECTOR WORKSPACE-SCOPE AUTHORIZATION MISSING**

Confidence is now high. The failure is consistent across management, deployment, authenticated-fetch, and observability planes while GitHub→Vercel deployment status remains independently healthy.

There is no evidence supporting changes to CRM sync, freshness, reconciliation, Core fallback, Private Reader code, Apps Script, transactional datasets, or project/workspace naming.

## Safety decision

**BLOCKED_SAFE — NO PRIVATE READER CUTOVER**

Intentionally unchanged:

- Core Operations remains Production SOT.
- CRM/Intelligence remains the private values-only read model.
- `private_reader_runtime` remains pending/safe fallback.
- `private_analytics_acceptance` remains blocked pending authorized production-reader acceptance.
- `runtime_cutover` remains pending/blocked.
- `last_synced_at` is not advanced by authorization/observability rechecks.
- `KK_CRM_REQUIRE_PRIVATE` is not enabled without successful health acceptance.
- No Booking/Event/Asset/Package/Pricing/Web/Settings/Operations data is modified.
- No Apps Script is modified/deployed.
- No Vercel environment variable or secret is modified.
- No unrelated PR is merged.

## What improved in the 10:29 recheck

- Extended authorization testing to Vercel production runtime-error and runtime-log APIs.
- Confirmed observability is blocked by the same workspace permission boundary rather than showing an application/runtime failure.
- Eliminated another class of possible workaround: runtime logs cannot currently be used to infer Private Reader health from this connector.
- Increased root-cause confidence without changing a working production layer.
- Preserved Core fallback and prevented false acceptance/cutover state.

## Required external prerequisite

Re-authorize/reconnect the Vercel integration so its connected identity can access workspace `mikesd1995s-projects` / team `team_uaeOdVIjXMSW690ZM2wPuJyt`. Do not paste tokens, service-account keys, Admin PINs, or other secrets into chat.

## Acceptance sequence after authorization

1. Read currently promoted production deployment and commit.
2. Inspect required environment-variable names/presence without exposing secret values.
3. Verify `KK_CRM_SHEET_ID` targets the private CRM & Intelligence spreadsheet.
4. Verify supported read-only Google service-account credentials are present.
5. Keep strict-private disabled for initial health acceptance.
6. POST authenticated `/api/kk-intelligence-health`.
7. Require reader configured, manifest IDs match, freshness passes, all runtime reconciliation passes, `private_analytics_eligible=true`, status `READY_PRIVATE_READ_RECONCILED`.
8. Call normal Rental Analytics and require `data_source.mode=crm_private`, preserving Core as authoritative fallback.
9. Perform controlled `KK_CRM_REQUIRE_PRIVATE=1` strict-private acceptance.
10. Restore intended production strictness after the test.
11. Only after every gate passes, advance Private Reader acceptance/runtime state with a proven timestamp.

## Changes made in this recheck

- Re-ran direct project authorization with authoritative Vercel team ID.
- Queried production runtime error clusters; authorization blocked.
- Queried production runtime logs; authorization blocked before logs were returned.
- Consolidated all tested authorization surfaces into this audit.
- Preserved every production fail-safe state and made no business-data/runtime configuration mutation.
- Updated this audit record only.