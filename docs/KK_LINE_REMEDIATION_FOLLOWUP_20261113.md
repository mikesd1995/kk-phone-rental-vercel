# KK LINE remediation follow-up — source ready for independent GitHub review

13 November 2026, Asia/Bangkok. Tracking [#861](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/861), integrated candidate [#875](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/875).

**RELEASE HOLD. Production Definition of Done is not satisfied.** This follow-up continues #875 baseline `11e3eace5dcf4c384e7767a8ce7a9aa9008c6318`; it does not create a competing PR. Resolve current #875 HEAD and exact checks before action. Baseline discovery CI is historical after this follow-up is pushed.

## Reproduced defects and minimal corrections

1. **Private customer source:** a valid user ID within a group/room event could create Pending in Login-OFF automation. Both webhook admission and the canonical intake payload now require `source.type === 'user'` before any consent lookup, Pending or owner Push. Missing/unknown source also fails closed. Existing private-chat correction text is reused; explicit configured owner group/room destinations remain valid. Positive test fixtures now use actual provider event shape.
2. **Canonical recipient format:** Apps Script accepted non-hex inherited customer IDs, committed the Booking, then JavaScript refused delivery. One Apps Script helper applies the exact `U` plus 32 lowercase hex contract before INTENT/Booking mutation and claim. Malformed inherited Pending remains unchanged. Immutable recipient/request binding and document locking remain intact.
3. **Outbox capacity:** at exactly 20,000 rows a new INTENT could append row 20,001, commit the Booking, then fail claim. The shared capacity check also blocked existing settlement. New-intent admission now rejects `lastRow >= 20000` before mutation. Existing INTENT/replay/claim/settlement remains available above the cap, scanning IDs in bounded 1,000-row chunks with duplicate detection. Tests exercise 19,999/20,000/20,001 and settlement after legacy overflow. This does not authorize pruning, importing or any live ledger change.
4. **Unbounded transport:** public canonical lookup, GAS action, LINE reply/owner send, receipt-dependent Push and Inbox profile could wait until platform termination. One six-second absolute deadline now covers fetch and any consumed response body, passes an abort signal and races independently of transport cooperation. No automatic retry is added. Post-claim timeout attempts UNCERTAIN settlement and never acknowledges owner success. Existing fixed redacted error classifications and event-local single WebReady read remain.
5. **Dependency audit:** the installed `@vercel/functions@3.9.8` chain reported four high audit entries through OIDC/config/Zod. An exact `3.11.2` pin and matching lockfile update resolve those reported entries; Zod resolves to 4.6.7. Existing rewrite/OIDC import and routing regressions pass. This is dependency audit evidence, not proof that every application security risk is eliminated. [Reviewed advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

No new application runtime dependency, scheduler, outbox schema, API endpoint, feature flag or business write path was introduced. The shared deadline is reused by the existing transports.

## Files changed

- Runtime: `apps-script/Code.gs`, `server/line-booking-intake.js`, `server/line-booking-webhook.js`, `server/line-booking-owner-approval.js`, `server/kk-line-messaging-api.js`, new `server/line-booking-deadline.js`.
- Dependency: `package.json`, `package-lock.json`.
- Tests: new `tests/line-booking-network-deadline.test.js`; existing `tests/line-booking-intake.test.js`, `tests/line-booking-locked-intake-v4.test.js`, `tests/line-booking-owner-approval.test.js`, `tests/line-booking-owner-durable-outbox.test.js`, `tests/line-webhook.test.js`, `tests/kk-booking-terms-evidence.test.js`, `tests/static-route-precedence.test.js`.
- CI: `.github/workflows/booking-e2e-acceptance.yml` includes the helper/adapter trigger paths, helper syntax and deadline regression in the existing job.
- Documentation: this follow-up, the master-handoff pointer and `docs/superpowers/plans/2026-11-13-line-remediation-followup.md`.

## Executed verification

Local Node 24, complete repository checkout, exact Git blob bytes for archival/hash-sensitive files. Initial Windows CRLF checkout caused provenance/CSP comparison failures and missing installed TypeScript caused two test-file failures; locked dependency installation and exact-blob local restoration corrected the environment. No provenance/CSP assertions were relaxed. A later full run found one additional positive consent fixture missing `source.type`, corrected to `user`, and a mixed-line-ending archival candidate, restored byte-for-byte from Git. Final full run has no failures.

| Command / evidence | Actual scope and result |
| --- | --- |
| New identity/outbox regression before implementation | Expected RED: private-source, malformed inherited recipient, capacity admission and overflow settlement |
| Deadline regressions before implementation | 18 expected failures; all 20 final cases pass |
| `npm run code:test -- "LINE customer consent booking webhook owner approval"` | 86/86 local tests |
| Explicit bounded auth/LINE/webhook/full-path suites | 188/188 local synthetic tests |
| `npm test` | 2724/2724 Node tests plus 29/29 poster ACL tests |
| `npm run check`, new helper check, `vm.Script(Code.gs)` | Syntax checks completed without error |
| `node scripts/test-customer-auth-native.mjs` with disposable PGlite 0.5.11 | 11/11, including real first acceptance, immutable replay, provider/user/version isolation, expiry/revocation, role denial/RLS and existing-schema upgrade |
| `npm audit --json` | 0 reported vulnerabilities after the pinned update |
| Independent reviewer execution | 86/86 relevant synthetic tests; all four MATERIAL findings addressed; no remaining MATERIAL finding in reviewed content |
| Existing booking-agreement browser QA | Eight widths 320/375/390/430/480/768/1024/1440, TH first-entry and EN stale-version, no LINE requests; all sixteen screenshots inspected |

Local UX gateway `storefront_ux_review` and `storefront_visual_qa` were invoked with actual captured dialog widths/overflow and screenshot pointers; local invocation evidence was persisted. This proves only the sampled dialog interaction/fit. The local static page did not establish live event-data loading, authenticated identity consent, complete storefront/iOS acceptance or owner visual acceptance. No UI layout/source was changed here. Automated reviewer scores from partial metrics are not a complete visual acceptance score.

All mocked provider/GAS, disposable SQL and local browser evidence is separate from hosted exact-HEAD CI and live provider/Production verification. GitHub independent APPROVED reviews remain zero at fresh discovery. An independent agent content review is not a GitHub approval or permission to release.

## Fresh live discovery, 13 November 2026 17:19:03 Bangkok

- Canonical alias resolves to READY production deployment `dpl_2CyyhK7vyUm2cUMeiDzEgBdSBN2n`, main `735bbf7c159df7f2fd6b93e5324df131727f91c9`. This follow-up is not deployed.
- Vercel metadata used `decrypt=false`, names/type/targets only: 38 entries total, 29 production. LINE access-token/secret and Inbox URL/service-role key names exist. No credential validity, channel binding or flag values were established.
- Live Event Tracker `_Policy_Registry!A1:N2000` search was complete: 458 actual Active rows; one active global POLICY_VERSION, row 555 v4.9.44. Later scoped hardening through v5.0.6 preserves that global marker. No conflict identified with these local fail-closed hardening changes. No direct active customer-consent/private-chat rule was found; customer runtime authority remains unproven. Scanner/Verifier owner-alert rules do not authorize customer chat sends.
- Runtime ledger `zehlsagzrpromtfqqflt` is ACTIVE_HEALTHY: 19 public tables report RLS, 17 migrations. Separate Inbox `mxjnjujqjybqughsnqbz` is ACTIVE_HEALTHY: four public/four private tables report RLS, eight migrations. Catalogued public/private schemas contain no customer-auth tables. This does not prove absence across every project; the intended customer-auth database remains UNKNOWN. No target was selected.
- Schema metadata and migration history do not prove grants, customer access, native containment, quiescence, actual consent persistence, delivery, ACK or natural runtime. No customer rows or credential values were inspected.

## Migration, configuration and rollback

This follow-up adds no migration and no environment variable. The reviewed `supabase/kk_customer_auth_v1.sql`, same-provider LINE Login setup, exact callback, private GAS outbox installer/credential pairing, environment **names only**, retention/erasure decisions and staged acceptance procedure remain in [master handoff](KK_LINE_MASTER_REMEDIATION_20261113.md). Expired sessions have a seven-day application TTL; expiry is not physical cleanup. Do not choose a connected database merely because it is available. Do not install the competing #876 `19_Line_Delivery_Outbox` alongside #875 `19_Line_Decision_Outbox`.

Rollback preparation: before any separately authorized release, capture protected schema/Booking/Owner Locks/outbox baseline and known-good GAS/application identities. Stop new automation through governed controls, preserve all existing bookings/consent/delivery evidence, manually reconcile CLAIMED/UNCERTAIN or initial-delivery-review records, and restore only an approved artifact. A source revert must not delete consent tables or resend legacy notifications. No operational rollback or rehearsal was executed.

## Release gates / next session

| Gate | Current boundary |
| --- | --- |
| Source review / regression | Independent corrective review and local tests complete; bind to current commit and hosted checks |
| Exact-HEAD CI | Read current #875 checks after this follow-up; old `11e3eace` green checks do not cover new commits |
| Independent GitHub approval | BLOCKED: no submitted APPROVED review at discovery; never self-approve |
| Customer-auth DB / migration / RLS / retention | BLOCKED: intended target/authority and live acceptance absent |
| LINE Login/Messaging provider consistency | BLOCKED: same-provider Login and credential binding require owner/provider acceptance |
| Customer reply and owner Confirm/Reject | BLOCKED: no authorized real test-account delivery/decision receipt from this work |
| Live idempotency and Owner Locks | BLOCKED: deployed GAS identity, private schema/credential parity and live exact readback required |
| Initial notification recovery | HOLD: replay containment is tested; durable initial owner/customer delivery recovery is still absent, requires canonical/manual reconciliation, not blind replay |
| Visual/owner UAT, rollback rehearsal, owner release approval | BLOCKED pending actual acceptance |
| Production Definition of Done | NOT SATISFIED; keep #861 OPEN and RELEASE HOLD |

Next session: read this follow-up, master handoff, current #875 body and #861 latest update; fetch current main/#875 and exact checks. Preserve all donor coordination and no-production-write boundaries. First resolve owner-controlled same-provider Login, selected customer-auth DB/retention and deployed GAS/outbox identities. Obtain a safely redacted real Reply API failure category or an authorized test-account receipt through the governed staging process. Never diagnose the historical error as token expiry/401/400 without evidence; the new deadline is resilience hardening, not proof of that historical root cause. Complete independent GitHub review and all real gates before owner release acceptance.
