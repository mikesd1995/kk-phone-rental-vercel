# KK Private Core — Credential & Endpoint Rotation Cache Isolation
**2026-10-16 Asia/Bangkok — source-only patch in Draft PR #744. No merge/deploy or ACL changes.**

## Root cause
Private admin snapshot fallback cached a private service-account result under an identity key of `unset` whenever `KK_CORE_PRIVATE_TRANSPORT=service-account`. Two different service-account identities or a rotated PEM key were therefore allowed to reuse an earlier cached snapshot within the configured TTL. Apps Script mode hashed only `KK_CORE_PRIVATE_READ_KEY`, so switching the Apps Script `/exec` endpoint without switching the key also reused an earlier snapshot. Independently, the Google Sheets OAuth token cache fingerprint hashed **only the first 64 bytes** of the private key, which is not adequate to distinguish a same-prefix credential rotation.

## Minimal fix
- `server/admin-sheet-fallback.js`: bind cache key to the **complete service-account email+normalized private key**, or the **Apps Script URL+private read key**. Store only the SHA-256 digest; never include raw URL, email, PEM or key in the cache key or diagnostics. Preserve cache TTL, coalescing, read-only behavior and default transport settings.
- `api/lib/private-google-sheets.js`: OAuth token-cache fingerprint now hashes the **complete** normalized private key plus principal email; expose the pure fingerprint helper to Node regression tests. No remote auth or token request is triggered.
- `tests/admin-sheet-fallback-private-reader.test.js`: two rotation cases use synthetic credentials and mocked read-only fetches; they prove same-identity HIT, rotated-key/endpoint MISS and full 11 dataset fresh private re-read. Neither test sends network requests or customer values.
- `tests/private-google-sheets-credential-rotation.test.js`: pure fingerprint regression differentiates keys sharing the entire former 64-byte prefix.

## Acceptance status
This is SOURCE-ONLY regression hardening. In-isolate function/fixture tests do not replace **exact-head native Node CI**, real 13/13 private reader authenticated reads, anonymous-public-deny, Core 13-dataset content parity, Storefront/Admin/Revenue readback, or owner-approved Drive ACL cutover. The 13 header rows previously checked are schema-only evidence. Core remains Anyone/Reader and P0 Release **HOLD** (#49/#738). Do not enable credential cutover or Make/Scanner/LINE/Booking/price writes based on this change. No additional paid services, no CI-triggering automation, no GitHub merge or Vercel/Supabase deployment.
