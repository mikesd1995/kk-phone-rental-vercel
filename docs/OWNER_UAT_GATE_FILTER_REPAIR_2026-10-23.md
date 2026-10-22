# Owner UAT gate lookup repair — 23 October 2026

## Change plan and scope

The owner requested diagnosis and repair of the failed Telegram test without
resending, exact Make6176241 / native database / Sheet ACK reconciliation, and
returning the sender to OFF. This source repair addresses the first failing
boundary only: the existing Edge handler's exact native UAT gate lookup.

Expected files are the existing Edge handler, its executed-handler regression,
and this dated record. Change the standalone PostgREST equality value from a
quoted/escaped string to the original key after `eq.`. Keep URLSearchParams as
the query encoder. Do not add a new endpoint, consumer, signer, database schema,
Apps Script helper, sender, scheduler, or alternate authority.

Preserve the existing exact one-row/key/enabled checks; allowed production or
preview Vercel JWT identity; immutable binding hash and audit join; five-minute
gate lifetime; post-operation gate readback; fixed RPC allowlist; provider
receipt CAS; native ACL/RLS; and zero provider sends by this Edge function.

## First failing boundary

The runtime investigation supplied by the release planner observed the actual
gate row through a native nonquoted lookup, while the Edge's quoted standalone
lookup returned HTTP200 with an empty array at 2026-10-22T19:04:36.843Z. The same
execution then returned403 before enqueue. These observations do not establish
a provider send or ACK.

The old test double returned the configured gate regardless of its query value.
It therefore masked an incorrect query. Standalone `eq` consumes the entire
value following `eq.`; extra quotes and doubled backslashes become part of the
compared text. Quoting rules for `in.(...)` or logical expressions do not apply
to this scalar filter. The narrow parser behavior is documented in PostgREST's
[v12.2.12 query parser](https://github.com/PostgREST/postgrest/blob/v12.2.12/src/PostgREST/ApiRequest/QueryParams.hs)
(`pRequestFilter` with `pSingleVal`). URLSearchParams still percent-encodes the
complete value, so reserved characters cannot add query parameters.

## Verification plan and evidence boundaries

First strengthen the native-HTTP double to select rows using standalone `eq`
semantics. Execute the actual transpiled Edge handler against normal IDs and
IDs containing quotes, commas, Unicode, backslashes and URL/query syntax, with
an unrelated valid gate present. Observe RED against the old handler before
changing production source. Then apply the one-line lookup correction and run
the focused Edge / owner bridge regressions plus the full repository suite and
poster ACL checks. The context pack requires full regression for this runtime
authority boundary.

Independent review and fresh live readback remain separate release gates. A
local green test does not establish an installed Edge repair, successful Make
execution, durable ACK, exact Sheet projection, device delivery, natural
Scanner/Verifier operation, or whole-project closure. No resend is authorized
by this document or by the source regression.

## Local verification outcome

The first executed-handler run against the old source was RED:5 passed and14
failed out of19 tests, including all seven normal/reserved-character cases.
After the one-line correction, the final focused owner Edge / bridge / gateway /
ACK regression passed176/176. Independent review requested explicit refusal
when only a different valid gate exists; both a normal missing ID and a
query-shaped missing ID now reject before any RPC. A separate production-owner
case admits its exact enabled production gate and rejects the disabled gate.

On Node24.13.1, final `npm test` passed2160 source tests and29 poster ACL checks,
with zero failures, cancellations or skips. Context-selected targeted tests
passed91/91, the changed test file passed syntax validation, and `git diff
--check` found no whitespace defects. RED and all GREEN logs are retained in
`outputs/kk-owner-ack-release-20261023-0115/`. These are local source results;
hosted CI, installed runtime repair and provider ACK acceptance remain separate.

The exact corrected Edge source SHA256 is
`e11308449f6a2ee6052ccd2d28e1ed64716158aca5b8e39df1d12de83c481e3b`.
The production-source diff changes only the scalar equality filter line. No
source commit, external mutation, fixture creation, provider send, or ACK
projection was performed by this implementation task.
