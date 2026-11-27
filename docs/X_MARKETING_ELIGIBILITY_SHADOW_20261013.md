# KK Phone Rental — X Marketing / AI Learning shadow safety checkpoint
**Date:** 2026-10-13 ICT. **Mode:** Draft source hardening only. **Production writes/publishes/spend = 0.**

## Baseline: direct reads, not inferred traction
- Google Sheets canonical `08_Web_Ready!A4:K550`: 72 `show`, 8 `show_full` on this snapshot. **Only** matching `show + เปิดจอง + available_phone_count > 0` is eligible for phone-rental promotion. An existing booking does **not** bar promotion if the exact public event/date still has a phone. Do not unhide other events on a booked day.
- `18_X_Post_Log!A4:O600`: 22 `confirmed_posted`, 65 `assumed_posted`, 16 `planned`, 61 `superseded` across the 164 data records inspected (one header row omitted). Only 12 of the 22 confirmed rows have both an X status URL and a filled views column. These are historic snapshots **not verified current X reach**. No owner X publishing occurred in this task.
- Metricool account query returned **no social network connected**; no present-day X API impressions or engagement were retrieved. Never invent fresh X metrics.
- Repo already contains `kk-marketing-agent.js`, `kk-x-signal-detector.js`, `kk-content-performance.js`, `kk-content-selector.js`, `kk-x-posting-plan.js`, the Agent Gateway and an owner-only X chat bridge. [PR #636](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/636) owns shadow attribution work; [PR #694](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/694) owns copy-style docs. **Do not merge unrelated stale branches.**

## Draft improvements on this branch
1. **Source-of-truth eligibility** (`server/kk-x-posting-eligibility.js`): requires explicit **fresh (<=6 hours) timestamped** and caller-verified `08_Web_Ready` + `18_X_Post_Log` readback before ranking. Match **exact event_id and event_date_text**; reject stale/absent/duplicate rows, owner-hidden `hide`, sold-out `show_full`, `booking_status_for_web` other than `เปิดจอง`, available phone <=0, event date in the past, missing event name or unverified pricing.
2. **06:00 Bangkok operating-day boundary**: times in 00:00–05:59 belong to prior operating day; a `planned`, `assumed_posted` or `confirmed_posted` post for the same event in that day blocks a duplicate slot. **Only confirmed + evidenced actual X posts can count as measured performance**; assumed posts are for conflict avoidance, not measurement. Historical `superseded` posts do not block.
3. **Evidence-aware heuristic planning**: recompute proximity from the verified canonical event date rather than stale caller flags; leave unverified social dimensions at zero; explicitly label low X-confidence and scores as *heuristic advisory*, not measured reach. Storefront bookings with remaining phone inventory are eligible.
4. **Learning input guard**: ingest historical performance only if source row has a valid X status URL and `evidence_verified=true` with `status` measured/confirmed. This is a **caller provenance assertion, not independent API verification**; do not promote that score to live X analytics without source/API readback. No model fine-tuning, autonomous retraining or business data mutations are claimed.
5. **Fail-closed Agent Bridge**: a recorded Agent invocation whose planner result is blocked **must not** return `PASS` or produce a purportedly ready posting schedule. Owner approval remains mandatory; auto-publish/spend disabled.
6. Regression tests include `tests/kk-x-posting-eligibility.test.js`, updated `tests/kk-x-posting-plan.test.js`, and updated `tests/kk-x-posting-plan-chat-bridge.test.js`. **Source assertions and GitHub readback do not establish actual Node test execution**.

## Input contract / no connector spoofing
`Planner.plan(input)` now requires `input.now`, `storefront_source='08_Web_Ready'`, `storefront_verified=true`, `storefront_readback_at` in ISO8601 with time and TZ (<=6h); `storefront_rows` from authorized Web Ready readback (array of 11 columns or canonical keyed objects); `post_log_verified=true`, `post_log_readback_at` same freshness requirements, and `post_log` (canonical sheet array rows or mapped rows). Each candidate needs `event_id`, exact `event_date_text`, `event`, `verified_event=true`, `verified_pricing=true`. A synthetic hand-entered `verified=true` flag alone cannot prove external provenance: **only the accountable orchestrator should supply connector-backed rows and audit readback IDs/timestamps**. Until the read path is wired and independently verified, production activation must stay blocked.

## Acceptance / release gates
- [ ] Run `node --test tests/kk-x-posting-eligibility.test.js tests/kk-x-posting-plan.test.js tests/kk-x-posting-plan-chat-bridge.test.js` on the **exact PR SHA** using a genuinely zero-spend runner; report passing case counts and logs, not just test code presence.
- [ ] Check all dependent Agent Gateway/workflow acceptance tests for the stricter input contract, since old synthetic issue payloads without verified storefront and post-log rows will now correctly **BLOCK** (not pass).
- [ ] Wire real authorized Web Ready/Post Log retrieval into the owner-gated planner without self-attested synthetic booleans; verify freshness from connector receipts and dedup; do not add paid API calls.
- [ ] Collect latest X public posts via no-cost allowed sources with timestamps/metric labels; separately classify old X snapshots from new metrics. Do not claim today's reach from Oct 2 data.
- [ ] Validate 60–90-minute cadence, no duplicate event per 06:00 operating day, same-name events across dates, actual published vs assumed. Owner approves single final post; no automatic publishing.
- [ ] Before actual attribution activation, reconcile with [#635](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/635) and Ultra Deep acceptance. Only verified completed bookings may count toward Actual revenue.
- [ ] GitHub Actions included minutes were exhausted 2,032/2,000 until reported Nov 1 reset. Do **not** bypass Required Checks, spend or auto-run extra jobs. Draft only pending genuine tests and approval.

**Safety:** No live X post, no scheduled social posts, no prices/booking/events/stock changed, no LINE sends, no Production deploy or automatic merge.


## Follow-up: X discoverability / suspected shadowban risk (2026-10-13)
**Diagnosis confidence:** elevated *content and scheduling risk*; **NOT a confirmed Search Ban, Search Suggestion Ban, Reply deboost, or account penalty**. Public index snapshots for [@KK_PhoneRental](https://www.sotwe.com/kk_phonerental?lang=en) show multiple rental posts where event and hook change but lengthy promotional benefit/discount/booking-link blocks remain similar. External mirrors are not authenticated X Search/analytics and their crawl timestamps are not precise publication proof. Never treat indexed existence or view-count guesses as proof the X account is unrestricted.

**Applicable X rules (primary sources, retrieved 13 Oct 2026):**
- https://help.x.com/en/rules-and-policies/x-search-policies — duplicate/near-duplicate posts, keyword-triggered automated posting/replies, hashtag abuse, similar messages across accounts may cause filtering from search.
- https://help.x.com/en/rules-and-policies/authenticity — bulk duplicative content, coordinated accounts, unrelated hashtags and copy/paste behaviors are restricted.
- https://help.x.com/en/rules-and-policies/x-automation — compliant automation may be allowed; unsolicited automated replies and spam/duplicates are not.
**No official X numeric daily-post threshold exists in these sources.** The following 2/day is KK's voluntary conservative advisory, not a promised method for removing platform restrictions.

### Implemented on THIS DRAFT branch
- Added `server/kk-x-visibility-recovery.js` and integrated it into `server/kk-x-posting-plan.js` (owner-review recommendation path, *not* the live X publication path).
- **Account-wide 2 new recommendations / Bangkok operating day**, not merely per-event: count `confirmed_posted`, `assumed_posted`, and `planned` rows across ALL events in the canonical Post Log before filling any more recommendation slots. `superseded` does not consume capacity. Budget is reduced if earlier slots/posts exist.
- **At least 90 minutes between recommended slots and active log timestamps**, including late-night time slots; `00:00–05:59` maps to the previous 06:00 operational day. Thai timestamps in `DD/MM/YYYY HH:mm` are supported.
- Invalid timestamp on any active Post Log row **fails closed** (`ACTIVE_POST_LOG_TIME_UNVERIFIED`) instead of making unsupported account-wide frequency claims. Missing or stale canonical source readback continues blocking under PR #716 rules.
- New planner response reports `visibility_recovery`, `RECOVERY_DAILY_POST_CAP`, `RECOVERY_SPACING_UNDER_90_MIN`, or `BLOCKED_VISIBILITY_RECOVERY`. Account guard is independent of event-level eligibility; distinct events are no exception.
- Added seven regression cases in `tests/kk-x-visibility-recovery.test.js` for daily cap, cross-event post log, exact 90-minute spacing, close intervals, Thai format, midnight and stale/invalid evidence.
- All posts remain **manually approved;** publishes=0, paid spend=0, price/booking/LINE/inventory changes=0. No X account OAuth, account settings, or existing post edits were performed. **Not deployed/merged.**

### Real account verification still blocked by missing X session/analytics
To classify actual shadowban, perform the following **from a genuinely separate viewer account**, logged out of KK:
1. Search `from:KK_PhoneRental` in Latest with an unrestricted viewer; save screenshot including visible query, time, and found/missing **exact post URLs**.
2. Search a distinctive verbatim sentence from a recent *public* post; compare Latest results with the profile timeline, using Search settings that do not filter sensitive content.
3. Check whether the handle appears under autocomplete from that viewer. For reply rank testing, inspect a recent reply while logged out/other-account, controlling for parent-post context.
4. In the owner X account, check account status/security notifications; record any platform label or appeal option. Compare **real X Analytics** impressions across similar posts over 7–14 days, with time-of-day, follower vs nonfollower reach and publication times. Reach declining alone is not proof of a penalty.
5. Store screenshots, exact X status URLs, source/account and dates in an evidence log; mark each outcome `PASS`, `FAIL`, or `UNVERIFIED`. Do **not** supply account passwords, automation tokens or X session cookies to GitHub.

### Operational recovery protocol until proof is available
- Prefer no more than two *distinct, evidence-verified and owner-approved* commercial posts per Bangkok operating day as a temporary precaution. Space at least 90 minutes. These are **internal business guardrails, not X requirements**; review once firsthand search/analytics evidence exists.
- Stop mass generic replies, near-identical benefits blocks, recycled hashtag lists and identical cross-posts on `@KK_PhoneRental2`. Avoid deleting and reposting the same copy.
- Rewrite each piece around independently verified event-specific value; do not invent scarcity, outcomes, hashtags or booking availability. Do not post sold-out/owner-hidden dates. Avoid putting a repeated link/discount paragraph into every post.
- Monitor actual discovery and engagement; *do not* promise account will be unbanned. If X shows an enforcement label, follow the platform's in-product appeal route instead of attempting to evade a restriction with the backup account.

### Verification and release boundary
- [x] Branch file changes and explicit test cases persisted in GitHub.
- [ ] Execute **exact-head** Node tests: `node --test tests/kk-x-visibility-recovery.test.js tests/kk-x-posting-eligibility.test.js tests/kk-x-posting-plan.test.js tests/kk-x-posting-plan-chat-bridge.test.js` plus affected Gateway suite. Source presence is not test execution.
- [ ] Genuine external X visibility checks and owner analytics readback with dates.
- [ ] Reconcile with PR #694 copy-policy branch without discarding its stronger anti-repeat gates. Never publish through an unverified bridge.
- [ ] Confirm no repository quota, required-check, or Production safety gate is bypassed. Leave this PR **DRAFT**, do not merge/deploy without passing acceptance and owner approval.

**Disposition:** SAFETY_CODE_DRAFTED / CI_UNVERIFIED / X_ENFORCEMENT_UNVERIFIED / PRODUCTION_UNCHANGED.


### Read-only smoke evidence added this session
- Re-fetched the **committed branch sources** for `kk-x-posting-eligibility.js`, `kk-x-visibility-recovery.js`, and `kk-x-posting-plan.js` and executed their functions in an in-memory V8 harness with a *stubbed* Marketing Agent. No external data or production mutations.
- Seven scenarios **PASS (7/7, FAIL 0)**: (1) account-wide 2/day recommendation cap, (2) previous two cross-event posts block, (3) 90-minute cross-event spacing, (4) midnight to previous operating day mapping, (5) invalid active timestamp fails closed, (6) historical or superseded entries excluded, (7) stale readback refuses recommendations.
- This is **targeted V8 smoke, NOT exact-head `node --test`, a genuine Marketing Agent end-to-end test, GitHub CI or Production acceptance**. Node/CI gates above remain unchecked.
