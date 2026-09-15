# Admin Post-write Refresh Lean — 2026-09-15

## Goal
Release the Create Event submit path immediately after the authoritative createEvent write returns, rather than waiting for a second full Admin snapshot before showing success and releasing the submit button.

## Change
- Create Event still performs the normal createEvent API write and all server-side guards.
- After a successful write, the UI schedules the existing full snapshot refresh asynchronously instead of awaiting it inside the submit transaction.
- Snapshot status shows a pending background-sync marker until a verified refresh succeeds.
- Background refresh retries only while another refresh is already active, with a bounded retry count.
- If background sync fails, the UI keeps the pending/stale safety signal and tells the operator to press Refresh.

## Safety boundary
- Only Create Event post-write refresh behavior changes.
- No Booking create/update path changes.
- No Apps Script source or deployment changes.
- No Google Sheet business-data mutation from this code change.
- No Scanner/Verifier/Canary/Make changes.
- Existing snapshot health validation remains authoritative; this change does not manufacture a successful snapshot.

## Expected UX improvement
The Create Event button and success confirmation no longer wait for the second full snapshot after the write. The full snapshot still runs for eventual verified UI convergence, but outside the blocking submit path.

## Acceptance
- Exact source replacement count = 1 for every patch point.
- Node syntax check passes.
- Full repository test suite passes.
- PR CI and Vercel Preview must pass before merge.
- Post-merge Main CI and GitHub Vercel status must pass.
- Browser-level authenticated acceptance is not claimed while the connected Vercel workspace scope remains unauthorized.
