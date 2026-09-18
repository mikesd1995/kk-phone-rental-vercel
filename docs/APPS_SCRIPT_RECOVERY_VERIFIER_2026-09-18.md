# Apps Script Recovery Verifier — 2026-09-18

## Status

**ZERO-WRITE RECOVERY TOOLING HARDENED / PRODUCTION APPS SCRIPT STILL BLOCKED ON AUTHENTICATED DEPLOYMENT RECOVERY**

This change adds a deterministic read-only verifier for candidate Apps Script Web App URLs. It does not recover or change the production deployment by itself.

## Why this exists

Prior production evidence established the Admin upstream symptom as HTTP 404 HTML from `script.google.com`, and PR #57 added the explicit `APPS_SCRIPT_DEPLOYMENT_NOT_FOUND` classification. A fresh authenticated post-PR #57 upstream probe is still pending, so this document does not claim that the 404 has been newly reproduced on the latest deployment.

Connected-source recovery was repeated on 2026-09-18:

- Google Drive metadata search for `application/vnd.google-apps.script`: no accessible Apps Script project found.
- Drive searches for `Code.gs`, `PRICE_INTEGRITY_FIX`, Apps Script deployment terms, and `/exec`: only project documentation / Sheets evidence was found; no authoritative 9_5_9 source or active Web App URL was recovered.
- Gmail searches for `script.google.com/macros/s`, `PRICE_INTEGRITY_FIX`, and `9_5_9`: no historical active Web App URL or source backup was recovered.
- No URL was guessed.
- No Apps Script deployment, Vercel secret mutation, or Google Sheet business write was performed.

## New command

```bash
npm run verify:apps-script -- --validate-only
npm run verify:apps-script
```

The command reads only:

- `KK_ADMIN_SCRIPT_URL`
- `KK_ADMIN_API_KEY`

from the authorized runtime environment.

It never prints either value.

### Validate-only mode

`--validate-only` checks that the candidate URL is exactly:

```text
https://script.google.com/macros/s/<deployment-id>/exec
```

It rejects:

- non-HTTPS URLs;
- URLs with embedded username/password credentials;
- non-`script.google.com` hosts;
- `/dev` URLs;
- editor / Drive / Sheet URLs;
- query strings or fragments.

The report contains only SHA-256-derived fingerprints for correlation, not the deployment ID or full URL.

### Read-only probe mode

Normal mode sends exactly one read-only Apps Script health action used by the production System Guard path:

```json
{"action":"phase1Health","apiKey":"<from environment>"}
```

The report is intentionally bounded. It can include:

- upstream HTTP status;
- content type;
- existing non-JSON failure classification;
- safe version/revision fields;
- URL/deployment fingerprints.

`phase1Health` is preferred over `snapshot` so recovery verification does not request booking/customer snapshot data. The tracked Apps Script path also excludes `phase1Health` from the normal audit-log write path, so this probe is designed to remain zero-write.

### Fail-closed acceptance contract

A candidate is not accepted merely because it returns HTTP 200 or parseable JSON. Normal probe mode now requires all of the following:

- HTTP response is successful;
- JSON explicitly contains `ok: true`;
- recognized backend/version metadata is present;
- the observed backend identity matches the expected production backend from `admin/snapshot-health.js` (`v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX`).

The verifier fails closed with explicit classifications when JSON is parseable but not authoritative:

- `APPS_SCRIPT_JSON_CONTRACT_UNVERIFIED` — no explicit `ok: true`;
- `APPS_SCRIPT_BACKEND_IDENTITY_MISSING` — no recognized backend/version identity;
- `APPS_SCRIPT_BACKEND_MISMATCH` — candidate reports a backend other than the expected 9_5_9 identity;
- `APPS_SCRIPT_HTTP_ERROR_JSON` — JSON was returned with a non-success HTTP status.

It does not emit:

- request API key;
- full Apps Script URL;
- deployment ID;
- upstream HTML/JSON response body;
- bookings, customers, phone numbers, assets, pricing rows, or other business payload.

## Recovery procedure

1. Authenticate to the Google account that owns the bound Apps Script project.
2. Open the bound project and choose **Deploy > Manage deployments**.
3. Copy the currently active Web App URL ending in `/exec`.
4. In an authorized **ephemeral/local shell only**, set the candidate as process-local `KK_ADMIN_SCRIPT_URL`. Do **not** change the Vercel Production environment at this stage.
5. Run `npm run verify:apps-script -- --validate-only`.
6. With the authorized `KK_ADMIN_API_KEY` available only to that authorized runtime, run `npm run verify:apps-script`.
7. Accept the candidate only when the verifier returns `ok: true`, explicit KK JSON contract, and the expected 9_5_9 backend identity.
8. Only after that evidence exists should the Vercel Production `KK_ADMIN_SCRIPT_URL` be updated and the Vercel project redeployed.
9. Rerun authenticated Admin/System Guard and exact Sheet readback acceptance.
10. Preserve/export the exact live 9_5_9 source before any Apps Script code modification.

## Safety boundary

This tool does not:

- create or update a deployment;
- mutate Apps Script source;
- write Google Sheets;
- change bookings/events/customers/assets/pricing;
- update Vercel environment variables;
- expose secrets;
- activate Scanner/Verifier/Canary/Make/HF.

Repository `apps-script/Code.gs` remains known-stale 9_5_8 and must not be deployed over production.


## 2026-09-18 follow-up hardening

A fresh read-only browser recovery attempt was repeated with the available browser profile and credential vault. The bound Sheet remained accessible only behind a Google sign-in boundary for Apps Script; no stored credential was available, so the run stopped without changing anything.

This follow-up therefore strengthens the verifier instead of guessing or mutating the upstream. It prevents a false-positive candidate from being accepted solely because an endpoint returns HTTP 200 plus arbitrary JSON.
