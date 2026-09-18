# Apps Script Upstream 404 Recovery Hardening — 2026-09-18

## Status

**CODE HARDENED / LIVE DEPLOYMENT URL STILL REQUIRES AUTHENTICATED RECOVERY**

This change does not replace the production Apps Script deployment. It makes the currently observed HTTP 404 condition explicit and fail-closed so System Guard reports the actual root cause instead of generic HTML or downstream snapshot-array failures.

## Fresh production evidence

Before this patch, production Vercel runtime logs showed the Admin upstream returning:

- host: `script.google.com`
- action: `snapshotHealth`
- HTTP status: `404`
- content type: `text/html; charset=utf-8`

The upstream classifier therefore knew the response was HTML, but did not distinguish a missing/retired Apps Script deployment from other generic HTML failures.

## Recovery attempts performed

Read-only recovery attempts were made without changing production state:

1. opened the bound spreadsheet and attempted to enter its Apps Script project;
2. attempted direct Apps Script project-dashboard access;
3. searched connected Google Drive for `application/vnd.google-apps.script` projects and 9_5_9 source;
4. searched Gmail for Apps Script deployment URLs, deployment IDs, and prior Web App notices.

Result:

- connected Drive exposes no bound Apps Script project/source export;
- no exact live 9_5_9 source was recovered;
- no active `/macros/s/.../exec` deployment URL was found in connected Gmail;
- browser recovery reached a Google sign-in boundary, so no deployment settings were changed.

No URL was guessed and repository 9_5_8 was not deployed.

## Code changes

### `server/upstream-response.js`

The non-JSON classifier now accepts an optional HTTP status and identifies:

`APPS_SCRIPT_DEPLOYMENT_NOT_FOUND`

when all of these are true:

- upstream host is `script.google.com`;
- HTTP status is 404;
- response is HTML.

The operator suggestion now explicitly says to:

- open the bound Apps Script project;
- use **Deploy > Manage deployments**;
- copy the active Web App `/exec` URL;
- update Vercel `KK_ADMIN_SCRIPT_URL`;
- redeploy;
- rerun System Guard;
- never overwrite the observed 9_5_9 production backend with repository 9_5_8.

### Call sites

Both the snapshot adapter and legacy Admin proxy now pass upstream HTTP status into the shared classifier.

### Regression coverage

Added tests proving:

- HTTP 404 HTML from `script.google.com` is not reduced to `GENERIC_HTML_RESPONSE`;
- the snapshot adapter preserves the 404 as a single upstream root cause;
- the response includes `upstream_failure_class=APPS_SCRIPT_DEPLOYMENT_NOT_FOUND`;
- no downstream "missing or invalid array" error replaces the root cause.

## Why this is better

Before:
- 404 HTML could be described only as generic HTML;
- operators still had to infer whether the URL was stale, access was wrong, or the deployment was missing.

After:
- System Guard can identify a stale/missing Apps Script deployment as its own failure class;
- the recovery action is deterministic;
- dependent snapshot checks remain blocked/warned rather than looking like independent data corruption;
- the safety warning against deploying stale 9_5_8 remains attached to the recovery path.

## Remaining human-authenticated boundary

The exact active Web App URL cannot be recovered safely from the currently connected Drive/Gmail surfaces and the browser automation profile is not authenticated to Apps Script.

Required authenticated action:

1. open the bound Apps Script project;
2. Deploy > Manage deployments;
3. copy the active Web App URL ending in `/exec`;
4. replace `KK_ADMIN_SCRIPT_URL` in Vercel Production;
5. redeploy;
6. rerun System Guard and verify:
   - Apps Script JSON Response = OK;
   - backend version = observed 9_5_9;
   - Sheet ID matches;
   - snapshot arrays are valid;
   - no `APPS_SCRIPT_DEPLOYMENT_NOT_FOUND` remains.

## Safety boundary

This work does **not**:

- edit or deploy Apps Script;
- change Vercel secrets/environment variables;
- write Google Sheet business data;
- modify bookings, events, customers, assets, pricing, or inventory;
- change Scanner, Verifier, Canary, Make, provider sends, or Hugging Face;
- expose the Admin PIN, API key, service-account credentials, or response bodies in logs.
