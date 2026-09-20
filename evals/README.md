# KK AI Quality Evals

This directory contains **manual/staging-only** evaluation assets for KK Phone Rental event intelligence.

## Safety boundary

These files do not create a scheduler, runner, booking/event writer, notification sender, or Machine-SOT writer.

The Promptfoo provider requires an explicit `KK_EVAL_ENDPOINT` and:

- fails closed when the endpoint is absent;
- blocks non-HTTPS remote endpoints;
- blocks production-looking endpoints;
- sends `mode=EVAL_ONLY`;
- sends `authoritative=false`;
- sends `verifier_required=true`;
- sends `production_writes=0`;
- sends `final_truth_mutation=false`;
- sends `notification_sends=0`.

No bearer token is stored in the repository.

## Files

- `event-intelligence-prompt.txt` — structured advisory-output contract.
- `event-intelligence-tests.yaml` — Promptfoo behavioral tests.
- `fixtures/event-intelligence-gold.jsonl` — versionable gold fixtures suitable for later Hugging Face Datasets loading.
- `providers/kk-staging-provider.js` — fail-closed staging endpoint adapter.

## Local fixture validation

```bash
npm run validate:ai-quality
```

This validation is also included in `npm run check`.

## Manual Promptfoo run

Promptfoo is intentionally **not** a production dependency and is not invoked by the production runtime.

From a controlled development environment:

```bash
export KK_EVAL_ENDPOINT="https://<approved-staging-host>/<eval-path>"
export KK_EVAL_BEARER_TOKEN="<ephemeral-staging-token-if-required>"
npx promptfoo@latest eval -c promptfooconfig.yaml
```

Do not point `KK_EVAL_ENDPOINT` at the production storefront, Admin, Scanner dispatch, Apps Script, or any business-write endpoint.

## Future sinks

The separate `server/ai-observability-contract.js` is prepared for explicit adapters such as Langfuse or OpenTelemetry. Those sinks remain disabled until a dedicated acceptance change provides credentials, retention policy, PII review, and zero-business-write evidence.

## Future probabilistic dedup

`server/event-dedup-shadow.js` is the zero-dependency deterministic baseline. Splink may be evaluated later in a separate Python/shadow job against the same gold fixtures. Splink must remain advisory and cannot merge or mutate events directly.
