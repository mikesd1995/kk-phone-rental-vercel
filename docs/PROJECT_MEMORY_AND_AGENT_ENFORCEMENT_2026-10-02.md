# KK Project Memory + Agent Runtime Enforcement — 2026-10-02

## Purpose
Make cross-chat continuity a project capability instead of relying on conversational recall, while keeping the existing governed Agent runtime proof standard.

## Project memory
- Canonical seed corpus: `config/kk-project-memory.json`
- Validator/bootstrap: `server/kk-project-memory.js`
- CLI: `node scripts/kk-project-memory-bootstrap.js [domain...]`
- Stores durable rules, decisions, implementation history, incidents, blockers, next actions and acceptance references.
- Supports explicit supersession so stale decisions disappear from bootstrap context.
- Rejects likely phone/secrets/tokens.
- Never becomes authority for current price, inventory, booking, customer or event truth.
- Raw transcripts are not injected wholesale. Conversation-derived facts must be promoted into concise evidence-backed durable memory.

## Required session behavior
Before substantial KK work, retrieve the relevant project-memory domain plus the normal code-context route. If memory and current canonical business/runtime evidence disagree, current canonical evidence wins and the discrepancy must be recorded rather than silently guessed.

## Agent enforcement
The existing Agent Runtime Proof Gate remains authoritative:
registered name/prompt/document != runtime use.
A claim that an Agent ran requires the registered route, actual invocation, persistent ledger evidence and flow-specific acceptance.

Critical flows already governed this way include Content, Discovery/Ultra Deep, Verifier, Canary, Reliability, Operating Partner and Storefront design/review routes. Deterministic booking, Admin, inventory and revenue calculations remain deterministic by design; AI must not become their write authority.

## Learning boundary
Learning means durable evidence -> feedback/fingerprint/performance signal -> future governed decision -> regression/acceptance. It does not mean autonomous retraining or self-modifying production code.

## Follow-up
Future accepted owner decisions and completed implementation records should append or supersede project-memory entries as part of closure. This avoids repeating solved work in a new chat while preserving auditable evidence.


## Durable runtime ledger activation
- Canonical Supabase project is pinned to `zehlsagzrpromtfqqflt` (`kk-phone-rental-runtime-ledger`).
- `public.kk_project_memory_events` is append-only for the application role: RLS enabled; `anon` and `authenticated` have no table grants; `service_role` has only `SELECT, INSERT`.
- `server/kk-project-memory-ledger.js` uses the same exact project-ref binding gate as the runtime/decision ledgers.
- Agent Gateway loads seed memory plus durable ledger memory before critical execution. If the durable ledger is enabled/configured but cannot be read, the request fails closed as `BLOCKED_PROJECT_MEMORY_UNAVAILABLE`.
- Durable memory remains non-authoritative for booking, pricing, inventory, customer, and current event truth.
- Database migrations: `add_kk_project_memory_events`, followed by `tighten_kk_project_memory_events_grants`.

## Acceptance — durable ledger
- GitHub Admin Regression run `36913809332`: PASS.
- Syntax checks: PASS.
- Full regression tests: PASS.
- Continuous invariant gate: PASS.
- Code Intelligence benchmark: PASS.
- HF harness safety and fail-closed readiness: PASS.
- Canonical database readback: RLS enabled and application `service_role` privileges restricted to `INSERT, SELECT`.
- Vercel preview build-rate-limit remains a deployment-quota condition and is not treated as repository acceptance.
