# KK X Marketing — integrated release candidate / cross-chat evidence

**2026-10-15, Asia/Bangkok — DRAFT / RELEASE HOLD.** This document stages, but does not authorize, Production activation.

## Source composition (all first-party GitHub branches, main unchanged)
- Base main: `a54a348dd3258d87b1ec0c70e6ffd255d4678018`.
- Owner X copy/Content 3-angle+QA/Selector: Draft [#694](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/694) at `0747590ee28ba2f50f033eb40c725cfe02f4c2e5`. Focused GitHub [run 38731296234](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38731296234) **43/43 PASS**, Mergeable TRUE. New owner-locked-day V4 rule omits hidden/locked dates without falsely calling them full; preserve other available days of a multi-date event; all-locked events fail closed.
- X eligibility, 06:00 dedup, advisory visibility recovery and evidence-gated learning: Draft [#716](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/716) at `38e8a3f61301e334028af74d589ee8fe97b12cea`. GitHub [run 38731819723](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38731819723) **29/29 PASS**, Mergeable TRUE. Two/day, 90-minute values are **KK conservative draft recommendations**, not a real X platform rule or deployed control.
- GitHub OIDC Ledger self-recursion fix: Draft [#746](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/746) at `fbb7c108117cce03ee13d5264602be8d3b24476a`. Focused [run 38732065244](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38732065244) **50/50 PASS**; Full [run 38732065157](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38732065157) **1,727/1,727 PASS**, Mergeable TRUE. All under no-install, no secrets and no Production writes.
- Integrated Project Memory includes all 16 records from main plus two owner X records and one Ledger incident record; no preexisting memory record overwritten. All unrelated main paths remain untouched.

## Production reality (READ ONLY — Supabase live inspected on 2026-10-15)
- Runtime project `zehlsagzrpromtfqqflt` is ACTIVE_HEALTHY.
- Deployed `kk-project-memory-github-read` remains ACTIVE **version 2**, with recursive `function internalRuntime(){ const {url,key}=internalRuntime(); ... }`.
- Read-only `SELECT count(*) FROM public.kk_agent_invocations` returned **0**. Earlier SQL using nonexistent `created_at` failed; corrected count-only SELECT succeeded.
- Accordingly the actual GitHub Agent Bridge is **BLOCKED_LEDGER_UNAVAILABLE**, not accepted and not repaired in Production. No persisted live Invocation ID, no real production Content QA/Selector PASS. CI success of repo code does not equal runtime deployment.

## Integrated test acceptance and release gates
1. Run the exact-head integrated full `node --test tests/*.test.js` zero-install GitHub workflow; record real PASS/FAIL. Do not lower failed tests.
2. Independently audit merged diff and owner-lock source-provenance: values of `verified_*` booleans supplied by issue payloads are **not** proof of live Sheets/Storefront/Post Log fetch. Use connector-backed readback, including full Booking, owner visibility locks and live storefront, then document receipt and freshness. `planned` and `assumed_posted` are not proof of X publication.
3. Require **explicit owner/release approval** to merge any PR, deploy Supabase Edge function, enable main-facing changes or promote Vercel Production. No paid service additions.
4. After independent security and release review, separately approved targeted Supabase Edge deployment must preserve strict GitHub OIDC claims, secret/RLS boundaries and business_writes=0; verify live function revision and signed audit write plus persistent `kk_agent_invocations` row. Do not bypass Ledger.
5. Run real owner `[KK-CONTENT-RUN]` and `[KK-CONTENT-BATCH]` bridge issues with authoritative current truth. Verify persistent Invocation ID + complete required agents, Content QA PASS, Selector PASS, and Batch Diversity QA PASS; all content remains Owner Review.
6. Verify current X post history, genuine engagement and learning inputs. No fake impressions/AI training, no auto-post or paid advertising. Only then consider owner-approved X publication.

**Forbidden without separate explicit approval:** merge PR to main, Production deploy, changes to Booking, prices, assets, owner visibility locks, ACL/secrets, customer messages or X publication.

This is a source integration rehearsal, not a Production success claim.
