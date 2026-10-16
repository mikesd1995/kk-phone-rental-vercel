# Inbox LINE Safety Integration Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this bounded task inline; request one independent final review.

**Goal:** Preserve the private media and international LINE contact functionality in existing PR #700 while importing the canonical #744 LINE booking safety guards.

**Architecture:** Port only the two shared LINE runtime modules and their regression tests using current main as the three-way ancestor. Do not merge either PR into main or absorb unrelated Core, Revenue, runtime, marketing or storefront changes.

**Tech Stack:** Node built-ins, dependency-free `node:test`, existing Apps Script and Inbox contracts.

**Spec:** `AGENTS.md`, `docs/KK_INBOX_PRIVATE_MEDIA_FRESH_PORT_20261012.md`, and the LINE guards at canonical #744 `e6597b7d82179646932a7c1520bf46a32bd7e1f8`.

## Global Constraints

- Classification: EXISTING PR #700; current main `a54a348dd3258d87b1ec0c70e6ffd255d4678018`; remote starting head `e6e21f9b85a350f0d5e3741d6b99abffc4801888`.
- No added dependencies, spend, deployment, main merge, provider messages, production data writes, ACL changes, migration execution or scheduler mutation.
- Preserve owner-hidden admission, signed raw webhook verification, private media, optional phone with verified LINE identity, and governed pending writer authority.
- No application UI source changes or claims of Production acceptance. Invoke the registered product review for this flow boundary; absent authenticated visual evidence remains HOLD.

## Review Focus

- Duplicate approve/reject webhook after a committed writer decision must produce zero LINE sends.
- Wrong booking/decision or non-boolean replay readback must fail before sends.
- Hidden/full/missing-stock events must stop before package resolution, pending write or owner push.
- Upstream bodies, transport errors and forged codes must not reach logs.
- Private image capture and a verified international customer with no phone must remain functional.

## Task 1: Port and prove the shared LINE safety boundary

**Files:** `server/line-booking-webhook.js`, `server/line-booking-owner-approval.js`; their existing LINE tests; three canonical privacy/replay regression files; one signed webhook integration regression; this plan and the existing Inbox handoff doc.

**Interfaces:** `processEvent(event, env, fetchImpl)`, `processOwnerPostback(event, env, fetchImpl)` retain their established contracts. Inbox tee/media wiring and optional-phone behavior remain from #700.

- [x] Import canonical tests first, run them against unchanged #700 runtime, record expected failures.
- [x] Three-way port canonical runtime guards; preserve every #700-specific media, parser and contact change.
- [x] Exercise signed webhook admission and media persistence together with synthetic I/O only.
- [x] Run routed tests, explicit privacy/replay/media suites, full `npm test`, Inbox ship gate, syntax and diff checks.
- [x] Obtain independent review, fix material findings with RED to GREEN, record engineering gate accurately.
- [x] Publish exact tested text tree to the existing #700 branch using expected-head protection, read back SHA/tree and update cross-chat GitHub records.

## Execution record

- Root cause proven by exact source diff: #700 predates canonical replay/readback, error privacy and event bookability guards. A whole-branch merge would import unrelated subsystems; a two-module port retains the bounded Inbox release candidate.
- User has explicitly authorized continued implementation and detailed GitHub continuity. Execute without an additional planning confirmation.
- Added boundary regression exposed a second concrete bug: the Inbox media tee reflected arbitrary provider `error.code` into webhook logs. Extend the bounded diff to `server/kk-inbox-media.js` and `server/kk-line-inbox-tee.js`; a private WeakMap retains only module-owned original diagnostic codes and maps foreign errors to a fixed fallback. This preserves useful archive failures while preventing forged/mutated code leakage.
- RED evidence: canonical guard tests 9/31 pass, 22 fail against unchanged runtime; signed integration 1/3 pass, 2 fail (hidden event caused three forbidden downstream requests; forged media code reached log). Runtime port subsequently passes canonical guard tests 31/31.

- Independent review `/root/inbox_line_safety_review`: no BLOCKER/MATERIAL source findings; independent 60/60 relevant checks PASS. Full 1,800/1,800; targeted 73/73; routed 69/69; expanded Inbox ship gate 179/179; postinstall PASS. Exact-head GitHub publication/readback is the final remaining checklist item.

- Published LINE guard source6114967ab1db7f852bc8b90c4990301d85acc9bf with exact tested tree readback. Combined rehearsal independently found a missing Supabase source-only middleware matcher; minimally fixed in the same #700 lineage. Routing RED4/6 to GREEN6/6, routing+packaging10/10, routed63/63, final full1802/1802, ship185/185 and postinstall PASS. Database/visual/production acceptance remains explicitly unverified.
