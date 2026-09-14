# KK Phone Rental — Private Reader Access Recheck

Time: 2026-09-15 03:43 Asia/Bangkok

## Purpose

Recheck the remaining Production Private Reader blocker after the full 8-dataset Core→CRM values-only read model acceptance had already passed.

## Confirmed identity

- GitHub repository: `mikesd1995/kk-phone-rental-vercel`
- Repository default Vercel homepage: `https://kk-phone-rental-vercel.vercel.app`
- Frontend production alias in `config.js`: `https://kk-phone-rental.vercel.app/`
- Historical Vercel workspace slug observed in repository audit records: `mikesd1995s-projects`
- Intended Vercel project slug: `kk-phone-rental-vercel`

This cross-check makes a project-name mismatch unlikely.

## Live Vercel authorization recheck

A direct Vercel project lookup was attempted with:

- project slug: `kk-phone-rental-vercel`
- team/workspace slug: `mikesd1995s-projects`

Result: **403 Forbidden**.

This is stronger evidence than an empty team listing: the Vercel integration can resolve the request path but the connected identity is not authorized to read that project/workspace.

## Corroborating repository evidence

The repository's current open Admin hardening PR also records that the connected Vercel credential cannot read the team's build logs and that a usable preview could not be validated through that connection. This independently supports the same authorization/access-path diagnosis.

## Safety decision

**BLOCKED_SAFE — NO PRIVATE READER CUTOVER**

No attempt was made to guess or inject production environment variables, service-account secrets, or project IDs. No strict-private switch was enabled.

The following remain intentionally unchanged:

- Core Operations remains Production SOT.
- CRM/Intelligence stays a private values-only read model.
- `private_reader_runtime` remains pending/safe fallback.
- `private_analytics_acceptance` remains blocked pending production reader access.
- `runtime_cutover` remains pending/blocked.
- `last_synced_at` is not advanced by this access recheck.
- No Booking/Event/Asset/Package/Pricing/Web/Settings/Operations data was modified.
- No Apps Script was modified or deployed.

## Required next gate

Production Private Reader acceptance can continue only after the Vercel connection is authorized for the workspace/project. Then perform, in order:

1. verify production deployment identity;
2. verify required env names without exposing secret values;
3. verify `KK_CRM_SHEET_ID` and supported read-only service-account credential presence;
4. run authenticated `/api/kk-intelligence-health`;
5. require fresh manifest + successful Core↔CRM runtime reconciliation + `private_analytics_eligible=true`;
6. verify normal Rental Analytics reports `data_source.mode=crm_private`;
7. run a controlled strict-private acceptance test;
8. only after all checks pass, advance private-reader acceptance state.

## Changes made in this recheck

- Re-resolved the target Vercel project from independent repository evidence.
- Performed a direct project authorization test and captured the 403 result.
- Cross-checked the same Vercel-access limitation against the current Admin hardening PR.
- Preserved all production fail-safe states and data.
- Added this audit record only.
