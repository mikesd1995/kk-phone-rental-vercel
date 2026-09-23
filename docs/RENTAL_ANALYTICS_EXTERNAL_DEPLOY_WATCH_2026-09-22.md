# Rental Analytics External Production Watch — 2026-09-22

## Purpose

Move the Rental Analytics deployment/route watch out of scarce ChatGPT Automation slots and into a deterministic external scheduler.

This watch is intentionally **not an AI agent**. Deployment-state polling, SHA lineage checks and HTTP route-shape checks are deterministic control-plane work; using another LLM for this would add cost and failure modes without improving the decision.

## Runtime

GitHub Actions workflow:

- `.github/workflows/rental-analytics-production-watch.yml`
- immediate trigger: every push to `main`
- schedule: hourly at minute 17 as a recovery/monitoring clock
- manual `workflow_dispatch` remains available
- concurrency is single-flight

The workflow reads current `main`, GitHub's Vercel commit status, and Vercel Production deployment metadata. It does not create or redeploy anything.

## Incident binding

The watcher is bound to the accepted Rental Analytics route-shadow fix:

- PR: #164
- fix commit: `061da369297dbce1042cc4822edf9f93956e3776`
- root cause: physical `api/kk-rental-dashboard.js` shadowed the intended rewrite to the v6 signed-session wrapper
- current code contract: legacy analytics core lives at `server/rental-dashboard-core.js`; the physical public-path file must remain absent

## Safe Production route probe

Once the serving Production commit is proven to contain the fix, the watch performs only:

1. `HEAD /api/kk-rental-dashboard`
   - expected v6 unauthenticated boundary: HTTP 401
   - legacy physical handler shape: HTTP 405
   - no PIN/header/cookie is sent, so this is not a login attempt and does not increment the legacy wrong-PIN counter
2. `GET /api/kk-admin-auth`
   - expected HTTP 200
   - no authenticated session is required

This proves public route wiring and the Admin auth gate shape. It does **not** claim a full browser signed-session E2E acceptance; that still requires a real authenticated Admin session.

## State model

- `BLOCKED_BUILD_RATE_LIMIT`: GitHub/Vercel reports the known build-rate-limit and Production does not yet contain the fix.
- `WAITING_FOR_FIX_DEPLOYMENT`: Production remains older than the fix without the explicit build-rate-limit signal.
- `FIX_DEPLOYMENT_NOT_READY`: a newer Production attempt exists but is not READY.
- `ROUTE_WIRING_ACCEPTED`: serving Production contains the fix and read-only route probes match the v6 boundary.
- `ROUTE_SHADOW_REGRESSION`: Production contains the fix lineage but the public path behaves like the old physical handler; workflow fails closed.
- other unexpected route/auth states also fail closed.

## Durable record / anti-spam

PR #164 is the operational record. The workflow maintains one marker comment:

`<!-- kk-rental-analytics-production-watch -->`

A deterministic SHA-256 state fingerprint excludes the check timestamp. The PR comment is created/updated only when material state changes. Repeated hourly checks with the same state are no-ops.

Changed-state evidence is also retained as a GitHub Actions artifact for 30 days.

## Safety boundaries

The watcher:

- uses Vercel API GET only
- never deploys/redeploys Production
- never rotates or reads the Admin PIN or Admin session secret
- never performs an Admin login
- never mutates Google Sheets, Apps Script, booking, event, asset, package, pricing or customer data
- never touches Scanner / Verifier / Canary runtime state
- never invokes Hugging Face, Gemini, Claude or another LLM
- reports `production_writes=0` and `business_writes=0`

## Why this improves the system

Before: deployment monitoring depended on a ChatGPT Automation slot, competing with five core Scanner/Verifier/closure tasks.

After: GitHub's scheduler owns the deterministic watch. ChatGPT task capacity remains reserved for reasoning-heavy operational flows, while deployment state has a durable, auditable, non-AI control loop.

## Rollback

Delete or disable `.github/workflows/rental-analytics-production-watch.yml`. The watcher has no business-data migration, secret change or Production mutation to roll back. The script/tests/docs can be reverted independently.

## First-run remediation

The first push-triggered run on main (`35734879675`) correctly made zero Production or business mutations, but its orchestration failed before the watcher script ran.

Two workflow-only defects were identified from GitHub Actions logs:

- the workflow token did not have `statuses: read`, so the read-only commit-status request returned HTTP 403
- the job-summary shell block used a nested heredoc terminator that Bash interpreted as unterminated

Remediation:

- grant only `statuses: read` in addition to the existing `contents: read` and `issues: write`
- replace the fragile summary heredoc with a non-interactive `node -e` writer
- add regression coverage that requires the status permission and rejects the broken summary-heredoc pattern

No Vercel deployment, secret, Admin credential, Sheet, Apps Script, Scanner, Verifier, Canary or business data was changed by this remediation.

### Second-run permission remediation

The second push-triggered run (`35735369981`) successfully completed the read-only status lookup and watcher execution, classifying the live state as `BLOCKED_BUILD_RATE_LIMIT` with zero Production/business writes. Publishing the single durable PR #164 state comment then returned HTTP 403 because PR issue-comment access also requires Pull Requests permission for this token.

Remediation: add only `pull-requests: write` so the workflow can list/create/update the one marker comment on PR #164. The watcher logic itself did not require a code change.

### Anti-spam fingerprint remediation

A controlled rerun of the now-healthy watcher proved the state itself was stable, but it still updated the existing PR comment and uploaded a second artifact. The SHA-256 fingerprint value was identical; the defect was only in parsing the Markdown line because the bold formatting inserted `**` between the label and value.

Remediation:

- add a hidden machine-readable fingerprint marker to the durable comment
- retain a tolerant legacy parser so the existing comment migrates without duplication
- keep the human-readable fingerprint line for operator inspection

After one migration update, identical material state must produce a true no-op: no comment edit and no changed-state artifact.
