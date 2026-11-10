# Safe OAuth rejection diagnostics implementation plan

> **For agentic workers:** Use the repository code-change/debugging/review workflow and test-driven implementation. No production release or live diagnostic is part of this plan.

**Goal:** Preserve a bounded Google token HTTP status and fixed error enum in the existing authenticated OFF health rejection response, without exposing provider content or changing dispatch authority.

**Architecture:** Keep generic gateway503/GAS_HEALTH_OAUTH_REJECTED/send_allowed:false. On a known non-2xx token response, retain only an integer HTTP status100..599 (otherwise null) and an exact enum from a fixed allowlist (otherwise unknown). Read the rejection body through the existing16KiB/UTF-8/JSON/deadline reader; parse/size/content-type failures fall back to unknown. Closure-owned rejection metadata preserves the known rejection boundary if its body stalls until the existing10second deadline.

**Tech stack:** Existing CommonJS Node>=20, fetch/Response/AbortController, node:test. No dependencies.

**Authority:** Current owner explicitly requests code preparation and review with no repeated health. User opted out of clarification. Source-only branch from deployed16b; no merge/deploy/grant/token/health/Make/provider calls. Independent review remains a release gate; delegated agents currently fail with usage-limit errors, so do not invent an independent PASS.

## Global constraints

- Existing consumer authentication, OFF/readiness/store/project/deployment/adapter binding gates unchanged.
- Preserve10second overall deadline,16KiB response limit, one token request, no retry, no GAS call after rejection, no console/log/telemetry output.
- Output only oauth_http_status and oauth_error_code on the known rejection path. Never output raw body, error_description, error_subtype, headers, client ID, tokens, secrets, hashes, stack or arbitrary error text.
- Exact enum matching: invalid_request, invalid_client, invalid_grant, unauthorized_client, unsupported_grant_type, invalid_scope, access_denied, server_error, temporarily_unavailable, deleted_client. All other strings/types become unknown.
- Do not trim credentials, rotate keys, add scopes, create replacement modules or re-enable senders. Existing success response and unrelated errors remain unchanged.

## Task1 — bounded rejection metadata

Files: server/make-owner-canonical-off-gas-probe.js and tests/make-owner-canonical-off-gas-probe.test.js.

- [x] Add integration-level tests first for allowed enums/status, unknown/malicious values and no leaks/no retry; run and retain expected red failure.
- [x] Implement closure-owned primitive metadata and minimal rejection-result constructor; no arbitrary Error-property reflection.
- [x] Test malformed/non-JSON/invalidUTF8/declared and streamed oversize bodies; known rejection remains503/genericcode and safe unknown diagnostic.
- [x] Test known non-2xx stalled body with mocked timer: deadline cancels once, no retry/GAS; known status plus unknown enum preserved. Existing successful-response timeout behavior unchanged.
- [x] Verify invalid status values cannot be reflected; extra provider fields/descriptions/credential canaries/hashes never appear or log.
- [x] Re-run existing auth/OFF/binding/provider/native side-effect guards and all success contracts.
- [x] Run targeted test and syntax checks, then full npm test because this changes an authenticated diagnostic response/security boundary.
- [x] Review the final diff through kk-code-review as a distinct pass. Record independent-review quota blocker honestly; do not release without independent acceptance.
- [x] Evaluate engineering gate with actual source/test/review evidence; no runtime/release success claim. Preserve a reviewable source candidate and detailed handoff.

## Observed implementation result

- Probe integration tests:20/20; Code Intelligence-selected tests65/65; full regression2516/2516 plus poster ACL29/29. Zero failures/skips. Both edited JavaScript files parse; npmcheck and diffcheck exit0.
- Existing13 probe cases retained;7 new cases cover exact whitelist, arbitrary values/secret canaries, malformed/oversized/invalidUTF8 responses, status typing, stalled rejection deadline, no logging/native/GAS side effects, and unchanged non-rejection responses.
- Distinct implementer review found no material issue in this minimal diff; it is not independent acceptance. Delegated review and fresh policy assistant attempts failed at account usage limit. Engineering gate is BLOCKED: INDEPENDENT_REVIEWER and RELEASE_READBACK missing. No deployment, merge or live health is performed.
- Google Account UI shows an existing KK Phone Rental Backend grant with Sheets/Drive/offline descriptions. Canonical client was previously listed as enabled in its project. No credential values or client IDs read. The Secret-stored token's client/grant binding remains UNKNOWN; display labels cannot prove it.
- Fresh readback: Make6176241 inactive/on-demand/original15/no34/all11OFF/lastEdit2026-11-05T17:14:43.756Z unchanged; Production remains exact16b/8vwc READY and canonical alias matches. No operational state changed.
- Evidence packet: outputs/kk-oauth-safe-diagnostics-20261106 outside the checkout. Candidate source is local only; no branch push/PR or preview deployment is implied.

## Separate read-only binding check

Inspect existing owner Google account's grant entry and declared client metadata only. Do not read/copy client IDs or credential values, exchange/refresh/revoke tokens, approve warnings or grant/revoke access. A matching app name/scopes is metadata proof, not cryptographic equality with the Secret-stored refresh token. Retain UNKNOWN when that equality cannot be established without prohibited I/O.

## Validation limits

Mock tests do not repair/reconstruct historical0da Google error or prove current OAuth works. Production remains8vwc/exact16b, Make15/no34/11OFF. New code is not approved for deployment by the old16b approval.
