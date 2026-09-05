# KK Phone Rental — Astra Transition Handoff

Prepared: 2026-09-05 18:55 Asia/Bangkok  
Branch: `skills/x-scanner-v2`  
Purpose: one-time Astra transition review after current GPT-5.6 Sol implementation work is exhausted.

> Live Machine SOT + exactly one highest Active `_Policy_Registry` + canonical backend/provider state + runtime/provider/exact-readback evidence remain authoritative. This file is a continuity/change-log mirror, not runtime authority.

## 1. Current classification

**CORE SAFE / GOVERNED IMPLEMENTATION HARDENED / v4.9.3 CURRENT-MARKET RUNTIME ACTIVE / PROVIDER-PERMISSION-DEPLOYMENT-FUTURE-EVIDENCE GATES FAIL-CLOSED.**

No `FINAL_DONE` claim is made for external/provider/future-event work. No local/CI result is promoted to provider/production evidence.

## 2. Authority changed during 5 Sep continuation

Fresh Machine-SOT read now resolves exactly one Active `POLICY_VERSION`:

`v4.9.3 PRICE FRESHNESS & CURRENT MARKET`

This supersedes the older v4.9.2 policy-version row while inheriting unchanged rules.

Material v4.9.3 semantics:
- `_Price_Evidence` is append-only historical observation lineage.
- `_Competitor_Price_Current` is replaceable current projection.
- current resolution is one latest valid Event + normalized competitor + package observation.
- stale/superseded/conflict-held observations cannot count in current range/median/recommendation.
- pricing consumers (owner query / X content / rent recommendation) read current fresh exact-event evidence first.
- history is trend/lineage only, never silent fallback.
- every current projection update requires exact Event/shop/package/price/freshness/source-lineage readback.
- 15:00 DEEP daily competitor completion requires an attempt for every eligible price-focus event.
- verified price/queue/promo changes trigger current refresh + repricing review; no automatic undercut.
- owner/manual price override remains authoritative.

## 3. v4.9.3 real runtime evidence

Two real Scanner price-refresh runs are preserved in live Machine SOT:

### `SCV493-20260905T180100-OWNER-PRICE`
- Manifest FINISHED under v4.9.3.
- 40/40 event-level attempts.
- 11 new `_Price_Evidence` observations (rows 95–105).
- `_Competitor_Price_Current` rows 2–12 exact-read with lineage.
- eight events had qualified current exact-event prices.
- SkyNani had three independent fresh offers and current median 1,090 with per-date availability caveat.
- source coverage remained honestly PARTIAL.
- KK self listings excluded.
- no final KK price, owner outbound or provider/public write.

### `SCV493-20260905T182300-OWNER-YEAREND-PRICE`
- Manifest FINISHED under v4.9.3.
- 29/29 year-end event attempts through 31 Dec 2026.
- nine new `_Price_Evidence` observations (rows 106–114).
- current rows 13–20 exact-read with lineage.
- fresh actionable examples include BABYMONSTER 1,000, CAT EXPO 1,000 and RUNAWAY 900.
- NCT 127 / BIGBANG conflicting lens-rule evidence is `CONFLICT_HOLD`, not current market truth.
- source coverage remained PARTIAL.
- no final KK pricing or outbound/provider mutation.

Current `_Competitor_Price_Current` therefore contains 19 projected observations from these refreshes, including FRESH and fail-closed `CONFLICT_HOLD` states.

## 4. NONT current-price revalidation

Protected content remains:
`CONTENT|NONTENCORE|20261003-04|X|V2`

Live readback:
- `APPROVED`
- selected Variant 1 / `THEME`
- Telegram message 229
- campaign price 1,190 THB
- CRM standard bundle remains separate 1,290 THB
- `EXTERNAL_SEND_AUTHORIZED=FALSE`
- `PRODUCTION_PUBLISH_AUTHORIZED=FALSE`

The immutable approved row was created under v4.9.2 and must not be silently rewritten to v4.9.3.

Fresh v4.9.3 competitor refresh did attempt NONT Arena Encore at 18:07:30 and recorded:
`PARTIAL_NO_PACKAGE_SPECIFIC_FRESH_PRICE; generic start-price listings not promoted to X300 Pro+Lens current market.`

Therefore:
- the old historical exact competitor price must not be described as current market;
- no current competitor range/median claim is allowed;
- owner-approved 1,190 campaign price may remain an independently authoritative manual campaign price because the copy makes no current-market claim, but final publish must still resolve current Active policy and all publish/creative/provider gates.

