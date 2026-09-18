# PR #44 Merge-Readiness Audit — 2026-09-18

## Repository state

- Base branch: main
- Base SHA observed: 1bd815a7f4ce4a38d40b5442512455134039fbc1
- Feature branch: hf-event-assist-v1-20260918
- PR state: OPEN
- PR draft: TRUE
- PR mergeable: TRUE
- Changed files after cleanup: 16
- Production HF activation: OFF

The observed main SHA matched the PR base SHA during this audit.

## Scope

Changed files remain limited to HF workflows/CI, documentation, scripts, Scanner staging contracts, and tests/fixtures.

No current production API/admin entrypoint imports the staged Scanner HF adapter. CI contains a regression guard for that boundary.

## Workflow audit

The canonical controlled UAT workflow remains manual-only via workflow_dispatch.

A redundant pull-request-triggered live-UAT workflow was removed because it duplicated the proven manual OIDC path and could create an unintended provider call when the PR changed state.

A regression test now requires that automatic live-UAT workflow to remain absent.

## Credential audit

Changed-file scanning found no committed Hugging Face credential value and no committed bearer credential value.

Documented examples remain placeholders or environment-variable references only.

## Authority audit

HF remains nonauthoritative, Verifier-required, and zero-production-write.

The staged Scanner contract rejects:
- final authority;
- verified/approved final truth;
- pricing/monthly/booking/inventory writes;
- notification sends.

Provider failure produces no fabricated handoff.

## Runtime-evidence hardening

The Scanner external-access preflight now requires:
- normalized evidence schema SCANNER_HF_GATE_SNAPSHOT_V1;
- evidence snapshot timestamp;
- Candidate-to-Run binding;
- fresh CORE lease;
- fresh Scanner lease;
- lock acquisition/expiry consistency;
- timestamped post-acquire writer recheck;
- Manifest temporal consistency;
- Planner timestamp consistency.

Expired, future-dated, stale, or mismatched evidence blocks external access.

## Live-schema alignment

The live _Scan_Planner uses physical fields such as Plan ID, Run Key, Decision and Planned At.

The staged adapter does not accept raw Sheet rows as authority. A production caller must normalize current-policy evidence into SCANNER_HF_GATE_SNAPSHOT_V1 before invoking the adapter.

## Holds

### Issue #47
Natural Scanner/Verifier persistence acceptance remains pending.

### Issue #46
The approved production integration surface has not yet been accepted. The adapter remains staged and production-import isolated.

### Current-head CI / Preview
The latest hardening must pass current-head Admin Regression and Vercel Preview before merge-readiness can advance.

## Classification

MERGE_READINESS = CONDITIONALLY_BLOCKED

PRODUCTION_ACTIVATION = BLOCKED_SAFE

Merge and production activation remain separate decisions.
