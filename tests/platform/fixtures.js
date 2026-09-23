'use strict';
const { SqliteRepository } = require('../../platform/sqlite-repository');
const { ControlPlane } = require('../../platform/control-plane');
const C = require('../../platform/contracts');
const { POLICY_LEVELS } = require('../../server/agent-governance-contract');
const NOW = '2026-09-22T10:00:00.000Z';
const scope = { workspace_id: 'workspace-a', project_id: 'project-a' };
const capabilities = ['platform.read', 'platform.task.write', 'platform.evidence.write', 'database.stage_write', 'web.search'];
const versions = { policy_version: 'policy-1', project_pack_version: '1.0.0', workflow_version: '1.0.0', agent_version: '1.0.0', tool_contract_version: '1.0.0', capability_certificate_version: '1.0.0' };
function tool(overrides = {}) {
  return { tool_id: 'database.stage_write', version: '1.0.0',
    input_schema: { type: 'object', properties: { value: { type: 'string', maxLength: 100 } }, required: ['value'], additionalProperties: false },
    output_schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
    risk_class: 'R2', required_capability: 'database.stage_write', allowed_environments: ['local'], read_only: false, side_effect: 'LOCAL_WRITE', idempotent: true,
    timeout: 1000, retry_policy: { max_attempts: 1, backoff_ms: 0 }, approval_requirement: 'HUMAN', credential_class: 'NONE',
    network_destination: { mode: 'DENY', allowed_hosts: [] }, audit_level: 'MANDATORY', redaction_policy: 'HASH_ONLY', ...overrides };
}
function seed(repo, opts = {}) {
  const s = opts.scope || scope; const agent = opts.agent || 'agent-a';
  repo.transaction(tx => {
    for (const level of POLICY_LEVELS) {
      const policy = { ...s, policy_id: `policy-1:${level}`, policy_version: 'policy-1', scope: level,
        scope_id: { PLATFORM_HARD: 'platform', WORKSPACE: s.workspace_id, PROJECT: s.project_id, WORKFLOW: 'default', TASK: 'default' }[level],
        policy_level: level, allow_capabilities: capabilities, deny_capabilities: [], permission_ceiling: 'P4', created_at: NOW,
        activated_at: NOW, deprecated_at: null, ...(opts.policy?.(level) || {}) };
      policy.content_hash = C.contentHash(policy); tx.insert('policies', s, policy.policy_id, policy);
    }
    const cert = { ...s, certificate_id: 'certificate-a', subject_agent: agent, environment: 'local', capabilities, permission_ceiling: 'P4',
      issued_by: 'owner-a', issuer_type: 'HUMAN', issued_at: NOW, expires_at: '2026-09-23T10:00:00.000Z',
      revoked_at: null, revoked_by: null, revocation_reason: null, certificate_version: '1.0.0', ...opts.certificate };
    cert.content_hash = C.contentHash(cert, ['revoked_at', 'revoked_by', 'revocation_reason']); tx.insert('certificates', s, cert.certificate_id, cert);
    if (!opts.noKill) tx.insert('kill_switches', s, 'current', { ...s, observed_at: NOW, expires_at: '2026-09-22T11:00:00.000Z',
      controls: { AGENT_EXECUTION: false, EXTERNAL_WRITE: false, PRODUCTION_WRITE: true, DEPLOYMENT: true, SCHEDULES: true }, ...opts.kill });
  });
}
function fixture(opts = {}) {
  const repository = opts.repository || new SqliteRepository({ filename: ':memory:' }); seed(repository, opts);
  let now = NOW;
  const service = new ControlPlane({ repository, ...(opts.scope || scope), agent_id: opts.agent || 'agent-a', certificate_id: 'certificate-a', clock: () => now, tools: [tool()] });
  return { repository, service, setNow: value => { now = value; }, close: () => repository.close() };
}
function taskSpec(overrides = {}) {
  return { ...scope, ...versions, task_id: 'task-a', objective: 'Synthetic local control-plane validation', agent_role: 'agent-a', risk_class: 'R3', permission_ceiling: 'P4',
    requested_capabilities: capabilities, budget: { steps: 10, tool_calls: 5, retries: 3, cost: 100 }, ...overrides };
}
function running(f, overrides = {}) {
  let task = f.service.createTask(taskSpec(overrides), 'create-a');
  for (const next of ['VALIDATING', 'READY', 'PLANNING']) task = f.service.transitionTask(task.task_id, task.version, next, versions.policy_version, `transition-${next}`);
  const run = f.service.startRun(task.task_id, task.version, { ...versions, run_id: 'run-a', model_provider: 'fixture', model_id: 'synthetic-no-calls', skill_versions: ['1.0.0'], budget: task.budget }, 'start-a');
  return { task: f.service.getTask(task.task_id, versions.policy_version), run };
}
function request(overrides = {}) { return { ...scope, tool_id: 'database.stage_write', tool_version: '1.0.0', task_id: 'task-a', run_id: 'run-a', environment: 'local', idempotency_key: 'tool-a', target: 'synthetic-record', input: { value: 'candidate' }, ...overrides }; }
function approve(f, req = request(), overrides = {}) {
  const { prepareToolCall } = require('../../platform/tool-gateway');
  const intent = prepareToolCall({ request: req, contract: tool() });
  const approval = { ...scope, approval_id: 'approval-a', proposal_id: req.proposal_id || req.idempotency_key, environment: 'local', target: req.target,
    capability: 'database.stage_write', risk_class: 'R2', diff_hash: intent.payload_hash, nonce: 'nonce-a', approved_by: 'owner-a', actor_type: 'HUMAN',
    approved_at: NOW, expires_at: '2026-09-22T10:30:00.000Z', consumed_at: null, status: 'APPROVED', ...overrides };
  f.repository.transaction(tx => tx.insert('approvals', { workspace_id: approval.workspace_id, project_id: approval.project_id }, approval.approval_id, approval));
  return approval;
}
module.exports = { NOW, scope, capabilities, versions, tool, seed, fixture, taskSpec, running, request, approve };
