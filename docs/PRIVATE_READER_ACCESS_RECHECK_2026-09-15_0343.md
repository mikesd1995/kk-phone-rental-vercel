# KK Phone Rental — Private Reader Access Recheck

Time: 2026-09-15 03:43 Asia/Bangkok
Updated: 2026-09-15 07:27 Asia/Bangkok

## Purpose

Recheck the remaining Production Private Reader blocker after the full 8-dataset Core→CRM values-only read model acceptance had already passed.

## Confirmed identity

- GitHub repository: `mikesd1995/kk-phone-rental-vercel`
- Repository default Vercel homepage: `https://kk-phone-rental-vercel.vercel.app`
- Frontend production alias in `config.js`: `https://kk-phone-rental.vercel.app/`
- Historical Vercel workspace slug observed in repository audit records: `mikesd1995s-projects`
- Intended Vercel project slug: `kk-phone-rental-vercel`

## Live Vercel authorization recheck

At 07:27 Asia/Bangkok, direct project lookup was repeated using project slug `kk-phone-rental-vercel` and workspace slug `mikesd1995s-projects`.

Result: **403 Forbidden**.

The connected Vercel identity still cannot inspect project settings, production environment-variable presence, deployments/logs through the project API, or run the remaining connector-side Private Reader acceptance sequence. No project ID, team ID, environment value, credential, or secret was guessed.

## Deployment evidence

The latest `main` commit before this recheck was `496bd506b9e7480f46ad5327ded3856f89d04880` (`Extend private reader access recheck with deployment evidence`). Earlier readback had already proven its Vercel deployment status succeeded.

A separate current Admin hardening PR (#29), head `399ca6ebe15585eeb43d450528b09af45f1f13d1`, is mergeable and GitHub's Vercel status for that exact head is also **success**, targeting the same `mikesd1995s-projects/kk-phone-rental-vercel` workspace/project. This is useful independent evidence that Vercel continues accepting builds for the correct project even while this ChatGPT Vercel connector lacks project-read authorization.

The Admin PR is not merged by this Private Reader recheck and is not treated as Private Reader acceptance evidence.

## Current diagnosis

The evidence now cleanly separates two planes:

- **Deployment plane:** healthy; GitHub→Vercel statuses are succeeding for the identified project.
- **Management/acceptance plane from this connector:** blocked by Vercel authorization (403).

Therefore there is still no evidence requiring changes to CRM synchronization, freshness logic, reconciliation logic, Apps Script, transactional data, or the Private Reader implementation itself.

## Safety decision

**BLOCKED_SAFE — NO PRIVATE READER CUTOVER**

The following remain intentionally unchanged:

- Core Operations remains Production SOT.
- CRM/Intelligence remains the private values-only read model.
- `private_reader_runtime` remains pending/safe fallback.
- `private_analytics_acceptance` remains blocked pending authorized production-reader acceptance.
- `runtime_cutover` remains pending/blocked.
- `last_synced_at` is not advanced by this authorization recheck.
- `KK_CRM_REQUIRE_PRIVATE` is not enabled merely to manufacture acceptance evidence.
- No Booking/Event/Asset/Package/Pricing/Web/Settings/Operations data is modified.
- No Apps Script is modified or deployed.
- No Vercel environment variable or secret is modified.
- PR #29 is not merged as part of this work.

## What improved in the 07:27 recheck

- Reconfirmed that the authorization blocker persists rather than silently assuming the connection recovered.
- Added a fresh independent successful Vercel preview/deployment signal from PR #29 on the same workspace/project.
- Further isolated the fault domain to connector management authorization rather than deployment availability.
- Preserved safe Core fallback and avoided unnecessary production mutations.

## Required next gate

Once the Vercel connection is actually authorized for the project, continue in this order:

1. verify current production deployment identity and promoted commit;
2. inspect required environment-variable names without exposing secret values;
3. verify `KK_CRM_SHEET_ID` points to the private CRM & Intelligence spreadsheet;
4. verify a supported read-only Google service-account credential is present;
5. keep strict-private disabled for the first health check;
6. POST authenticated `/api/kk-intelligence-health`;
7. require reader configured, manifest IDs match, sync fresh, all runtime reconciliation passes, `private_analytics_eligible=true`, and status `READY_PRIVATE_READ_RECONCILED`;
8. verify normal Rental Analytics returns `data_source.mode=crm_private` while Core remains authoritative fallback;
9. perform a controlled `KK_CRM_REQUIRE_PRIVATE=1` strict-private acceptance test;
10. restore intended production strictness after the test;
11. only after all gates pass, advance Private Reader acceptance/runtime state with a proven timestamp.

## Changes made in this recheck

- Repeated direct live Vercel project authorization lookup; still 403.
- Checked latest repository state.
- Checked current PR #29 state and exact-head Vercel status; preview/deployment status is success.
- Kept PR #29 unmerged.
- Preserved all production fail-safe states and data.
- Updated this audit record only.
