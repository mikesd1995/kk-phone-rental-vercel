# System audit continuation — 7 October 2026

## Canonical starting point

- Repository main inspected: `8ae2fabcf040228071f1222ebc7dfcc7831c1fec`.
- Production alias resolved READY to `dpl_Evw1KPAkcDYFyXotayXcMAszjKS6`, target production, source `e54bf57b8e17d78de18aeddb93b90e724ff2b477`.
- PR #644 is closed, superseded by #652 for public-note redaction. Do not reopen or merge its diverged branch wholesale.
- PR #642 is closed, superseded by #650/#656 for current external-demand policy and recall improvements. Its separate Phase2/Phase3 architecture was deliberately not carried forward.
- Current main has eight top-level api/*.js files; the old duplicate Phase2 preview endpoint is absent. The local five-file function-budget repair for #642 is superseded, not a pending production fix.
- Open PR #654 changes verifier/direct runtime. #655 changes demand hardening/runtime adapter. This patch changes neither of those runtime files.

## Defect reproduced and fixed

`server/kk-ultra-deep-full-loop-v2.js` still coerced absent planned/write counts to zero and accepted READY + COMPLETE + exact_match without candidate terminal coverage. Malformed evidence could therefore return COMPLETE.

Fresh-port only the isolated acceptance hardening from the closed audit branch:
- buildPlan emits terminal and pending candidate counts;
- counts must be explicit nonnegative safe integers, without string/null coercion;
- every candidate must have a known terminal decision, with zero pending;
- candidate counts must agree with actual decision arrays;
- mutation totals must agree with plan and per-decision arrays;
- CREATE/UPDATE require mutations; no-change/hidden dispositions must have none;
- matching write count and exact readback remain mandatory.

External-demand scoring, booking-price locks, owner-hidden state, writer authority, pricing and inventory are unchanged. This is selected-plan evidence validation, not proof that live discovery covered all possible events.

## Validation evidence

All Node tests used the existing offline network guard. No live search, provider calls or business writes were made.
- New regression file against unchanged current source: 2 pass / 5 fail, reproducing false COMPLETE.
- Patched acceptance + current V2 + fandom + closure fixtures: 58/58 pass.
- Independent reviewer: 66/66 scoped tests pass; approved for PR save, no blocking compatibility findings. Real direct runner passes the original buildPlan output with required evidence.
- Wider Ultra Deep tests: 204/210 pass. Same baseline with new regression cases: 199/210 pass. The five acceptance failures are fixed, with no newly failing cases.
- Six pre-existing failures remain: three stale V25/V26 ingress assertions; two known-miss corpus-count assertions; one offline provider/preflight expectation. This is not a green full-suite claim.
- git diff --check passes.

## Fresh public readback

Production `/api/kk-data?sheet=08_Web_Ready&range=A4:K`: HTTP 200. No OWNER_HIDDEN marker in response. `TEETEE_SCHEDULE` still appears in the public feed and needs field-level follow-up; do not claim all public text is clean. This pass did not alter Sheet data or remove audit rationale.

## Remaining work and release boundaries

1. Read back this fresh PR and exact-head Actions/Vercel status. Do not merge on a failed required check or call production fixed before exact-source deployment evidence.
2. Diagnose the six existing Ultra Deep failures against current policy without reverting external-demand work or weakening tests.
3. Trace TEETEE_SCHEDULE to its actual public text field and apply the existing server/browser text-boundary contract with regression coverage.
4. Revalidate earlier Apps Script version/source, private-reader configuration, Make pause state and cross-service acceptance before closing those audit items. October 6 observations are historical, not fresh certification.
5. Do not replay customer messages, activate paused scenarios, alter stock/bookings or cross governed COMMIT gates as a test.

Production business writes this continuation: 0. No release performed by this patch preparation. Engineering release/readback remains pending until deployment checks are actually satisfied.

## Continuation at 13:11 Bangkok — six regression failures repaired

The six earlier failures have now been diagnosed and repaired in test infrastructure, without production-source changes:
1. Three ingress tests lacked node:path and ROOT; once restored, the GET assertion also needed the actual V2 ingress identifier already deployed by #623. Authentication, canonical queue claim and read-only assertions remain.
2. Two corpus tests assumed ten cases. Current policy intentionally has nineteen after #656. Tests now enumerate all nineteen required case IDs and require exact set equality, preserving old misses and expanded RYO/October coverage. Fixture success must cover all nineteen.
3. The no-provider test disabled only DDG/Bing HTML but left LiveNation/Bing RSS defaults enabled. Runner fixtures now disable all real provider transports, save/restore relevant environment, and use a counter that fails if a live transport is invoked. Injected fixture providers still exercise execution evidence. Independent review caught one differently ordered options object; fixed and reran.
4. V2 workflow now triggers for the Ultra Deep tests/workflow itself and executes terminal-evidence, direct ingress, corpus and runner regression files alongside V2. The old workflow did not execute the new terminal regression file.

Validation after final repair: Ultra Deep 210/210 PASS under offline guard; npm run check PASS; diff check PASS. This supersedes the six-failure status above. No claim of a green repository-wide full suite or hosted CI is made.

### Title-quality correction from fresh field-level readback

Production feed HTTP 200. The concatenated title containing TEETEE_SCHEDULE belongs to EVT-20261018-THE-MALL-LIFESTORE-BANGKAPI-, whose action_for_web is hide and event_note is empty. It is a hidden historical data-quality defect still present in the public feed, not a proven visible customer card. Do not invent an official replacement title or reopen the row. No Sheet mutation was made.

### Cross-chat resume

Use PR #661 current head and read its body for exact deployment/Actions evidence. Tests are now repaired locally; infrastructure readiness must be checked on the new head. Do not rerun-spam zero-step jobs, pay for quota, invent an alternate scheduler or bypass required checks. Production release remains pending; business writes remain zero.
