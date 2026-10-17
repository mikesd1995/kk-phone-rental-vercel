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

## Cleanup & cross-chat continuity (2026-10-14)

The [canonical cleanup triage](docs/KK_PROJECT_CLEANUP_CONTROL_2026-10-14.md) is the dated baseline for the 36-PR backlog, 25-workflow audit and the Vercel deployment-capacity HOLD. Its snapshots are not timeless: refresh GitHub/Vercel readbacks before mutating code.

For every new KK work request:
1. Check current `main`, the matching open PRs/issues and their changed paths **before creating a new branch**. State explicitly whether the work is `EXISTING PR`, `PORT TO CURRENT MAIN`, `REBASE`, or genuinely `NEW`. Filename overlap is not proof of supersession.
2. Use one bounded subsystem release candidate instead of layering another broad cross-domain PR. Preserve existing reviewable work and regression tests. Do not close older PRs without an independently reviewed replacement and explicit owner authorization.
3. Distinguish `CODE WRITTEN`, `LOCAL TEST PASS`, `CI PASS`, `PREVIEW VERIFIED`, `PRODUCTION VERIFIED` and `BLOCKED`. Never treat a draft PR or skipped workflow as a successful release.
4. Keep the established zero-spend Git Preview suppression and existing production/rollback deployments intact. Do not invoke app-origin Vercel deployments without explicit owner approval, verified free capacity and required safety gates.
5. At handoff, write a dated GitHub record of exact SHA, changed files, evidence, failed alternatives, unresolved conditions, rollback and the next action. Don't duplicate a closed-loop investigation in a later chat.
6. Treat Booking/Stock/Price/Customer PII/LINE/Drive permissions as P0; no source-of-truth cutover, production write, ACL change, deployment or customer notification without the applicable acceptance and owner approval.

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

## Mandatory Product / UX / UI gate

For every task that changes or reviews customer-facing storefront UI, Admin UI, product flow, navigation, forms, filters, modals, sticky/fixed controls, responsive layout, accessibility, or other user interaction:

1. Invoke the registered `kk-storefront-ux-reviewer` through the Agent Gateway using `storefront_ux_review` before implementation. Do not substitute an informal prose review.
2. Supply concrete viewport/layout evidence. For screenshot-reported defects, encode the screenshot observation in the review packet; missing visual evidence is a blocking condition for final visual acceptance.
3. Treat P0/P1 findings as release-blocking for the affected surface. Implement the smallest coherent fix without changing pricing, inventory, booking semantics, event visibility, Machine SOT, or unrelated behavior.
4. Add or strengthen a regression guard for the reported defect. Responsive changes must cover the affected mobile width plus representative acceptance widths.
5. After implementation, invoke `storefront_visual_qa`. A material UX/UI change is not accepted while Visual QA is FAIL/BLOCKED or required P0/P1 evidence remains unresolved.
6. Preserve persistent invocation evidence required by the Agent Registry. Code review/CI evidence does not replace agent invocation evidence.
7. Production acceptance still requires fresh runtime/readback evidence under the production-release rules. The UX agent cannot merge, deploy, publish, or mutate business truth.

This gate applies to both storefront and Admin/product-flow work. If a task is outside the current reviewer policy, extend the deterministic policy/reviewer/tests first rather than silently bypassing the gate.

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
