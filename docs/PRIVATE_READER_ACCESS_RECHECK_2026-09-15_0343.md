# KK Phone Rental — Private Reader Access Recheck

Time: 2026-09-15 03:43 Asia/Bangkok
Updated: 2026-09-15 10:04 Asia/Bangkok

## Purpose

Recheck the remaining Production Private Reader blocker after the full 8-dataset Core→CRM values-only read model acceptance had already passed.

## Confirmed identity

- GitHub repository: `mikesd1995/kk-phone-rental-vercel`
- Repository default Vercel homepage: `https://kk-phone-rental-vercel.vercel.app`
- Frontend production alias in `config.js`: `https://kk-phone-rental.vercel.app/`
- Vercel workspace slug: `mikesd1995s-projects`
- Vercel team ID disclosed by Vercel: `team_uaeOdVIjXMSW690ZM2wPuJyt`
- Intended Vercel project slug: `kk-phone-rental-vercel`

## 10:04 live authorization recheck

The authorization gate was tested again rather than assuming the previous state persisted.

1. Current Vercel team discovery still returns an empty team set.
2. Deployment listing was retried using the authoritative Vercel team ID `team_uaeOdVIjXMSW690ZM2wPuJyt` rather than only the workspace slug.
3. Vercel again returned **403 Forbidden** and explicitly reported:
   - scope: `mikesd1995s-projects`
   - team ID: `team_uaeOdVIjXMSW690ZM2wPuJyt`
   - `saml=false`
   - `enforced=false`
   - remediation: re-authenticate to this scope or use a token/connection with access to this scope.

Using the authoritative team ID and receiving the same workspace-scope authorization failure eliminates slug resolution as a plausible cause. The blocker is the connected Vercel identity's workspace authorization state.

No token, credential, environment value, service-account secret, or Admin PIN was requested or exposed.

## Deployment evidence

The immediately preceding audit commit `43c72cb1246b03d33fe8f1d74fc9afe4a0e18576` (`Record exact Vercel re-auth scope blocker`) has GitHub Vercel status **success**, with the target under `mikesd1995s-projects/kk-phone-rental-vercel`.

Therefore GitHub→Vercel deployment continues to function while connector-side management access remains unauthorized. Deployment health and connector authorization are conclusively separate gates.

## Current diagnosis

**ROOT CAUSE: VERCEL CONNECTOR WORKSPACE-SCOPE AUTHORIZATION MISSING**

Current evidence does not support changing CRM sync, freshness, reconciliation, Core fallback, Private Reader code, Apps Script, transactional datasets, or project/workspace naming.

## Safety decision

**BLOCKED_SAFE — NO PRIVATE READER CUTOVER**

Intentionally unchanged:

- Core Operations remains Production SOT.
- CRM/Intelligence remains a private values-only read model.
- `private_reader_runtime` remains pending/safe fallback.
- `private_analytics_acceptance` remains blocked pending authorized production-reader acceptance.
- `runtime_cutover` remains pending/blocked.
- `last_synced_at` is not advanced by an authorization recheck.
- `KK_CRM_REQUIRE_PRIVATE` is not enabled without health acceptance.
- No Booking/Event/Asset/Package/Pricing/Web/Settings/Operations data is modified.
- No Apps Script is modified/deployed.
- No Vercel environment variable or secret is modified.
- No unrelated PR is merged.

## What improved in the 10:04 recheck

- Re-tested access with Vercel's authoritative team ID, not just the human-readable workspace slug.
- Received the same scope-specific 403, eliminating workspace-slug lookup/resolution as a remaining hypothesis.
- Reconfirmed the prior audit commit itself deployed successfully through GitHub→Vercel.
- Narrowed remediation to one external action: authorize/reconnect the Vercel integration to `mikesd1995s-projects`.
- Avoided risky or irrelevant changes to working production layers.

## Required external prerequisite

Re-authorize/reconnect the Vercel integration so its connected identity can access workspace `mikesd1995s-projects` / team `team_uaeOdVIjXMSW690ZM2wPuJyt`. Do not paste tokens, service-account keys, Admin PINs, or other secrets into chat.

## Acceptance sequence after authorization

1. Read the currently promoted production deployment and commit.
2. Inspect required environment-variable names without exposing secret values.
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

- Re-ran live Vercel team discovery.
- Re-ran deployment authorization using the authoritative team ID.
- Captured the repeated exact workspace-scope 403 and remediation.
- Verified the preceding audit commit's Vercel deployment succeeded.
- Preserved every production fail-safe state.
- Updated this audit record only.