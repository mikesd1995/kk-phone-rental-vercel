# KK Phone Rental — guard against false LINE booking acknowledgements
Date: 2026-11-12 ICT | Source parent: Draft #871 exact SHA `98a91f1f291284589cf8b0de0a1fd230484340e7`

## Scope of minimal change
In signed LINE webhook identity-on automation mode, a booking can be canonical/bookable while the private Terms evidence is absent, mismatched, expired, unsigned, or unavailable. The existing code correctly refuses to create `Pending`/owner card but incorrectly sends the **generic** Flex `ร้านได้รับคำขอเช่าแล้ว`. This can induce customers to believe a booking is held and stop checking availability, increasing support debt and duplication risk.

This fix returns immediately from the `TERMS_EVIDENCE_REQUIRED` path with one short text **`ยังไม่ได้บันทึกคำขอจองค่ะ`** and explicit instructions to open the official site, connect LINE and affirm current terms, then resend the request or ask the shop to check. Does not falsely say acceptance was rejected when the store is merely unavailable. Does not duplicate either legal attestation footer line, does not echo any private LINE ID, secret, or receipt. No `Pending`, owner card, stock, Owner Lock, or booking record is created in this branch.

## Tests
Adds assertions to the existing `tests/line-webhook.test.js` missing/foreign/invalid consent receipt loop. Each verifies:
- exactly one customer Reply API call, zero Booking writer calls and zero owner pushes;
- response is actionable `type:'text'`, not a generic accepted-looking Flex;
- message clearly says request **not saved**, directs customer to authenticated site, and contains no repeated Terms-version footer.

Success path with verified receipt is untouched; default-OFF/legacy mode is untouched; no new API endpoint, no database schema, and no package dependencies.

## Integration / Safety Gates
Source is stacked on **#871** to avoid changing an actively worked-on branch. This is **not** a substitute for #871 full identity/Terms persistence. PR should be merged into #871 only after exact-HEAD Booking E2E acceptance, independent reviewer, and host owner coordinated release. Do not merge it independently into main; it depends on #871 receipt path. Production remains under the separate #871/#855 owner release gates: same LINE Provider, secure OAuth/channel, Supabase schema/RLS, real backend receipt, owner UAT and human visual approval. #861 LINE Reply delivery incident is separate and unclosed; provider errors not diagnosed by this synthetic patch.

Rollback: revert this focused two-file change before release; no data/schema/production changes.
