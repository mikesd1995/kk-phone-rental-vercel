# KK Phone Rental — Current State Checkpoint

Checkpoint: 2026-09-05 10:25 Asia/Bangkok  
Branch: `skills/x-scanner-v2`

> Live highest Active `_Policy_Registry`, Machine SOT, canonical CRM/backend state, runtime/provider evidence and exact readback are authoritative. This file is a compact continuity mirror, not a substitute for live reconciliation.

## Continuation rule

`READ CHECKPOINT -> RESOLVE ACTIVE POLICY -> RECONCILE LOCKS/LIVE STATE -> EXECUTE NEXT SAFE ACTION -> EXACT READBACK/VERIFY -> UPDATE CHECKPOINT -> CONTINUE`

Do not restart the project or rebuild Core v1. Do not create competing writers/runners merely because an external gate is blocked.

## Current classification

**CORE SAFE / GOVERNED IMPLEMENTATION HARDENED / REAL RUNTIME EVIDENCE PRESERVED / EXTERNAL PROVIDER-PERMISSION-EVIDENCE GATES FAIL-CLOSED.**

- Core v1: `RUNTIME_VERIFIED / COMPLETE / PRESERVE`.
- Phase A Scanner/Verifier: canonical tasks restored; 09:00 Scanner and 09:30 Verifier have real current runtime proof; recurring unexplained task-disable drift remains a P0 control-plane incident.
- Phase B Business Brain/CRM projection: governed exact-identity read-only projection hardened; current implementation tests pass in CI.
- Phase C Content: NONT V2 exact owner approval remains valid; production publish flags remain false.
- Phase C Creative: exact binding guard hardened; exact official NONT Arena Encore source image bytes/hash -> Canva binding is still not proven.
- Phase D temporary Telegram compatibility: provider-proven and stale-callback gated; canonical Make scenario `5988323` remains blocked by organization-view permission.
- Phase E X: provider-bound publish guard hardened; PostPeer authorization request is pending; no X production post/receipt exists.
- Phase F Booking/KYC: governed intake guard hardened and Vercel ambiguous-create timeout now fails closed; canonical Apps Script writer still needs durable writer-side idempotency/receipt before exactly-once can be claimed. KYC authority remains unconfigured.
- Phase F LINE: LINE OA authorization request remains pending.
- Phase G Outcome: projector hardened; `_Business_Outcome` remains empty because no eligible real post-event exact crosswalk/final evidence exists yet.

## Authority

### Machine SOT
`1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo`

Fresh live policy read on 2026-09-05 resolved exactly one Active `POLICY_VERSION`:
`v4.9.2 BALANCED SOURCE COVERAGE`.

Company semantics:
- Thai performer -> verified talent affiliation / label / management.
- Foreign performer -> verified local organizer/promoter.
- Organizer remains separately represented.
- Unknown or ambiguous evidence remains `UNKNOWN`; event-name heuristic inference is not canonical truth.

### CRM / Booking SOT
`12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`

Canonical writer for bookings, assets, packages and operational availability. Machine SOT consumes governed read-only projections and must not become a competing CRM writer.

## Current implementation fencing

Historical implementation leases remain immutable evidence.

- v172 expired and was stale-recovered without replaying work.
- v173 was later stale-recovered after expiry with no newer valid implementation writer.
- current implementation lease at this checkpoint:
  - holder: `CHATGPT-20260905T100518-CONTINUE`
  - scope: `CODEX_IMPLEMENTATION / AUTONOMOUS_BUILD`
  - lease version: `174`
  - fencing token: `CX-20260905T100518-CONTINUE-V174`
  - acquired: `2026-09-05T10:05:18+07:00`
  - lease until: `2026-09-05T10:55:18+07:00`

Before any later protected mutation, re-read `_Run_Lock` fresh. If v174 has expired, reconcile it and acquire max+1; never reuse v174.

## Phase A — Scheduled runners / current runtime proof

