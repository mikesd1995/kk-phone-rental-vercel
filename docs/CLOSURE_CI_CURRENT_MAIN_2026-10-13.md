# Current-main closure CI repair

Date: 2026-10-13, Asia/Bangkok. Local/PR source work; no protected main merge or production deployment.

The exact PR705 head35139d2 had hosted staging success, while Ultra Deep V2 failed before tests because `npm ci` had no tracked lockfile. This is a current installation defect, superseding the historical account-payment/spending-limit blocker for this run. Visual QA separately executed and failed; its acceptance must remain separate.

Hosted runs checked out GitHub's PR merge tree against main d6dc3bfe4cc0c4dd6fdfec407823752da0572464, newer than the previous56714eb baseline. The 13 new main paths were disjoint from closure changes. They are integrated into the feature branch, retaining temporary-artwork runtime and booking-lifecycle shadow runtime verbatim.

The repair adds package-lock.json for the existing direct dependency @vercel/functions3.9.8 and its resolved graph. It adds the lockfile to the V2 workflow path filter, preserves npm ci and all postinstall/syntax/targeted gates, and protects the lockfile from packaging exclusions. No direct dependency/version, deployment policy or runtime writer is changed.

Ordinary clean npm ci, including all incoming postinstall guards, passed. The incoming image-fallback fixture required CRLF normalization on Windows; only test source extraction was changed. Four existing expectations were stale after main integration: booking read range A4:X for the existing quote projection, two explicit v633 asset cache markers, and CRLF-sensitive modal source matching. Tests now assert current contracts; runtime source is preserved.

Full offline-guarded regression after integration:1600/1600, zero failures/skips; npm run check exit0. Independent review and exact final hosted CI are recorded by the parent handoff. A separate fresh visual acceptance artifact is required before claiming storefront readiness. No owner screenshot acceptance, provider success, natural scanner run or Apps Script release is inferred from these source checks.
