# Owner Ledger code-context retrieval — 24 October 2026

The local Code Intelligence router previously matched `owner-ledger` only through
the generic `ledger` keyword. It returned the runtime/invocation-ledger subsystem
and omitted the actual KK Agent owner bridge, provider ACK and private relay
boundaries. Generic Apps Script routing also described the Admin backend rather
than the existing `apps-script/kk-agent/OwnerLedgerBridge.gs` source.

The additive `owner_ledger_transport` route requires a specific subsystem name,
owner transport function/helper, existing Make 6176241 consumer or explicit Thai
owner-ledger/transport phrase. Bare Telegram, ACK, notification/send words and
generic Supabase, Admin or Apps Script tasks do not select it. Its tests cover
the existing source bridge, Sheet ACK, local exact-data relay, signed transport,
durable gateway, planner and OIDC owner gate.

A mixed `owner-ledger Supabase database migration ACK` request reproduced a
second boundary: generic database keywords ranked higher, consumed the context
budget and omitted the real transport handler and contract. Optional finite
numeric route priority now breaks that ambiguity before the existing score and
route-ID ordering, and the same priority precedes the existing candidate-file
score ordering for directly curated files. Incidental dependencies receive no
priority. Only the owner route sets priority 10; absent or invalid
priorities behave as zero and existing routes retain their prior ordering when
the explicit owner route does not match. The route also explicitly requests full
regression, while the previous built-in full-regression rules remain enforced.

The default limits remain 12,000 estimated tokens, ten selected files and ten
targeted tests. The five bridge/relay/handler/contract/durable-bridge boundaries
come first. The actual OIDC Edge source follows with its remaining budget and a
symbols/targeted-ranges read strategy, including `ownerGate`. Core and planner
paths remain curated but cannot all fit in the same pack. Inspect those exact
paths separately when their functions are needed; never enlarge the global
budget to hide a route defect. Tests and the benchmark reuse one real repo-map
snapshot per case batch; production retrieval continues to build its usual map.

The checked-in benchmark includes English, Thai, path, function, mixed-database
and both Make-consumer spellings. Optional negative route/file expectations now
fail the benchmark when excluded context is retrieved even if positive recall
is 100 percent. Existing fixtures without exclusions keep their previous meaning.

This change is local source retrieval and regression coverage only. It adds no
runtime dependency or production caller and grants no send, admission, retry,
fixture, credential, business write, merge or deployment authority. Runtime,
provider delivery, durable ACK, Sheet readback and natural Scanner/Verifier
acceptance remain separate evidence gates.
