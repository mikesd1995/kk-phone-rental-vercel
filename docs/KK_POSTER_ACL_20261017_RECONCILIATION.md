# KK Poster ACL reconciliation — 2026-10-17 ICT

## LIVE SOT
- Core `01_Events` joined to `08_Web_Ready` for October–December 2026 visible cards: **74 event/date cards, 48 Drive thumbnail uses, 39 unique active Drive image files; zero event/derived image URL divergence**.
- Compared to the exact previous branch manifest (35/44/76), there are **7 newly active** poster file IDs, **3 previously active now outside active scope**, net +4 images/+4 references/-2 event/date cards.
- Each of the seven newly active files was individually verified through owner-authenticated Drive metadata: six image/jpeg, one image/png, all anyone/writer, all in the approved fourth folder. Remaining previously active files were NOT individually reaudited this turn.
- Historical file/folder ACL census 209 from 2026-10-14 is NOT a current exact active/archive split. Do not infer historical files were deleted or ACL repaired.

## BRANCH-ONLY PATCH
- Re-pinned the exact sorted active allowlist and fail-closed 74/48/39 cardinality to today's SOT.
- Synchronized identical read-only Apps Script prefix and synthetic regression suite: active 39 + folders 4, owner batch sequence 25+18, fingerprint gates and independent 209-historic simulation.
- Preserved scope ACTIVE_ONLY, per-approval 25 maximum, no historical explicit Drive writes, inherited-role drift detection, unexpected membership and thumbnail drift HOLD.
- No production action, Core/booking/customer/price/stock/Drive permission change, no Merge/Deploy or automation-state change.

## ACCEPTANCE AND OWNER GATES
1. Run exact new head native Node tests and full relevant CI; a code edit and static validation are **not** runtime acceptance.
2. Re-read every current active file, each pinned folder, and the historical tree. Require full write-role baseline and owner Dry Run fingerprint with exact source provenance.
3. Independently verify public poster image decode / venue / event-date matching.
4. Owner must authorize each Drive ACL change batch using the fresh dry-run fingerprint; never auto-run Apply or strip historic roles without separate approval.
5. Require complete post-ACL role readback + public image integrity and separate Core privacy P0 #738 cutover.

Cross-chat: [PR #721](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/721), [Issue #718](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/718), [history #743](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/743). P0 remains OPEN until real ACL readback.