# Audit regression closure — 7 October 2026 evening

## Integration identity

Base main: 783ed7e85493ab932e3cc1fefb3171fc003cd6a0 (latest storefront polish).
Integrates reviewed PR #661 acceptance/test fixes, PR #668 memory-schema repair, and the regression/context continuation described below. Latest storefront HTML/CSS/JS are preserved without edits by this continuation. PR #665 owner-suppression policy remains separate.

## Root causes repaired

1. Invalid RUN_RESULT memory kind blocked all-domain bootstrap, including unrelated content/reliability/X routes. Reclassified the historical record as supported ACCEPTANCE; retained strict validation and added whole-corpus regression. Historical text is not authority to reopen events.
2. Code Intelligence alphabetical tie-breaking displaced curated Inbox ingress files from the context budget. Stable score sorting and route priority now retrieve real Inbox integration without enlarging budgets.
3. Inbox tests depended on obsolete variable names/string concatenation. Replaced with real authenticated handler reads and renderer behavior, checking zero writes/provider sends, escaping, unread badges and count.
4. Storefront tests expected obsolete cache hashes, copy and one-level modal lock shape. Aligned to current main and tested actual nested lock/unlock scroll restoration in a VM. No UI implementation or visual acceptance claim.
5. Monthly discovery expectations still required 8/11 tiers; current source includes 16 audit and14 operational tiers. Explicit sets preserve every required category and bounded operational queries.
6. Three bridge fixtures invoked durable storage without configuration. Stubbed only storage boundary with try/finally restoration and audit-receipt assertions; business writes/publishes remain0. This proves unit behavior, not live persistence.
7. Admin workflow assertion expected automatic triggers even though documented infrastructure recovery is manual-only. Test now checks documented workflow_dispatch plus required checks and absence of continue-on-error; it does not enable or bypass CI.

## Verification

- Final integrated repository-wide suite: **1445/1445 PASS**, zero failures, under existing offline network guard.
- Independent reviewer: **94/94 scoped PASS**, no material blockers; approved PR save.
- Memory repair independent review:8/8PASS.
- Code context benchmark and invariant gate executed locally; source syntax and diff checks passed.
- Earlier audit 1409/1441 with32fail is historical. Counts increased through regression additions and newer main. Do not claim all differences represent production bugs.
- No dependencies added. No customer messages, booking/price/stock writes or automatic publish.

## Remaining external boundaries

Fresh production Apps Script timing health still returns HTTP200 with data.status READBACK_BLOCKED/error PHASE1_HEALTH_TIMEOUT. Runtime version, source equivalence and installed triggers remain unverified. Do not count HTTP200 as healthy.

Hosted Actions must actually execute and pass before release acceptance. The earlier zero-step/no-runner failures are not assertion failures. Do not retry-spam, pay for quota or weaken gates.

Production deployment/readback is not established by these local tests. Exact remote head and hosted checks are recorded in PR #661 body after saving, avoiding documentation-only build churn. Use that current head before resuming.

## Next work

1. Verify exact integrated PR head remotely; evaluate hosted checks and production-release conditions.
2. Diagnose Apps Script timeout through authorized source/health evidence; no booking mutation as probe.
3. Keep owner-suppressed event/date exclusions locked; review #665 separately before any scan-to-publish acceptance.
4. Prove LINE→booking→readback and revenue/stock reconciliation through governed paths.
5. Do not activate paused Make/Telegram transport until its role, duplicate protection, approval and readback are verified.
