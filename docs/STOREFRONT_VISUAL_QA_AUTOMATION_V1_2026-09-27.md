# Storefront Automated Visual QA V1 — 2026-09-27

## Objective

Prepare a read-only visual acceptance layer for the KK Phone Rental storefront while PR #237 waits for an exact-head Vercel Preview.

The goal is to turn mobile UX acceptance from an informal screenshot check into a repeatable evidence packet:

1. verify the target deployment identity;
2. open the existing deployment without creating or promoting a deployment;
3. capture screenshots at the storefront policy widths;
4. measure DOM/layout metrics that map to known KK mobile UX failure classes;
5. pass those metrics through `kk-storefront-ux-reviewer`;
6. publish screenshots, metrics, a manifest and a Markdown summary as GitHub Actions artifacts.

This branch is intentionally stacked on PR #237 because it uses the reviewer and policy introduced there.

## Added

### `.github/workflows/storefront-visual-qa.yml`

Manual, read-only workflow.

Inputs:

- explicit confirmation token;
- target Vercel URL;
- exact Git SHA expected on that deployment;
- preview/production surface;
- optional expected CSS cache marker.

Before opening the page, the workflow queries Vercel and fails closed unless:

- the URL is HTTPS and belongs to the KK Phone Rental Vercel host allowlist;
- the deployment is READY;
- the deployment belongs to the canonical project;
- `meta.githubCommitSha` exactly matches the approved SHA;
- preview requests do not point to Production;
- Production requests do not point to a Preview.

The workflow never runs `vercel deploy`, never calls the promote endpoint and has only `contents: read` GitHub permission.

### `scripts/storefront-visual-acceptance.mjs`

Chromium-based visual evidence runner.

Acceptance widths come from `config/kk-storefront-ux-policy.json`:

- 320
- 375
- 390
- 430
- 480
- 768
- 1024

For each width the runner:

- loads the target storefront;
- waits for an event card/error/empty state;
- fails on storefront error state or missing event cards;
- verifies the optional CSS cache marker;
- captures one top-of-page screenshot;
- scrolls to the event browser so sticky controls are active;
- captures one sticky-state screenshot;
- records layout metrics;
- feeds those metrics to `kk-storefront-ux-reviewer.validateVisualQa()`.

Measured failure classes include:

- horizontal overflow;
- iOS form-control size contract;
- sticky-control height;
- fixed LINE CTA height;
- safe-area CSS presence;
- tap-target size;
- filter row count;
- event-card columns and minimum width;
- visible event cards in the viewport;
- backdrop blur;
- browser page errors.

The runner performs no clicks, no form fills and no submissions.

### Evidence artifacts

The workflow uploads:

- `manifest.json`
- `summary.md`
- top screenshot for every acceptance width
- sticky-state screenshot for every acceptance width

Artifact retention: 14 days.

## Safety

- Production writes: 0
- Vercel deployments created: 0
- Vercel promotions: 0
- Booking writes: 0
- Pricing writes: 0
- Inventory writes: 0
- Google Sheet writes: 0
- Apps Script writes: 0
- Machine SOT writes: 0
- Clicks: 0
- Form submissions: 0
- Auto-merge: false
- Auto-deploy: false

The only network actions are read-only page loads and read-only Vercel deployment metadata lookup.

## Why Chromium is not called iPhone proof

The runner uses Chromium viewport emulation for deterministic automated layout evidence. It labels the platform `ios-contract-via-chromium` only so the existing 16px iOS form-control policy is enforced.

This does not claim to emulate WebKit/Safari perfectly.

Final acceptance for an iPhone-specific browser behavior still requires either:

- a real iPhone/Safari check; or
- a future WebKit runner that has been separately accepted.

## Release sequence

1. PR #237 must pass its exact-head Preview/visual acceptance and merge first.
2. Rebase or refresh this branch after #237 merges.
3. Merge this visual-QA infrastructure only after the normal regression gate passes.
4. Once this workflow exists on `main`, run it against future READY Preview deployments before storefront merges.
5. After a Production deployment, rerun with `surface=production` for post-release visual smoke acceptance.

## Current limitation

The workflow can capture screenshots automatically, but V1 does not make a vision-model judgment about the screenshot pixels.

The automated decision is based on measurable DOM/layout evidence plus the governed UX policy. The screenshots are retained for owner/AI visual review.

A future V2 may attach a vision provider, but it must remain advisory and must not gain merge/deploy or business-data mutation authority.

## Retry/failure policy

If a run fails:

- deployment identity mismatch -> stop; do not inspect a different deployment;
- target not READY -> wait for the exact deployment; do not substitute an older Preview;
- storefront error or no event cards -> preserve the failure artifact and diagnose data/runtime separately;
- P0/P1 UX finding -> fix the scoped UI issue, rerun regression, then rerun visual QA;
- Playwright/browser setup failure -> retry once with the pinned Playwright version on a clean runner; if still blocked, use owner-provided screenshots plus the existing reviewer as the fallback without weakening acceptance criteria.


## Protected Preview handling

The first live exact-head Preview check exposed a real Vercel Deployment Protection constraint: direct browser/page fetches are redirected to Vercel Authentication even though the deployment itself is READY.

The automation was hardened instead of weakening protection.

Preferred path:

- configure the repository secret `VERCEL_AUTOMATION_BYPASS_SECRET`;
- Playwright sends Vercel's documented headers:
  - `x-vercel-protection-bypass`
  - `x-vercel-set-bypass-cookie: true`
