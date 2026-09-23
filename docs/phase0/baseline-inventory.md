# Baseline and reuse inventory

Inspection date: 2026-09-22. Repository: `mikesd1995/kk-phone-rental-vercel`.

The task's baseline inspection confirmed:

- Initial main: `9588391d8caa7e40eb1381dc98e86b6873f155ae`.
- PR #152 HEAD: `0bb2c07522c706d02f1edcf6bb9cfb5c74dd96b0`, equal to the owner's pinned governance baseline.
- Foundation branch: `agent-platform-hardening-v1-20260922`.
- Phase-0 branch: `ai-platform-phase0-control-plane`; stacked draft target is the foundation branch while #152 is unmerged.
- Tracker: [Issue #153](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/153).

These are source-control observations for the inspected baseline, not a statement that remote branches remain unchanged indefinitely. Do not automatically rebase, retarget, merge, force-push or squash the validated stack. Reinspect and report exact drift before adapting a changed baseline.

The pre-publication refresh observed main advance seven commits to `c15ee5c4c60e810f023542df4302f2b984f00791`, covering admin outage, storefront UX and Vercel preview-budget work. PR #152 still matched its pinned HEAD and remained unmerged; GitHub reported `mergeable=false` against main. The Phase-0 stacked base remains the pinned foundation without rebase or retarget. Eventual foundation-to-main reconciliation is pending separately governed owner work, not silently resolved by this implementation.

The same refresh observed an unrelated main production deployment `dpl_8wEFecSLHHjEeVMg6NJV6XVcLPnU` at `c15ee5c4c60e810f023542df4302f2b984f00791`, reported READY. That existing deployment is not a Phase-0 deployment or proof of this foundation's runtime acceptance.

## Existing mechanisms preserved

| Existing files | Reuse and boundary |
| --- | --- |
| `server/agent-governance-contract.js`; `tests/agent-governance-contract.test.js` | Reuse policy intersection, deny precedence, hard-governance refusal and canonical change hashing. Service requires complete trusted policy layers and full scoped approval binding around minimal helpers. |
| `server/capability-improvement-contract.js`; matching test | Preserve candidate-only learning and independent-evaluation concepts. Phase 0 persists candidates; no promotion engine is activated. |
| `server/control-plane-contract.js`; matching test | Preserve exact Manifest/WriteTransaction headers, strict maximum-plus-one fencing, exact1 locks/Manifest, terminal status, release and unresolved-transaction checks. These audit KK runtime evidence; they are not the generic task store. |
| `server/control-plane-persistence.js`, `control-plane-evidence-snapshot.js`; corresponding tests/scripts | Preserve task identity/prompt fingerprint, natural occurrence and role-specific exact readbacks. KK +07:00 Scanner :00 / Verifier :30 assumptions remain in the KK auditor. |
| `server/runtime-ledger.js`, `runtime-ledger-oidc-bridge.js`; `supabase/staging/kk-runtime-ledger-v1*.sql` | Existing Supabase witness telemetry, canonical project binding and idempotent occurrence insertion. No imports into the new local store; no live migration/provisioning. |
| `api/kk-scanner-dispatch.js`, `server/external-scanner-*.js`, `cloudflare/kk-scanner-clock.mjs` | Existing external witness/transition contracts remain separate; witness telemetry does not prove Scanner business execution. |
| `server/canary-acceptance.js`; matching test/audit script | Preserve scenario-specific evidence, provenance and zero-business-write requirements. Synthetic platform tests do not certify natural Canary runs. |
| `apps-script/Code.gs`, `scripts/verify-apps-script-upstream.js`, recovery and atomic-reservation tests | Preserve document-lock and existing reservation/recovery behavior. No Apps Script edits or deployment. |
| `server/hf-event-assist.js`, `hf-scanner-wiring-contract.js`, `hf-scanner-adapter.js` | Preserve default-OFF advisory provider boundary, candidate/run binding, Active policy, exact fresh locks, frozen Manifest/fence and authorized Planner checks. No provider activation. |
| `server/discovery-source-watch-contract.js`; corresponding tests | Preserve source provenance, freshness, hash/change validation; unchanged observations make zero downstream calls, changed observations permit one staging-only stage. |
| `tests/hf-external-scanner-isolation.test.js` | Existing import-isolation pattern extended with a transitive graph barrier for all new platform/pack code. |
| `.agents/skills/kk-discovery-scanner`, `kk-event-verifier`, `kk-canary-safety`, `kk-discovery-source-watch`, `kk-capability-improvement` | Existing SKILL.md files referenced without copying; Scanner staging-only, Verifier adjudication, Canary zero-write and candidate-only improvement remain intact. |
| `vercel.json`, `.github/workflows/admin-regression.yml` | Existing production routes reviewed; no new runtime route. CI needs explicit stacked-branch coverage and a separate Node 24 platform test runtime; existing production runtime remains unchanged. |
| `.github/workflows/kk-external-witness-clock.yml`, `hf-event-assist-uat.yml`, `discovery-crawl4ai-uat.yml`, `bounded-oidc-production-acceptance.yml` | Existing operational/UAT workflows inspected as context; no scheduler/provider activation or modification is needed for Phase 0. |

No repository AGENTS.md was present in the inspected hidden-file inventory; the owner's supplied instructions and existing repository skills remain applicable.

## Authority and unresolved live facts

Machine SOT plus the highest compatible Active _Policy_Registry remain KK business/runtime authority. Repository snapshots, architecture documents and pack metadata cannot replace them. This source inventory does not verify live policy values, writer leases, provider delivery, natural task persistence or deployment state.

The original architecture/hardening documents explicitly identified missing persistence, gateway, durable recovery, registry and Project Pack foundations. Phase 0 implements isolated local primitives for these gaps rather than replacing stable production subsystems. A later integration must inspect live state and obtain its own runtime/provider/readback acceptance.

Reference baseline documents: `docs/AI_AGENT_PLATFORM_ARCHITECTURE_V1_2026-09-22.md` and `docs/AI_AGENT_PLATFORM_HARDENING_CHANGELOG_2026-09-22.md`. Their historical CI/preview claims are not final Phase-0 acceptance.
