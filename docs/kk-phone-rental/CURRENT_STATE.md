# KK Phone Rental — Current State Checkpoint

Checkpoint: 2026-09-03 16:13 Asia/Bangkok
Branch: `skills/x-scanner-v2`

> This file is a progress checkpoint for migration/workstream continuity. It does not override the live Machine SOT. If this file conflicts with the highest Active `_Policy_Registry`, current Machine SOT runtime state, or newer provider/readback evidence, the newer live authority wins.

## Operating workflow

Use this sequence for every continued workstream:

`READ DOC -> RECONCILE LIVE STATE -> EXECUTE NEXT ACTION -> READBACK/VERIFY -> WRITE BACK DOC -> SET NEXT ACTION`

Do not rebuild Core v1. Continue from the latest verified state and fail closed when authority, ownership, fencing, provider access, or runtime evidence is ambiguous.

## Documents read before this checkpoint

The migration Starter Pack was read/reconciled before performing the work in this checkpoint, including:

- `00_READ_ME_FIRST.md`
- `01_CODEX_BOOTSTRAP_PROMPT.md`
- `02_PROJECT_CURRENT_STATE.md`
- `04_SOURCE_OF_TRUTH_MAP.md`
- `05_ACTIVE_RULES_AND_POLICIES.md`
- `10_SKILL_CATALOG.md`
- `12_PHASE_HISTORY_AND_STATUS.md`
- `14_MIGRATION_CHECKLIST.md`
- `15_AUDIT_GAPS_UNVERIFIED.md`
- `17_GITHUB_STATE.md`
- `21_VERIFICATION_REPORT.md`

These files remain migration/reference material; live Machine SOT/provider/readback evidence is authoritative when newer.

## Live authority reconciliation

### Machine SOT

- Spreadsheet: `KK Phone Rental — Event Tracker Aug–Dec 2569`
- Spreadsheet ID: `1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo`
- Live `_Policy_Registry` confirms exactly one Active `POLICY_VERSION`: `v4.9.2 BALANCED SOURCE COVERAGE`.
- `_Policy_Registry` wins over `_Scan_Control` mirror drift and stale automation prompts.
- Live competitor boundary remains `SCANNER_RAW_VERIFIER_FINAL`.
- KK Phone Rental own listings are excluded from competitor evidence.
- Exact-event range requires at least 2 independent competitors; median requires at least 3.

### Core v1

Core v1 remains treated as `RUNTIME_VERIFIED / COMPLETE` and was not rebuilt or modified in this workstream.

Existing chain remains:

`Scanner -> Verifier -> Google Sheet -> Notification Ledger -> Telegram + LINE`

No Core-v1 architecture replacement was created.

## Runtime runner reconciliation — P0 single-runner state

Live `_Run_Manifest` shows continuous Scanner/Verifier execution through 2026-09-03 before and during this migration window.

Recent observed evidence includes:

- Scanner `SCV492-20260903T145731` — 15:00 COMPETITOR DEEP — `FINISHED` at 15:06:20.
- Verifier `GPTV492-20260903T152829` — two competitor packets frozen/adjudicated — final completion recorded at 15:33.
- Scanner `SCV492-20260903T155820` — 16:00 heartbeat — `FINISHED` at 15:59:10.

The new ChatGPT Scheduled Task `KK Discovery Scanner — Current Policy` also recorded its first run at approximately 15:59 ICT. Because the Machine SOT Manifest does not expose the ChatGPT task ID, the source of the 16:00 Manifest cannot be attributed safely to old vs new runner from this evidence alone.

Therefore **single-runner cutover is NOT VERIFIED**.

Safety action taken in this checkpoint:

- New `KK Discovery Scanner — Current Policy`: **PAUSED/DISABLED** after its first observed run.
- New `KK GPT Verifier — Current Policy`: **PAUSED/DISABLED**.
- `KK Canary Safety — Enabled Suite`: **ENABLED**; it is not treated as a competing production writer and its prompt must not create synthetic production writes.

Do not re-enable the new Scanner or Verifier until the prior runner is identified/disabled or conclusively proven to be the same runner, followed by no-overlap readback.

## X Scanner V2.1 workstream

Status: `SAFE_TO_INSTALL` after adjustment, but not merged to `main`.

GitHub:

- Repository: `mikesd1995/kk-phone-rental-vercel`
- Branch: `skills/x-scanner-v2`
- Draft PR: `#1 Add on-demand X scanner v2.1 skills`
- Base remains `main`.
- `main` has not been merged or modified by this workstream.

Eight skills were added under `ai/skills/<skill>/SKILL.md`:

