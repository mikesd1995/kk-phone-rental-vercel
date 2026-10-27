# Canonical owner notification intake (OFF preparation)

Authority: current Machine SOT / Active GLOBAL policy v4.9.44, refreshed 2026-10-25. See the private implementation packet LIVE_IMPLEMENTATION_PREFLIGHT.json for exact policy rows. This specification covers source development, not runtime activation.

## Required behavior

Use the existing Make scenario 6176241, gateway route and KK Agent project. Add a canonical protocol distinct from controlled UAT v1. Do not replace the storefront, CRM, LINE sender, Scanner or Verifier. Keep every transport, activation and UAT switch OFF. No old-row replay, fixtures, provider requests, production DDL, deployment, Make edits, GAS saves or protected merge are authorized by this source task.

Separate three clocks: immutable business CreatedAt; fresh authenticated observation/claim; original signed transport descriptor expiry. Business CreatedAt must be at or after a trusted activation cutoff and not in the future. It need not be in the current poll slot: normal alerts held 23:00–07:00 must be eligible later under the same identity. Observation/claim age and original descriptor TTL remain at most 120 seconds, future skew at most 15 seconds. Never re-age a row or renew an attempted envelope.

Poll context is server/database-derived, single-use, bound to the same consumer 6176241, policy and trusted immutable activation epoch. Poll every 900 seconds; no alternate runner or backlog replay. A bounded poll returns authenticated tickets; Make admits each ticket just in time. No claim is consumed during quiet hours. Pending unclaimed rows remain queued for a later poll; claims with ambiguous results remain fenced for reconciliation.

Reuse the existing GAS ScriptLock, exact full-row comparison, dedup witnesses, normal candidate rules, message renderer and ACK projector. Invoke only fixed functions on the same Apps Script deployment using authenticated Execution API, devMode false. Do not add public doPost or borrow private Core reader credentials. Signed GAS context and attestation use domain separation; credentials remain in provider secret stores. Default unbound/disabled configurations must fail before network or write.

Canonical durable storage is additive and isolated from v1 UAT guards/tables. Preserve immutable original source identity, payload, CreatedAt and dedup across attempts. Atomic native leases, claims, receipts and ACK/readback are required. Only definitive provider rejection may enter governed RETRY_WAIT with the same source identity after exact projection; accepted/unknown/expired attempted sends cannot be reset or resent. Do not add an automatic retry until this entire transition is implemented safely; an explicit reconciliation hold is required otherwise.

Canonical ACK must contain actual native provider receipt evidence joined to the reserved descriptor and consumer. Commit durable ACK before exact Sheet projection. A projection failure must permit readback/projection repair without another provider send. LINE remains on its established path and accepted requestID/messageID semantics. No claim that source tests prove provider delivery or natural runtime.

## Acceptance

Meaningful RED/GREEN tests for normal post-cutover rows, preserved CreatedAt, quiet-held rows, stale observation, original TTL, forged/cross-context tickets, concurrent/replayed claims, duplicate identity/dedup, ambiguous outcomes, ACK mismatch and projection-only recovery. Demonstrate default-OFF integration and unchanged UAT v1. Supply executable guarded Make configuration/migration preparation for the same scenario, including iterator/JIT admission and safe ACK projection. No runtime binding may be invented.

Full regression, independent review and a dated handoff are required. Report source completion separately from pending migration, deployment, secret binding, activation and actual Telegram/LINE ACK evidence.
