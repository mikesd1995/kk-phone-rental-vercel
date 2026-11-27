# LINE booking dummy isolation — S1 local evidence

CURRENT: RELEASE HOLD. This is a **local full-handler rehearsal with synthetic external systems**. It establishes no native/provider acceptance and grants no release authority.

Source base: `b442a5a366e46db416498219d9f77e3818aa1d8b` (PR #875 candidate). Harness/protocol version: S1 / `schemaVersion=1`. Implementation is confined to this document and three new test/fixture files; production handlers, constants, policy, dependencies, deployment configuration and workflows are unchanged.

## Reproduction and actual results

From the approved worktree, remove `NODE_OPTIONS` from the launching shell without reading its value, then run:

```powershell
Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
node --test tests/line-booking-dummy-isolation.test.js
```

Verified locally on Node 24.13.1, 15 November 2026: **27 parent tests passed, 0 failed/cancelled/skipped/todo**, exit 0. These include nine fresh guarded existing regression processes containing **96 existing tests, all passed**. The 96 tests are separate from the 27 parent assertions and must not be summed as a single native or hosted acceptance result. The parent captured **28 per-process attestations** because poison/repeat checks launch additional fresh scenario children.

Every positive scenario and regression leaf reported `denialCount=0`, `blockedAttemptCount=0`, and `pendingCount=0`. Expected negative probes are separate:

| Case | Expected denials/blocks | Outcome |
|---|---:|---|
| Separate guard self-test | 38 lower-level/default-fetch/sensitive-file blocks | All rejected before the original operation; child exit 0 |
| Separate strict transport self-test | 9 fixture denials | Unknown query, method, body, redirect option, redirect response, exhaustion, null options and two malformed-header forms rejected; child exit 0 |
| Swallowed profile denial | 1 fixture denial | Actual webhook returned HTTP 200; child exited 1 with `FIXTURE_DENIAL`; parent asserted this failure |

Guard probes are process-local and synchronous/rejected-promise controls. No probe intentionally opens a socket, DNS operation, listener, subprocess, worker, or secret file. The WebSocket probe is present only when that built-in exists; this local Node version produced the count above. Compatibility uses Node 20 built-ins, but Node 20 was not installed or executed here.

The reviewed fix wave adds guard-installation assertions before any UDP constructor probe, then exercises the blocked public Socket constructor and send/bind/connect prototypes using an inert object. Ten pure sensitive-path predicate checks cover bare relative, `./`, absolute and Windows separator forms without filesystem access. Three malformed-input errors are deliberately caught after a separate route has satisfied its required call; each increments the denial counter and makes final completion fail. Intentional responder/provider fixture errors retain their separate recovery semantics. Fresh bounded verification after those corrections retained 27/27 parent tests and 96/96 selected existing tests; expected negative counts above supersede the earlier 34-block/six-denial run.

| Existing guarded regression leaf | Tests / passed |
|---|---:|
| `line-webhook.test.js` | 26 / 26 |
| `line-webhook-raw-body.test.js` | 3 / 3 |
| `line-booking-inbox-tee.test.js` | 2 / 2 |
| `line-booking-inbox-safety-integration.test.js` | 4 / 4 |
| `kk-line-inbox-tee.test.js` | 6 / 6 |
| `kk-inbox-private-media.test.js` | 16 / 16 |
| `line-booking-initial-outbox-integration.test.js` | 6 / 6 |
| `line-booking-owner-durable-outbox.test.js` | 28 / 28 |
| `line-booking-owner-approval-replay-failclosed.test.js` | 5 / 5 |

The parent launches the absolute Node executable with a fixed child path, static mode/case IDs, explicit TAP reporter, 30-second timeout, 2 MiB output bound, hidden Windows window, and literal environment. It rejects a missing/duplicate attestation, nonzero positive leaf, pending/denied attempts, missing TAP totals, skipped tests or unhandled failures. Regression mode requires each allowlisted test file directly in its own guarded leaf; `node:test` runs within that process. Subprocess and worker creation remain blocked, with no descendant exception.

## Environment and egress controls

Only `LANG`, `TZ` and, on Windows, the non-secret OS key `SystemRoot` are eligible to enter the child launcher. The synthetic poison test supplies a parent-shaped object containing dummy provider configuration and `NODE_OPTIONS`; the launcher ignores every application/preload field. It does not read real application environment values. Windows supplied additional OS defaults at startup despite the literal environment; the bootstrap enumerates/deletes all non-allowlisted key names before imports, without reading their values. Attestation records key names only.

Scenario configuration is a fixed source literal added after that scrub. Application key names (never runtime values in evidence):

```text
LINE_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN
KK_LINE_BOOKING_AUTOMATION_ENABLED
KK_LINE_INITIAL_OUTBOX_V1_ENABLED
KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET
KK_ADMIN_SCRIPT_URL
KK_ADMIN_API_KEY
KK_OWNER_LINE_USER_ID
KK_CUSTOMER_LOGIN_ENABLED
KK_LINE_LOGIN_PROVIDER_VERIFIED
KK_CUSTOMER_AUTH_MIGRATION_VERIFIED
KK_LINE_LOGIN_PROVIDER_ID
KK_CUSTOMER_AUTH_SUPABASE_URL
KK_CUSTOMER_AUTH_SUPABASE_SERVICE_ROLE_KEY
KK_INBOX_SUPABASE_URL                    (MOCK inbox only)
KK_INBOX_SUPABASE_SERVICE_ROLE_KEY       (MOCK inbox only)
```

Before application/test imports the child denies the default global fetch and public HTTP/HTTPS, raw socket/listener, TLS, HTTP2, DNS (including promise/resolver), UDP factory/Socket constructor/send/bind/connect, child-process and worker entry points; WebSocket/EventSource are blocked when present. Common filesystem read/open APIs deny `.env` variants and named credential paths, including bare relative forms. The guard closure records attempts even if application code catches the resulting exception. Original network functions are not exposed to application code. No `.env`, credential value, native secret store, browser, listener or external service is used by the scenarios.

Scenario fetch is subsequently replaced by a strict in-memory router. Options and headers are parsed inside a denial-counting boundary before route lookup; malformed input is a safe `FIXTURE_REQUEST_INVALID` denial. It matches exact URL/query, method, relevant headers and payload validation, has exact per-case call budgets, rejects redirects and fixture exhaustion, and has no original-fetch fallback. Webhook and poster share the same feed URL; exact User-Agent selects their distinct fixture counters. Responses are memory CSV/JSON/PNG. Counters contain route aliases only; request bodies, authorization headers, user IDs and signed postbacks are not printed.

Existing regression files retain their existing injected synthetic mocks, including tests that intentionally replace/restore global fetch or throw provider errors. Their empty strict-router counters are not proof of exact routing inside those old mocks. Their individual attestations establish clean bootstrap plus zero attempted lower-level/default-fetch egress in each selected process. These are controls for the audited trusted handler/test dependency graph, **not an OS sandbox or containment of hostile arbitrary code**, alternate runtimes, native addons, or pre-existing handles.

## Scenario readbacks

Route counts below are accepted fixture calls; rejected attempts are counted separately. `GAS_ACTION` dispatches the actual initial-outbox VM helper's readiness/create/claim/settle functions, preserving Node envelope checks. `POSTER_API` is a direct in-memory invocation of the actual API handler using the hero URL captured from the validated customer Flex; it is not a network route.

| Scenario | Events / packages / auth / GAS | Push / reply | Inbox profile / RPC / read / write | Result |
|---|---|---|---|---|
| DISABLED inbox, same signed event replayed | 2 / 2 / 2 / 8 | 1 / 1 | 0 / 0 / 0 / 0 | One Booking, original pair, synthetic states `SENT,SENT`; poster API 1, poster feed 1, PNG 1 |
| MOCK inbox, image + booking replayed | 2 / 2 / 2 / 8 | 1 / 1 | 4 / 4 / 2 / 2 | Two inbox duplicates; duplicate image still downloads/archives; same initial pair |
| Hidden or ambiguous event | 1 / 0 / 0 / 0 | 0 / 0 | 2 / 2 / 1 / 1 | No Pending; inbox persists/archive independently |
| Unavailable package | 1 / 1 / 0 / 0 | 0 / 0 | 2 / 2 / 1 / 1 | No Pending |
| Missing or mismatched consent | 1 / 1 / 1 / 0 | 0 / 0 | 2 / 2 / 1 / 1 | No Pending |
| Lost settlement acknowledgement | 2 / 2 / 2 / 8 | 1 / 1 | 0 / 0 / 0 / 0 | Original persisted owner receipt retained; only customer resumes |
| Uncertain provider outcome | 2 / 2 / 2 / 6 | 1 / 0 | 0 / 0 / 0 / 0 | `UNCERTAIN,READY`; no reclaim/resend |
| Settlement never committed | 2 / 2 / 2 / 6 | 1 / 0 | 0 / 0 / 0 / 0 | Actual VM claim remains `CLAIMED,READY`; no manual ledger mutation/resend |
| Confirm / Reject (separate Bookings) | 3 explicit decision mock calls each | 1 / 1 | 0 / 0 / 0 / 0 | Wrong actor blocked, same decision replay silent, conflicting terminal readback rejected; customer push precedes separate owner reply |

Raw wrapper checks use streamed bytes and real HMAC with the fixed dummy key: non-POST 405, invalid signature 401, signed malformed JSON 400, body over 1 MiB 413, changed raw bytes 401; all have zero fixture calls. Body/query/header fixture-target strings cannot select another target. The actual raw-body wrapper supplies the verified signature flag internally; no scenario calls `processEvent` with a fabricated verified flag.

One WebReady fetch occurs per inbound booking, with no cache across events. Canonical fixture price overrides the synthetic customer text price. Receipt lookup binds signed user, provider and current Terms version. Inbox asserts exact normalized message, profile/persist/image ordering and archive bytes. Poster API asserts PNG bytes, content type and length. Replays preserve original Booking/request/outbox identities and frozen context hashes; already-saved message hashes remain unchanged while a previously unclaimed leg may acquire its first hash.

Baseline fixture SHA-256 readbacks:

| Fixture | SHA-256 |
|---|---|
| Visible events CSV | `11c2a5b5fd4497cc2d0a8c7312dbbfe14d414bf7dca9e2f87bf882166fc90bf6` |
| Available packages CSV | `5c900246f75eff2725ec71fcb1b867b2544e70570b61de9e1ecd0c3f4fde8596` |
| PNG bytes | `6b1048f8a6d40bac0b2954c18fefa40c4ea7a96120fc2e54b7317c0e43c2bbec` |
| Combined fixture set | `b7fc523c6a72a520b7c6880a38870215e55f04fe1b14fca4d96843d1938cc2ef` |
| Baseline frozen context | `129e639de3ead160ffb7015ce39e3beaf4cdf061d7ba1182564c36a85bedf4dc` |

Fresh repeated children produced equal fixture/context hashes. Variant event/package hashes are emitted per case. Dates, events, prices, policy witnesses, keys and receipt IDs are synthetic fixtures and are not current business truth.

## Pending and limits

`FULL_OFFLINE_GUARDED_REGRESSION_PENDING`: broad regression was not run. Existing broad suites include subprocess work and an additional poster ACL command; safe bootstrap, file-access bounds and separate attestation of all descendants were not established in this four-file scope. Default descendant denial was not relaxed. This is a remaining engineering gate, not full-regression acceptance.

Initial VM evidence uses synthetic Sheets/properties/DocumentLock stubs; it does not establish native GAS transaction/lock/schema behavior. Confirm/Reject uses an explicit **Node-contract mock upstream** because the initial VM helper has no decision API. Existing guarded decision/outbox tests supply separate synthetic evidence; the new runner does not claim full native decision integration or four durable receipts per Booking.

No A+D2 access/invocation/writes, real OAuth issuance, LINE/provider delivery or rendering, external image/CDN fetch, Sheet projection, all-writer isolation, natural runtime, owner UAT, Restore, activation, hosted CI, push, merge or deploy occurred. E06/E08/E09 setup/E10/E11 and Release Hold remain open. Future native/provider work must first refresh current live Machine SOT and the highest compatible Active `_Policy_Registry`, and obtain its separately required authority. Local synthetic `SENT` states are never provider `SENT`/`DELIVERED` claims.
