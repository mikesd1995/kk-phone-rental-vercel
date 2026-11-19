# PR875 initial notification receipt and recovery — local source plan

Date: 2026-11-14. Branch: `fix/line-prebooking-recovery-local-20261114`.

Status: local source design and verification candidate. **RELEASE HOLD**. This document does not establish deployed source, provisioned schema, active configuration, provider delivery, visual acceptance, UAT, or runtime acceptance. No push, CI rerun, cloud edit, Restore, merge, deployment, activation, or provider send is authorized by this packet.

## Problem and bounded hypothesis

The current webhook creates canonical Pending, pushes an owner approval card, then replies to the customer. Canonical replay deliberately blocks both initial sends because a Booking row is not a notification receipt. A provider error or crash between these steps can therefore leave a real Pending booking with initial delivery requiring review.

Hypothesis: a separate default-OFF initial-notification ledger, written under the existing Pending writer's DocumentLock, can make previously unclaimed notification legs recoverable while preserving uncertainty after a possible provider send. Local mocks must demonstrate this claim; no live acceptance is inferred.

## Minimal source plan

1. Add a separate initial-notification dispatcher and narrow hooks in `processEvent`, `createPendingBooking`, and typed canonical intake readback. Preserve the existing customer Reply and owner Push methods, messages, and owner-before-customer ordering. No UI copy change is planned.
2. Extend the existing GAS Pending transaction with feature/schema/dispatch preflight, two durable initial intents before Booking mutation, existing exact A:T Booking readback, and exact READY readbacks before acknowledging the request.
3. Add authenticated readiness, claim, and settlement actions with sanitized audit/error handling. Leave the existing decision outbox and its schema unchanged.
4. Add local Node and GAS VM regression cases; run the selected tests and full regression because the change crosses a canonical business-write boundary. Obtain independent review before calling the local candidate accepted.

## Source contract

Version: `KK_LINE_INITIAL_OUTBOX_V1`. Both producer and consumer flags are `KK_LINE_INITIAL_OUTBOX_V1_ENABLED`, default OFF. The dedicated `KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET` must be distinct from the generic admin credential. GAS pins the owner destination to `KK_LINE_INITIAL_OUTBOX_OWNER_TARGET`, validated as a provider-shaped U/C/R destination; the customer destination remains the canonical private LINE user contact.

Proposed private tab: `20_Line_Initial_Outbox`. This name and schema are source proposals only; provisioning and activation are not approved here. Never auto-create or rewrite a live tab.

Exact 14-column header:

```text
outbox_id,booking_id,kind,state,claim_key,provider_message_id,provider_request_id,recipient,request_id,context_json,context_hash,message_hash,updated_at,created_at
```

Kinds: `OWNER_APPROVAL_PUSH`, `CUSTOMER_PENDING_REPLY`. Actions: `lineInitialOutboxReadiness`, `claimLineBookingInitialDelivery`, `settleLineBookingInitialDelivery`.

The server builds bounded, flat notification context before creating Pending. Its exact fields are `version`, `event_name`, `event_date`, `venue`, `poster_image_url`, `package_name`, `price_display`, `nickname`, `phone`, `pickup_time`, `terms_status`, and `terms_version`. GAS stores the raw JSON and its SHA-256 hash, pins context and recipients to the allocated booking/request identity, and returns a typed `initial_outbox` envelope. Message rendering uses that pinned context and canonical booking ID. Claim also pins the rendered message hash. Credentials, signing keys, Reply tokens, and raw provider response bodies are excluded from persisted records and diagnostics.

In durable mode, Pending readback always exposes `idempotent_replay: true`, including the fresh transaction, to fence consumers that lack the new outbox contract. The enabled server must consume the typed envelope instead of interpreting this field as notification completion. Readiness and producer-mode compatibility must fail closed before Pending mutation when either side, its credential, schema, or configured recipient is incompatible.

## Transaction and recovery invariants

- Keep the existing canonical Pending writer, request identity, document lock, A:T exact readback, and payment/asset restrictions. No second writer or replacement runner is introduced.
- Under that same lock: preflight; durable request-mode marker and allocated Booking identity; both INTENT exact readbacks; Booking write and exact readback; completed request claim retaining the mode and identity; both READY exact readbacks before exposing the typed response. If the process stops after the request is marked OK, replay still requires the matching initial marker, both original intents and exact canonical Pending evidence before reconciling INTENT to READY. An OK request alone grants no delivery authority.
- Only READY grants a one-time claim. Persist and exactly read back CLAIMED with its claim key and message hash before reaching LINE. Owner Push uses that saved UUID as its provider retry key. Customer Reply does not use a Push retry header, does not persist its Reply token, and requires the owner leg to have canonical SENT evidence.
- SENT requires a concrete provider message ID bound to the saved claim plus exact settlement readback. A generic HTTP success, local UUID, Booking replay, or claim response is not a receipt. Provider request IDs are supplemental receipt metadata.
- A repeated saved claim and the same concrete provider receipt may reconcile settlement only. CLAIMED or UNCERTAIN never authorizes an automatic provider reread or another send. No claim lease, timeout reset, new retry key, or replay sender is introduced.
- Historical requests without the durable mode marker and matching ledger intents remain missing/review-required. Never backfill their notifications from a Booking row. Duplicate IDs, recipient/context/message drift, malformed receipts, missing fields, or a booking that is no longer Pending block a new send.
- Recovery preserves per-leg evidence: owner SENT/customer READY skips owner and may claim the never-claimed customer leg with an available authenticated webhook Reply token. An ambiguous owner leg blocks the customer leg. Neither missing evidence nor uncertainty is reported as SENT.

