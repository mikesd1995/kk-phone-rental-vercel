# Finite real acceptance source contract — 2026-10-29

This default-OFF source preparation limits the existing canonical Make 6176241 / private GAS / LINE path to one genuine matching future event pair and at most one provider attempt per channel in a finite round. It adds no runner, Scanner, queue, provider route, database schema or scheduled task. The current storefront and CRM are outside this diff.

## Configuration and durable ownership

`KK_OWNER_REAL_ACCEPTANCE_ENABLED` defaults FALSE. An explicit FALSE alone with no round metadata preserves ordinary behavior. Any manifest, state or source pin is a sticky fence: missing/disabled/malformed/expired/CLOSED configuration cannot return to broad sending. No reset or cleanup API clears that fence.

The exact twelve-field manifest is validated by `server/make-owner-real-acceptance.js` and `apps-script/kk-agent/OwnerRealAcceptance.gs`. `KK_OWNER_REAL_ACCEPTANCE_SOURCE_SHA` is a nonsecret trusted approved-source pin; it must equal the manifest source SHA. GAS owns `KK_OWNER_REAL_ACCEPTANCE_STATE_JSON` under the existing ScriptLock; the gateway must never mirror that mutable state. Only manifest, enable flag and source pin are mirrored. Secrets remain in the existing provider stores.

The first-cutover contract uses slot `1`, unchanged activation time T0, due T0+900 seconds and expiry due+120 seconds. Source Created At must remain genuine and at/after activation; it is not reset or assigned a false 120-second lifetime. The original signed descriptor TTL and >15-second provider margin remain separate checks.

GAS freezes one exact eligible Telegram/LINE pair from the full bounded snapshot, persists each consumed right before its Sheet claim, and retains consumption after uncertainty. The existing LINE sender has a further durable start fuse immediately before provider fetch. The signed canonical request and response bind round ID, manifest digest and deadline. A deterministic UUID places the round and immutable source hash in the existing claim binding; the native 16-field context, 15-element binding and transport envelope are unchanged.

## Make source compiler

`server/make-owner-canonical-real-acceptance-stage.js` prepares the actual 15-module graph and its inverse using exact snapshot/last-edit checks. It preserves all IDs, old legacy configuration, connection references, error route, on-demand schedule and OFF flags. It attaches canonical input to the existing Start module and temporarily substitutes round-control inputs for the UAT business envelope. Ticket-count, round-deadline and original-TTL filters supplement server/GAS checks.

The compiler is pure local source. Its local patch simulation is not a Make engine result. It explicitly reports unresolved connector-interface opcode/filter-removal semantics; descriptors must not be submitted as an unverified connector call. Actual installation requires supported schema confirmation, fresh CAS readback and independent review under a separate owner-approved release.

## Completion boundaries

Automated tests and independent source review establish source behavior only. They do not prove deployed GAS parity, native cutover, actual Make execution, provider acceptance, durable ACK, Sheet projection, natural Scanner/Verifier runtime or owner acceptance. Existing exact receipt projection can remain available after the sending window closes, without new provider rights.

No production merge, deployment, configuration write, GAS invocation, Make run, provider send, old replay, Scanner/Verifier restoration or policy change is authorized by source tests or this document. Operational execution remains blocked until the current live policy supplies compatible authority and every release/runtime/readback gate is satisfied. Close the round by stopping new provider rights first, reconciling only exact existing receipts, then restoring verified OFF while retaining CLOSED/consumed artifacts. Do not delete or reset state to retry.