Canonical IDs only:
- Scanner `6a992c91ba688191ad428cbdc2e8cf35` — hourly `:00` Asia/Bangkok.
- Verifier `6a992d4d0c248191914e6c73c4f17db4` — hourly `:30` Asia/Bangkok.
- Canary `6a992bbe16d081918553ca3eb7f81058` — daily `08:15` Asia/Bangkok.

All three canonical task IDs were restored/enabled at the latest control-plane reconciliation. Do not create duplicate schedules and do not fabricate missed-window success.

### Current Scanner proof

Run: `SCV492-20260905T090033`

- Active policy `v4.9.2`.
- real scheduled runtime boundary.
- Scanner fencing/lease released.
- Manifest `FINISHED` only after required boundary/readback.
- coverage truth retained as `PARTIAL`, not falsely promoted to FULL.
- Change Count = 1.
- no protected final-business, provider, public, customer or owner outbound write.
- staged BTS packet `WP|BTS-ARIRANG|CANONICAL-LINK|20260905T090033` as `READY_FOR_VERIFIER`.

The 10:00 slot occurred while the recurring control-plane disablement had reappeared. Preserve that as a gap; do not backfill a fake successful Scanner run.

### Current Verifier proof

Run: `GPTV492-20260905T093007`

- Verifier fencing v213 safely released.
- processed the real BTS ARIRANG packet.
- direct authorized Live Nation Tero evidence verified BTS WORLD TOUR 'ARIRANG' IN BANGKOK.
- verified Bangkok shows on 3, 5 and 6 Dec 2026 at Rajamangala National Stadium.
- ticket state verified as SOLD_OUT under the available authorized evidence.
- foreign-event Company semantics use local organizer/promoter `Live Nation Tero` rather than a foreign label.
- canonical lifecycle/projection transaction, exact readback and reconciliation passed.
- Manifest `FINISHED`.
- no autonomous Audit/Notification Ledger/provider/owner send was manufactured.

Historical run `GPTV492-20260905T023000` released its v212 lease but its original Manifest remained `FROZEN`. A reconciliation record preserves this as an incomplete historical boundary; do not rewrite it to fake `FINISHED` and do not replay the historical run.

## Control-plane incident

Scanner and Verifier have repeatedly been found disabled shortly after prior restorations/runs. The actor/root cause is still unproven. Treat as P0 drift:
- preserve exact timestamps/evidence;
- restore only the existing canonical IDs after fresh role-lock checks;
- never blame Codex/Make/a person without evidence;
- never manufacture missed-run boundaries.

## Phase B — CRM / Business Brain

Governed projection code:
- `lib/kk-crm-projection.js`
- `scripts/kk-crm-projection.test.js`

Current implementation validates exact Machine<->CRM identity, freshness, nonnegative counts, exact phone/lens model physical capacity, package capacity, no PII projection and read-only CRM ownership.

Known real integration proof remains OH MY FOURTH CONCERT 16–18 Oct 2026 with CRM phone/lens/bundle availability projected and exact-read back. G2 inactive inventory is not counted as rentable.

## Company / Rental Analytics semantics

Current strict modules:
- `lib/kk-company-semantics.js`
- `lib/kk-rental-analytics-company.js`
- `api/kk-rental-dashboard.js`

The legacy event-name affiliation mapping was migrated out of the authoritative Rental Analytics path. Ambiguous/missing authoritative evidence fails closed to Unknown rather than guessing a label from event text.

## NONT V2 content state

Content version:
`CONTENT|NONTENCORE|20261003-04|X|V2`

Preserved current truth:
- `STATUS=APPROVED`
- selected variant `1`
- selected angle `THEME`
- Telegram message `229`
- callback token `2a268b61b806d5df8d45311c`
- approval fingerprint `305d014bbec42d057960ec9d71475ec87cd75498f6dd37a81ca58ff30f6b89f7`
- `LAST_ACTION=APPROVED_VARIANT_1`
- `EXTERNAL_SEND_AUTHORIZED=FALSE`
- `PRODUCTION_PUBLISH_AUTHORIZED=FALSE`

