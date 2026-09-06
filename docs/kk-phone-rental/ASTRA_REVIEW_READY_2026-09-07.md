# KK Phone Rental — Astra Review Ready — 2026-09-07

## Purpose

This is a continuation/review handoff, not a restart request. Live Machine SOT + exactly one highest Active policy + canonical provider/backend state + runtime/exact-readback evidence remain authoritative.

Astra should perform a bounded transition/review against the current live state and preserve runtime-proven architecture unless fresh evidence proves a defect.

## Read first

1. `docs/kk-phone-rental/CURRENT_STATE.md`
2. Live Machine SOT `_Policy_Registry`
3. Live `_Run_Lock`, `_Write_Transaction`, `_Run_Manifest`, `_Reconciliation_Log`
4. Canonical Scanner / Verifier / Canary task states
5. PR #1 current head + final-head governed CI
6. Current external authorization/permission state only where relevant

## Current authority

Fresh handoff read resolves exactly one Active policy:

`v4.9.7 MAX RECALL OPPORTUNITY DISCOVERY`

Do not freeze this version in future runtime logic. Fresh live authority wins.

Important inherited/current invariants now represented in governed code:

- v4.9.5: deterministic Candidate↔AI packet handoff; no Candidate READY without matching READY packet; orphan reconciliation before Verifier no-op; eligible canonical→monthly exact1 or explicit non-promotion.
- v4.9.6: stable-key protected mutations; row number is address only; Verifier normal FINISHED requires READY lineage gap=0, canonical/monthly gap=0, unresolved PREPARED/COMMITTING=0; bidirectional monthly↔canonical audit.
- v4.9.7: same source-family breadth through current year; A/B/C/D multipass discovery; source-section proof; competitor consensus P0 alarm; zero unaccounted in-area signals; recall before score; explicit backlog holds; honest partial-external completion.
- v4.9.7 price persistence: verified exact-event vivo X300 Pro + Lens observation history→current projection; monthly market 1=Reference, 2=Range, >=3=Range+Median; STALE/no-history semantics; same event/shop/package delta only for PRICE UPDATED.

## Runtime recovery completed immediately before handoff

### Stale owner year-end drain

Original run:
`GPTV497-20260906T235800-OWNER-YEAREND-DRAIN`

It was found with:
- expired Verifier lease v224;
- Manifest still RUNNING;
- 12 MAXRECALL Candidate↔AI lineages still operationally READY;
- no completed canonical v4.9.7 drain evidence.

The state was not backfilled as success.

### Deterministic recovery

Recovery run:
`GPTV497-20260907T023821-OWNER-YEAREND-DRAIN-R2`

Verifier lease:
- version 225
- token `VF-497-20260907T023821-225`
- safely RELEASED at 2026-09-07 02:42 +07

Transaction:
`TX|YEAREND|V497_BACKLOG_HOLD_DRAIN|20260907T023821`

Final exact state:
- transaction `COMMITTED`;
- Candidate rows124-135 exact12 => `WATCHING`;
- original Retry At / Blocked Reason retained for every Candidate;
- AI rows198-209 exact12 => `COMPLETED_HOLD`;
- AI ChatGPT Result remains blank;
- stable Event Family + Show/Showset + Work Packet identity preserved;
- old Manifest => `FINISHED_PARTIAL`;
- no canonical Lifecycle/monthly/pricing/Notification/provider/owner success was invented.

Reconciliation:
`RECON|GPTV497|20260907T0242|YEAREND_HOLD_DRAIN_RECOVERY`

The 12 events remain due-watch/backlog evidence, not silently discarded opportunities. Reopen only when current material evidence satisfies the relevant authority/rule/ticket/market gate.

## Engineering sync completed for review

New governed contracts:

- `lib/kk-discovery-closure-contract.js`
- `scripts/kk-discovery-closure-contract.test.js`
- `lib/kk-market-presentation-contract.js`
- `scripts/kk-market-presentation-contract.test.js`

Updated governed skill contracts:

