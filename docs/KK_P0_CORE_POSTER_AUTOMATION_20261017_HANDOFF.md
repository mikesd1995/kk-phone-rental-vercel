# KK Phone Rental — P0 Choices 2, 3, 4 | 2026-10-17 ICT

**Status: DRAFT SOURCE IMPROVED / LIVE SECURITY REMAINS HOLD.** This is a GitHub cross-chat handoff, not permission to merge, deploy, close PRs, restore automations, change customer/booking data, or alter Google Drive permissions. No new services, plan upgrades, payments, Google Apps Script deployments, Vercel deploys, permission writes, task writes or PR closures were initiated by this work.

## Choice 2 — Core Sheet privacy, Draft PR #739

- Canonical Core Google Drive ACL directly read: `anyone/reader`; private Event Tracker remains owner-only.
- Vercel Production environment **key-name only** readback (not values): `GOOGLE_SHEET_ID`, `KK_ADMIN_API_KEY`, `KK_ADMIN_SCRIPT_URL` exist; `KK_CORE_PRIVATE_READ_KEY`, `KK_CORE_PRIVATE_TRANSPORT`, `KK_CORE_SHEET_REQUIRE_PRIVATE` were absent from the inspected variable inventory (16 entries). DO NOT supply/create credentials without owner-governed acceptance.
- In existing Draft #739, committed a fail-closed `server/core-sheet-apps-script-reader.js` validation improvement: raw owner read-key must be untrimmed, match base64url-compatible characters, and be at least 32 characters. Whitespace/special-character environment values are no longer accepted as configured. This aligns the transport preflight with the owner-local key generator and does not change strict-mode opt-in defaults.
- Expanded `tests/core-apps-script-private-reader.test.js` with malformed-key negative cases.
- Commits: `e9df98af8158ab3f9b8c02c07934437ae5c17dac` (source); `91867af81ddeb0e3afe6c8a5aa14fefa6a4ab280` (tests). Another independent commit may move PR head; always re-fetch current head. Remote file readback confirmed patched code/test blobs. **No native exact-repo test or hosted CI newly invoked on #739 by this work.**
- Release HOLD: owner-authenticated independent read key, 13/13 real private Core reads, negative admin-key tests, privacy/no-GViz API tests, full exact-head CI/browser/rollback and explicit owner approval BEFORE restricting existing Core ACL. No Service Account migration.

## Choice 3 — Public writer Drive posters, Draft PR #721

- Fresh direct Core `01_Events` + generated `08_Web_Ready` join: **74** visible Oct–Dec 2026 event-date cards; **48** Drive thumbnail uses, **39** distinct current active image file IDs; **zero** Core-WebReady image divergence and **zero** duplicate event IDs in the read ranges. Branch-pinned exact 39 IDs match all 39 current active IDs, with zero added/removed membership.
- Independently read Google Drive metadata for all **39/39** active pinned image files in five batches, each is `anyone/writer`, zero failed role reads, zero non-image MIME. All **4/4** pinned folders are `anyone/writer`, zero read errors. No ACL change. Historic 209 from Oct 14 remains historical evidence; do not claim it is an exact current active/archive split.
- Existing ACL scope is `ACTIVE_ONLY` with <=25 writes per *separate owner-approved* fingerprint, no auto-trigger. Branch #721 had already refreshed the 39/48/74 manifest on Oct 17 before this run; the stale 33/35/42 numbers are superseded.
- New additional fail-closed guard rejects duplicate nonempty `event_id` values in either `01_Events` or `08_Web_Ready` before Map last-write semantics can conceal conflicting poster rows and before any snapshot/apply. Identical preflight change staged in both owner-only and standalone read-only Apps Script sources. Regression fixture/tests now explicitly cover Core-only and WebReady-only duplicates in both script modes, with zero mocked writes.
- Commits: `4b039dc19fa394a8dd31c46ea11af6542d674814`, `3364d819074810c9dc5a6d516cf5851cdb578453`, `b07da98f1f8c7b31e2bb69ccfe038e8f0e4518f9`. Remote source/test readback confirmed.
- **Full native Node mock suite and real Apps Script Dry Run NOT executed by this work.** Before Apply require current owner SOT re-pin, full exact-head tests, standalone owner Apps Script dry-run + fingerprint, folder inheritance blast-radius approval, image decoding acceptance and separate explicit owner permission approval per batch. Parent folder changes may affect historic descendants; keep fail-closed.

## Choice 4 — Scheduled-task capacity and cleanup governance, Draft PR #744

- Authoritative ChatGPT task readback on Oct 17: **3 enabled** tasks (Ticket Resell Scanner; KK PR744 Cleanup Gate; KK November official-poster watch), while canonical KK Scanner `6ab272b36b1881919577ff3367fa8245` and Verifier `6ab7e060fa788191b5f17a7028494c3a` remain OFF. The Oct 15 audit's 'five enabled' is superseded. **Current plan's authoritative active-task limit not independently verified**; do not conclude capacity is full nor automatically pause an unrelated task.
- Added `scripts/automation-capacity-preflight.cjs` as a read-only, dependency-free decision helper. It explicitly requires a COMPLETE task inventory, independently VERIFIED account limit, canonical distinct IDs, valid boolean task states, and ownerPause=false. Returns `HOLD_*` or `READY_FOR_SEPARATE_OWNER_REVIEW`; all results fix `task_writes=0`, `production_writes=0`, `approval_required=true`, `can_auto_enable=false`, `can_auto_disable=false`. Nothing invokes the automations API.
- Added `tests/automation-capacity-preflight.test.js`. **Native Node 22.16.0 syntax checks PASS + node --test 8/8 PASS**, local zero-network/zero-cost using synthetic tasks. Published file byte lengths 2066 / 3190 were read back exactly in GitHub.
- Commits `42770851f147abfd8fcaf6390061c434b208a2c4` + `357d2d06ffd939610f519cbd46cabf89384947f4`. No Task toggled, cloned, rescheduled, retired or created. PR #744 remains Draft.
- Scanner/Verifier restore is a separate owner-approved gate: confirm exact policy v4.9.44/current latest, OWNER_PAUSE, attributable writer, genuine free capacity, safe lock/fencing and no unfinished transaction, then require two independent natural run receipts/manifest coverage. Never fabricate missed run evidence.
- `KK PR744 Cleanup Gate` task is enabled with a conditional scope to comment/close older PRs. This is NOT authorization to close any PR on this turn; verify exact PR head and individual supersedence/release safety first.

## Test / expense / production boundaries

- PR commits were tagged `[skip ci]` to avoid automatic workflow/preview resource consumption. GitHub is public, but that alone is not proof every auxiliary CI/provider operation or artifact is free.
- Main/Production, booking, customer, LINE sends, Google Drive ACL, Apps Script runtime and scheduled task state were not written.
- Vercel production was observed READY after these drafts. Production may move independently; never credit another actor's release to these commits.
- Requested three workstreams remain **P0 HOLD for real deployment/security acceptance**, while branch hardening + local #744 tests above are completed.

References: [#739](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/739) · [#721](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/721) · [#744](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/744) · [#738](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/738) · [#718](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/718) · [#47](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/47) · [#49](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/49).