Campaign copy price remains `1,190฿`; CRM standard bundle price remains a separate `1,290฿` template and must not be overwritten merely because the X campaign uses 1,190฿.

## Phase C — Creative

Current guard:
- `lib/kk-creative-binding-guard.js`
- `scripts/kk-creative-binding-guard.test.js`

Production-ready Creative requires exact approved content/version/fingerprint/body hash plus official/authorized source asset ref, source evidence ref, exact source SHA-256, Canva design ID and final creative SHA-256/binding fingerprint.

Current investigation has rejected unrelated Drive/Canva assets rather than weakening the gate. Exact official NONT Arena Encore `FINAL MAIN KEY VISUAL — ARENA ENCORE : THE PERSONA` source bytes/hash have not yet been safely retrieved. The old generic Canva design `DAHUOaFyrRk` remains non-production and must not be promoted.

## Phase D — Telegram / Make

### Temporary compatibility
`5901592 — 02_KK_TELEGRAM_CONTROL`

Provider-proven V2 callback path remains a temporary compatibility bridge with exact token/chat/message/owner binding, callback dedup and DRAFT-only stale-state gate. Because V2 is now APPROVED, stale callbacks must fail closed.

### Canonical Phase D
`5988323`

Fresh access attempt still fails with:
`Insufficient rights, admin permission "organization view" is needed.`

Do not call the scenario deleted and do not create a competing permanent canonical worker.

Legacy `5911509` remains contained/inactive. Temporary one-shot `6144260` remains inactive after its controlled provider edit.

## Phase E — X provider boundary

Guard:
- `lib/kk-x-publish-guard.js`
- `scripts/kk-x-publish-guard.test.js`

Current publish scope binds content version, owner-approval fingerprint, exact text hash, creative/source hashes and Canva design ID. `PUBLISHED` additionally requires provider acknowledgment, post ID, canonical `https://x.com/<account>/status/<post_id>` URL, provider evidence/timestamp and exact text/media readback binding.

PostPeer was selected as the current candidate integration because its Make surface can support X text+media and provider post URL/ID evidence.
Authorization request:
`4e3be806-f7bc-4f0a-99da-268d2f112b51`
Status at this checkpoint: `PENDING`.

No X post has been sent and no provider receipt/post ID/URL exists. Keep both NONT production authorization flags false until Creative and provider gates pass.

## Phase F — Booking / exactly-once / KYC / LINE

Booking/KYC guard:
- `lib/kk-booking-intake-guard.js`
- `scripts/kk-booking-intake-guard.test.js`

Current guard covers recursive raw-PII rejection, exact event/template/package/current availability, inventory, request fingerprint/idempotency binding, KYC authority allowlist/freshness and canonical CRM API-only mutation.

### Ambiguous timeout fail-closed repair

`api/kk-admin.js` now treats `createBooking` upstream timeout as an ambiguous write result:
- dedicated error `BOOKING_WRITE_AMBIGUOUS_RECONCILE_REQUIRED`;
- `retry_safe=false`;
- `reconciliation_required=true`;
- explicit prohibition on blind retry.

This reduces duplicate-booking risk but does not by itself make the writer exactly-once.

### Remaining canonical writer gap

`apps-script/Code.gs::kkApiCreateBooking_` still performs the real CRM mutation under DocumentLock and validates event/package/asset availability, but it does not yet persist a durable request-id/fingerprint receipt at the canonical writer. Exactly-once must not be claimed until writer-side idempotency + exact replay/conflict/ambiguous receipt semantics are implemented and verified.

### KYC
No authoritative governed KYC approval authority is configured. OTP/contact verification and OCR/document parsing are not automatically KYC approval authority. Do not fabricate verified customer flow.

