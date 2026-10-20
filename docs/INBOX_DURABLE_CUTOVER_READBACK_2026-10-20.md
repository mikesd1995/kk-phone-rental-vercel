# Inbox durable-send prerequisite cutover — 20 October 2026

The owner authorized a temporary Inbox-send hold, draining legacy requests, bounded database repair, and conditional integration/release of PR #766. This record describes the actual database cutover and its limits. It does not certify provider delivery or canonical Scanner/Verifier runtime.

## Production identity and atomic migration

- Supabase project: `mxjnjujqjybqughsnqbz` (`kk-unified-inbox`, Primary connection), actual PostgreSQL **17.6**.
- Native applied migration version: **`20261020021900`**, name `kk_inbox_outbound_reservations_owner_review_20261020`.
- Apply receipt: **20 October 2026 09:19:00 Asia/Bangkok**; native history and catalog subsequently read back.
- Exact independently reviewed SQL payload: **24,397 bytes**, SHA256 `ac232002734dcb20b4c2e1d7e04e5c18da4e3563bcd8767fae1020e994610320`.
- Source guard commit: `3283351f3f3ebd4f0b4723cc53d778bf24b4b2da`.
- The payload includes only the reviewed durable-reservation and owner-review migration files, with explicit BEGIN/COMMIT, a deterministic transaction advisory lock, bounded lock/statement timeouts, and pre/post assertions. The existing base/media migrations were not replayed.
- Native history records this combined application. Do not blindly replay the two draft source migrations merely because their individual source filenames differ from the combined native history version.

The wrapper rejects pre-existing targets, unexpected default privileges, stable RPC drift, incorrect role/database identity, or changed private-media configuration. Its final assertions reject public access, excess service privileges, obsolete reserve overloads, or unexpected pre-release attempts. A forced late failure was independently tested to roll back the complete additive change.

## Legacy writer boundary

The canonical production alias was moved to the exact send-only HOLD source `1526dedde1fb26eb3283c317051e7fd9cfd831ca`, deployment `dpl_AiqiB4bguhkEUvtPJHHSqM9FLx4W`. Existing authentication runs before the maintenance denial; other Inbox reads/inbound paths remain available.

Canonical legacy admission was closed by 09:03:17 Bangkok. The authenticated Vercel resource page for the previous deployment showed the actual `/api/kk-admin-guard` maximum duration of **300 seconds**. The minimum drain deadline was 09:08:17; the schema migration began at 09:18:59. Old deployment/branch URLs denied anonymous access through SSO; authorized owner access to an old URL was not revoked. Make A/B senders and writers remained inactive. No old application events were observed in the inspected post-HOLD log window; application logs are not an exposed active-invocation counter.

This is the controlled operator boundary for known writers. An elapsed timeout does not establish a provider outcome. No ambiguous legacy request is automatically replayed or fabricated into a SENT/receipt record.

## Resulting database contract

The database now has **14** exact Inbox RPC signatures. Definitions, pinned search paths, security-invoker configuration and role grants of all **nine existing** RPCs were preserved. The private media bucket remains private, with its existing 8 MiB and JPEG/PNG/GIF/WebP limits.

The additions are the RLS-enabled private `inbox_outbound_attempts` table and five service-only RPCs:

| RPC | Responsibility |
| --- | --- |
| `kk_inbox_reserve_outbound(uuid,text,text,uuid,text)` | Transactional request/content reservation and governed intentional-repeat checks |
| `kk_inbox_finish_outbound(uuid,text,text,text)` | Preserve provider identities; require exact persisted receipt before SENT |
| `kk_inbox_list_outbound_attempts(text,integer)` | Bounded owner reconciliation read without HMAC/retry-key exposure |
| `kk_inbox_review_outbound(text,uuid,text,text,text)` | Evidence annotation; cannot retry uncertain sends or invent delivery |
| `kk_inbox_has_legacy_outbound(text,text)` | STABLE boolean read over the complete 30-day legacy history |

PUBLIC, anon and authenticated cannot execute these RPCs or access the private table. The service role has only SELECT/INSERT/UPDATE on the new table, with no DELETE/TRUNCATE/REFERENCES/TRIGGER authority. The obsolete three-argument reservation function is absent.

The server calls the legacy boolean reader before reserving or calling LINE. A historical match returns `409 / INBOX_LEGACY_OUTBOUND_REVIEW_REQUIRED`; missing, failed or malformed evidence returns `503 / INBOX_LEGACY_OUTBOUND_UNAVAILABLE`. Only primitive `false` permits the existing durable-send path to continue. The complete history has no newest-200/UI pagination cutoff. Historical payload UUIDs are compared as text rather than cast. No synthetic attempt rows or delivery claims are imported from historical messages.

## Verification and actual readback

- Reviewed source regression: **1978/1978**, separate poster ACL **29/29**, targeted **32/32**, syntax/invariants clean.
- Independent targeted **32/32**, embedded SQL **39/39**, exact-live-nine/minimum-two proof **8/8**, exact atomic payload/rollback/precondition proof **5/5**.
- Embedded SQL uses PostgreSQL **18.6 / PGlite 0.5.10** and is distinct from the hosted **PostgreSQL 17.6** checks below.
- Actual production catalog and `service_role` acceptance at **14:48:12–14:48:13 Bangkok** found all 14 signatures, new five bodies matching source, invoker/pinned-search-path/least-privilege settings, four private RLS tables and an empty new ledger.
- A **READ ONLY** transaction called the real legacy reader on all **three** eligible existing historical rows; all were detected. It read attempts for an existing LINE conversation and received an empty array. It exercised four all-NULL early guards for reserve/finish/review/legacy; all returned the exact expected exceptions before any persistent write. The transaction ended with ROLLBACK and an aggregate-only result was retained.
- Within that actual acceptance transaction, counts remained **55 conversations / 389 messages / 414 audit rows / 0 attempts** before and after. These differ from the morning 54/376/401 snapshot because live inbound activity continued between snapshots; no claim is made that diagnostics caused those intervening business changes.
- Provider calls, synthetic business rows and business-write statements in hosted acceptance: **0**. Catalog/SQL execution does not prove HTTP PostgREST cache, customer delivery or provider ACK.
- Security advisor after DDL reported only the existing INFO category `rls_enabled_no_policy` (now eight private/service-only tables), with no WARN/ERROR finding in that response. Public policies were not added to bypass the intended service-only boundary.

The accepted storefront remains byte-identical across its 19-file manifest, digest `2b970d7e749e61207bb664b52a565f6c819e8abcae46e418a76cbdf1433e5c00`. The Header/Hero is unchanged. Actual hosted CI, protected merge, final deployment source, runtime routes, eight-width production captures and Inbox reopening require their own subsequent receipts.

## Compensation and release boundary

On an uncertain migration response, inspect native history/catalog before retrying. After this successful additive commit, retain the ledger/schema and repair forward; do not delete durable reservations or receipts.

Before a new durable send is admitted, an aborted cutover can restore the accepted prior storefront/backend deployment only after confirming no new attempts/in-flight durable requests. After durable sending opens, rollback first returns to the reviewed HOLD, drains requests, preserves ledger evidence and reviews compatibility. Never directly reopen the unreserved legacy sender beside pending durable work.

Scanner/Verifier, Sheet business writes and notification-provider acceptance remain separately governed by the live Machine SOT and attributable-cause policy. A successful Inbox migration or storefront release does not close their runtime acceptance.

Detailed native receipts, reviewed payload, failure history, test logs and source identities are retained in `outputs/kk-db-runtime-closure-20261020/` outside the repository checkout. Earlier sealed release evidence was preserved.
