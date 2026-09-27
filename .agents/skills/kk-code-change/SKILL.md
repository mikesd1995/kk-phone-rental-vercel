---
name: kk-code-change
description: Use for implementation work in the KK Phone Rental repo. Enforces context-first planning, minimal diffs, targeted tests, regression coverage and no unauthorized business/runtime mutation.
---

# KK Code Change

## Required workflow

1. Run npm run code:context -- "<task>".
2. Read selected files, relevant scoped skills and targeted tests before broad repo search.
3. Write a short change plan containing desired behavior, first boundary, expected files, preserved invariants, targeted tests and full-regression requirement.
4. Make the minimum coherent change.
5. Run npm run code:test -- "<task>".
6. Run full npm test when context says it is required or the change crosses security/business-write/runtime boundaries.
7. Read back any external state explicitly authorized to change.

## Prohibitions

- No unrelated refactor in a bug-fix PR.
- No test weakening to make CI pass.
- No Machine SOT, pricing, booking, inventory or task-state mutation merely to validate code.
- Do not add a new package when a small Node built-in implementation is sufficient.
- Do not make a runtime component authoritative because a helper/model returns high confidence.

## Failure handling

If approach A fails, preserve failure evidence, identify the exact failing boundary, then use approach B. Do not restart from the whole repo unless the first context pack was demonstrably wrong.
