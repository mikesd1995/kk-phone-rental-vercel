# KK Phone Rental — all-month storefront modal content audit

**Audit date:** 27 October 2026 ICT. **Source:** native backend workbook `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU` with exact tabs `08_Web_Ready!A4:K1000` and `09_Web_Packages!A4:N1360`. This is a read-only source snapshot, not a claim that the customer-facing API returns identical rows.

## Findings by event date month

| Event month | Event rows in sheet | Rows not explicitly hidden by `action_for_web=hide` / Thai hidden status | Non-hidden rows with long `event_note` (>100 characters or >2 lines) |
|---|---:|---:|---:|
| Sep 2026 | 44 | 2 | 0 |
| Oct 2026 | 152 | 39 | 20 |
| Nov 2026 | 144 | 27 | 20 |
| Dec 2026 | 61 | 23 | 19 |
| Jan 2027 | 25 | 12 | 12 |
| **All** | **426** | **103** | **71** |

The read returned 435 row slots after the header, including empty/unused rows; counts above include only nonblank event IDs. The public API and browser may additionally remove past dates or apply availability/owner-lock business rules. **Do not report 103 as the current live customer card count.**

## Package-content issue

In source, 179 package rows associated with these non-hidden event records also had non-hidden package status and a nonempty `web_note`:
- 43 matching stock generic marketing lines (e.g. phone photo suitability, lens pitch or discounted bundle pitch).
- 129 resembling internal machine/pricing/competitor/owner audit annotations under a basic token-class audit.
- 7 other raw text rows, including 2 additional general marketing slogans and 5 recent December audit markers (numeric-prefixed machine markers, currently not captured by simple letter-prefixed token matching).

**Observation and fix:** the raw generated Sheet mixes customer remarks with internal audit notes. The former public sanitizer did not recognize numeric-date-prefixed 8-digit internal markers. This branch extends **both** the read-only public API sanitizer (`api/kk-data.js`) and the browser sanitizer (`script.js`) to redact that exact machine-token class, with negative/positive regression cases in `tests/public-note-redaction-regression.test.js` and `tests/public-data-proxy.test.js`. Canonical Sheet audit data stays untouched. No business writes or publication-permission changes are introduced.

## Confirmed structural root cause and permanent clean fix

1. The active customer `main` `script.js` still rendered long event `webNote` as an always-expanded `modal-meta`; PR #800 was never merged. All months share `showModal(c,options)`, so this affected any month with verbose data.
2. The old renderer appended package subtitles, including generic slogans; their line count scaled with the number of available packages.
3. The all-month branch ports PR #800 to newer immutable `main` commit `cdaa7a4c5513dfb338be1117bede19bbdc2f0b25` without overwriting unrelated main changes.
4. It keeps sanitized genuine event details and material package restrictions accessible in native disclosure panels, removes generic package-marketing disclosure rows and duplicate model/spec labels, and retains price, CTA, full/LINE, dark/light, Thai/English and mobile targets.

This is a **shared presentation fix**, not 426 individual row rewrites. Existing and future event imports therefore inherit it. See durable policy in `AGENTS.md` and `docs/STOREFRONT_COMPACT_EVENT_DETAILS_STANDARD_2026-10-27.md`.

## Verification / release integrity

- Tests: `tests/storefront-compact-event-modal.test.js`, `tests/storefront-compact-event-fixtures.test.js` and existing public-text/UX tests.
- Isolated V8 execution: **36/36** selected tests passed, syntax compilation **5/5**. Mocked Node APIs/DOM, **not** real full CI or guaranteed mobile visual acceptance.
- No customer/booking/pricing/stock/Machine-SOT/Google Sheet mutations. Zero production writes.
- **Release hold:** require real Node regression, exact-head genuine browser visual QA with inspection of ZATO and examples from Nov, Dec, Jan, fresh safety gates, and owner acceptance before Merge/Deploy. Keep project [issue #803](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/803) open until production readback proves this branch is live.


## All-month exact-source renderer replay against live read-only Sheet snapshot

After the patch, fed **all 103** source events not explicitly hidden (including historical dates) plus their `09_Web_Packages` records into the exact candidate `showModal` function using a fake DOM:

| Month | Event rows exercised | Notes hidden (empty/internal) | Valid notes collapsed |
|---|---:|---:|---:|
| Sep 2026 | 2 | 0 | 2 |
| Oct 2026 | 39 | 25 | 14 |
| Nov 2026 | 27 | 17 | 10 |
| Dec 2026 | 23 | 9 | 14 |
| Jan 2027 | 12 | 3 | 9 |
| **Total** | **103** | **54** | **49** |

- **0 renderer exceptions**, every row retained a visible package action or the existing waitlist branch.
- **155** package options rendered in the fake DOM across these event fixtures; **0** generic package disclosure rows remained. Genuine non-promotional package instructions would still be preserved in collapsed details (verified separately by unit fixtures).
- This is read-only replay of actual backend Sheet data into an isolated client renderer, **not** a signed-out production browser screenshot, not equivalent to the actual availability filter and not permission to publish or deploy. No canonical Sheet cell was changed.
