# Vercel Hobby Storage — ready-to-submit support packet (2026-10-11, Asia/Bangkok)

**State: prepared on GitHub; NOT submitted to Vercel.** The connected Vercel plugin does not expose a support-ticket creation action or the account's live Deployment Storage quota and Retention fields. No payments, no new Deployments, no deletions.

## Safe, non-secret environment identifiers
- Team: `mikesd1995s-projects`, ID `team_uaeOdVIjXMSW690ZM2wPuJyt`; Hobby/free account in owner-provided email.
- Project: `kk-phone-rental-vercel`, ID `prj_snbAmpya7YGmOuMbv1o8T16ouxl6`.
- Live storefront: `https://kk-phone-rental.vercel.app/`.
- Production alias is on READY deployment `dpl_AmYtTipVdrzuT1i5XdYBGp3wdY1L`; live storefront HTTP 200. Must preserve this and two historical Production rollback deployments.
- Owner warning on 2026-10-10 at ~23:19 Bangkok: **Deployment Storage 10.00 GB / 10.00 GB**. This was from the *email at that time*, not fresh dashboard usage after automated pruning.
- Before cleanup/recent warning: first 100 returned Deployment records (Oct 9–10) included **50 READY, 33 CANCELED, 17 ERROR**.
- Vercel retention after the freeze: current complete Project deployment listing = **20** total: **19 READY, 1 BLOCKED**, no `next` page cursor. Other two projects in the same team = 0 API-listed deployments each. These are count observations, **not verified storage byte usage** and not a valid claim of exactly 80 deletions.
- Verified stop for new previews: Vercel event `uev_hg873r92dk0tSAPg3Jhc9W6S` at 2026-10-10T16:55:17.019Z, type `project-preview-environment-branch-tracking-updated`, payload `previewDeploymentsEnabled=false`. Current `list_deployments(since=1791651317019)` = **zero new deployments**.
- Private GitHub source recovery: [Draft PR #690](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/690) changes future Git auto-deployment to default deny and allows only `main` plus `release/**`; no merge, no production deployment, no Paid CI, no customer data change.
- No tokens, customer data, or private source files should be included in a public Community post.

## Support issue subject
Hobby Deployment Storage 10GB cap after automatic retention: please verify current rolling usage and safe capacity recovery (no paid upgrade)

## Support issue body — submit only with a CURRENT Usage screenshot
Hello Vercel team,

Our Hobby project `kk-phone-rental-vercel` (`prj_snbAmpya7YGmOuMbv1o8T16ouxl6`, team `team_uaeOdVIjXMSW690ZM2wPuJyt`) received an email indicating that Deployment Storage had reached the Hobby 10 GB limit on October 10, 2026. We need to restore safe build capacity without upgrading our plan.

Our project experienced high Preview churn: one API listing showed 50 READY, 33 CANCELED, and 17 ERROR deployments from Oct 9–10. We disabled Preview auto-deploy; Vercel event `uev_hg873r92dk0tSAPg3Jhc9W6S` confirms `previewDeploymentsEnabled=false`, and zero new Deployments have been recorded since the change. A later complete deployment listing shows only 20 retained records (19 READY / 1 BLOCKED).

The production storefront `kk-phone-rental.vercel.app` is serving normally and must remain available. We have deliberately preserved the active Production deployment (`dpl_AmYtTipVdrzuT1i5XdYBGp3wdY1L`) and rollback versions; we do not want to delete active customer-facing deployments or pay for Pro.

We understand from your September 2026 Hobby retention announcement that unprotected old deployments may be pruned automatically when over the limit, and from your community guidance that Hobby usage is measured over a rolling 30-day period. However, we cannot retrieve the current team-specific Deployment Storage GB value or inspect Retention with our connected API.

**Could you please check:**
1. The latest actual Deployment Storage usage and next date that the account can successfully build again, including any 30-day accumulated amount.
2. Whether any Recently Deleted or protected active-branch deployments are consuming the metered amount, and whether the September 2026 pruning policy has already cleaned up all unprotected records.
3. Whether the reported 10GB condition is still an actual build-blocking quota or reflects older accrued usage in the dashboard.
4. Any safe steps to reclaim headroom on Hobby without deleting current Production/required rollback or changing to Pro.

We can share a current **Usage → Deployment Storage** screenshot privately. Please do not post account secrets or customer data publicly.

Thank you.

## Vercel dashboard checks before marking resolved
1. Dashboard > team `mikesd1995s-projects` > **Usage > Deployment Storage**: note current 30-day GB-month, daily project breakdown, last refreshed timestamp, and whether deploys are still blocked. Check **Functions Storage separately**, because the two quotas can be distinct.
2. Project > **Settings > Security > Deployment Retention**: inspect policy and Recently Deleted; record current values. Hobby policy already does automatic pruning; do not arbitrarily force a shorter Production rollback window or remove protected active branches.
3. If below limit with headroom for 1 Production build, run the targeted actual `node --test tests/vercel-ignore-build.test.js tests/vercel-deployment-policy.test.js` on a no-cost Node runner (the temporary package.json npm alias was removed to avoid unrelated Ultra Deep CI triggers), complete release gate, then merge PR #690 once and verify production alias + branch configuration. Reenable Preview only if needed for deliberate `release/*` RCs.
4. If still at limit with 20 records, submit the support body above and screenshot. **No fabricated reset date**: support/account specific 30-day window decides when the quota becomes usable.

## Verified public references
- [Hobby September 2026 automatic retention](https://vercel.com/changelog/hobby-projects-now-retain-fewer-deployments-to-free-up-storage)
- [Usage and rolling 30-day staff answer](https://community.vercel.com/t/hobby-deployment-storage-not-reclaimed-after-deleting-old-deployments/49417)
- [Official Vercel Git branch allowlist rules](https://vercel.com/docs/project-configuration/git-configuration)
- [Official ignored-build caveat: canceled build still counts](https://vercel.com/docs/project-configuration/project-settings#ignored-build-step)
- [Deployment Retention Settings](https://vercel.com/docs/deployments/managing-deployments)

## Cross-chat state
- Primary operation handoff: `docs/VERCEL_HOBBY_DEPLOYMENT_STORAGE_ZERO_COST_20261010.md`.
- No Vercel quota recovery evidence and no actual hosted Node CI yet; the emergency Preview freeze and Production site health are independently verified. Do not claim this incident is `RESOLVED` until both quota and guarded live release check pass.
