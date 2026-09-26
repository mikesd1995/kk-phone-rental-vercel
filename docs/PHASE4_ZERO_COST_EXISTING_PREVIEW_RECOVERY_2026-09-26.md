# Phase 4 Zero-Cost Existing Preview Recovery — 2026-09-26

## Objective

Ship Seamless UX Phase 4 without paying for a Vercel plan and without creating another deployment while the Free plan daily deployment quota is exhausted.

The normal Production path and the prebuilt Production-candidate path both fail at deployment creation because Vercel currently returns the Free-plan deployment quota limit. Source checks, production-environment build, and the repository regression suite pass before that point.

## Zero-cost strategy

Vercel supports promoting an existing READY deployment to Production without rebuilding it. Promotion itself does not create a new deployment.

Directly promoting a Preview is normally unsafe because Preview environment variables can differ from Production. The recovery workflow therefore refuses to promote unless every safety gate below passes.

## Safety gates

1. Only the repository owner can trigger the workflow through PR #213.
2. The approved SHA must still be the exact current `main`.
3. The candidate deployment must be READY, belong to the KK project, and match the explicitly approved candidate Git SHA.
4. Candidate and current-main runtime trees must be byte-identical. Differences are allowed only in `tests/**`, `docs/**`, and `.github/**`.
5. Full source checks and regression tests run again.
6. Vercel environment-variable metadata is read without decrypting values. Every Production variable must be a single unbranched entry targeted to both Production and Preview; separate Production/Preview values or branch-specific Preview overrides fail closed.
7. Candidate read-only probes must pass:
   - storefront 200 and Phase 4 asset marker present;
   - anonymous Admin auth 200 with `authenticated=false`;
   - Rental Analytics anonymous boundary 401 `Unauthorized`;
   - public web feed 200;
   - anonymous Admin gate 200.
8. Candidate public web feed must match current Production before promotion.
9. Exact current-main is checked again immediately before promotion.
10. Promotion uses Vercel's no-rebuild promote API. No new deployment is created.
11. Live Production is checked for Phase 4 markers and auth boundaries.
12. Any post-promotion mismatch triggers immediate promotion of the previously serving Production deployment as rollback.

## Cost and mutation boundary

This path is designed to remain zero-cost:

- no Vercel deployment creation;
- no hosted build;
- no browser-automation credit;
- no paid service is required.

The workflow does not mutate Booking, price, stock, Asset, Event visibility, Package visibility, Google Sheet business rows, Apps Script settings, secrets, or environment variables. It only changes which already-existing accepted Vercel deployment receives Production traffic, and only after all gates pass.

## Trigger

After the workflow is merged to current main:

```
/run-phase4-zero-cost-promote <candidate_deployment_id> <candidate_git_sha> <exact_current_main_sha>
```

The initial intended candidate is the latest READY Phase 4 Preview whose runtime files are identical to the merged Phase 4 runtime. The workflow independently verifies that identity before promotion and will stop without traffic changes if the assumption is no longer true.
