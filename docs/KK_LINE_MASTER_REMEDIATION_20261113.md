# KK Phone Rental — LINE remediation and release handoff

Date: 13 November 2026, Asia/Bangkok. Incident: [#861](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/861).

**RELEASE HOLD. Source remediation is not Production acceptance.** No merge, Production deployment, real feature activation, customer message, real Booking/Owner Lock edit or live database migration was performed. One LINE Console **empty-event webhook verification** was performed; it returned **Success**, without a booking event or outbound message.

**Latest source follow-up:** [KK_LINE_REMEDIATION_FOLLOWUP_20261113.md](KK_LINE_REMEDIATION_FOLLOWUP_20261113.md) records newly reproduced private-source, canonical-recipient, capacity and network-deadline corrections, full local repository verification, fresh read-only live evidence and remaining gates. Its current #875 commit/check readback supersedes the baseline exact-HEAD CI below. Historical provider verification below was not repeated.

**Further gate work / owner steps:** [PR875_OWNER_RELEASE_GATES_TH_20261113.md](PR875_OWNER_RELEASE_GATES_TH_20261113.md) records the later default-ACL SQL correction (native12/12), fresh missing LINE Login channel and intentional no-auto-Preview findings, the owner's still-unselected DB target, safe catalog checks and exact LINE/Supabase/GAS staging steps. Release Hold persists.

## Exact source and PR coordination

Continue existing integrated [#875](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/875), branch `feat/line-booking-release-candidate-20261112`. Do not create another integration PR or merge the overlapping donors separately.

| PR | Discovery HEAD | Relationship and disposition |
| --- | --- | --- |
| #856 | `6ef986b62ceb42a9bc9d1385e94f47179c37bd25` | Auth/consent donor; all 10 changed paths overlap #875. Its old SQL acceptance defect must not be reintroduced. |
| #862 | `f3274ce7dd51c72bf8d98518955be9c131ed3604` | Reply diagnostics donor; webhook and tests overlap. Preserve current integrated diagnostics and shared WebReady fetch. |
| #868 | `916ba3bca0d34f37cfc00a1e3eb0ee18b1095aa8` | Clean message/first-visit UI donor; all 18 paths overlap. Browser acknowledgement alone is not verified identity consent. |
| #870 | `a6ba5dc2fb6a0069169693fdb0b4ea89306eebe3` | Full-path test donor. Its scenarios are adapted to current identity and durable-outbox behavior in the existing integration test, rather than copying obsolete fixtures. |
| #871 | `94617a8bc0f659f1b240eda8edfb5d1acbd0a3f3` | Original primary candidate; all 42 changed paths overlap #875. Keep as donor/reference, not a competing release. |
| #875 | `8972a3255fc288a850fddb44f5115b55779a49ad` | Integration baseline at session start. |

Session commits:

- `e163cdfe1faac7a3f620dbe10120f4d039c16142`: native SQL test and existing-CI wiring; proved original PostgreSQL failure.
- `277f4f9e58eea1eb0be39c661ae4dad4aa39b142`: initial explicit-constraint correction.
- `752f31cf3966c0ecc8cca4ee7727883055d9aec5`: matching unique-constraint guard; all eight exact-HEAD workflows passed, native 10/10.
- **`1a926aeab853638698f6b2d472547e020855b4bc`**: final runtime/test correction. Preserves old-schema compatibility, blocks legacy recipient disclosure and initial-notification replay; adds signed full-path tests.
- This handoff may be a later documentation-only commit. Resolve the current #875 HEAD and its checks again; the final #861 comment and current PR body record exact-HEAD acceptance. Do not use an older green SHA as current acceptance.

## Proven defects and final repairs

### Consent acceptance failed only when SQL actually executed

`kk_customer_terms_accept` returns columns named `provider_id`, `line_user_id` and `terms_version`. Its `ON CONFLICT` target used those same unqualified names, causing PostgreSQL **42702**, ambiguous `provider_id`, on the first real acceptance. Existing JavaScript tests mocked the RPC or inspected SQL text, so they did not detect it.

Witness: [Actions #43295709740](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/43295709740), job `131453370863`, native first-acceptance failure. Seven native cases passed; the acceptance case and two receipt-dependent checks failed.

The first named-constraint correction was also tested against an already installed schema with a different unique-constraint name. That reproduced **42704**. The final repair uses **`#variable_conflict use_column` only inside this function**, retaining the original unique index inference. All other table reads remain `s.`/`e.` qualified and request/local variables remain `p_`/`v_` prefixed. No global PostgreSQL setting or schema-constraint rename is required. Fresh install, repeated installation and pre-existing constraint names all pass.

`scripts/test-customer-auth-native.mjs` runs the actual migration in disposable PGlite 0.5.11. It verifies first acceptance, immutable replay, cross-device receipt reuse, provider/user/version isolation, rejected affirmation, expiry/revocation, anon/authenticated table and RPC denial, RLS and security-invoker functions, and legacy-constraint upgrade. **11/11 passed locally.**

### Legacy decision path could disclose a booking to a group or room

The non-outbox path checked only that canonical `customer_contact` was nonempty. A group/room ID or malformed string could reach LINE with the booking ID. It now shares `LineIdentity.isUserId` with intake and durable delivery. Invalid recipients raise the existing fixed `LINE_CUSTOMER_CONTACT_READBACK_REQUIRED` code before either customer push or owner acknowledgement. Group/room targets remain available only for the separately configured owner destination.

Regression: approve and reject with group, room, malformed and non-hex customer recipients. The test failed before the change and now proves zero LINE sends. Positive fixtures use valid, synthetic provider-format user IDs; negative cases retain malformed IDs.

### Initial webhook replay repeated owner cards and customer replies

`Intake.canonicalResult` discarded canonical `idempotent_replay`, so the webhook resent both notifications even when Apps Script had reused an existing Booking. It now preserves a strict boolean, with unknown/stringified metadata represented as `null`. Only explicit `false` authorizes initial notifications.

Replay or unknown metadata produces **`PENDING_DELIVERY_REVIEW_REQUIRED`**, `requires_manual_delivery_review:true` and an allowlisted warning without booking IDs, customer identifiers, reply tokens or text. It does not resend a push or consume the reply token. The original first-attempt send error still propagates; it is not hidden or relabeled as success.

**Important residual boundary:** this is duplicate containment, not automatic delivery recovery. A crash after Pending creation but before initial owner/customer delivery still requires canonical/manual reconciliation. There is no durable initial-notification receipt proving either send. Do not claim that replay was notified, recovered or delivered; do not turn on webhook redelivery to compensate. The post-decision durable outbox remains a distinct path.

### Full-path integration coverage

The existing `tests/line-identity-owner-outbox-integration.test.js` now executes the actual signed webhook handler through verified receipt lookup, canonical price/package resolution, one Pending, signed owner card, authorized Confirm/Reject, durable preflight/claim, provider acceptance receipt, canonical settlement, owner ACK and repeated owner decision. It rejects invalid signatures and signed non-owner decisions. Both decisions pass with synthetic fetch boundaries; unknown external calls fail the fixture.

The existing Booking E2E workflow explicitly executes these integration and owner privacy/replay tests. The existing canonical SQL workflow executes the new native consent probe. No new CI workflow or application dependency was added.

## Changed files in this session

- Runtime: `supabase/kk_customer_auth_v1.sql`, `server/line-booking-intake.js`, `server/line-booking-owner-approval.js`, `server/line-booking-webhook.js`.
- Verification: `scripts/test-customer-auth-native.mjs`, `.github/workflows/canonical-owner-v2.yml`, `.github/workflows/booking-e2e-acceptance.yml`.
- Tests: `tests/kk-customer-line-auth.test.js`, `tests/line-booking-intake.test.js`, `tests/line-booking-owner-approval.test.js`, `tests/line-booking-owner-approval-replay-failclosed.test.js`, `tests/line-booking-owner-approval-upstream-privacy.test.js`, `tests/line-booking-inbox-safety-integration.test.js`, `tests/line-webhook.test.js`, `tests/line-identity-owner-outbox-integration.test.js`.
- Documentation: this handoff and `docs/superpowers/plans/2026-11-13-line-consent-remediation.md`.

Customer-facing UI and message generators were not edited in this session. The integrated candidate already removes both trailing legal lines at the booking/waitlist message origin; TH/EN prefill, legal-copy and identity fail-closed regression was rerun. The current Production storefront still serves the older main code.

## Verification commands and evidence boundaries

```sh
npm run code:context -- "LINE customer consent booking webhook owner approval"
npm run code:test -- "LINE customer consent booking webhook owner approval"
node --test tests/kk-customer-*.test.js tests/kk-booking-terms-evidence.test.js tests/line-booking-*.test.js tests/line-webhook*.test.js tests/line-identity-owner-outbox-integration.test.js
node scripts/test-customer-auth-native.mjs
npm test
npm run check
```

- Local exact-ref source snapshot: **163/163** scoped Node tests passed; code-intelligence command **2/2** passed. The context pack was incomplete for this cross-subsystem task, so explicit bounded auth/LINE suites were added. The snapshot is not a complete local repository clone; do not call its `npm test` a full-repository run.
- Native command requires `PGLITE_MODULE` pointing at pinned `@electric-sql/pglite@0.5.11/dist/index.js`, or that exact installed package. CI installs it in runner temporary storage, outside repository dependencies. **11/11** passed, including upgrade behavior.
- Full-repository `npm test`, syntax and native acceptance run on GitHub's exact checkout. Source commit Booking [#43346518546](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/43346518546) explicitly executed **90/90**, including both signed full-path cases. Canonical [#43346518563](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/43346518563) is the native/full-regression evidence. Final current-HEAD readback is recorded in #861.
- Mocked provider/GAS and disposable SQL success are not live provider, multi-session lock contention or deployed Supabase proof.
- Storefront CI generates phone/desktop and responsive evidence. Prior exact-head technical visual/interaction checks passed while `owner_visual_acceptance:BLOCKED`, `screenshot_review:BLOCKED`, `release_ready:false`. A green visual job does not remove those gates. No new UI layout change was introduced here.
- Independent agent review reproduced the recipient, replay and migration-compatibility defects. All three were corrected with RED→GREEN guards. It is not independent GitHub approval; submitted APPROVED reviews remained zero at readback.

## Fresh LINE provider evidence — no customer sends

The owner-connected LINE Official Account Manager and Developers Console were inspected. Do not confuse the separate **KKPhoneAgent** account with **KK Phone Rental**.

| Binding | Observed value |
| --- | --- |
| Shop official account | KK Phone Rental, `@827blnmo` |
| Actual shop Messaging API channel | `2011794771` |
| Provider | KK Agent, `2005383568` |
| Other channel under that provider | KKPhoneAgent, `2010860976` |
| LINE Login channels under the inspected provider | None in the two-channel inventory |
| Shop webhook destination | `https://kk-phone-rental.vercel.app/api/line-webhook` |
| Use webhook | ON |
| Webhook redelivery | OFF |
| Error statistics aggregation | OFF |
| LINE Console Verify, empty `events` | **Success** |

The official verification request contains no webhook event. This establishes signed inbound connectivity for the actual shop channel; it does **not** validate the deployed access token's Reply API permissions or prove customer/owner delivery. No Verify retry, test customer message, postback, credential reissue or channel setting change was performed. Secrets and personal identity values must never enter repository evidence.

Recent Vercel 30-minute error-log queries returned no matching reply-failure logs. That is not historical root-cause resolution. The actual status/category of the reported `LINE booking reply failed` remains unknown; do not invent an expired-token/401/400 explanation.

## Live database, writer and configuration evidence

- Production alias still resolves to READY deployment `dpl_2CyyhK7vyUm2cUMeiDzEgBdSBN2n`, GitHub main `735bbf7c159df7f2fd6b93e5324df131727f91c9`. No session commit is deployed there.
- Production env **names** `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `KK_ADMIN_SCRIPT_URL`, `KK_ADMIN_API_KEY` exist. Values were not decrypted or transferred.
- Owner automation/user binding, dispatcher flags/credential and customer-auth configuration names remain absent from the inspected Production inventory. Candidate Preview has no provider credentials for a positive provider E2E.
- Active connected `kk-unified-inbox` project `mxjnjujqjybqughsnqbz`: catalog query found neither customer auth table; migration inventory did not contain this migration. This is not authority to choose Inbox as the customer-auth database. RLS/security advisor output showed informational no-policy notices for existing server-only tables; those notices alone are not proof of unsafe access.
- Read-only metadata for the current **KK Phone rental backend** showed 31 tabs and no `19_Line_Decision_Outbox`. No Booking rows or customer data were read to perform this check. Deployed GAS source/version, private outbox schema and credential parity remain unverified. Do not create a competing tab or execute an installer without the governed staging/release process.

Required environment names, values supplied only through approved secret management:

```text
LINE_CHANNEL_ACCESS_TOKEN
LINE_CHANNEL_SECRET
KK_ADMIN_SCRIPT_URL
KK_ADMIN_API_KEY
KK_LINE_BOOKING_AUTOMATION_ENABLED
KK_OWNER_LINE_USER_ID
KK_OWNER_LINE_TARGET_ID                 # optional explicit owner destination
KK_LINE_APPROVAL_SECRET                # optional dedicated secret; legacy fallback exists
KK_LINE_OWNER_OUTBOX_V1_ENABLED
KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET
KK_CUSTOMER_LOGIN_ENABLED
KK_LINE_LOGIN_CHANNEL_ID
KK_LINE_LOGIN_CHANNEL_SECRET
KK_LINE_LOGIN_PROVIDER_ID
KK_LINE_LOGIN_CALLBACK_URL
KK_LINE_LOGIN_PROVIDER_VERIFIED
KK_CUSTOMER_AUTH_SESSION_SECRET
KK_CUSTOMER_AUTH_SUPABASE_URL
KK_CUSTOMER_AUTH_SUPABASE_SERVICE_ROLE_KEY
KK_CUSTOMER_AUTH_MIGRATION_VERIFIED
```

The public `KK_CONFIG.customerLoginEnabled` opt-in must be coordinated with backend readiness. Never use the separate Messaging API secret as an invented LINE Login channel credential. Verify a real Login channel under provider `2005383568` and exact callback `/api/kk-customer-auth?action=callback` on its approved HTTPS host.

## Migration and rollback procedure — prepared, not executed

1. Establish the owner-approved customer-auth project and staging environment. Capture existing schema, functions, privileges, migration history and a protected backup. Inspect for incompatible pre-existing objects; do not overwrite unknown schemas.
2. Review the final `supabase/kk_customer_auth_v1.sql` and native upgrade proof. Execute it through the approved migration process against the selected staging target, not an arbitrary connected project. No application route auto-creates schema.
3. In that authorized target, verify service-role RPC acceptance/readback, exact identity/version binding, expiry/revocation, anon/authenticated denial and security advisors. Use only approved synthetic/test identities; no real Booking writes.
4. Approve Terms-evidence retention, access audit and lawful erasure policy before activation. Opaque sessions have a seven-day application TTL, but expiry is not physical deletion. Evidence retention and expired-session cleanup require the approved existing maintenance path; no new runner is silently installed.
5. Verify deployed GAS version against the integrated source and #852 stock dependency. Snapshot Booking/Owner Locks and outbox schema, use the owner-private governed installer, validate dispatcher parity, then stage full-path tests. The source outbox creates intent before decision and requires one-time claim and concrete provider receipt; preserve that order.
6. Independently review the accepted exact SHA, complete provider/owner UAT, visual acceptance and owner release acceptance before coordinated release. Do not activate flags independently merely to get a green result.
7. Rollback first stops new automation through its governed controls and preserves all existing bookings, consent evidence and delivery receipts. Keep flags off, reconcile `CLAIMED`/`UNCERTAIN` or `PENDING_DELIVERY_REVIEW_REQUIRED` manually, and restore the approved known-good application artifact only under release authorization. Never delete evidence or replay legacy sends to manufacture recovery. A source revert is not permission to drop auth tables.

## Release gates and next session

| Gate | Actual boundary |
| --- | --- |
| Source code review | Independent agent review completed; findings corrected and covered. |
| Independent GitHub reviewer approval | **BLOCKED: zero submitted APPROVED reviews.** |
| Exact-HEAD CI | Read current #875 HEAD and #861 final acceptance; never inherit a donor/older green SHA. |
| Supabase migration verified | **BLOCKED: target authority and live migration/readback absent.** Disposable SQL passes. |
| LINE provider configuration | Inbound shop channel/destination/empty-event verification passed; **Login/provider and Reply-token ownership/permissions still require acceptance.** |
| Customer reply verified | **BLOCKED: no real authorized test-account reply receipt; original provider failure category unknown.** |
| Owner Confirm/Reject verified | Signed full-path mocks pass; **live owner/provider/GAS UAT blocked.** |
| Booking idempotency | Canonical source/fixtures and notification replay containment pass; **live readback and durable initial-notification recovery still required.** |
| Owner Locks | Existing canonical guards preserved; **live deployed-source/lock acceptance remains required.** |
| Rollback plan | Prepared above; protected backups and operational rehearsal still required before release. |
| Responsive/visual acceptance | Automated technical evidence exists; independent screenshot/owner acceptance remains blocked. |
| Owner release approval | **HOLD until the above actual gates pass and exact-source acceptance is recorded.** |

Next session: read this document, #861 latest comments and #875 current body; fetch exact main/#875 and current checks. Continue on #875 only. Verify same-provider Login and the intended DB/GAS identities before provisioning. Preserve all OFF defaults. Obtain a safe redacted Reply API status or authorized test-account validation, reconcile existing Pending before any recovery, and resolve durable initial-notification evidence without adding a competing outbox. Then complete private staging, independent GitHub review, visual/owner acceptance and release readback. Do not close #861 or claim the user's Production Definition of Done until real LINE Booking, consent and owner approval are witnessed on Production.

References: [PostgreSQL function-local variable conflict behavior](https://www.postgresql.org/docs/current/plpgsql-implementation.html#PLPGSQL-VAR-SUBST), [LINE empty-event webhook verification](https://developers.line.biz/en/docs/messaging-api/verify-webhook-url/), [coordinated release contract](LINE_BOOKING_COORDINATED_RELEASE_HANDOFF_20261112.md).
