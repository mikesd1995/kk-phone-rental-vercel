# Agent Enforcement Hardening — 2026-10-02

## Scope
Close the verified enforcement gap where storefront visual QA could be recorded with only the UX reviewer even though the seven-role Design Council existed.

## Changes
- Registry V27 requires all seven storefront Design Council agents for `storefront_visual_qa`.
- Visual QA task routing executes `StorefrontDesignCouncil.runCouncil()` and returns council evidence with UX QA output.
- Reliability Learning is declared as the downstream feedback consumer.
- Regression coverage asserts exact seven-agent invocation, council evidence, and zero production writes.

## Safety
No price, booking, inventory, event, customer, storefront presentation, deployment, or production data is mutated. Reviewers remain read-only. No auto-merge or auto-deploy is introduced.

## Learning model
This is bounded closed-loop learning, not autonomous model retraining. Runtime evidence and incident outcomes can feed Reliability Learning; executable policy changes remain code-reviewed and regression-gated.
