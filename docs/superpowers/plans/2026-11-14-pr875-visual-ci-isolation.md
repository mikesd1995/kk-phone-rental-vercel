# PR875 visual CI credential isolation implementation plan

**Goal:** Complete the approved local-only visual-CI hardening on a separate branch from `487efc258aebdb98011e46abf205f779e3c66429`, preserving LINE recovery and visual coverage.

**Architecture:** Remove the bypass secret from job-wide environment and browser-wide headers. Use a small testable read-only route transport: local mode never calls its secret accessor; protected mode adds only the bypass header to the exact approved HTTPS origin, never requests a bypass cookie, disables automatic redirects and blocks credentialed redirects before fulfillment. Normal uncredentialed resources, cached images and application responses remain supported.

**Constraints:** RELEASE HOLD. Local source, dummy/mock tests, independent review and local commit only. No push, CI run/dispatch/rerun, Restore, external settings/secret edits, deployment, provider sends or real secret reads. No business/UI/copy, Vercel branch rule, workflow permission, runner target or existing LINE-outbox changes.

## Tasks and boundaries

- [x] Add failing workflow assertions; remove global bypass binding, explicitly guard remote identity/Preview/capture steps by manual dispatch and remote mode. Preserve the local capture command and all coverage. Add `--ignore-scripts` to existing pinned temporary installs.
- [x] Add failing harness/fixture guards; implement `scripts/storefront-visual-transport.cjs` and integrate it into the existing harness. Test route behavior with dummy headers and mocked Playwright interfaces; no browser/network run is required.
- [x] Cover local secret-access denial, exact origin/port/host boundary, reserved-header stripping, bypass-cookie omission, GET/HEAD only, redirect abort, safe errors, normal response forwarding, image-cache preservation and fixture method guard. Report actual attempted bypass use without rereading environment.
- [x] Independent source review; fix material findings and rerun affected local tests. Full offline regression is required because this crosses a credential boundary.
- [x] Verify only intended files and original nine-file LINE commit unchanged. Local commit/readback evidence is recorded outside the repository; retain RELEASE HOLD and separate runtime/LINE card acceptance.

Expected files: `.github/workflows/storefront-visual-qa.yml`, `scripts/storefront-visual-acceptance.mjs`, new `scripts/storefront-visual-transport.cjs`, `tests/storefront-visual-qa-automation.test.js`, new `tests/storefront-visual-transport.test.js`, and this dated plan/result note.

Protected redirects are deliberately unsupported by this change: a credentialed 3xx with Location is aborted, with a fixed error. Do not follow it manually or attach the credential to a different origin. Ordinary application cookies retain normal browser host-based semantics; this does not claim they are origin-scoped. Normal Set-Cookie forwarding is preserved, but the transport never asks Vercel to create a bypass cookie.

## Observed local verification

Workflow RED witnesses: three new isolation/install/path assertions failed while the 42 original cases passed; three additional manual-identity/install/runtime-path assertions then failed before their fixes. Final static suite: **48/48 passed**, with no original test removed. Harness RED witnesses: context-wide headers and fixture POST bypass failed while fixture GET passed. Final transport suite: **33/33 passed**, exercising dummy callbacks and mocked route interfaces only.

Combined focused suites: **81/81 passed**. Full offline repository regression: **2,805/2,805 passed, zero skips**. Separate poster ACL VM fixtures: **29/29 passed**. Code Intelligence targeted runner: **62/62 passed**. `npm run check` and explicit helper/harness syntax checks passed. Network/HTTP/TLS/fetch and non-Node child execution were blocked by the local test preload; ambient provider variables were removed by name without inspecting their values. No real secret getter, browser, production CSV request, provider or cloud system was used in these checks.

Independent whole-candidate source/security review covered all six files and reported **0 BLOCKER / 0 MATERIAL**. Original nine LINE-recovery files matched their previously tested working-copy hashes with **zero differences**. Workflow permissions, existing capture coverage, action/dependency versions and Vercel branch-deployment rules are preserved. The protected bypass is an attempted per-request header use, not proof that a request reached a provider. No bypass-cookie request is made; application cookies keep normal browser semantics.

No live setup/secret availability, public feed request, hosted CI, rendered LINE card or release acceptance follows from these local tests. The source change is ready for a local commit only; external push and automatic CI effects require the owner's separate authorization after exact-SHA impact review.
