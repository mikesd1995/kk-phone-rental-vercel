# KK Phone Rental — Private Reader Access Recheck

Time: 2026-09-15 03:43 Asia/Bangkok
Updated: 2026-09-15 03:49 Asia/Bangkok

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

The following live checks were performed against the connected Vercel integration:

1. Team/workspace listing returned no accessible teams.
2. Direct Agent Runs project discovery for `mikesd1995s-projects` returned **403 Forbidden** with `You don't have permission to access this resource.`
3. Direct project lookup using:
   - project slug: `kk-phone-rental-vercel`
   - team/workspace slug: `mikesd1995s-projects`
   returned **403 Forbidden**.

This is stronger evidence than an empty team listing alone: the request path resolves to the expected workspace/project context, while the connected identity is not authorized to inspect it.

## Deployment pipeline cross-check

The latest repository commit at the time of this recheck was:

- `030cc6be0f9cf7ea1578cd9fb6c98e89514c717e` — `Record Vercel private reader access recheck`

GitHub's combined commit status reports:

- context: `Vercel`
- state: `success`
- target workspace/project path: `mikesd1995s-projects/kk-phone-rental-vercel`

This proves the GitHub→Vercel deployment integration is functioning and that the workspace/project identity is correct. It does **not** prove Private Reader environment credentials are configured, nor does it prove authenticated Private Reader runtime acceptance. Those still require authorized Vercel project/env/log access or an authenticated production health check.

No GitHub Actions workflow run was associated with this docs-only commit; the successful deployment evidence comes from the Vercel commit status.

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

## What improved in this recheck

Before this update, the evidence established only that the connected Vercel identity could not inspect the project. This update adds an independent deployment-side proof:

- the project identity is now corroborated by GitHub's successful Vercel deployment status;
- the deployment pipeline itself is proven healthy;
- the remaining issue is narrowed to Vercel connector authorization for project/env/log inspection;
- no evidence currently points to a deployment failure, CRM synchronization failure, or Private Reader code defect.

This materially reduces the remaining diagnostic scope and avoids unnecessary changes to working production components.

## Required next gate

Production Private Reader acceptance can continue only after the Vercel connection is authorized for the workspace/project. Then perform, in order:

1. verify production deployment identity and currently promoted deployment;
2. verify required env names without exposing secret values;
3. verify `KK_CRM_SHEET_ID` and supported read-only service-account credential presence;
4. run authenticated `/api/kk-intelligence-health`;
5. require fresh manifest + successful Core↔CRM runtime reconciliation + `private_analytics_eligible=true`;
6. verify normal Rental Analytics reports `data_source.mode=crm_private`;
7. run a controlled strict-private acceptance test;
8. restore intended production strictness after the controlled test;
9. only after all checks pass, advance private-reader acceptance state.

## Changes made in this recheck

- Re-resolved the target Vercel project from independent repository evidence.
- Repeated live Vercel authorization checks at team, Agent Runs discovery and direct-project levels.
- Captured explicit 403 authorization failures.
- Verified the latest GitHub commit has Vercel deployment status `success`.
- Confirmed the successful deployment status targets the same `mikesd1995s-projects/kk-phone-rental-vercel` workspace/project identity.
- Checked for associated GitHub Actions workflow runs; none were present for the docs-only commit.
- Preserved all production fail-safe states and data.
- Updated this audit record only; no production env, spreadsheet dataset, credential, Apps Script or transactional-data change was made.
