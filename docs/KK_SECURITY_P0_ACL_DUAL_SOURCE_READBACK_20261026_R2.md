# KK Phone Rental — Security P0, 26 October 2026, R2
## Safe continuation evidence and cross-chat handoff

**Scope:** Improve existing **Draft PR #721 only** without changing live business data, Drive ACL, apps-script deployment, Production configuration, secrets, Booking, LINE, prices, inventory, Make scenarios or spend. Status is **P0 HOLD**, not fixed in Production. Follow original [26 Oct R1 evidence](KK_SECURITY_P0_ACL_READONLY_2026-10-26_HANDOFF.md), [#721](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/721), [#739](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/739), [#718](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/718), [#738](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/738), and [final gate #49](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/49).

### 1. Re-verified baseline and defect

Read current Google Sheets **01_Events!A5:I600** and **08_Web_Ready!A5:K600** without any customer or booking rows. Source records: **390 events / 390 Web Ready IDs**, duplicate IDs **0/0**; current Oct–Dec 2026 visible events **110** (Oct **39**, Nov **44**, Dec **27**). Visible Web rows with absent Core ID **0**, cross-source date disagreements **0**, image URL disagreements **0**.

Visible cards: **48 Drive thumbnail references, 37 unique referenced Drive file IDs**, **62 cards use other artwork URL styles** (not proof that poster is missing or usable). Draft #721's pinned *owner ACL repair* still expects **73 visible cards / 48 Drive references / 39 unique Drive IDs**. Current versus pinned IDs: **5 newly used Drive IDs**, **7 no longer currently used**. Do **not** silently repin the repair target; the existing **SCOPED_ACTIVE_POSTER_DRIFT** fails closed until full owner-reviewed effective-permission scope, provenance, fingerprint and signed-out media acceptance are established.

**Newly fixed code gap:** Previous Core-first card filtering could omit a **WebReady-visible Oct–Dec event** when its canonical Core event ID was absent or its canonical date was outside the Oct–Dec scope. The earlier date parity guard only checked Core rows that passed the Core-first filter. Neither orphan nor reversed date drift was detected *specifically* before the final cardinality guard. This is a source-integrity control, not proof of current live mismatches.

### 2. Actual Draft-only source and test changes

Latest code changes, all on **security/drive-public-acl-owner-review-20261013**, without production merge:

1. [d27a310](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/d27a31089f7562a2ac6f1aa43585b3c84cde8430) — adds a reverse visible WebReady-to-Core join guard to `ops/drive-security/kk-poster-acl-owner-review-20261013.gs`, returning `SCOPED_VISIBLE_WEB_ORPHAN` if source is absent and `SCOPED_ACTIVE_EVENT_DATE_DIVERGED` if source/derived date diverges, before fingerprint or Drive permission apply.
2. [2c5140a](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/2c5140a5419e84fb22aed5aa19f5802a326b4dd2) — mirrors exactly the same read-only join guard in `ops/drive-security/kk-poster-acl-READONLY-preflight-20261014.gs`. This script still contains **no setSharing and no Apply or trigger entrypoint**.
3. [8c7c4c5](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/8c7c4c584982dbe4875d83bd1bc9bc40a258facd) — adds regressions for orphan visible WebReady, January Core event moved into visible October scope, and hidden web-only historical rows remaining excluded from active repair.

GitHub exact file SHA readback after those commits:
- ACL owner script: `779fb54dbdec745df49d8761103311e6e83b0887`
- Standalone read-only ACL preflight: `93b0fbe6c882f3a889166a8e151ea49bcc600213`
- Regression fixture: `d4328ee44cff64dd33abf4612a8e8713ffcf2024`

### 3. Tests — precisely separate levels

**PASS, source-only isolated synthetic V8: 23 / 23 checks, 0 failures.** Direct GitHub content readback; full JS parse; owner versus standalone read-only prefix byte parity; standalone absence of write entrypoints; baseline 39 mocked current IDs; owner and readonly both reject visible orphan, reverse January/October date mismatch, regular date mismatch, image mismatch, new visible card, Core duplicate ID, Web duplicate ID, and missing Drive thumbnail reference; both leave hidden-only orphan out of active scope. Mock Drive provider writes **0** for all negative/readonly checks.

**LIMITATION:** V8 simulation mocked the Apps Script APIs and used a deterministic test-only digest for fingerprint instrumentation, not production SHA-256 or real Drive permissions. This is **not** native Node full contract suite, Google Apps Script execution, GitHub Actions success or authenticated private transport E2E. An initially proposed patch failed **local pre-write syntax validation** and was not committed; corrected script passed validation and was committed. No unsafe first attempt reached the repo.

