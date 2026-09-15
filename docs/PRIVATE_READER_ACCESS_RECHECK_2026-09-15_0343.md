# KK Phone Rental — Private Reader Access Recheck

Time: 2026-09-15 03:43 Asia/Bangkok
Updated: 2026-09-15 10:04+ Asia/Bangkok

## Purpose

Recheck the remaining Production Private Reader blocker after the full 8-dataset Core→CRM values-only read model acceptance had already passed, and attempt the deepest safe runtime check available without credentials or production mutation.

## Confirmed identity

- GitHub repository: `mikesd1995/kk-phone-rental-vercel`
- Repository default Vercel homepage: `https://kk-phone-rental-vercel.vercel.app`
- Frontend production alias: `https://kk-phone-rental.vercel.app/`
- Vercel workspace slug: `mikesd1995s-projects`
- Vercel team ID disclosed by Vercel: `team_uaeOdVIjXMSW690ZM2wPuJyt`
- Intended Vercel project slug: `kk-phone-rental-vercel`

## Latest live authorization and runtime checks

1. Deployment listing was retried using authoritative team ID `team_uaeOdVIjXMSW690ZM2wPuJyt`.
2. Vercel again returned **403 Forbidden** with exact scope `mikesd1995s-projects` and remediation to re-authenticate to that scope or use an authorized secure connection/token.
3. A direct Vercel-authenticated fetch was then attempted against production health URL `https://kk-phone-rental.vercel.app/api/kk-intelligence-health`.
4. That runtime fetch could not even reach application health evaluation because Vercel first attempted to resolve/check deployment access and was itself blocked by the same **403 Forbidden** authorization boundary.

This adds a useful negative control: the blocker is not limited to project-list/deployment-list management endpoints. The connector also cannot traverse its Vercel-authenticated deployment-fetch path to the production health endpoint. Therefore an authenticated Private Reader health acceptance cannot be truthfully claimed from the current connection.

No Admin PIN, Vercel token, Google service-account secret, environment value, or other credential was requested, guessed, logged, or exposed.

## Deployment evidence

The preceding audit commit `43c72cb1246b03d33fe8f1d74fc9afe4a0e18576` has GitHub Vercel status **success**, targeting `mikesd1995s-projects/kk-phone-rental-vercel`.

Thus the evidence remains internally consistent:

- GitHub→Vercel deployment plane: healthy.
- ChatGPT Vercel management/deployment-fetch plane: unauthorized for the workspace.
- Private Reader runtime acceptance: not yet executable through the current connection.

## Current diagnosis

**ROOT CAUSE: VERCEL CONNECTOR WORKSPACE-SCOPE AUTHORIZATION MISSING**

The latest runtime-fetch test strengthens this diagnosis. There is no evidence supporting changes to CRM sync, freshness, reconciliation, Core fallback, Private Reader code, Apps Script, transactional datasets, or project/workspace naming.

## Safety decision

**BLOCKED_SAFE — NO PRIVATE READER CUTOVER**

Intentionally unchanged:

- Core Operations remains Production SOT.
- CRM/Intelligence remains the private values-only read model.
- `private_reader_runtime` remains pending/safe fallback.
- `private_analytics_acceptance` remains blocked pending authorized production-reader acceptance.
- `runtime_cutover` remains pending/blocked.
- `last_synced_at` is not advanced by authorization/runtime-access rechecks.
- `KK_CRM_REQUIRE_PRIVATE` is not enabled without successful health acceptance.
- No Booking/Event/Asset/Package/Pricing/Web/Settings/Operations data is modified.
- No Apps Script is modified/deployed.
- No Vercel environment variable or secret is modified.
- No unrelated PR is merged.

## What improved in this recheck

- Reconfirmed workspace-scope authorization failure using authoritative team ID.
- Extended validation from management APIs to the Vercel-authenticated production deployment-fetch path.
- Demonstrated that the health endpoint cannot yet be evaluated through this connection because Vercel authorization fails before application-level health evaluation.
- Prevented a false `private_analytics_eligible` or cutover claim.
- Preserved safe Core fallback and all production data boundaries.

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

- Re-ran deployment authorization using authoritative Vercel team ID.
- Attempted Vercel-authenticated fetch of the production intelligence-health endpoint.
- Recorded that the runtime fetch is blocked at Vercel authorization before application health can be evaluated.
- Preserved every production fail-safe state and made no business-data/runtime configuration mutation.
- Updated this audit record only.