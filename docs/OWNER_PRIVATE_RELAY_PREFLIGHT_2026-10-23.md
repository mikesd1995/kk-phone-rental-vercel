# Local exact-data guard for the private owner relay

The actual finite Make 6176241 attempt rejected Prepare before the Telegram provider module. Root's retained readback identifies a private UI extraction mismatch: the original native owner-test descriptor text has 100 characters and SHA256 `b5a18b1001d1b107dcda420a49fd56bf6838b6cee5f9ff7a89d93f57e4fe628d`, while the captured debugger text had 101 characters after a display ellipsis U+2026 was appended. This establishes an exact-data failure boundary. It is not a Telegram provider rejection or proof that any other signed field was accepted.

`scripts/kk-owner-relay-preflight.js` is a local reusable CommonJS operator helper. It has no CLI side effect, network, provider, credential or signing function and is not imported by production code. It does not change the existing transport protocol, GAS admission/send/finalizer/V2 grant, native gates, Make scenario or historical pending identities. It cannot repair an expired descriptor or grant another test.

Call `assertExactOwnerRelay(envelope, native, {now})` immediately before handing the existing signed envelope to the same Make consumer. The independent native anchor must contain exactly these ten enumerable string data properties:

```text
consumer_id source_notification_id notification_id request_id entity_id
content_version text text_sha256 created_at expires_at
```

Native provenance remains a separate operator qualification. Never build the anchor from the captured UI object, treat a caller-provided hash as independent evidence, or reuse the historical 100-character sample as a current signed capability. The consumer is pinned to `6176241`; the source is a canonical lowercase `KKUAT_TG_` UUIDv4; all three transport identities must exactly equal their native values and base64url derivation from that raw source ID.

The envelope must have exactly eleven enumerable string data properties, fixed owner-only version/audience/event type, exact native content version and text, raw UTF8 text SHA256, exact original Created/Expires timestamps in canonical UTC millisecond form, TTL at most 120 seconds, no more than 15 seconds future skew and at least 45 seconds remaining. Unknown keys, symbols, accessors, hidden required fields, nonprimitive values and malformed Unicode are rejected. No field is trimmed, Unicode-normalized, stripped of ellipses, replaced, coerced, renewed or re-signed. A legitimate ellipsis that exactly matches the independent native text and hash is accepted unchanged.

Signature is checked only for its existing 64-lowercase-hex shape. This helper has no signing key and does not verify HMAC. Its frozen return contains safe metadata with `status: LOCAL_RELAY_MATCH_ONLY`, `signature_verified:false` and `provider_sends:0`; there is deliberately no send_allowed field. Any thrown error uses only a constant code and never echoes text, signature, credential, recipient or the envelope. Existing real Prepare authentication, durable claim, single provider attempt, durable ACK and exact Sheet projection remain mandatory.

Regression coverage includes the actual 100-character Thai fixture plus debugger-added U+2026, legitimate matching ellipsis, whitespace/Unicode changes without repair, every missing envelope field, both native and UI identity/content/timestamp changes, malformed shapes/accessors, original TTL/clock skew and the exact 45-second boundary. Local tests do not establish a positive provider call, Telegram ACK, natural Scanner/Verifier acceptance or whole-project closure.
