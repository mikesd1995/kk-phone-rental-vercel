# Canonical health attempt fence implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Preparation only; no Production source/schema/Edge/Make writes or health calls until one future exact approval.

**Goal:** Prepare a concrete one-approval OAuth/private-GAS diagnostic whose Google refresh and fixed private health can occur at most once across duplicated or retried requests.

**Architecture:** Existing879a nonce is correlation only; Make documents automatic backoff and module-only retry exclusion is not proven. Add a dedicated owner-preseeded control row and service-only atomic claim RPC on the existing runtime database, exposed only through a narrow Production OIDC Edge probe. Gateway must consume the fixed approved attempt before Google; missing/unarmed/mismatched/expired/consumed/uncertain claim stops before Google. No new infrastructure, credentials, sender, scheduler or GAS source.

**Tech Stack:** Existing CommonJS Node>=20 (Production24), existing Vercel OIDC bridge and Edge TypeScript, PostgreSQL PL/pgSQL, disposable pinned PGlite0.5.11 tests. No new repository dependency.

**Spec:** This file is the compact design. Owner requested once-bounded diagnostic preparation and opted out of repeated questions. Local source/SQL/test preparation follows that requirement; protected deployment/install/arm/run are not authorized now. Current Production stays879a/2LC/OFF.

## Global constraints and shared contract

- Preserve all current consumer auth/OFF/readiness/project/store/GAS API/adapter/bot/digest gates and safe879a rejection metadata. Body remains exactly5 fields (stage/version/nonce/bot_id/provider_binding_sha256).
- New health config fields: gasHealthAttemptId from KK_OWNER_CANONICAL_GAS_HEALTH_ATTEMPT_ID; deploymentSourceSha from VERCEL_GIT_COMMIT_SHA; deploymentId from VERCEL_DEPLOYMENT_ID; deploymentEnvironment from VERCEL_ENV. Missing/invalid/nonProduction => no native or Google I/O. Verify official system-variable contract; fail closed if unavailable, no guessed fallback.
- Edge probe body exact keys: probe='owner-health-attempt-claim',version='v1',attempt_id,nonce,source_sha,deployment_id. Both UUIDs lowercasecanonical; source40lowerhex; deploymentID dpl_ bounded; verified OIDC environment must be Production. Source SHA is trusted gateway metadata plus fresh release readback, not a signed OIDC source claim.
- New RPC public.kk_claim_owner_health_attempt_v1(p_attempt_id uuid,p_nonce uuid,p_source_sha text,p_deployment_id text,p_environment text). Dedicated private control table (no notification/business/queue records). Owner-preseeded only; no automatic INSERT/arm/rearm/refund/reclaim. Lock row then clock_timestamp check and one terminal consumption before Google. Bind exact attempt/nonce/source/deployment/environment and TTL<=15minutes. Lost reply consumes forever; duplicate must never return idempotent success.
- Native result exact allowed keys: claimed(boolean),attempt_id,nonce,source_sha,deployment_id,environment,control_writes(0|1),business_writes=0. Denial may use the same caller-known bindings with claimed=false/control_writes=0. Edge outer adds ok=true/authenticated=true/probe/version/send_allowed=false/provider_sends=0; no arbitrary raw error/row data.
- Edge reuses verified existing Production project/environment OIDC and internal ownerRpc transport; do not use canonical.store or notification queue operation, do not enable canonical/transport. New probe has no public/preview access or arbitrary RPC/row/body forwarding.
- Gateway fixed helper invokes existing OIDC bridge with bounded strict JSON/no redirect/no cache/deadline wrapper; claim winner alone continues. Total10seconds includes claim+Google+GAS. No timer race may continue Google after aborted/unknown claim. Claim denial maps safe fixed error; remote arbitrary strings/objects/headers never reflected or logged.
- SQL private table RLS + least privilege: anon/authenticated/PUBLIC no access; service role only EXECUTE claim RPC, no table INSERT/UPDATE/reset grant. Definer justified only for fixed private-row transition with secure search_path and explicit EXECUTE revokes. Table arm is separate exact owner-authorized SQL, not endpoint.
- Current mutable GAS deployment metadata verified APIversion2/accessMYSELF; functionsource unchanged from approved818 and audited readonly. scripts.run has no immutable-version parameter: execution requires fresh version snapshot/single-writer window; no GAS deploy in this scope.
- No source or SQL installation, control-row arming, Make mutation/run/activation, token/health/readiness, provider/customer send, credential/scope/grant/Scanner/Verifier change or old replay in this preparation turn.

