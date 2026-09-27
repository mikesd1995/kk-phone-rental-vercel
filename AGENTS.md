# KK Phone Rental — AI Engineering Guide

This is the compact repository-level contract for AI-assisted engineering. Detailed domain procedures live in scoped skills and project docs; do not paste them into every task.

## First action for a code task

Before broad search or opening large files, run:

    npm run code:context -- "<task description>"

Use the returned context pack first. Expand beyond it only when evidence shows the selected files are insufficient.

For targeted regression:

    npm run code:test -- "<task description>"

For a repo/dependency map:

    npm run code:map

## Engineering flow

1. Classify the subsystem and risk.
2. Retrieve the smallest relevant context pack.
3. Plan affected files, invariants, write authority and tests.
4. Implement the minimum coherent diff.
5. Review the diff against task and invariants.
6. Run targeted tests selected by Code Intelligence.
7. Run full regression when the context pack requires it or the change crosses subsystem/security/business-write boundaries.
8. Read back external state after any authorized external mutation.
9. Record material architecture/runtime changes in a dated doc.

Do not repeatedly read the full repo, all docs, or all tests unless the task truly spans them.

## Stable authority boundaries

- Discovery Scanner is staging-only; it never writes final event/pricing/booking/inventory truth.
- Verifier owns governed event verification under current Machine SOT.
- Owner-hidden storefront state must not be reopened implicitly.
- Content Agent is advisory and requires verified business truth for direct-rental copy.
- HF/search/crawlers are advisory evidence, never final business authority.
- Canary and acceptance paths must preserve zero unauthorized business writes.
- Pricing, booking, inventory and Machine-SOT mutations require their existing governed write paths.
- Never create a replacement scheduler/runner to hide a runtime symptom.

## Context discipline

- Default context budget: 12k estimated tokens and 10 files.
- Large files should be inspected by symbols/targeted ranges first.
- Prefer dependency/reverse-dependency evidence over broad grep.
- Load only the skills returned by the context pack plus any skill explicitly required by the task.
- Prefer current source + regression tests over historical docs.
- If the first context pack is wrong, refine task wording or route configuration instead of permanently increasing the global budget.

## Change discipline

- Preserve working behavior outside requested scope.
- No speculative refactors mixed into bug fixes.
- Do not weaken a safety gate or test merely to make CI green.
- If the first approach fails, identify the failing boundary and use a second evidence-based approach.
- New abstractions require a concrete reuse or safety benefit.
- Every material bug fix should add or strengthen a regression guard.
- Avoid new runtime dependencies when Node built-ins are sufficient.

## Production discipline

Before production-affecting actions, use the current production-release skill and fresh runtime evidence. A successful API call, timer, deployment request, or workflow start is not acceptance proof.

For Vercel, Supabase, Apps Script, Scanner/Verifier schedules, Google Sheets Machine SOT, bookings, pricing or inventory: preserve existing least-privilege, locking, fencing, exact-readback and owner-approval rules.

## Code Intelligence v1

The deterministic retrieval baseline is intentionally zero-cost and local:

    task
      -> curated subsystem routes
      -> repo/dependency map
      -> bounded relevant files
      -> targeted tests

Do not enable a semantic/Hugging Face code retriever until it beats this baseline on a checked-in benchmark for relevance, token cost and false-negative rate.
