# Core Privacy P0 — Exact SHA Test Execution Gate — 28 Oct 2026

**Draft/source-only** | PR #739 | No production, Apps Script deployment, Drive ACL, Booking, customer, credential, LINE, Supabase or automation writes.

## Why this was necessary
At the start of this checkpoint PR #739 HEAD was `9741dc7d4a5a8f462fb07a8da262f14488822618`, Draft with merge conflicts against main and **no hosted exact-SHA CI checks**. The workflow `.github/workflows/core-sheet-privacy-exact-head.yml` existed on the Draft PR branch but did **not** exist on default/main, so previous `pull_request` event alone did not produce a current GitHub job.

## Controlled improvement
- Add a minimal `push` trigger **only** for the existing Draft branch `fix/core-sheets-privacy-private-read-gates-20261014` and only for the security workflow/test paths.
- Checkout and verify exact `${{ github.event.pull_request.head.sha || github.sha }}`, supporting both PR and Draft-push events without credential persistence.
- Keep `contents: read`, no secrets, no npm installs, no new provider calls, no deploy, max 8 minutes, and cancel older runs.
- Update the workflow's own Node test contract for the one-branch trigger, the SHA fallback and prohibition on main push.
- An ordinary Node test pass is **not** private Core live 13/13 proof or approval to revoke `anyone/reader` Core ACL.

## Remaining gates
1. Hosted CI on **exact current PR HEAD**, read logs for failure and update source/test carefully if required.
2. Owner-provisioned private credentials and negative authorization checks; no secret printed or stored in repository.
3. Canonical 13 dataset private-read header/schema parity and Admin/Booking/LINE read-only customer-path acceptance.
4. Separate deployment/cutover and Core ACL restriction only with explicit owner approval, complete rollback and browser checks.
5. Resolve PR #739 vs current-main branch conflicts before any release; preserve existing production and customer state.

See Issue #49 and #738 and PR #739 for current acceptance status. Do not mark P0 fixed in Production from source CI.
