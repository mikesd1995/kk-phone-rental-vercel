# Ultra Deep Zero-Cost Runner

Purpose: execute the existing governed Ultra Deep Full Loop without GitHub-hosted runner minutes.

## Required repository runner labels
- self-hosted
- linux
- x64
- kk-ultra-deep

## Required local tools
- git
- Node.js 20+
- npm
- Python 3
- curl

Register the runner at repository scope using GitHub Settings > Actions > Runners > New self-hosted runner. Use GitHub's generated registration command; registration tokens expire after one hour. Add custom label `kk-ultra-deep`.

Do not store the registration token, Vercel token, GitHub OIDC token, or Admin PIN in this repository.

## Execution
Use workflow_dispatch for `Ultra Deep Full Loop Direct`:
- month: target YYYY-MM
- confirm: RUN_ULTRA_DEEP_FULL_LOOP
- zero_cost_self_hosted: true

The workflow fails closed unless it is actually running on a self-hosted runner and required tools exist. Existing owner authorization, OIDC, discovery FULL, commercial, production COMPLETE, tombstone, booking-price-lock and exact-readback gates remain authoritative.

## Acceptance
A run is COMPLETE only when the production COMPLETE gate passes and exact storefront readback is present. A queued job without an online `kk-ultra-deep` runner is not acceptance.
