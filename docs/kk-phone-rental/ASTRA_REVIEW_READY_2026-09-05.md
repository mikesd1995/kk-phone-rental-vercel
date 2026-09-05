# KK Phone Rental — Astra Review Ready Handoff

Checkpoint target: 2026-09-05 late evening Asia/Bangkok  
Branch: `skills/x-scanner-v2`  
PR: #1 Draft / Open / Unmerged

> Live highest Active `_Policy_Registry`, Machine SOT, CRM/backend, automation/provider state and exact readback override this document.

## Review posture

Do not restart the project and do not perform a full audit of already runtime-proven Core v1. Perform the one-time bounded Astra Transition Review, then continue only material executable work.

## Current authority

Highest live Active policy at handoff: `v4.9.4 COMPETITOR DISCOVERY & SOURCE PERSISTENCE`.

v4.9.4 inherits v4.9.3 current-price freshness and all prior reliability/geo/single-writer rules, and adds:
- reverse competitor-feed discovery independent from known-event price scanning;
- per-active-competitor reverse-discovery attempt coverage;
- unknown competitor-surfaced event normalize/dedup/geo/authority routing;
- parse-before-geo-suppression for already-accessed feeds;
- verified recurring official source persistence into `_Direct_Source_Map` with exact readback;
- known-source upcoming-event gap audit;
- learned misses require a concrete source-map/planner/policy/alias repair + readback;
- alias normalization must not collapse distinct date+venue events.

## Runtime evidence to preserve

Core v1 remains `RUNTIME_VERIFIED / COMPLETE / PRESERVE`.

Recent v4.9.4 Scanner evidence:
- `SCV494-20260905T195907-OWNER-YEAREND-RESCAN`: Candidate18, PriceEvidence7, Current7, source persistence5; 17 new event signals + 1 cancellation/update; no final/outbound write.
- `SCV494-20260905T221900-OWNER-SEPT-DEEP`: Candidate21, PriceEvidence16, Current16, Registry6; 17 new signals + 4 reconciliation gaps; collision audit complete; external closed-social coverage remained PARTIAL; no final/outbound write.

`_Competitor_Registry`, `_Direct_Source_Map` and `_Miss_Learning` now contain persisted v4.9.4 discovery/source-learning evidence including CAT EXPO/Cat Radio repair lineage.

## Engineering synchronized for v4.9.4

Added:
- `lib/kk-competitor-discovery-contract.js`
- `scripts/kk-competitor-discovery-contract.test.js`

The contract deterministically enforces:
- known vs unknown competitor event signal routing;
- distinct access-state truth;
- IN_AREA candidate verification vs OUT_OF_AREA observability only;
- verified-recurring-source persistence decision;
- active competitor source attempt completeness;
- learned-miss concrete-correction + exact-readback requirement.

Updated:
- governed `package.json` test/check chain to include the discovery contract;
- `COMPETITOR_RENTAL_HUNTER` for two separate modes: reverse event discovery vs known-event pricing;
- `SCAN_COMPLETENESS_AUDITOR` for reverse-discovery/source-persistence completeness semantics.

GitHub Actions run `33977945285` succeeded for head `0696cec94baa27e55e18f23d858cf946f8526682`, including the new v4.9.4 contract in the governed check chain. Prior governed baseline was 188 assertions; the new discovery contract adds 26 deterministic assertions, so the governed suite now contains 214 declared assertions. Treat CI as code evidence, not runtime/provider proof.

## Control-plane drift

Historical unexpected Scanner/Verifier disable drift recurred again during finalization. Live automation read showed Scanner=false and Verifier=false while Canary=true. The canonical existing Scanner and Verifier task IDs were re-enabled; no duplicate runner/watchdog was created. The recurrence is recorded in `_Reconciliation_Log` as `RECON|CONTROL_PLANE|OFF_DRIFT|20260905T2329`.

Actor/root cause remains unproven. Active P0 self-mutation prohibition remains authoritative. Do not attribute an actor without evidence.

## Phase states

### A — Core
`PRESERVE / RUNTIME_PROVEN`.
Canonical task IDs only:
- Scanner `6a992c91ba688191ad428cbdc2e8cf35`
- Verifier `6a992d4d0c248191914e6c73c4f17db4`
- Canary `6a992bbe16d081918553ca3eb7f81058`

### B — Business Brain / CRM / current market
`IMPLEMENTATION_HARDENED`.
Preserve exact Machine↔CRM identity, model-specific physical capacity, no PII projection, policy-correct company semantics, append-only price history + fresh current projection, no historical price resurrection, exact source-lineage/readback.

### C — Content / Creative
NONT V2 copy remains immutable approved historical evidence with Variant 1 / THEME and 1,190 THB manual campaign price; production flags remain false unless live evidence supersedes.

Creative is still `WAITING_EVIDENCE / BLOCKED_EXTERNAL`: exact authorized raw bytes/hash for `FINAL MAIN KEY VISUAL — ARENA ENCORE : THE PERSONA` have not been safely obtained. Do not substitute older May/BITEC or generic NONT art.

### D — Telegram / Make
Temporary `5901592` remains compatibility-only. Canonical `5988323` remains inaccessible to the current Make identity with `organization view` permission error. Do not create a competing canonical scenario.

### E — X
X publish guard is implementation-hardened. PostPeer authorization request `4e3be806-f7bc-4f0a-99da-268d2f112b51` was still PENDING at this handoff. No production post ID/URL/receipt exists.

### F — Booking / KYC / LINE
Booking writer-side idempotency implementation exists (`apps-script/BookingIdempotency.gs`) and Vercel ambiguous timeout path fails closed. Production Apps Script deployment/runtime readback remains external deployment work.

Xama authorization request `20005b08-4698-490a-b168-58a982f3c545`: PENDING at handoff.

LINE request `2dbe7ba5-061c-45e2-8f98-6822cf2eb50b`: PENDING at handoff.

### G — Outcome
Projector implementation is hardened. Final outcome remains `WAITING_EVIDENCE` until a genuinely completed eligible event has exact Machine↔CRM crosswalk, POST_EVENT_FINAL CRM state and no unresolved active booking.

## External / future gates

1. Canonical Apps Script booking-idempotency deploy + production runtime/readback proof.
2. Exact authorized NONT Encore creative bytes/hash + Canva final binding.
3. Make `5988323` organization-view access + controlled UAT/cutover.
4. PostPeer authorization, then provider wiring/publish only after creative + production gates.
5. Xama authorization + real governed KYC validation.
6. LINE authorization + real customer delivery provider receipt.
7. Real completed event for Phase-G POST_EVENT_FINAL.
8. Continue evidence-based observation of control-plane OFF drift.

## Hard non-actions

- no Core rebuild;
- no duplicate Scanner/Verifier/Canary/watchdog;
- no fake backfill or historical PASS;
- no competing Phase-D writer;
- no direct CRM booking around canonical writer;
- no generic/old creative promoted;
- no provider/public/customer action merely to obtain PASS;
- no fake KYC/customer/outcome;
- no PII copied into Machine SOT/docs/receipts;
- no merge to `main` without explicit owner approval.

## Astra first exact action

1. Read live Active policy and require exact-one `POLICY_VERSION`.
2. Read latest `_Run_Lock`; never reuse a released/expired implementation lease.
3. Re-read canonical task enabled state because OFF drift is recurrent.
4. Read current branch/PR head and latest CI.
5. Perform the one-time bounded Transition Review.
6. Do not redo completed engineering merely for style.
7. Continue only newly discovered material executable work; otherwise classify remaining items as external/future evidence.