### LINE
LINE OA connection request:
`2dbe7ba5-061c-45e2-8f98-6822cf2eb50b`
Status at this checkpoint: `PENDING`.

Owner Core notification infrastructure remains separate from future customer-facing LINE workflow.

## Phase G — Outcome Learning

`_Business_Outcome` remains schema/header only; no synthetic business outcome row has been created.

Current projector:
- `lib/kk-outcome-projector.js`
- `scripts/kk-outcome-projector.test.js`

Final outcome requires exact Machine↔CRM identity, event date agreement, POST_EVENT_FINAL observation after the event, no active/unresolved booking, valid CRM final snapshot and provider X evidence if X performance is claimed. Unproved values remain null/unknown.

## Governed CI proof

Workflow:
`.github/workflows/governed-checks.yml`

GitHub Actions run `33941503515` completed successfully on the PR branch. `npm run check` performed syntax validation plus all governed regression suites.

Exact CI regression results:
- CRM projection: **18/18 PASS**
- Booking/KYC guard: **33/33 PASS**
- Outcome projector: **24/24 PASS**
- Company semantics: **6/6 PASS**
- Rental Analytics company semantics: **13/13 PASS**
- Rental dashboard contract: **5/5 PASS**
- Creative binding guard: **14/14 PASS**
- X publish guard: **21/21 PASS**
- Admin booking ambiguous-timeout contract: **5/5 PASS**

Total governed assertions: **139/139 PASS**, plus all configured `node --check` syntax checks.

This is current GitHub implementation/CI proof. It is not provider/public-production proof.

## GitHub / PR

Repo: `mikesd1995/kk-phone-rental-vercel`  
Branch: `skills/x-scanner-v2`  
PR #1: Draft / Open / Unmerged.

Current branch head at this checkpoint:
`866707233ce68082a16baae8a18c7157df830025`

Do not merge `main` without explicit owner approval.

## Current executable frontier

1. Observe the next live Scanner/Verifier scheduled boundaries and preserve evidence of any recurring OFF drift without fake backfill.
2. Implement canonical Apps Script writer-side booking idempotency/receipt when a safe partial-edit/deployment path is available; then verify exact replay/conflict/readback semantics.
3. Continue searching authorized/direct NONT Arena Encore media for exact official image bytes/hash. Do not substitute historical/generic posters.
4. Once Make organization-view access is available, inspect/cut over canonical Phase D `5988323`; do not replace it permanently while blocked.
5. Once PostPeer is authorized and Creative gate passes, wire the existing provider candidate under the X publish guard; do not send publicly merely to manufacture PASS.
6. Once LINE OA authorization completes, wire governed customer communication after booking truth; owner LINE remains separate.
7. Configure a governed KYC authority or formal manual attestation authority before real customer KYC automation.
8. Produce the first real eligible post-event exact Machine↔CRM final snapshot before writing `_Business_Outcome`.
9. Continue control-plane root-cause investigation for repeated task disablement using evidence only.

## External / human blockers

- Make organization-view permission for `5988323`.
- PostPeer authorization request pending.
- LINE OA authorization request pending.
- exact official NONT Arena Encore creative bytes/hash unavailable through currently accessible authorized sources.
- governed KYC authority not selected/configured.
- real Phase-G post-event evidence necessarily depends on an eligible completed event.

## Explicit non-actions

- no Core v1 rebuild;
- no duplicate Scanner/Verifier/Canary;
- no fabricated missed scheduled run;
- no fake historical Manifest completion;
- no competing canonical Phase-D worker;
- no merge to `main`;
- no bulk HOLD/quarantine release;
- no direct CRM Sheet booking write outside canonical writer;
- no invented customer/KYC/booking/outcome data;
- no PII copied into Machine SOT/docs;
- no generic/old creative promoted as official;
- no X/LINE/customer/public send to manufacture provider PASS;
- no provider/SENT/PUBLISHED claim without exact receipt/readback.
