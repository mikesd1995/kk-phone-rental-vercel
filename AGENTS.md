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
5. Run an independent Reviewer pass against the diff, task, invariants and failure evidence. The Implementer must not self-certify a material fix.
6. Run targeted tests selected by Code Intelligence.
7. Run full regression when the context pack requires it or the change crosses subsystem/security/business-write boundaries.
8. Read back external state after any authorized external mutation.
9. Record material architecture/runtime changes in a dated doc.
10. For material changes, evaluate `server/kk-engineering-execution-gate.js`; do not call the work accepted while any required phase is missing.

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
- If the first approach fails, identify the failing boundary and use a second evidence-based approach. Do not repeat the same patch hypothesis without new evidence.
- Material fixes require Planner -> Implementer -> independent Reviewer separation. External coding-agent tooling may fill the Reviewer/Debugger role when connected; otherwise use the repository review skill as a distinct pass.
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


## Deep Scan full-loop execution

For Deep Scan / Ultra Deep Scan requests, follow `docs/DEEP_SCAN_FULL_LOOP_EXECUTION_CONTRACT_V1_2026-09-28.md`. Treat one user scan request as authorization to continue through all safe pipeline stages without requiring repeated conversational `continue` prompts. Stop mutations only at the contract's hard-stop conditions; try approved fallback paths first and report the blocker precisely.


## Public storefront text boundary

Internal operational annotations must never reach unauthenticated/public customer surfaces.

Hard rules:
- Treat machine-style ALL_CAPS snake-case annotations (for example owner/pricing/benchmark/audit/collision tokens) as internal by default.
- Sanitize customer-facing free-text at the server public-data boundary before CSV leaves `/api/kk-data`.
- Keep the browser-side sanitizer as a second defense; never rely on the UI alone.
- Apply the boundary to package `web_note` / `use_case`, event `event_note`, and other customer-visible free-text that can carry internal metadata.
- Preserve internal notes in internal/admin sources; do not solve a leak by deleting audit rationale unless the owner explicitly requests that data change.
- Any change touching public notes or derived public feeds must include a regression case proving known internal-token classes are redacted while normal customer copy remains visible.
- A public API response containing an internal operational token is a release-blocking defect.
