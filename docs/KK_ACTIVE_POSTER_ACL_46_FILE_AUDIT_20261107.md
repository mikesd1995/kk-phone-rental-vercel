# KK Phone Rental — Active Poster ACL Evidence — 2026-11-07

**Classification:** READ-ONLY SECURITY FINDING, **not** a completed remediation. **Risk P0.**
**Execution ownership:** Isolated ChatGPT audit lane; no Codex branch or shared source/config modified.
**Observed Production/source baseline:** `d4bd11f6ff78f67f41b79a26448d036007737701` (#840, preserving bilingual #844).

## Fresh evidence and precise scope

Read from the original visible-event data `08_Web_Ready!A4:K480` on 7 Nov 2026, filtered by `action_for_web in [show, show_full]`:
- **106** live visible event rows (including owner-full/waitlist cards).
- **46** distinct Google Drive poster **file** references, across some repeated event days.
- **48** non-Google-Drive poster URL rows (not covered by this Google Drive ACL audit).
- Direct Google Drive `files.get` permission metadata inspected for **all 46/46** distinct Drive files with no changes made.
- **45 files have an `anyone:writer` permission.** These are externally writable to persons with the link, subject to provider behaviour. They must be treated as a P0 security exposure.
- **1 file has no returned `anyone` permission**. It was referenced by the MizuMi × PP KRIT event. This is *not* proof that customers cannot see it; verify the exact image load in a signed-out session, including fallback.
- There were 0 unreadable metadata calls in this inspection; this says nothing about folder inheritance or external-provider image URLs.

Examples of exposed current visible-event artwork: CAT EXPO, WILLIAM EST, BTS World Tour Arirang, PERSES, SONRAY, NAMTAN FILM, GMMTV FANIVAL, Happy BUSDAY, GMMTV STARLYMPICS, The Weeknd, FORTREASURE, JASP.ER, iQIYI iJOY TH 2027. **Examples are not an exhaustive list**; see anonymized ordinal evidence for the complete count.

### Reproducibility without publishing private identifiers

- Evidence: `evidence/kk-active-poster-acl-snapshot-20261107.json`, containing only ordinal positions, permission roles, aggregate counts and non-identifying provenance. **No Google Drive IDs, poster access URLs, customer details or credentials committed.**
- Deterministic read-only evaluator: `scripts/qa/kk-active-poster-acl-evidence-20261107.cjs`.
- Unit tests: `tests/kk-active-poster-acl-evidence-20261107.test.js`.
- Evidence file is **dated** and does not auto-refresh. Every actual cutover requires a **new live ACL readback** for the exact current poster IDs and affected customer pages.

## Ownership / non-collision boundary

During preflight, known Codex branches `codex/lock-x-signal-first-posting-plan`, `codex/ultra-deep-demand-hardening-20261007`, `codex/ultra-deep-external-demand-gate-20261006`, and the older storefront Codex handoff branch were inspected. Their changed paths were outside these **new audit-only files**.
No changes here to Codex X, Scanner, Storefront, `script.js`, `config/kk-project-memory.json`, booking/stock files, existing ACL owner automation, or existing Draft PRs (#721, #831, #833, #845). **Branch separation reduces collisions; it does not prove an unseen Codex run cannot start later.** Recheck ownership before any write or release.

## Required safe P0 remediation — separate owner-governed lane only

1. Confirm a **single writer / owner lock**, deployed owner identity, canonical source and currently referenced posters. Compare all active assets and any inherited folder ACLs. Do not merge historical and active batches.
2. Capture signed-out successful image delivery baselines for each active poster and fallback path before any ACL change.
3. Where public viewing is necessary, the narrowly scoped target is generally **public Writer → public Reader**, not deletion of public access, subject to provider constraints and independent owner review. Owner-only access is appropriate only when the image has a separately verified public CDN/mirror. Avoid changing roles on other principals.
4. Use the existing owner-gated design of [Draft PR #721](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/721) and incident [#718](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/718); do not create a competing ACL writer. First run dry-run, read exact role and URL stability, and abort on unknown/inherited permissions.
5. After any authorized change, inspect **Google Drive ACL readback** per file plus signed-out HTTP/browser poster loads for every referenced event, and report only aggregate counts. Take rollback snapshot of changed ACLs with privileged owner tooling, never store secrets in GitHub.
6. Recheck historical items and folders under [#743](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/743) separately; no claim that these 46 files cover the full historical asset tree.

**Stop conditions:** unconfirmed owner, unexpected Google Drive inheritance, any missing poster in signed-out browser, stale event/poster mapping, unexpected owner lock/Booking dependency, unsupported provider permission API, or unreviewed production change. Do not send LINE, alter Booking, publish GAS, change prices or deploy merely to fix public ACL.

## Current status / impact on project score

**Evidence coverage improved:** from 6 sampled current posters to **46/46** identified active Drive files in this scope, with **45/46 confirmed public Writer**.
**Actual security exposure NOT improved yet:** no ACL changed; Security/Privacy score must remain in the high-risk band. A green source CI run tests the evidence evaluator, **not Drive permission safety**, and cannot be used to claim the P0 closed.

**This is a standalone audit branch for Codex-safe handoff only. No Merge/Deploy/Configuration/Drive permission or customer write is authorized by these files.**