## 5. Current-market deterministic implementation

New governed implementation on branch:
- `lib/kk-competitor-current-market.js`
- `scripts/kk-competitor-current-market.test.js`

Contracts:
- exact Event + normalized competitor + package identity;
- positive current price;
- mandatory source evidence row lineage;
- Last Checked / Fresh Until validation;
- future-check rejection;
- only `FRESH` current rows eligible;
- current exact market excludes self and non-bookable offers;
- >=2 independent current shops for exact range;
- >=3 for exact median;
- exact projection readback checks Event/shop/package/price/freshness/source lineage;
- history remains separate from current projection.

A material bug was identified and fixed during finalization: an earlier resolver could select an older still-fresh observation when the newest observation was conflict-held/expired. That would resurrect superseded history and violate v4.9.3 stale/superseded exclusion. The resolver now fails closed: only the newest observation may define current truth; newest invalid/conflict/expired means no current row. Same-timestamp conflicting latest observations also fail closed.

Regression cases were added for:
- newest conflict-held observation supersedes older fresh history;
- newest expired observation cannot resurrect older history;
- ambiguous same-time latest observations fail closed.

## 6. Pricing/content skill integration

Updated staging skills now explicitly follow current-policy market semantics:
- `ai/skills/competitor-price-evidence-ranker/SKILL.md`
- `ai/skills/x-content-competitor-pricing-scanner/SKILL.md`

They now require:
- current Active policy first;
- current projection before history;
- fresh exact-event evidence first;
- append-only history for lineage/trend only;
- stale/expired/conflict-held/superseded exclusion;
- source-lineage/readback requirement;
- refresh/HOLD instead of historical fallback;
- explicit separation of comparable evidence;
- no automatic undercut;
- current campaign price may be used only when independently authoritative and without false competitor-derived claim.

## 7. Booking exactly-once engineering

Canonical source implementation exists on branch:
`apps-script/BookingIdempotency.gs`

Writer contract:
`request_id + canonical SHA-256 -> PREPARED -> bind target row/assets -> canonical booking write -> exact booking-row fingerprint readback -> COMMITTED receipt`

Safety:
- dedicated non-PII `17_Booking_Request_Receipts` surface;
- same request / changed intent rejected;
- PREPARED recovery reconciles exact target-row fingerprint;
- matching prior write is finalized instead of duplicated;
- occupied nonmatching target row fails closed;
- receipt exact readback;
- raw customer payload not stored in receipt;
- DocumentLock released in `finally`.

Vercel proxy already treats ambiguous `createBooking` timeout as:
`BOOKING_WRITE_AMBIGUOUS_RECONCILE_REQUIRED`, `retry_safe=false`, `reconciliation_required=true`.

**Implementation/CI is complete; production Apps Script deployment/runtime proof remains unavailable through current authorized tooling. Do not call production exactly-once COMPLETE until deployed/read back from the canonical Apps Script project.**

## 8. KYC

Governed Xama adapter exists:
- `lib/kk-kyc-xama-adapter.js`
- `scripts/kk-kyc-xama-adapter.test.js`

It maps accepted provider decisions to minimal non-PII attestation:
`verified + subject_ref + evidence_ref + authority + verified_at`.

It requires explicit accepted status/review/document allowlists and, when configured, independent face-match evidence. Raw provider identity fields are not projected into Machine SOT.

Xama authorization request:
`20005b08-4698-490a-b168-58a982f3c545`

Latest checked state: `PENDING`.

## 9. X / LINE / Make external gates

### X
Candidate provider: PostPeer.  
Authorization request: `4e3be806-f7bc-4f0a-99da-268d2f112b51`  
Latest checked: `PENDING`.

No production X post ID/URL/receipt exists.

### LINE customer flow
Authorization request: `2dbe7ba5-061c-45e2-8f98-6822cf2eb50b`  
Latest checked: `PENDING`.

Owner LINE and customer LINE remain separate scopes.

### Canonical Phase D Make
Scenario `5988323` remains inaccessible to the current identity:
`Insufficient rights, admin permission "organization view" is needed.`

Do not create a competing canonical scenario. Existing `5901592` remains temporary compatibility only.

## 10. Creative gate