- Deployment Protection remains enabled.

Fail-closed fallback when the secret is not configured:

- use authenticated `vercel curl` with the existing `VERCEL_TOKEN`;
- verify the protected Preview is reachable and, when supplied, that the expected CSS marker is present;
- emit `BLOCKED_PREVIEW_AUTOMATION_BYPASS_UNAVAILABLE`;
- do not generate a permanent bypass, disable SSO, promote, deploy, or claim screenshot acceptance.

This preserves security while making the missing prerequisite explicit.


## Validation checkpoint 2

After adding protected-Preview handling, this documentation-only checkpoint retriggers the repository regression suite. The runtime visual-QA design remains read-only. Vercel may independently rate-limit Preview creation; that is not treated as evidence of a code failure.


## Zero-cost default path

The preferred path is now `local_zero_cost`, not an external browser service and not a protected Vercel Preview.

Flow:

1. GitHub Actions checks out the exact PR/head SHA.
2. A loopback-only static server serves that exact storefront source from `127.0.0.1:4173`.
3. The runner reads the two canonical public storefront CSV feeds from Production using GET only:
   - `08_Web_Ready!A4:K`
   - `09_Web_Packages!A4:N`
4. Playwright intercepts local `/api/kk-data` requests and fulfills them from the read-only snapshot.
5. The same UX policy and reviewer generate PASS/FAIL evidence.
6. Screenshots are JPEG-compressed and retained for 3 days to minimize included GitHub Actions artifact storage.

This path requires no TinyFish, Browserless, paid screenshot API, new Vercel deployment, Vercel promotion or Deployment Protection bypass.

The only consumable resource is the repository's existing GitHub Actions allowance. Keep this workflow scoped to storefront/visual files and use standard Linux runners only.

### Cost hierarchy

Preferred:
- existing GitHub Actions included minutes + local Playwright = near-zero incremental cash cost.

Fallback if hosted Actions allowance is exhausted:
- self-hosted GitHub runner on an existing machine = no GitHub Actions minute charge, with only the machine's existing power/network cost.

Optional remote acceptance:
- protected Vercel Preview with `VERCEL_AUTOMATION_BYPASS_SECRET` when already configured.

Avoid:
- TinyFish/browser-agent wallet usage;
- paid Browserless or screenshot SaaS;
- larger GitHub-hosted runners;
- generating new deployments solely for screenshots.

## Local-mode evidence quality

Local mode validates the exact checked-out HTML/CSS/JS and realistic current public event/package data. It is stronger than source regex tests for layout behavior, and it avoids confusing an older Preview with the current head.

It does not validate Vercel routing/protection behavior. Those remain covered separately by existing deployment checks and Production smoke checks.

It also does not claim to be a physical iPhone. A real-device Safari spot check remains the final browser-specific confirmation for iOS-only behavior.


## Preinstalled Chrome optimization

To keep GitHub Actions usage as low as possible, the workflow does not download a Playwright browser bundle in the normal hosted-runner path. GitHub-hosted Ubuntu runners include Google Chrome, so the job installs only the Playwright Node library and launches the preinstalled `chrome` channel.

This removes the `playwright install --with-deps chromium` step, reducing network transfer and runner time. If a future GitHub runner image no longer exposes Google Chrome, the job fails visibly at `google-chrome --version` rather than silently installing a paid external service.


## Zero-cost acceptance result

The zero-cost local workflow completed successfully after one evidence-driven correction cycle.

Successful run:
- GitHub Actions run: `36320723047`
- exact head: `cef5868d173e9a17d199f6babaa09a76b3e6bc73`
- result: PASS
- external paid service calls: 0
- production writes: 0
- artifact size: under 1 MB
- artifact retention: 3 days

All acceptance widths passed with professional-readiness score 100:
- 320
- 375
- 390
- 430
- 480
- 768
- 1024

The first zero-cost run correctly surfaced one real hit-area defect and one measurement defect:

1. Follow-X was reduced to a 40px mobile hit area by an older media rule, while the UX policy requires 44px.
2. The initial iOS zoom metric incorrectly included button font sizes, producing a false P0. The metric now measures only zoom-prone text controls (`input/select/textarea`) and applies the iOS contract through tablet widths.

The storefront base was updated with 44px mobile utility hit areas and 40px desktop control floors. The rerun then passed all viewports with no P0/P1/P2 findings.

This validates the near-zero-cost design: exact checked-out code + canonical read-only public data + localhost Chrome/Playwright + governed UX reviewer.


## Sticky-state evidence correction

A manual inspection of the first successful artifact found that the so-called sticky screenshot had not scrolled far enough to activate the sticky shell at the top edge. Metrics were valid, but the screenshot itself was not ideal acceptance evidence.

The runner was corrected to scroll from `.browse-controls-shell` itself by at least the shell height before the sticky screenshot.

Validation run:
- GitHub Actions run: `36321012480`
- exact head: `958b943ee20c096b61ae72b7e20d9830a90064f9`
- result: PASS
- 390px sticky screenshot visibly pins search + single-row filters at the viewport top
- sticky height: 124px
- filter rows: 1
- 320px intentionally uses horizontal filter overflow rather than a second row
- paid external service calls: 0

This correction improves the quality of visual evidence without changing storefront business behavior.
