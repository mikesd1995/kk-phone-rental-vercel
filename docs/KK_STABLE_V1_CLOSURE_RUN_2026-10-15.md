# KK Stable V1 — Safe Closure Checkpoint (2026-10-15 ICT)

Status: **PARTIAL — RELEASE HOLD**. This checkpoint records source-only work, not an authorization to merge, deploy, mutate customer data or enable automations.

## Exact source operation
- Existing authoritative working PR: **#744**, branch `chore/project-cleanup-backlog-20261014`, starting HEAD `ffc1f6dc06f056dfce2db2303a3dc1890854cc77` (mergeable true/draft).
- Ported only the **proven non-recursive internal Supabase Agent Invocation runtime resolver** from **PR #746** at `fbb7c108117cce03ee13d5264602be8d3b24476a` into this consolidation branch.
- New regression fixture: `tests/kk-github-oidc-agent-ledger-runtime-regression.test.js`, copied byte-for-byte from same proven source PR. Includes in-memory Deno credentials mocks; rejects recursion, missing/malformed credentials, wrong OIDC claims, invalid audit writes, upstream HTTP/transport/readback failures; tests 1-write idempotence and zero business writes.
- The integrated `supabase/functions/kk-project-memory-github-read/index.ts` is **byte-for-byte identical** to the verified PR #746 copy after patch; no other original business runtime paths changed.
- Existing standalone PR #746 GitHub Actions on exact `fbb7c108`: runs 38732065157 and 38732065244 **SUCCESS**, not proof of this new integrated commit's full regression.
- The consolidation branch's prior HEAD `ffc1f6dc` had six hosted checks successful (including 1,792/1,792 full regression, and screenshot Visual QA technical green) but these **do not apply automatically to any new HEAD**.
- Risk boundary: no production Edge deployment, no key/credential changes, no Supabase SQL, no Booking/LINE/X writes. Current Agent Invocation ledger remains 0 until actual post-release authenticated invocation/readback.
- Do not close #745/#746 merely because integration exists; verify exact-head source tests and owner-approved release separately.

## Read-only business/control findings supporting closure ordering
- Canonical Scanner and Verifier tasks: **OFF**, no natural-run pass; no replacement scheduler/clone permitted (issue #47).
- Make A/B: safe manual Telegram sends active **on-demand**; old write gateways and stale queued actions quarantined (issues #696/#740).
- Core customer workbook: public-reader privacy risk (issue #738); Poster Drive active+historical writer permission risk (issues #718/#743), PR #721 manifest needs real scope refresh from 33 to 35 current active image IDs. No permission write authorised by this checkpoint.
- Confirmed active Booking: 27 in current Master, 15 missing pickup times, 27 missing return times; two fully booked adjacent event dates Oct 17/18 have missing handover schedules (issue #714). Avoid public PII and any automatic assumption of collisions.
- Native revenue dashboard observed Actual 67,125 THB / Future 30,370 THB / Forecast 97,495 THB; do not infer production API matches without secure canonical X private-read E2E (issues #710/#739).
- X log has confirmed/assumed/planned rows, but intelligence performance sheet has header and zero populated results; avoid claiming verified campaign learning (PRs #694/#716).
- Vercel Production remains READY at `a54a348`, not this branch; storefront rendered visual owner/art-direction acceptance and security remain HOLD.
- Supabase ledger snapshot: invocation=0, notification outbox=0, runtime observations=0, decision events=0, project memory events=17. A table existing is not proof of automatic processing.

## Required closure order and acceptance
1. **P0 security**: private Core 13-dataset reader + rights and public proxy deny tests; scoped poster ACL dry-run with refreshed fingerprints/IDs; verify storefront read after controlled ACL changes.
2. **P0 source CI**: exact-head native regression, zero-install + security, booking, LINE, store, Ultra Deep and screenshot owner acceptance. Fix inherited main-baseline failures without weakening guards (issue #749).
3. **P0 Apps Script and booking**: exact authority/deployment identity, 9.5.13 Gate 2, signed E2E idempotent Booking and no duplicate LINE customer delivery (issues #9/#715).
4. **P0 Agent and Make**: release only after the approved private endpoint's OIDC/audit logs give a real invocation ID; prove durable outbox TTL/ACK/replay safety in staging before enabling a replacement Make notification path.
5. **P0 Scanner/Verifier**: prove governed natural timed runs with policy, manifest, locks, transaction terminality, coverage, readback; no synthetic backfill or reactivation without gated authorization.
6. **P1 revenue/storefront/marketing**: separate production private booked-price parity and owner visual review; use X evidence before attribution/learning. Keep auto-publish and autonomous booked-day pricing off.

## Fail-closed release rules
No merge or Production/Preview deploy; no credentials/ACL changes; no customer, Booking, price, LINE, X or automatic schedule writes; no paid services. **Do not mark #49 complete** until actual Production/owner/security readback passes. Link this source checkpoint from #49 and PR #744. If CI is skipped or pending on a new SHA, explicitly label `EXACT_HEAD_CI_NOT_ACCEPTED`.
