# Storefront Production Activation — Deploy Diagnostics — 2026-09-28

## Incident
Production activation for approved main `03ae38aa7b16dfa1a5cc125e6949660d41a92c2d` failed in GitHub Actions run `36341404116`.

All source, regression, credential-presence, Production-settings pull and local Production build gates passed. The first mutation step, `vercel deploy --prebuilt --prod --skip-domain`, exited 1 before producing a candidate deployment.

The prior workflow redirected Vercel CLI stderr to a temporary file and exited immediately under `set -e`. The error file was not included in the secret-safe artifact, so the terminal report proved the failure boundary but did not preserve the provider error reason.

## Remediation
The workflow now captures the deploy return code explicitly and prints only a redacted stderr diagnostic on failure. Token/authorization/bearer-shaped values are redacted before output.

This changes observability only. It does not weaken exact-main gates, candidate isolation, route acceptance, promotion controls or rollback.

## Safety
- no Admin PIN/session secret
- no Google Sheet or Apps Script writes
- no event/package/price/visibility writes
- no automatic promotion on failed candidate creation
- Production remains unchanged until candidate acceptance succeeds

## Acceptance
Retry only after this diagnostics patch is merged. If Vercel candidate creation succeeds, continue existing candidate acceptance/promotion/live verification. If it fails, use the preserved redacted provider error to select the next recovery route rather than guessing.
