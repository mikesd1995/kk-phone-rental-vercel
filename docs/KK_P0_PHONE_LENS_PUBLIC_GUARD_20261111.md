# KK Phone Rental P0 — phone stock vs lens stock / public booking UX audit (2026-11-11 ICT)

## Exact provenance
- User instruction: fix highest-priority phone/lens availability bug carefully, avoid conflicts with Codex, test and record durable cross-chat handoff.
- Base current Main `735bbf7c159df7f2fd6b93e5324df131727f91c9` (post Terms-cookie release); isolated branch `fix/p0-phone-lens-public-safety-20261111` — **DO NOT** merge stale Draft #845 or #831 blindly.
- Read-only donor: Draft #845 source changes for storefront phone-only capacity, phone waitlist and distinct existing-renter lens inquiry. Ported only relevant audited hunks to current Main, plus compatible assertions and CI; no direct package, booking or customer-state writes.

## 11 Nov 2026 live Google Sheets evidence (read only)
- Canonical spreadsheet: `KK Phone rental backend`, ID `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`, sheet `08_Web_Ready` gid 1887878700.
- Metadata confirms `00_Master_Booking`, `01_Events`, `08_Web_Ready`, `09_Web_Packages`, `18_Event_Visibility_Locks` are active; archived `_BKP_*` not canonical.
- Live `08_Web_Ready!A4:J1000`: 444 populated event records in the bounded read (read response omitted trailing blank rows), two future anomalous records `G=0 phones`, `H=1 lens`, `I=เปิดจอง`, `J=show`: row 37, `EVT-20261203-BTS-WORLD-TOUR-ARIRANG` (03 Dec); row 38, `EVT-20261205-BTS-WORLD-TOUR-ARIRANG` (05 Dec). All other displayed nonzero-phone-open statuses not audited beyond this scan's invariants. 0 `hide`/booking-status contradiction.
- Authenticated bounded FORMULA read `08_Web_Ready!I5:J1000`: exactly **996 pairs** reviewed, **995 pairs containing legacy MAX(G,H)>0 in BOTH I/J**, **1 blank pair**, **0 nonlegacy/drift pairs**. This is a canonical spreadsheet defect; client-only fix does not repair it.
- Canonical `09_Web_Packages!A4:J650`: 03 Dec rows 101–103 and 05 Dec rows 104–106: `phone_only=0/full`, `lens_only=1/available`, `phone_lens_bundle=0/full` on each date.
- `00_Master_Booking!A5:D1000`: two CONFIRMED booking IDs per affected date (4 total): Dec 3 IDs `BK-20261203-001` and `BK-20261203-002`, Dec 5 IDs `BK-20261205-001` and `BK-20261205-002`. No customer names or phones copied into this document.
- Visibility Locks `18_Event_Visibility_Locks!A2:G1000`: these two IDs have `SEEN_CORE`, not `LOCKED`. Do not infer an explicit owner reopen from that; no owner lock or Booking mutations performed.

## Public-front-end remediation (staged, read-only)
1. `script.js` `availCnt`: event-level NEW phone capacity counts only a visible phone package + positive actual phoneCnt; `show_full` always yields zero even if source numbers are stale; lens-only never creates a phone rental.
2. Full modal always offers waitlist when phone capacity is zero, even if a detachable lens is spare. Existing confirmed-renter lens requests have their own clearly labelled inquiry link, not a new phone booking.
3. Signed LINE booking parser rejects the distinct existing-renter lens-message prefix, including messages amended with booking-style fields. LINE provider action is still customer-initiated, no automated provider sends.
4. Index JS cache-bust and compatible existing store tests/visual QA, new 20261111 P0 regression; Booking E2E exact-head workflow includes new test. Preserve Terms-cookie UX merged previously.

## Unresolved canonical repairs and safety gates
- Issue remains open until safe canonical GAS source update and **owner-only** `08_Web_Ready!I:J` formula migration. Existing PR #852 has source-only bounded/preflight/lock/snapshot/rollback logic; read and review it on latest Main, never invoke a blanket 996-row repair blindly. Historic PR #831 is donor only; PR #845 remains Draft and should not be merged independently into current Main.
- Mandatory preflight before sheet formula repair: registered source/deployed GAS parity, exact sheet ID/formula reconciliation all 996 pairs, frozen Booking/Owner Locks check, rollback snapshot, independent reviewer + owner SHA/visual acceptance, no concurrent writers, limited formula spans, full readback. Preserve manual `09_Web_Packages!J` overrides and existing renter add-on eligibility.
- Release P0 client-side patch only after exact-head Booking E2E + Visual QA + full suite, independent review, candidate-bound owner acceptance, governed Preview and owner production authorization. Do not misreport technical PASS as release READY if acceptance reports BLOCKED.
- Rollback: public old production commit `735bbf7c159df7f2fd6b93e5324df131727f91c9`, previously READY Vercel deployment `dpl_2CyyhK7vyUm2cUMeiDzEgBdSBN2n`. Recheck alias, public JS and actual event cards after any deployment.

## Execution journal
- 2026-11-11: canonical Google Sheets read-only audit confirms exact two BTS false-open events and four confirmed bookings; old formula COUNT 995. Created isolated current-main safety patch; **no Sheet, Booking, Owner Locks, LINE provider, Production or Vercel environment mutations**.
- CI and Production release outcomes must be appended to this PR description or PR comments with immutable SHA and run IDs; never call deployment completed until public alias and code are independently read back.
