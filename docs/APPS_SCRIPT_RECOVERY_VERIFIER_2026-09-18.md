# Apps Script Recovery Verifier — 2026-09-18

## Status

**ZERO-WRITE RECOVERY TOOLING ADDED / PRODUCTION APPS SCRIPT STILL BLOCKED ON AUTHENTICATED DEPLOYMENT RECOVERY**

This change adds a deterministic read-only verifier for candidate Apps Script Web App URLs. It does not recover or change the production deployment by itself.

## Why this exists

Production currently classifies the Admin upstream as `APPS_SCRIPT_DEPLOYMENT_NOT_FOUND`: Vercel reaches `script.google.com`, receives HTTP 404, and receives HTML instead of JSON.

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

`phase1Health` is preferred over `snapshot` so recovery verification does not request booking/customer snapshot data.

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
4. In an authorized shell, set the candidate as `KK_ADMIN_SCRIPT_URL`.
5. Run `npm run verify:apps-script -- --validate-only`.
6. With the authorized `KK_ADMIN_API_KEY` present, run `npm run verify:apps-script`.
7. Accept the candidate only if it returns JSON and the observed backend metadata is consistent with the production 9_5_9 evidence.
8. Only after that should the Vercel Production environment be updated and redeployed.
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
