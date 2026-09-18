# Apps Script 9_5_9 Source-Drift Matrix — 2026-09-18

Status: **BLOCKED_SAFE / SOURCE PROVENANCE NOT AVAILABLE**

This matrix records what is actually known from the connected repository, Google Drive, Core Sheet and current Vercel guard. It does not reconstruct or deploy the missing production Apps Script.

## Proven source identity

| Surface | Observed identity | Provenance |
| --- | --- | --- |
| Production Admin audit/snapshot evidence | `v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX` | Runtime/audit evidence only; source bytes unavailable |
| Repository `apps-script/Code.gs` | `v16.7.0_CRM_PRO_PHASE3_9_5_8_SNAPSHOT_TIMEOUT_STABILITY_FIX` | Git-tracked source |
| Connected Google Drive | no accessible `application/vnd.google-apps.script` project | Fresh Drive search 2026-09-18 |
| Git history | no commit containing live 9_5_9 source | Commit/code search; 9_5_9 mentions are guard/docs that deliberately preserve production |

The repository source must therefore be treated as **non-authoritative for production deployment**.


## Branch archaeology

A targeted read of `apps-script/Code.gs` across 14 relevant repository branches was performed after the default-branch search. Branches included the event-integrity, lean Admin, reservation guard, snapshot repair/resilience, deploy-safety, old AI integration, production-foundation, notification-remediation and historical repair lines.

Result:
- 13/14 inspected branches report `v16.7.0_CRM_PRO_PHASE3_9_5_8_SNAPSHOT_TIMEOUT_STABILITY_FIX`;
- the older historical repair branch reports `v16.7.0_INDEPENDENT_SAFE_REPAIR_20260909`;
- 0/14 contain a 9_5_9 Apps Script source;
- 0/14 contain `runKKLineMonitor`;
- 0/14 contain `payload.return_time` persistence;
- 0/14 contain backend createEvent duplicate detection.

This materially weakens the possibility that the live 9_5_9 source is merely stranded on one of the known relevant Git branches. It does not prove absence from deleted/unlisted refs, local machines, Apps Script version history, or the bound Apps Script project itself.

## Capability drift matrix

| Capability | Repo 9_5_8 | Production 9_5_9 | Current safe interpretation |
| --- | --- | --- | --- |
| Booking create uses DocumentLock | Present | observed production source unknown | Lock existence alone does not prove time-window atomicity |
| Booking update uses DocumentLock | Present | unknown source | Same limitation |
| Persist `pickup_time` | Present | runtime behavior historically present | Existing field remains usable |
| Persist create `return_time` | Absent; repository writes blank column M | source unavailable; current snapshot evidence does not prove end-to-end support | Do not trust submitted return_time |
| Persist update `return_time` | Absent | source unavailable | Do not expose authoritative update UI yet |
| Snapshot exposes `return_time` | Absent | current Admin contract does not prove it | Vercel guard preserves conservative fallback |
| Collision granularity | event-date / asset based in repo | exact live implementation unknown | Not proof of explicit cross-day timing atomicity |
| Backend createEvent duplicate check inside same lock | Absent in repo createEvent | exact live implementation unknown | Vercel preflight is mitigation only |
| Vercel duplicate/past-date guard | N/A Apps Script | Present in current Vercel main | Blocks normal Admin path, not direct backend races/bypass |
| LINE `runKKLineMonitor` | Absent in repo | operational policy/runtime references imply an existing production route, source unavailable | Never deploy repo source to repair LINE |

## Current production-data readiness

Fresh Core read on 2026-09-18:
- active bookings: 6, all currently `confirmed`;
- active bookings missing `return_time`: 6;
- active bookings missing `pickup_time`: 1;
- active bookings with both explicit times: 0;
- Core Health reports Spreadsheet timezone `Etc/GMT` while business timezone is `Asia/Bangkok`;
- Atomic reservation timing readiness remains `CHECK`.

This means even a correct future implementation cannot be accepted from code alone: current active timing data and timezone behavior must also be reconciled.

## Duplicate-event forensic boundary

The HEART/KHUNPOL incident is historical evidence that duplicate protection was absent at the time, not evidence that the current Vercel guard was bypassed. The current route is:

`/api/kk-admin -> kk-admin-snapshot-v6 -> kk-admin-snapshot-v5 -> kk-admin-guard -> legacy Admin upstream`

Current Vercel behavior:
- past dates fail closed;
- duplicate identity normalizes name/date/venue;
- lean event index is accepted only when its row count exactly matches the independent event source count and event IDs are unique;
- uncertainty falls back to a full authenticated snapshot;
- if both preflights fail, the write is blocked.

Remaining risk is architectural: two concurrent requests or a direct Apps Script path can still bypass a non-atomic Vercel preflight. The authoritative duplicate check belongs inside the same Apps Script DocumentLock/write transaction after exact 9_5_9 recovery.

## New repository tripwire

`tests/deploy-readme-apps-script-safety.test.js` now also asserts that the repository 9_5_8 source still lacks:
- `runKKLineMonitor`;
- create/update `payload.return_time` persistence;
- snapshot `return_time` exposure;
- backend createEvent duplicate detection.

These are intentional **staleness assertions**. If recovered source adds any of these capabilities, CI fails and forces a provenance/equivalence review rather than silently treating a changed Apps Script file as deployable.

## Recovery gate

Before any Apps Script deployment:
1. obtain exact bound 9_5_9 source/export or independently prove a reconstructed source equivalent;
2. commit the recovered source without behavior changes;
3. diff every live change against repository 9_5_8;
4. inventory bound triggers, including the single LINE Ledger consumer;
5. implement booking time-window and event duplicate checks inside the same DocumentLock/write transaction;
6. persist/expose return_time end-to-end;
7. reconcile active timing data and timezone assumptions;
8. run repository regression, Preview, controlled deployment, authenticated Admin acceptance and exact Sheet/snapshot readback.

No production Apps Script, booking, event, customer, pricing, inventory, Scanner/Verifier, HF, Make or provider state is changed by this matrix.