NONT exact event facts remain supported by official IMPACT / Eventpop and official-account mirrors. The desired official post is identified as:
`FINAL MAIN KEY VISUAL — ARENA ENCORE : THE PERSONA`.

Available search routes still have not yielded safe exact authorized raw image bytes/hash. Image search repeatedly surfaces prior May/BITEC or other NONT creatives, which remain rejected.

No generic/old image may be promoted. Creative remains fail-closed until exact authorized asset bytes/reference/hash + Canva design binding + final creative hash are proven.

## 11. Governed CI

Latest verified GitHub Actions run after current-market fail-closed hardening:
`33964652860` — `SUCCESS`.

Assertions:
- CRM projection 18/18
- Booking/KYC 33/33
- Outcome 24/24
- Company semantics 6/6
- Rental Analytics company 13/13
- Rental dashboard contract 5/5
- Creative binding 14/14
- X publish 21/21
- booking ambiguous-timeout 5/5
- booking writer idempotency 12/12
- Xama KYC adapter 12/12
- competitor current-market 25/25

**Total = 188/188 governed assertions PASS**, plus configured syntax checks.

This is code/CI evidence, not provider/deployment/production proof.

## 12. Canonical runner state

Canonical IDs remain unchanged:
- Scanner `6a992c91ba688191ad428cbdc2e8cf35`
- Verifier `6a992d4d0c248191914e6c73c4f17db4`
- Canary `6a992bbe16d081918553ca3eb7f81058`

Latest targeted automation read showed all three enabled. No duplicate or watchdog task was created.

Historical recurring OFF drift remains a control-plane observation with unproven actor/root cause. P0 policy forbids Scanner/Verifier runtime self-disable/self-pause/self-reschedule/task create-delete/cross-runner task management.

## 13. GitHub governance

PR #1 must remain:
- Open
- Draft
- Unmerged

Never merge `main` without explicit owner approval.

Latest implementation commits include v4.9.3 current-market integration plus final fail-closed hardening. Astra must read current branch head live rather than rely on a SHA in this document.

## 14. Remaining genuine blockers

### BLOCKED_EXTERNAL / BLOCKED_HUMAN
1. Deploy Apps Script booking idempotency overlay into canonical Apps Script project and obtain real runtime/readback proof.
2. Obtain exact authorized NONT Arena Encore source image bytes/hash and complete Canva binding.
3. Grant current Make identity organization-view access to canonical Phase D `5988323`.
4. Authorize PostPeer, then wire X only after copy/creative/publish authorization gates pass.
5. Authorize Xama and perform real governed KYC provider validation.
6. Authorize LINE OA and perform customer-facing delivery with provider receipt.

### WAITING_EVIDENCE
7. Phase G final Business Outcome requires a genuinely completed eligible event, exact Machine↔CRM crosswalk, final CRM state and no unresolved active booking. Do not fabricate this before the real event completes.

### CONTROL-PLANE OBSERVATION
8. Continue observing whether Scanner/Verifier OFF drift recurs after the self-mutation prohibition; do not attribute actor without evidence and do not create a duplicate watchdog architecture.

## 15. Explicit non-actions preserved

- no Core v1 rebuild;
- no duplicate Scanner/Verifier/Canary;
- no fake scheduled-run backfill;
- no historical evidence deletion;
- no competing canonical Make Phase D;
- no `main` merge;
- no bulk HOLD release;
- no fake KYC/customer/booking/outcome;
- no public X/LINE send to obtain PASS;
- no generic/old NONT creative promoted;
- no stale historical competitor price promoted to current truth;
- no current-market median/range below evidence thresholds.

## 16. Astra one-time review target

Astra should NOT restart or full-audit the project. Start with live reconciliation, then classify only material findings as:
`PRESERVE / HARDEN / SIMPLIFY / MIGRATE / REMOVE_AFTER_CUTOVER / BLOCKED_EXTERNAL`.

Highest-value review areas:
1. v4.9.3 current-price history→projection→pricing-consumer architecture and fail-closed semantics;
2. canonical Phase-D cutover plan once permission exists;
3. Content→Approval→SourceAsset→Creative→X immutable lineage;
4. canonical Apps Script idempotency deployment/runtime proof plan;
5. KYC/LINE provider integration once authorizations exist;
6. control-plane OFF-drift evidence/root cause without adding competing schedules;
7. context/checkpoint simplification without weakening evidence lineage.

After bounded review, Astra should immediately continue any newly executable safe work rather than stop at a report.
