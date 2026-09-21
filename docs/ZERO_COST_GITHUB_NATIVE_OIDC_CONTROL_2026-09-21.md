# Zero-Cost GitHub-Native OIDC Control Path — 2026-09-21

## Decision

TinyFish/browser automation is removed from the KK Phone Rental control-plane critical path.

The canonical bounded OIDC acceptance path is GitHub-native and can be initiated by an exact owner comment on Issue #47:

```text
/run-bounded-oidc
```

The existing manual `workflow_dispatch` path remains as an emergency fallback.

## Zero-cost boundary

The repository implementation adds no paid browser or third-party automation dependency.

The workflow uses the repository's existing GitHub Actions execution and existing `VERCEL_TOKEN`. If included GitHub Actions capacity is unavailable, the system must stop rather than add a paid browser fallback.

No repository workflow is authorized to purchase capacity, upgrade a plan, or silently route to a paid automation provider.

## Authorization gate

The issue-comment path is accepted only when all of the following are true:

- event = `issue_comment`
- issue number = `47`
- comment login = repository owner
- comment author association = `OWNER`
- comment body exactly = `/run-bounded-oidc`

Any other issue, user, role, or comment text schedules no job work.

## Fresh authority resolution

The workflow never trusts a deployment ID copied from an earlier chat or run.

For every accepted trigger it:

1. checks out `main`;
2. fresh-reads `refs/heads/main`;
3. requires checkout SHA = current main SHA;
4. lists Vercel Production deployments with the existing owner token;
5. selects the newest deployment satisfying all of:
   - state = READY
   - target = production
   - Git ref = main
   - Git SHA = exact current main
6. fails closed when no exact deployment exists;
7. optionally rejects a manually supplied deployment ID unless it equals the auto-resolved ID.

## Mutation boundary

Before live mutation the workflow:

- runs targeted regression tests;
- runs the exact-source acceptance dry-run;
- re-reads main immediately before mutation.

The acceptance script remains limited to the OIDC probe flag and exact-source Production redeploy. Scanner execution and business writes must remain false.

Independent rollback recovery runs with `always()` semantics once an exact source and SHA have been established.

## Terminal acceptance

A run is accepted only when:

- acceptance step succeeds;
- rollback step succeeds;
- final main SHA equals pinned preflight main SHA;
- acceptance report result = `PASS_AND_ROLLED_BACK`;
- rollback report = `ROLLBACK_ALREADY_SAFE` or `ROLLBACK_PASS`;
- OIDC probe reports `business_writes=0`;
- acceptance rollback readback reports `oidc_probe_enabled=false`.

Anything else is fail-closed and earns zero Gate-1 acceptance credit.

## Explicit non-authority

This path does not authorize:

- native Scanner re-enable;
- native Verifier re-enable;
- Canary re-enable;
- Machine SOT changes;
- HF Production enablement;
- business/final-truth writes;
- provider/customer notifications;
- Apps Script deployment or source changes.

## Audit artifacts

Every started acceptance run uploads secret-safe evidence including:

- auto-resolved source deployment identity;
- dry-run report;
- acceptance report/log;
- rollback report/log;
- final main SHA.

Issue #47 remains the durable control-plane record.
