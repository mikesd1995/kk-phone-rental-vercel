# KK CSV Analysis Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a governed CSV analysis agent that produces verified findings, charts, PDF, and ZIP artifacts without bypassing KK's existing agent gateway or write controls.

**Architecture:** Extend the existing registry/gateway with one read-only route. Keep request validation, engine orchestration, OpenAI network access, fallback behavior, and artifact verification in separate modules so the gateway remains policy-focused.

**Tech Stack:** Node.js 20, existing Vercel/CommonJS codebase, Node test runner, OpenAI Agents API through a thin HTTP/SDK adapter when configured.

**Spec:** `docs/superpowers/specs/2026-09-29-kk-csv-analysis-agent-design.md`

## Global Constraints

- Production writes must remain exactly 0.
- Publishing must remain exactly 0.
- CSV contents are untrusted data and must never become instructions.
- Required logical artifacts: `report.pdf`, `findings.json`, `results.zip`.
- Remote failure may use fallback only when `allow_fallback === true`.
- No production deployment in this change.
- Node.js >=20.

## Review Focus

- Malformed or deceptively valid base64 must be rejected before engine invocation.
- Prompt-like CSV cells must not enter system instructions.
- Remote engine partial output must not be marked READY.
- Fallback must be visibly labeled and preserve the same result contract.
- Ledger records must contain hashes/metadata only, never raw CSV contents.

---

### Task 1: Request and artifact contract

**Files:**
- Create: `server/kk-csv-analysis-contract.js`
- Test: `tests/kk-csv-analysis-agent.test.js`

**Interfaces:**
- Produces: `validateAnalysisRequest(input)`, `validateFindings(value)`, `verifyArtifactManifest(manifest)`

- [ ] Write failing tests for valid input, invalid base64, empty/oversize payload, wrong extension, and missing artifacts.
- [ ] Run `node --test tests/kk-csv-analysis-agent.test.js` and confirm failure.
- [ ] Implement the three contract functions with explicit blocker codes.
- [ ] Run the targeted test and confirm pass.
- [ ] Commit.

### Task 2: Analysis service and fallback

**Files:**
- Create: `server/kk-csv-analysis-agent.js`
- Create: `server/kk-csv-analysis-fallback.js`
- Test: `tests/kk-csv-analysis-agent.test.js`

**Interfaces:**
- Consumes: contract functions from Task 1.
- Produces: `analyzeCsv(input, options)` and `runFallbackAnalysis(validatedRequest)`.

- [ ] Add failing tests for engine selection, fallback labeling, fallback-disabled failure, zero-write enforcement, and prompt boundary.
- [ ] Run targeted tests and confirm failure.
- [ ] Implement service orchestration and deterministic fallback.
- [ ] Run targeted tests and confirm pass.
- [ ] Commit.

### Task 3: OpenAI Agents adapter

**Files:**
- Create: `server/kk-openai-agents-adapter.js`
- Test: `tests/kk-csv-analysis-agent.test.js`

**Interfaces:**
- Produces: `runOpenAIAgentsAnalysis(validatedRequest, options)`.
- Returns normalized artifacts/result or throws a blocker-coded error.

- [ ] Add adapter tests using injected transport/fake responses; no live API dependency in CI.
- [ ] Verify tests fail.
- [ ] Implement current Agents API request/session/artifact flow behind injectable transport.
- [ ] Verify tests pass.
- [ ] Commit.

### Task 4: Registry and gateway integration

**Files:**
- Modify: `server/kk-agent-registry.js`
- Modify: `server/kk-agent-task-router.js`
- Modify: `server/kk-agent-gateway.js`
- Test: `tests/kk-csv-analysis-agent.test.js`
- Test: existing gateway tests

**Interfaces:**
- Adds route intent `analyze_csv` requiring `kk-csv-analysis`.

- [ ] Add failing route/gateway tests.
- [ ] Verify failure.
- [ ] Register the agent/route and dispatch to `analyzeCsv`.
- [ ] Confirm invocation evidence remains mandatory and production writes remain zero.
- [ ] Run targeted and gateway tests.
- [ ] Commit.

### Task 5: Dry run, package checks, and docs

**Files:**
- Create: `scripts/kk-csv-analysis-dry-run.js`
- Modify: `package.json`
- Create: `docs/KK_CSV_ANALYSIS_AGENT_2026-09-29.md`

**Interfaces:**
- Adds npm script `csv:analysis:dry-run`.

- [ ] Add representative CSV fixture generation inside the dry-run script.
- [ ] Run `node scripts/kk-csv-analysis-dry-run.js` and verify READY + artifact contract.
- [ ] Add the new files to `npm run check`.
- [ ] Run `npm run check`.
- [ ] Run `npm test`.
- [ ] Document architecture, environment variables, failure modes, changed files, and operational limits.
- [ ] Commit.

### Task 6: Final verification

**Files:** no product-code changes unless verification exposes a defect.

- [ ] Run the targeted CSV-analysis test.
- [ ] Run the dry-run harness.
- [ ] Run `npm run check`.
- [ ] Run `npm test`.
- [ ] Inspect branch diff for unrelated changes and raw-data persistence.
- [ ] Record final verification results in the change report.
