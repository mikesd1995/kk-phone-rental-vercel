# Ultra Deep Bounded Concurrency — 2026-10-02

## Problem

Direct command execution removed the PR/request queue, but the provider executor still processed monthly discovery tasks serially. With 48 monthly tasks plus reference and known-miss probes, zero-evidence providers and DDGS timeouts could stretch one live scan unnecessarily.

## Change

- Provider executor V2 runs gap tasks with bounded concurrency.
- Default task concurrency: 4.
- Hard maximum: 8.
- Result order remains identical to plan order.
- Provider order inside each task remains unchanged and fail-closed.
- A task still stops only at the first provider/query that returns valid HTTPS evidence.
- Environment override: `KK_ULTRA_DEEP_TASK_CONCURRENCY`.
- Added regression proving concurrency is bounded and output order is preserved.

## Safety

This changes scheduling only. It does not change:
- evidence requirements;
- FULL acceptance gates;
- verifier requirements;
- provider trust;
- production-write authority;
- owner visibility/booking guards.

Production writes remain 0 in discovery acceptance.
