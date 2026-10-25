# Canonical owner intake implementation plan

Spec: ../specs/2026-10-25-canonical-owner-poll-spec.md
Base: 64cec7bfa75e8c1f5cfe56570ee701f27bf540fe
Branch: feat/canonical-owner-poll-20261025

1. Implement the coherent canonical protocol with tests first: additive durable contract/SQL, bounded authenticated GAS adapter, same-route gateway dispatch, same GAS project's poll/claim/project functions, OIDC operation allowlist and same-Make guarded configuration preparation. Keep legacy UAT unchanged. Treat these as one integrated task because their contracts and safety invariants are inseparable.
2. Run targeted tests, execute native SQL against a disposable PostgreSQL-compatible database, then run full source regression/syntax checks. No production mutation.
3. Independent whole-branch review against the specification and failure/concurrency evidence; fix material findings and re-review changed boundaries.
4. Record exact implemented scope, tests, limitations and OFF deployment prerequisites; commit and prepare a draft PR when validated. Do not merge or deploy this new unapproved head.

Preflight conflict rulings: source age uses trusted cutoff, not current-slot age (quiet-hour policy wins); canonical storage is additive so v1 UAT guards remain byte-identical; same identity survives authorized retries, while uncertain attempts are fenced; Make is the sole canonical Telegram sender, GAS canonical mode must suppress competing timed Core TG claims without changing LINE. No policy-owned allowed-change-type list or activation epoch is supplied by caller or inferred from test fixtures.
