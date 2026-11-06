# X owner copy policy reconciliation — 2026-10-16

## Requirement and boundaries
The owner's latest approved copy direction is a natural event-specific hook and CTA without dates, three verified closing hashtags, and no “อยู่โซนไกล”, “เตรียมกล้อง”, “เตรียมเลนส์”, “ซูม”, or “เก็บทุกโมเมนต์”.
Verified event dates that the shop explicitly does not accept may display “❌ เต็ม” in customer copy; this is a copy label, never evidence that bookings exist. Whole hidden/locked events remain excluded; availability, locks, posting eligibility and backend truth must not change.
Keep three internal candidates and one final owner-review result, verified facts/prices/tags, no counts, no automatic publication or paid calls.

## Minimal implementation plan
- [x] Add tests proving generic phrasing and dates in narrative/CTA are rejected, verified explicit shop-closed dates may display full, unknown/hidden/locked dates remain blocked.
- [x] Run focused test on unchanged source and retain RED evidence.
- [x] Update only deterministic owner-copy validator and generation instructions, preserving backend eligibility.
- [x] Align affected local owner guidance with the explicit distinction between a customer label and booked-full truth.
- [x] Run focused content tests and full native regression; independent reviewer checks false-positive date matching, hidden-state safety and no publication authority.
- [x] Save exact before/after evidence and source-only limitation to GitHub, no merge/deploy.

## Review focus
Year suffixes, compact Thai/English dates and day ranges in hook/CTA must be rejected.
Status lines may contain dates; event names and prices must not be mistaken for date copy.
Unknown or duplicate day statuses and missing verification stay blocked.
A closed day must not grant inventory or posting eligibility.
No owner screenshot/Agent runtime acceptance may be fabricated.


## Evidence and independent review
- Baseline #751 `98bfd8dc` full native suite: 1,763/1,763 PASS.
- Initial owner-policy regression: 12/16 PASS, 4 FAIL before implementation; all are now green.
- Independent Reviewer found structural-line bypasses, common numeric/Thai/compact-English date bypasses, and contradictory active memory/skill guidance. Added reproductions failed before the correction; narrowed exceptions to exact verified fields, applied banned-phrase checking across the copy, normalized Thai digits, expanded date forms, and reconciled conflicting clauses while preserving unrelated rules.
- The validator checks factual shape and explicit forbidden patterns. Natural event specificity remains a genuine Agent/owner QA duty; it is not guaranteed by a regex or self-reported score.
- Local full and focused commands are recorded in the final closure ledger. No Agent provider was called, nothing was posted or scheduled, and no backend status/lock was changed.
- No dependency added. Project-local skill changes are source-controlled repository guidance, not a new automatically installed ChatGPT hook.
- Roll back by reverting this isolated source commit. Exact-head hosted CI, actual persistent Agent results and owner release acceptance remain pending.

Final local verification: full `npm test` **1,767/1,767 PASS**, focused content/memory **73/73 PASS** before the final compatible memory wording correction and owner-policy/memory **18/18 PASS** after it. Syntax and diff-check PASS. No tests or guards were removed. Independent findings were repaired with RED→GREEN reproductions, and full regression was rerun after each code correction. Engineering gate remains BLOCKED on RELEASE_READBACK.