**Native exact-head Node:** NOT RUN. **Hosted GitHub Actions:** zero PR-associated workflow runs and empty combined status for source head `8c7c4c5`. Empty CI status is not a green check. Draft PR #721 mergeable=false and previous compare (against main commit `64cec7b`) was **76 ahead / 38 behind** after these changes. Do not merge or rebase blindly.

### 4. Fresh scoped Drive metadata census (read-only)

Google Drive `files.get` metadata was checked **individually** for the 5 newly in-scope image IDs, 7 no-longer-current-but-pinned image IDs, and 4 pinned folders (**16/16 metadata reads succeeded**). `permissions.type=anyone, role=writer` was returned for **all 5 new**, **all 7 previously pinned**, and **all 4 parent folders**. New image MIME: 4 JPEG + 1 PNG; former images: 5 JPEG + 2 PNG; 4 Drive folders.

This does **not** constitute a complete 37/37 active-file census or effective/inherited permission validation from the owner UI. It is evidence of an ongoing public-write *metadata* risk, not proof of tampering. A first attempt to inspect all 37 files in one connector transaction hit the tool call limit; the bounded 16-file targeted metadata audit completed instead. No permission changes were made, and Drive owner control is still required before Apply.

### 5. Production private read and remaining hold

R1 found Core workbook reported `anyone:reader`, and a read-only Vercel environment **names-only** check showed no `KK_CORE_PRIVATE_READ_KEY`, `KK_CORE_PRIVATE_TRANSPORT` or `KK_CORE_SHEET_REQUIRE_PRIVATE`. Core Private Reader #739 is **not active** despite earlier 13/13 native spreadsheet header-only schema parity. Do not close Core Privacy #738, nor revoke Core Reader access before an authorized Apps Script deployment, separately configured owner secret, successful authenticated 13-range read with negative auth tests and zero-downtime Admin/Booking/LINE/Storefront QA.

### 6. Acceptance / next steps (no implicit approval)

1. On owner-authenticated restricted Apps Script/Drive, produce a fresh read-only complete image/ancestor/history inventory with IDs, effective roles, ownership and fingerprint; reconcile current active 110/48/37 versus old 73/48/39 and exact independent poster source/filming rights. Preserve hidden/tombstone/booking-date rules.
2. Execute native exact-head Node tests and full relevant CI on a no-extra-cost runner plus actual browser image loading (signed out, mobile) and confirm dates/artwork. Stage reviewed scoped repairs only once owner approves the exact fingerprint and verified dependency path. Keep folders/history separate and never propagate implicit ACL changes.
3. Complete Core private-reader key isolation, 13/13 owner-authenticated transport reads, private/public negative tests, revenue/Admin/Booking/LINE equality, rollback and owner release approval **before** restricting customer-data sheet ACL.
4. Reconcile old Draft #721/#739 against current main and other overlapping PRs. Record CI/owner approvals before any protected merge/deploy.

**Writes in this turn:** 3 Draft code/test file commits and this evidence document only; Google Drive ACL 0; Production Apps Script saves 0; booking/customer/price/stock 0; LINE/Telegram 0; workflow activation 0; GitHub merge/Vercel deploy 0; paid services 0. Maintain **Security P0 HOLD**.


### 7. Complete present-visible Drive metadata check — second, bounded retrieval pass

After the 16-file targeted audit above, repeated read-only Google Drive `files.get` in batches respecting connector limits for the **remaining 32 currently referenced Drive image file IDs**. A mistyped manual lookup produced one 404; it was corrected and the exact current ID successfully read. This was a probe input error, **not a verified missing original asset**.

**Final current active set:** **37/37 exact current unique Drive image files were individually checked**, and **all 37 report `permissions: type=anyone, role=writer`**. Current-image MIME census: **29 image/jpeg, 6 image/png, 2 image/webp**. The 37 successfully checked IDs were compared against a fresh `08_Web_Ready!A5:K600` read; **37 unique in both sets, 0 missing and 0 extraneous IDs**. Including the distinct 7 formerly pinned now out-of-scope images and four poster folders checked earlier, **48/48 exact identified image/folder objects reported `anyone/writer` metadata**, with all valid-ID lookups successful. The old history tree beyond these 7 is **not** fully audited.

**Do not interpret this as 37/37 signed-out public image decode or definitive inherited-permission/ownership repair acceptance.** Metadata is a live read-only risk finding. Required next step remains owner-authorized full-tree provenance/fingerprint and scoped ACL decision, then after-change signed-out image/mime/artwork and permissions readback. All ACL writes remain zero.