## Task1 — SQL/Edge atomic control (native implementer ownership)

- [ ] Write failing Edge contract and disposable native SQL tests; retain real expected red.
- [ ] Add supabase/staging/kk-owner-health-attempt-v1.sql as reviewed install candidate, not migration-history execution. One new private table + one claim RPC (+minimal immutable-trigger helper only if necessary), no other subsystem changes.
- [ ] Add only new strict Production probe in supabase/functions/kk-runtime-ledger-oidc-probe/index.ts; fixed ownerRpc mapping, no raw reflection, no generic authority expansion. Preserve existing probes/flags.
- [ ] Add scripts/test-owner-health-attempt-native.mjs; execute actual PostgreSQL semantics in disposable PGlite, role/RLS/ACL/TTL/binding/onewinner/terminal/lostresponse tests. Label serialized PGlite concurrency limits honestly; no claim of real Production contention.
- [ ] Update canonical workflow with explicit new native test after its existing pinned disposable PGlite install. No repo dependencies or live credentials.

## Task2 — Gateway fence (gateway implementer ownership)

- [ ] Write failing health/gate tests first; keep meaningful guards and privacy tests.
- [ ] Add focused server/make-owner-health-attempt.js helper and config fields in server/kk-make-owner-notify.js, call fence in server/make-owner-canonical-off-gas-probe.js after existing gates and before Google under same10sdeadline.
- [ ] Validate exact native receipt, deny duplicates/unarmed/expired/mismatch/uncertain outcome, bound token lookup/response parse and abort continuation. No claim success replay or fallback to unfenced health.
- [ ] Update probe test fixture to provide a mocked controlled claim; existing forbidden business/native sender spies remain. Assert only dedicated control claim once, all other operational writes zero. Add simultaneous requests with single grant => one token/one health; consumed-but-lost response => zeroGoogle and no reclaim; auth/OFF => zero claim/Google.

## Task3 — Integration, review and one-approval packet (root ownership)

- [ ] Reconcile shared protocol/SQL names without weakening gates. Run focused, fullnpmtest/syntax, actual disposable native script and scoped Edge tests. Preserve red/green and result evidence.
- [ ] Genuine independent code/security review of complete diff and native claim semantics; fix material findings and verify only affected checks then full once at coherent end.
- [ ] Commit exact source on separate branch; optional draftPR/hostedCI as reversible source prep only. No protected merge/deployment.
- [ ] Render exact SQL/source/Edge hashes and one future approval covering OFF installs, one row arm with fresh dynamic deployment identity/TTL, one existing carrier module-only diagnostic, cleanup, unchanged15/11OFF. No dummy Make control needed once durable fence proven. Keep historical/staged carrier proposals explicitly superseded.
- [ ] Evaluate engineering gate honestly: source/test/review readiness distinct from uninstalled native/Edge/Gateway/live-cap acceptance. Persist latest handoff and separate preparation %, cumulativeOAuth evidence and wholeproject estimate.

## Review focus

1. Caller-supplied new nonce must not mint budget; row must be owner-preseeded and attemptIDserverconfigbound.
2. Concurrent/lostclaim reply must not permit a second Google call; never refund a consumed row.
3. TTL must be checked after lock wait with serverclock, no pre-lock stalegrant.
4. RPC/Edge cannot arm/reset or broaden generic native/provider authority; public/preview/extra fields denied.
5. A request from historical/unfenced deployment URLs is outside new deployed guard guarantee; plan cannot claimglobalexactlyonce or originalhistoricalcause recovery.