## Required local verification

Node mocks and the GAS VM harness must cover default-OFF compatibility; mixed producer/consumer versions; wrong schema/credential/owner binding; both intents preceding Booking mutation; crashes around Booking and READY writes; exact-readback failure; one-time claims; owner-before-customer fencing; replay and historical missing-marker behavior; changed canonical status; context/message/recipient drift; duplicate IDs; provider rejection/timeout/missing receipt; uncertain claim or settlement; and exact receipt settlement replay without provider resend. Assert that tokens, credentials, Reply tokens, private context, and provider bodies do not enter diagnostic output. Existing decision-outbox behavior remains a regression boundary.

Local tests cannot establish schema provisioning, actual bindings, provider acceptance, customer receipt, visual/UAT acceptance, or production runtime behavior. Those gates and release remain HOLD.

## Local implementation and observed verification

- [x] Separate default-OFF initial ledger, canonical Pending hooks and typed producer/consumer fence.
- [x] One-time owner Push and customer Reply claim/receipt/settlement, preserving the existing message builders and owner-before-customer order.
- [x] Context/recipient/request/package-type/claim/message binding; 6,000 UTF-8 context bytes and 8,500 UTF-8 request-property bytes; no historical backfill or claim reset.
- [x] Node mocks, real GAS functions in a VM, and combined Node-to-GAS-VM integration with synthetic LINE responses.
- [x] Independent Node and whole-candidate source review, followed by correction and re-review of all material findings.
- [x] Guarded full local regression, targeted regressions, poster-ACL fixtures and syntax checks.
- [ ] Actual isolated A+D2 setup/native acceptance, provider receipts, rendered LINE/owner UAT, rollback acceptance and release readback. These remain unauthorized and HOLD.

Observed final local results: **2,766/2,766** repository tests passed with no skips; the additional combined new-outbox/poster-ACL run passed **71/71**. The new outbox coverage comprises 19 Node cases, 17 GAS VM cases and 6 combined integration cases. The Code Intelligence targeted runner passed 68/68. `npm run check`, explicit new-module syntax and full GAS syntax compilation passed. The existing decision-outbox/decision-writer source range was compared directly to base `38adcbe7c9d91d2e397bb286932cfa0f0b91a338` and is unchanged.

Test processes were guarded against actual network sockets, unmocked fetch/HTTP/TLS and non-Node/shell child execution. Ambient provider configuration and credential variables were removed from the test process by variable name without inspecting their values. Fixtures used synthetic identities, storage, credentials and receipts. No CI rerun or actual provider/GAS/Supabase request was used.

Independent review identified and verified corrections for three material boundaries: a changed owner render/signing key cannot unlock another leg from an old receipt; a hidden/unavailable public snapshot cannot escape to the generic Reply on durable replay; and a lost authenticated terms receipt cannot issue a false no-Booking message or unledgered Reply. The final source re-review reported no unresolved BLOCKER or MATERIAL issue within this local scope. Two standalone private-reader fixture regressions discovered by the first full run were corrected in the `doPost` local classifier without changing those tests.

The frozen display context remains the admitted Node public snapshot, **not an atomic GAS-recomputed quote**. Changed snapshots, rendering, terms evidence or canonical identity conservatively stop recovery for review. Receipt-only settlement may acknowledge the same claimed provider receipt after a fast confirmed/cancelled owner decision; this never permits another send. Claims still require Pending/unpaid/no-assets with the pinned identity and package type.

The registered local UX review was recorded but BLOCKED, and Visual QA remains insufficient without authorized LINE rendered evidence. This is local source verification only, not GitHub APPROVED, visual/UAT acceptance, runtime acceptance or release approval. Engineering release acceptance must remain BLOCKED while RELEASE_READBACK is absent.

Transport reference: [LINE retry documentation](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/) distinguishes supported Push retry keys from Reply; [LINE message response documentation](https://developers.line.biz/en/docs/messaging-api/get-quote-tokens/) describes `sentMessages` returned by Push and Reply. The candidate requires a concrete message ID and canonical receipt settlement; provider acceptance itself does not prove customer delivery/read status.
