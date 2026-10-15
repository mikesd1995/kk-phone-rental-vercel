# Ultra Deep recall repair — 12 October 2026

## Scope and baseline

Branch fix/ultra-deep-probe-handoff-20261009, based on PR681 head d884a2aadf4c74e8e885441a3f65e10abac2a136. Main was freshly fetched through69390a94972b8c636317bbf00d62ab677c0cc66f. This is isolated source work, not production acceptance. No business writes, publishing, runner activation, protected merge, deployment or provider top-up.

## Proven defects and fixes

1. Probe-only candidates counted toward live known-miss recall but were absent from the returned Verifier candidate list. Recover eligible actual probe rows after main/reference recovery, with deterministic deduplication, KNOWN_MISS_PROBE_RECOVERY provenance, recovered count and scope diagnostics. Require sourced exact known-case date; preserve existing cross-month discovery scope and keywordless brand identities. Never populate evidence from corpus defaults.
2. A sourced but unrelated/undated first-provider result stopped fallback. Known-case probes now supply an optional candidate acceptance predicate to the existing executor. Only matching title/date evidence ends the probe; other rows are counted as rejected and the existing bounded query/provider sequence continues. Other executor callers retain their prior behavior. This does not implement general relevance ranking for unknown-event discovery.
3. Explicit Thai/numeric dates were unreadable. Support12 full/dotted-abbreviated Thai months, explicit4digit CE/BE, and dd/mm/yyyy with calendar validation. A novel Thai-title test proves the event date wins over an unrelated English ticket-sale snippet. Missing/two-digit years are not guessed. Thai digits, undotted abbreviations and Thai/numeric date-range expansion remain unsupported.

## Review and validation

TDD failures reproduced the handoff loss, suppressed fallback and missing Thai parsing. Independent review found a material foreign-scope bypass through generic keywords/cross-month exception. Added failing tests for Singapore venue and .hk host, then applied a final common guard across both eligibility paths. Independent final review confirmed resolution and no remaining BLOCKER/MATERIAL in scope.

Full local Windows regression1494/1494 passed with external network guard, zero failures/skips. Independent focused64/64 and full1494/1494 passed. Syntax and diff checks passed. Logs: ../../outputs/ultra-repair-final-2026-10-12.tap, ../../outputs/ultra-syntax-2026-10-12.txt; ../probe-independent-final-review-tests.log and ../probe-independent-final-full.log. No Linux/hosted/runtime equivalence claimed.

## Live evidence and limits

Fresh12October GET /api/kk-scanner-dispatch: machine_ingress_version KK_ULTRA_DEEP_MACHINE_V26, execution_enabled=false, ready_for_execution=false, scanner_execution_capable=false, business_writes_capable=false. Saved ../../outputs/ultra-runtime-readback-2026-10-12.json. No autonomous full scan occurred.

Earlier live provider diagnosis in this work: Exa connector returned402 credits exhausted. Bounded direct Bing adapter probes returned10 rows for each query; GELBOYS had1dated unrelated trailer row, MR FANBOY had0dated rows and unrelated results. Subsequent filtered Bing+DDG probes for two known cases both returned GAP_UNRESOLVED and zero accepted candidates, preserving rejection attempts. This is improved rejection/fallback behavior, NOT improved measured live recall. No claim that all providers were exhausted or the events absent. Public web-search fallback found independent leads, but is not an installed runtime fallback and does not establish organizer verification. Evidence ../../outputs/ultra-live-bing-diagnostic-2026-10-10.json and ultra-live-filtered-probe-2026-10-10.json. Preserve embedded observed_at provenance; client date may differ from execution-host clock.

Live Tracker reads used existing metadata and bounded _Run_Coverage A4575:J4600 and _Miss_Learning A20:M32. Recorded rows distinguish manual partial scans, hidden existing events, date/edition conflicts, and disabled machine execution. Do not equate their historical status text with fresh provider success.

On12October an alternate Code Review connector retrieved the exact PR681 v2-acceptance annotation for job113855635166/run37941175630: job was not started because recent account payments failed OR spending limit needs increasing. This confirms an account billing/spending gate, not which alternative caused it. No budget change or rerun attempted. This supersedes the earlier UNKNOWN diagnosis for that exact old-head run, not future heads.

## Remaining closure requirements

- Obtain exact-head hosted validation under approved existing capacity; owner/account administrator must resolve billing/spending restrictions if still present.
- Refresh live Machine SOT/highest compatible Active policy, runtime bindings and deployed source before any approved production action. Do not switch on the disabled ingress or provision replacement runners merely to obtain a pass.
- Re-establish usable structured provider/extraction evidence, then perform controlled read-only acceptance using a held-out event set and per-stage missing/rejected/hidden dispositions. Current2case live probe is not a coverage benchmark.
- Preserve separate booking/date-cleanup release, identity/receipt semantics and owner handoff gates from PR681.

PROJECT OPEN. Local source repair and independent review are complete; production deployment, autonomous recall improvement and business closure remain unverified.
