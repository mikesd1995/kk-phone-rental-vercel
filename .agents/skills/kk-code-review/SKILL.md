---
name: kk-code-review
description: Use to review KK Phone Rental diffs before merge. Checks correctness, scope, authority boundaries, security, dependency blast radius, regression coverage and rollback/readback requirements.
---

# KK Code Review

Review the diff plus relevant contracts, not the whole conversation.

## Review order

1. Does the diff satisfy the explicit requirement?
2. Does it change behavior outside the requested subsystem?
3. Are owner/business authority boundaries preserved?
4. Does dependency/reverse-dependency impact require extra tests?
5. Are error paths fail-closed where business/security state is involved?
6. Are secrets, raw prompts and customer data avoided in logs/ledgers?
7. Is idempotency preserved for retries?
8. Is there a regression test for the bug or new invariant?
9. Does production rollout need rollback/readback evidence?

Classify findings as BLOCKER, MATERIAL or NOTE. Do not approve a change solely because tests pass.
