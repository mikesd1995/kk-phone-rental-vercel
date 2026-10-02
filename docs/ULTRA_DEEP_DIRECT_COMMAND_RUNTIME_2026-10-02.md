# Ultra Deep Direct Command Runtime — 2026-10-02

## Goal

Restore the old operational behavior: an owner command starts Ultra Deep work immediately, exposes live progress, and reports completion without creating a request PR for every scan.

## Trigger

Control issue: #368

Commands:
- `/run-ultra-deep-full-loop` — scans the current UTC month.
- `/run-ultra-deep-full-loop YYYY-MM` — scans an explicit month.
- `workflow_dispatch` remains available as a manual fallback.

The issue-comment path is owner-gated and restricted to issue #368.

## Queue policy

`cancel-in-progress: true` implements latest-command-wins. A new scan cancels an older in-progress scan instead of waiting behind it.

## Visible progress

At runtime start, the workflow posts a RUNNING comment with the Actions run URL. GitHub Actions exposes each stage live. On terminal completion it posts either:
- DISCOVERY FULL / READY_FOR_VERIFIER, or
- BLOCKED / FAIL-CLOSED with blocker summary.

Evidence artifacts are retained for 30 days.

## Provider recovery

The direct runtime installs the pinned zero-cost `ddgs==9.14.4` fallback and enables `KK_DDGS_TRAFILATURA_ENABLED=1`. DDG/Bing remain fallbacks. No paid browser/search dependency is introduced.

## Safety

- Scanner remains zero-write through discovery acceptance.
- FULL remains fail-closed.
- Verifier remains required.
- No owner-hidden/tombstoned event resurrection.
- No direct pricing/booking/inventory/customer mutation is introduced by the trigger.
- Production write/readback must still go through the governed writer path.
- PR/CI remains required for code changes, but not for starting a scan.


## Self-cancel correction

The first direct-command trial exposed a workflow-level concurrency edge case: status comments emitted by the workflow also generate `issue_comment` workflow shells. A static concurrency group allowed those non-command shells to cancel the active owner-command run before the job-level authorization filter executed.

The concurrency key is now command-aware:
- authorized owner commands share `kk-ultra-deep-full-loop` and may cancel an older command;
- bot/status/non-command issue events receive a unique run-specific group and cannot cancel the active scan.

This preserves latest-command-wins without self-cancellation.
