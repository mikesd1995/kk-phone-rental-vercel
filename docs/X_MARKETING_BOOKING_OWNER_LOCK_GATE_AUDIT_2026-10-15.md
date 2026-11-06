# KK X Marketing — authoritative Booking and Owner Lock gate audit (2026-10-15)

**Change status:** Draft PR #751 source-only patch; no main merge, Supabase/Vercel deployment, Sheet mutation, booking changes, X posting or paid service.

## Live connector read-only evidence
Source spreadsheet: `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`. Live Google Sheets metadata confirmed authoritative tabs and row-4 header in `00_Master_Booking`, `08_Web_Ready`, `18_X_Post_Log` and row-1 header in `18_Event_Visibility_Locks`.
- Owner locks, 272 data rows read: **LOCKED=129, REOPENED=10, SEEN_CORE=133**. `SEEN_CORE` is a historical anti-recreate indicator, **not a current owner lock**. **Never blanket-hide those rows.**
- Booking, 59 data rows read: completed=13, confirmed=27, cancelled=12, blank=7. Some future booking dates use Google Sheets serials. Customer identifiers/phones/contacts were not included in this report.
- Web Ready 246 data rows read: `hide`=189, `show`=40, `show_full`=9, blank=8. Rows marked `show` may also have historical event dates; always reject candidate events earlier than current Bangkok day.
- X Post Log, 164 data rows read: confirmed_posted=22, planned=16, superseded=61, assumed_posted=65, only 12 link-shaped X URLs among these rows. A URL shape is not proof that it resolves or belongs to this account.
- The `18_X_Post_Log` row 3 operational note still states time-expired planned slots may be assumed posted. **This is a contradictory sheet instruction, not publication evidence.** Do not mutate the Sheet silently; requested owner policy supersedes it for advisory decisions. `planned` and `assumed_posted` reserve conservative daily capacity, but do **not** become measured X results.
- Marketing Intelligence Sheet `1mmXkDAk3NJtyWqp7qC8ByQyEgKsTY5IO1ca9xLQijaU`: first bounded data reads of `17_Content_Performance` and `19_Content_Experiments` return headers only. Never claim measured Learning AI or true X engagement without link-backed data.

## Source code issue and correction
`server/kk-x-posting-eligibility.js` in the previously green PR #751 checked only `08_Web_Ready` and `18_X_Post_Log` for actual posting eligibility. It **did not enforce Booking or Owner Lock evidence**, allowing a high-ranked event with a booking day or deliberate lock to pass solely because the storefront was open.

New source-only fail-closed contract:
1. All four readbacks must have exact source names and explicit verified flags, bounded arrays and offset-aware fresh timestamps (<=6h): `00_Master_Booking`, `18_Event_Visibility_Locks`, `08_Web_Ready`, `18_X_Post_Log`.
2. A non-cancelled booking **on the same calendar day** blocks all event promotion for that day, even if the storefront still shows positive phone stock. Cancelled/no-show/blank statuses do not reserve inventory. Unknown active booking dates fail closed. The parser handles valid Thai `dd/mm/yyyy`, ISO calendar dates and Google Sheets date serials.
3. `LOCKED` for matching event/day blocks regardless of store inventory or X engagement; `REOPENED` and `SEEN_CORE` do not independently block. Malformed `LOCKED` identity fails closed. A different unlocked day of a multi-date event remains eligible after the Booking Gate.
4. Source flags and timestamp fields on a **GitHub Issue JSON are still caller-supplied assertions**. The agent bridge must not infer authenticity from them alone. The external readback/receipt must be prepared against the connector-backed canonical Sheets and verified by the operator. Until an authenticated provenance bridge and release controls are accepted, the recommendation is not a Production bookability guarantee.
5. `booking_source`, `booking_verified`, `booking_readback_at`, `booking_rows`, `visibility_source`, `visibility_verified`, `visibility_readback_at`, `visibility_locks` are new **required input** fields to the Draft posting plan. Raw Sheets arrays are supported with row-4 booking columns C=booking_status, V=event_date; lock columns B=event_id, D=event_date, G=lock_state. Avoid copying PII into any GitHub Issue; sanitize to status/event/date only.
6. Never modify `00_Master_Booking`, `18_Event_Visibility_Locks`, Web output, price, equipment, X history, or privileges to make the gate pass.

## Exit criteria
- Run exact-head scoped and full no-install GitHub CI after this patch. Preserve all previous tests, add negative Booking/Owner Lock cases and no-loss multi-day cases.
- Re-read selected live booking and lock dates with exact current source timestamp before making a content/schedule proposal.
- Independent security review + explicit owner release approval for merge/deploy; Supabase Edge `kk-project-memory-github-read` v2 recursion still blocks real Ledger, persisted `kk_agent_invocations` was 0 on previous live inspection. No invocation PASS until real OIDC ledger receipt.
- All X posts still require explicit Owner Review and no automatic publish.

**Source privacy:** This audit stores aggregate status counts and code contracts only, not customer names, contacts, booking notes or private tokens.