1. `x-content-competitor-pricing-scanner`
2. `event-web-research-orchestrator`
3. `social-media-event-scanner`
4. `poster-media-fact-extractor`
5. `official-hashtag-verifier`
6. `competitor-rental-hunter`
7. `competitor-price-evidence-ranker`
8. `scan-completeness-auditor`

V2.1 changes include:

- on-demand only; no hourly Core Discovery Scanner hook
- canonical trigger: `ขอโพสงานนี้บน X`
- dependency cycles removed
- existing `EVIDENCE_VERIFIER` remains the promotion gate for event facts and competitor evidence
- existing `CONTENT_THREE_VARIANT_ENGINE` runs only after `CONTENT_GATE=PASS`
- source states remain distinct: `CHECKED / BLOCKED / NOT_ACCESSIBLE`
- no guessing date/time/venue/hashtag/link/competitor price/access success
- exact-event competitor evidence before comparable fallback
- no Production write/publish/notification side effect from the scanner skill

Static replay/regression result: 12/12 checks passed; dependency graph has 0 cycles.

## Phase C/D Runtime UAT

Status: `BLOCKED / NOT EXECUTED IN THIS CHECKPOINT`.

Exact target remains:

- command/token: `/team PREVIEW 1c830e214878f883a92e5f42`
- Make scenario: `5988323`
- controlled `Run once` only
- scenario OFF outside UAT

Current blocker:

The connected Make account cannot read/run scenario `5988323`; provider response requires admin permission `organization view`.

Do not substitute legacy scenario `5901592`.

Live `_AI_Inbox` already contains five prior rows for the exact preview token, Telegram message IDs:

- 201
- 203
- 205
- 207
- 218

All were observed as `NEW`. No matching token was found during reconciliation in `_Command_Queue`, `_Decision_Inbox`, `_Notification_Ledger`, or `_Job_Queue_STAGING`.

Therefore another `/team PREVIEW` was intentionally not injected.

Required successful UAT readback remains:

- Telegram `message_id`
- exact `WAITING_APPROVAL` row
- exact preview/token/version binding
- no X publish
- no LINE/customer send
- scenario returned OFF outside UAT

## Known drift / unresolved items

1. **P0 — single-runner cutover not verified.** New Scanner/Verifier are paused to prevent overlap until old/runtime runner ownership is reconciled.
2. **P0 — Phase C/D runtime UAT blocked by Make permission** for exact scenario `5988323`.
3. **P0 — five unreconciled preview requests** already exist in `_AI_Inbox`; do not create a sixth until their routing state is resolved.
4. `_Scan_Control` is a lower-authority mirror and contains stale business-semantic material relative to the newer Sep-1 company semantics. Do not let it override `_Policy_Registry`; repair only through an explicitly approved reconciliation scope.
5. X Scanner V2.1 remains Draft-PR only; Runtime Installed status is not implied by branch files.
6. `main` must remain unmerged until owner approval.

## Changes made in this checkpoint

- Re-read migration/current-state documents before continued work.
- Reconciled live `_Policy_Registry`, `_Scan_Control`, `_Run_Manifest`, `_Run_Lock`, UAT queues and current Scheduled Tasks.
- Confirmed live runtime activity through 2026-09-03.
- Paused the new Discovery Scanner after detecting that single-runner cutover could not be proven.
- Kept the new GPT Verifier paused.
- Kept Canary Safety enabled.
- Preserved Core v1 and Production behavior.
- Preserved Make scenario state; no Run once was executed.
- Preserved the five existing preview requests; no sixth request was created.
- Kept PR #1 draft and `main` unmerged.

## Explicitly NOT done

- No merge to `main`.
- No Core v1 rebuild.
- No replacement Scanner/Queue/Sheet architecture.
- No new `/team PREVIEW` injection.
- No Make `5988323` execution or activation.
- No legacy `5901592` substitution.
- No direct owner send.
- No manual protected Machine-SOT business mutation to force a PASS.

## Next Exact Action

**Single-Runner Reconciliation before any runner re-enable.**

With the new ChatGPT Scanner and Verifier paused, observe the next expected live Scanner/Verifier windows in Machine SOT. If fresh Manifest rows continue to appear, that proves another/legacy runner is still active. Identify and disable that runner, wait for any active lease to finish, verify no further old-runner Manifest/lock activity, then enable the new runner one role at a time and verify its first run/readback before proceeding.

After single-runner cutover is proven, restore access to Make scenario `5988323`, reconcile the five existing preview rows, and execute exactly one controlled Phase C/D Runtime UAT.

After each material step, update this file with actual readback evidence and replace `Next Exact Action` with the next single safe action.
