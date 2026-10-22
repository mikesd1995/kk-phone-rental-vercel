# Existing Tracker reader and exact ACK integration — 22 October 2026

This change connects the existing KK Agent source boundary to the installed
Telegram source-map/outbox functions. It does not enable canonical tasks or
normal notification delivery. The accepted storefront and CRM are unchanged.

## Corrected behavior

- The Tracker reader validates all 23 Ledger headers, preserves raw identifiers
  and payloads, checks the complete bounded source snapshot and scopes dedup to
  each channel. A row number is only a hint: claim and ACK phases locate the
  exact source again and compare all immutable fields and transport state.
- Claims and Sheet projections require the existing ScriptLock, flush and exact
  readback. Unknown provider outcomes stay unretryable. Provider acceptance is
  distinct from actual delivery to a device. A repeated exact Telegram ACK
  projection is read-only and can recover a local-property persistence failure.
- KK Agent makes authenticated outbound attestations, not a public Sheet reader
  or writer. Producer HMAC binds the fixed script, Tracker, channel, Make6176241,
  policy, timestamp, nonce and before/claimed source snapshots. No CRM keys or
  database keys are copied. Secrets must live in provider/runtime secret stores.
- The default-disabled Node gateway calls the existing native enqueue/readback,
  claim and ACK functions. Object RPC replies and legacy array replies have
  separate validators. Signed descriptors retain their original 120-second TTL.
- The existing Supabase OIDC Edge function gains typed owner-UAT operations.
  Existing operations still require Production identity. Preview owner-UAT
  requires the exact team/project JWT and a per-source native configuration gate
  matching immutable hash, audit provenance, environment and at most 300 seconds.
  No schema migration is added or replayed.
- A fresh, explicit, owner-only UAT fixture cannot enter the normal notification
  lane. The one-shot LINE helper disarms in `finally`, including lock-busy and
  preflight-error cases. It uses the existing LINE sender and recipient.

## Policy and runtime evidence boundaries

Fresh 08:25 Bangkok readback found one GLOBAL v4.9.44 and 458 Active rules.
Machine SOT `_Scan_Control` rows213/215 retain a narrow controlled acceptance
path: existing consumer, exact new ID, global transport OFF, fresh health/lease,
real provider receipt, exact Ledger readback and disarm. This is not a general
exception to the normal business-only/no-debug channel policies. Historical
HOLD and old queued rows are not released or re-aged.

The live KK Agent source was captured before editing and the reviewed Core plus
outbound bridge was installed into the same existing script. Reload/clipboard
readback matched the reviewed concatenation exactly after CRLF normalization:
`e3d6e2ea4c636b58e0011c7f29bdac4710ccaf2005a50df9ac166050095a715f`.
The original source was unchanged before installation:
`552ac41a13f8e5eaf07527fbaf3d4efcbcb365f55c4de92148bf674cc324df73`.
At 08:30 global transport was OFF, UAT disarmed, LINE configured and the single
existing `runKKLineMonitor` trigger present. A fresh single-LINE acceptance test
then obtained a real provider message/request receipt at08:41:29 and exact Sheet
readback of SENT/attempt1/HTTP200. At08:47 the global gate was still OFF, UAT
disarmed and that same single trigger present. Delivery Confirmed remains blank;
this proves API acceptance and same-row persistence, not delivery to a device.
Exact private IDs and screenshots are retained in the local evidence packet.

Make A6176241 is being repaired in place on its existing on-demand finite-test
interface. Its old direct row-number Sheet writers are removed with a saved
configuration backup. A zero-provider GET diagnostic executed successfully
(`663bb68804564eb38117a95f46d0bd45`) and returned the real gateway HTTP405 JSON;
the scenario was returned inactive. A denial is not a signed claim or ACK.
The approved Prepare response now exposes only its original signed expiry and
the staged Telegram filter requires more than15 seconds remaining. It stays
disabled pending deployed source/binding and actual provider acceptance.
The Telegram connection remains10356915. Make B5988323 remains inactive.

Native pre-deployment readback retained source-map0/outbox0/enabled-UAT-gates0.
Provider ACKs, hosted CI, Preview binding/authentication, exact final Make graph
acceptance and natural Scanner→Verifier→Sheet delivery require separate evidence.
Do not infer any of these from local tests or installed source.

## Validation and limitations

Independent focused review ran101 tests with zero failures/skips. Full local
regression after the expiry fix ran2131 source tests plus29 ACL checks, all passing.
Actual Node20.20.2 ran2128 source tests and29 ACL checks before the additive expiry
fix, and then its72 focused tests, all passing. The Windows Node20 shell
does not expand the existing npm wildcard; an explicit-file child-process run
was used and its failed wildcard/command-length attempts are retained.

Edge-handler tests execute the actual TypeScript source with the development-only
TypeScript5.9.3 compiler, pinned in a clean lockfile. Seven existing workflows
that run the full suite install the pinned dependencies with lifecycle scripts
disabled. No runtime import of TypeScript is added.

The finite snapshot limit is128 rows/262144 bytes. Admission uncertainty blocks
fresh fixtures until reconciled; no reset/resend is implied. Delayed readback
after gate expiry requires separately admitted authenticated recovery. A finite
UAT is not normal POLL900 integration or natural pipeline acceptance.

OpenAI case17503357 still had six messages at08:25. The video remains SENT;
there was no new cause-specific Scanner correction. Both exact canonical tasks
remain governed by the existing pause/cause-evidence boundary. No new task,
clone, replacement scheduler, watchdog or repeated restore is introduced.
