# Production Deployment Recovery Checkpoint — 2026-09-21

Status: **DOC-ONLY RETRY / NO RUNTIME BEHAVIOR CHANGE**

## Reason

HF staging PR #123 merged as:

`4da5acbb9fa54dee3ed8baec55812d25e35c43e4`

but Vercel did not produce an exact-main Production deployment because the exact-head Vercel status remained blocked by the account build-rate-limit.

At retry preparation:
- current main = `4da5acbb9fa54dee3ed8baec55812d25e35c43e4`
- latest READY Production = `dpl_EPr5KMwqyK8pFGM5NfY6HK1WbsvK`
- Production source SHA = `0753c6d0af246daa6a9b0324fee4ec876b38f157`
- therefore main/Production drift is present.

## Recovery method

This PR changes documentation only.

Its purpose is to obtain a fresh exact-head:
1. GitHub Admin Regression result;
2. Vercel Preview build under current account capacity.

Merge is permitted only if:
- branch remains 0 behind current main;
- Admin Regression passes;
- exact-head Vercel Preview is READY;
- changed-file scope remains this documentation file only.

If those gates pass and this PR is merged, the merge commit becomes the new exact current main and must receive a READY Production deployment before any Production OIDC acceptance is attempted.

## Safety

This retry does not:
- change runtime code;
- change Vercel environment variables;
- change Machine SOT;
- enable Scanner, Verifier, Canary, witness mode, HF, or business writes;
- deploy Apps Script;
- mutate Google Sheets;
- call HF;
- send customer/provider notifications.

## Acceptance

Do not use Production for OIDC acceptance until:

`production.githubCommitSha === current main SHA`

and Production state is `READY`.