- `ai/skills/event-web-research-orchestrator/SKILL.md`
- `ai/skills/competitor-rental-hunter/SKILL.md`
- `ai/skills/scan-completeness-auditor/SKILL.md`

Updated `package.json` runs both new suites in governed CI.

Latest material code head before checkpoint docs:
`a006e9f2d49d3b39d2df9500596fafd45ab544ba`

GitHub Actions run:
`34055996625`

Result:
`completed / success`

Final documentation head created after that run must also be verified green before this handoff is considered closed. CI is code evidence only, not runtime/provider proof.

## Preserve

Do not rebuild merely for style:

- Core v1 Scanner→Verifier architecture and canonical task IDs;
- live Machine SOT authority and single-writer/fencing/transaction semantics;
- CRM canonical booking/inventory ownership;
- append-only competitor price evidence + replaceable current projection;
- confirmed-origin Company semantics and Current>Archive metadata precedence;
- immutable content approval lineage;
- Creative/X publish guards;
- booking exactly-once implementation/no-blind-retry behavior;
- KYC adapter privacy boundary;
- Outcome fail-closed POST_EVENT_FINAL boundary.

Do not create a duplicate Scanner, Verifier, Canary, watchdog, canonical Make scenario, Apps Script writer or notification transport.

## Remaining external/future gates

Fresh handoff checks:

- PostPeer/X request `4e3be806-f7bc-4f0a-99da-268d2f112b51` => `PENDING`
- Xama request `20005b08-4698-490a-b168-58a982f3c545` => `PENDING`
- LINE request `2dbe7ba5-061c-45e2-8f98-6822cf2eb50b` => `PENDING`

Still require fresh verification before action:

- Make canonical Phase-D scenario `5988323`: historically organization-view permission blocked; do not create a competing canonical scenario.
- Canonical Apps Script deployment: repository has booking exactly-once source, but current tools have not exposed the existing production project/deployment target. Do not create a replacement writer merely to claim deployment.
- NONT Arena Encore Creative: exact authorized raw source bytes/hash remain required before source-safe Canva/X binding.
- Phase G: wait for a genuinely eligible completed event and POST_EVENT_FINAL evidence.

## P0 control-plane issue

Unexpected Scanner/Verifier OFF drift has recurred historically. Actor/root cause remains unproven.

Review rule:
- fresh-read canonical task state;
- restore only the exact existing canonical ID when live evidence shows unexpected OFF and no legitimate owner/control reason exists;
- retain evidence of the drift;
- do not add a watchdog/duplicate scheduler;
- do not attribute actor without control-plane audit evidence.

## Implementation lease at checkpoint

Current engineering sync lease while this document is being written:

- holder `CHATGPT-20260907T024341-V497-SYNC`
- version `185`
- token `CX-497-20260907T024341-SYNC-V185`

The handoff session must release v185 after final docs/PR/final-head CI/task-state checks. Astra must fresh-read `_Run_Lock` and never reuse v185.

## Astra first actions

1. Fresh-read exactly one Active policy and latest `_Run_Lock`.
2. Confirm v185 is RELEASED and no other valid implementation writer owns the required scope.
3. Fresh-read PR #1 head and its final-head CI; keep PR Draft/Open/Unmerged.
4. Fresh-read Scanner/Verifier/Canary states; preserve canonical IDs only.
5. Review the new closure/market contracts for concrete defects, not stylistic rewrites.
6. Recheck PostPeer/Xama/LINE/Make/Apps-Script/creative gates; continue immediately if any external dependency is now genuinely available.
7. Do not rerun a full migration/audit of unchanged components.
8. Do not claim Production E2E COMPLETE while provider/deployment/future evidence gates remain unresolved.

## Handoff classification

Target after final lease/CI/task readback:

**ENGINEERING_READY_FOR_ASTRA_REVIEW**

This means current safe code-only work is closed and externally blocked/future-evidence scopes remain explicit. It does not mean every provider/production path has been proven.
