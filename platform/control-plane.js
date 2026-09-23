'use strict';

// Trusted host service. Agents receive a scope-bound facade, never this repository.
const { randomUUID } = require('node:crypto');
const G = require('../server/agent-governance-contract');
const C = require('./contracts');
const { prepareToolCall, validateToolContract } = require('./tool-gateway');
const { requireThat: check } = C;

class ControlPlane {
  #repo; #scope; #agent; #certificate; #clock; #tools;
  constructor({ repository, workspace_id, project_id, agent_id, certificate_id, clock = () => new Date().toISOString(), tools = [] }) {
    this.#repo = repository;
    this.#scope = Object.freeze({ workspace_id: C.id(workspace_id), project_id: C.id(project_id) });
    this.#agent = C.id(agent_id); this.#certificate = C.id(certificate_id); this.#clock = clock;
    this.#tools = new Map();
    for (const contract of tools) { validateToolContract(contract); const key = `${contract.tool_id}@${contract.version}`; check(!this.#tools.has(key), 'TOOL_VERSION_DUPLICATE'); this.#tools.set(key, structuredClone(contract)); }
  }
  #now() { return C.utc(this.#clock()); }
  #get(tx, kind, id) { return tx.get(kind, this.#scope, C.id(id)); }
  #must(tx, kind, id) { const r = this.#get(tx, kind, id); check(r, 'RECORD_NOT_FOUND'); return r; }
  #put(tx, kind, id, record) { return tx.insert(kind, this.#scope, id, { ...record, ...this.#scope }); }
  #replace(tx, kind, record, expected) { return tx.replace(kind, this.#scope, record.id, record, expected); }
  #task(tx, id) { const t = this.#must(tx, 'tasks', id); check(t.agent_role === this.#agent, 'AGENT_SCOPE_VIOLATION'); return t; }
  #active(t) { check(!C.TERMINAL.has(t.status), 'TERMINAL_STATE_IMMUTABLE'); }
  #bind(task, policy, authority, run = null, capability = 'platform.task.write') {
    check(task.policy_version === policy && task.capability_certificate_version === authority.certificate.certificate_version, 'CONFIGURATION_VERSION_DRIFT');
    check(C.rank(task.permission_ceiling, 'P', 4) <= Math.min(C.rank(authority.policy.permission_ceiling, 'P', 4), C.rank(authority.certificate.permission_ceiling, 'P', 4)), 'PERMISSION_CEILING_EXCEEDED');
    check(task.granted_capabilities.every(c => G.capabilityAllowed(c, authority.policy) && authority.certificate.capabilities.includes(c)), 'CONFIGURATION_VERSION_DRIFT');
    check(task.granted_capabilities.includes(capability), 'TASK_CAPABILITY_DENIED');
    if (run) check(run.task_id === task.task_id && run.agent_role === this.#agent && C.VERSION_KEYS.every(k => run[k] === task[k]), 'CONFIGURATION_VERSION_DRIFT');
  }
  #auditHistory(tx) {
    const rows = tx.list('audit', this.#scope).sort((a, b) => a.sequence - b.sequence);
    let hash = null; let sequence = 0;
    for (const row of rows) {
      check(row.previous_event_hash === hash && row.sequence === ++sequence && row.event_hash === C.contentHash(row, ['event_hash']), 'AUDIT_INTEGRITY_FAILURE');
      hash = row.event_hash;
    }
    return rows;
  }
  #auth(tx, policyVersion, capability, now, { diagnostic = false } = {}) {
    C.text(policyVersion, 'POLICY_IDENTITY_REQUIRED'); G.assertCapabilityNotHardGovernance(capability);
    const records = tx.list('policies', this.#scope).filter(p => p.policy_version === policyVersion);
    check(records.length === G.POLICY_LEVELS.length, 'POLICY_MISSING_OR_AMBIGUOUS');
    const seen = new Set();
    const layers = records.map(p => {
      check(G.POLICY_LEVELS.includes(p.policy_level) && !seen.has(p.policy_level), 'POLICY_MISSING_OR_AMBIGUOUS'); seen.add(p.policy_level);
      C.id(p.policy_id); C.text(p.scope_id); check(p.scope === p.policy_level, 'POLICY_SCOPE_INVALID');
      const scopeId = { PLATFORM_HARD: 'platform', WORKSPACE: this.#scope.workspace_id, PROJECT: this.#scope.project_id, WORKFLOW: 'default', TASK: 'default' }[p.policy_level];
      check(p.scope_id === scopeId, 'PROJECT_SCOPE_VIOLATION');
      check(p.content_hash === C.contentHash(p, ['content_hash']), 'POLICY_HASH_MISMATCH');
      C.utc(p.created_at); C.utc(p.activated_at); check(Date.parse(p.activated_at) <= Date.parse(now) && p.deprecated_at === null, 'POLICY_INACTIVE');
      C.rank(p.permission_ceiling, 'P', 4); C.strings(p.allow_capabilities); C.strings(p.deny_capabilities);
      return { level: p.policy_level, allow: p.allow_capabilities, deny: p.deny_capabilities, permission_ceiling: p.permission_ceiling };
    });
    const resolved = G.resolvePolicyLayers(layers);
    check(G.capabilityAllowed(capability, resolved), 'POLICY_DENIED');
    const cert = this.#must(tx, 'certificates', this.#certificate);
    check(cert.subject_agent === this.#agent && cert.environment === 'local', 'CERTIFICATE_SCOPE_MISMATCH');
    check(cert.issued_by && cert.issued_by !== this.#agent && ['HUMAN', 'PLATFORM'].includes(cert.issuer_type), 'CERTIFICATE_ISSUER_INVALID');
    C.utc(cert.issued_at); C.utc(cert.expires_at);
    check(Date.parse(cert.issued_at) <= Date.parse(now) && Date.parse(cert.expires_at) > Date.parse(now), 'CERTIFICATE_EXPIRED');
    check(cert.revoked_at === null && cert.revoked_by === null && cert.revocation_reason === null, 'CERTIFICATE_REVOKED');
    check(cert.content_hash === C.contentHash(cert, ['content_hash', 'revoked_at', 'revoked_by', 'revocation_reason']), 'CERTIFICATE_HASH_MISMATCH');
    C.rank(cert.permission_ceiling, 'P', 4); C.strings(cert.capabilities); C.text(cert.certificate_version);
    check(cert.capabilities.includes(capability), 'CERTIFICATE_CAPABILITY_DENIED');
    const kill = this.#get(tx, 'kill_switches', 'current');
    check(kill && typeof kill.expires_at === 'string' && typeof kill.observed_at === 'string', 'KILL_SWITCH_UNAVAILABLE');
    C.utc(kill.observed_at); C.utc(kill.expires_at);
    check(Date.parse(kill.observed_at) <= Date.parse(now) && Date.parse(kill.expires_at) > Date.parse(now), 'KILL_SWITCH_UNAVAILABLE');
    check(C.SWITCHES.every(k => typeof kill.controls?.[k] === 'boolean'), 'KILL_SWITCH_UNAVAILABLE');
    if (!diagnostic) check(kill.controls.AGENT_EXECUTION === false, 'KILL_SWITCH_ACTIVE');
    return { policy: resolved, certificate: cert, kill_switch: kill };
  }
  #audit(tx, event, policy, target, before, after, now, metadata = {}) {
    const previous = this.#auditHistory(tx).at(-1);
    const record = { event_id: randomUUID(), event_type: event, ...this.#scope, task_id: after?.task_id || before?.task_id || null,
      run_id: after?.run_id || before?.run_id || null, actor_type: 'AGENT', actor_id: this.#agent, timestamp: now,
      policy_version: policy, target_type: target.type, target_id: target.id,
      before_hash: before ? C.changeHash(before) : null, after_hash: after ? C.changeHash(after) : null,
      previous_event_hash: previous?.event_hash || null, sequence: (previous?.sequence || 0) + 1, metadata,
      data_classification: 'INTERNAL', retention_class: C.RETENTION.audit };
    record.event_hash = C.contentHash(record); C.assertSafeData(record);
    try { return this.#put(tx, 'audit', record.event_id, record); } catch { C.fail('AUDIT_WRITE_FAILED'); }
  }
  #operation({ operation, key, policy, capability, request, diagnostic = false }, fn) {
    C.id(key); C.assertSafeData(request); const now = this.#now();
    const hash = C.changeHash({ operation, request, agent: this.#agent, certificate: this.#certificate, policy });
    const identity = C.changeHash({ ...this.#scope, operation, key });
    return this.#repo.transaction(tx => {
      const authority = this.#auth(tx, policy, capability, now, { diagnostic });
      this.#auditHistory(tx);
      const prior = this.#get(tx, 'idempotency', identity);
      if (prior) { check(prior.request_hash === hash, 'IDEMPOTENCY_CONFLICT'); return structuredClone(prior.result); }
      const result = fn(tx, now, authority);
      this.#put(tx, 'idempotency', identity, { operation, idempotency_key: key, request_hash: hash, result, created_at: now });
      return result;
    });
  }
  getTask(task_id, policy_version) { return this.#repo.transaction(tx => { this.#auth(tx, policy_version, 'platform.read', this.#now(), { diagnostic: true }); return this.#task(tx, task_id); }); }
  listAudit(policy_version) { return this.#repo.transaction(tx => { this.#auth(tx, policy_version, 'platform.read', this.#now(), { diagnostic: true }); return this.#auditHistory(tx); }); }
  createTask(spec, key) {
    C.id(spec.task_id); C.text(spec.objective); C.versions(spec); C.rank(spec.risk_class, 'R', 3); C.rank(spec.permission_ceiling, 'P', 4);
    C.strings(spec.requested_capabilities); C.budget(spec.budget); check(spec.agent_role === this.#agent, 'AGENT_SCOPE_VIOLATION');
    check(spec.workspace_id === this.#scope.workspace_id && spec.project_id === this.#scope.project_id, 'PROJECT_SCOPE_VIOLATION');
    return this.#operation({ operation: 'task.create', key, policy: spec.policy_version, capability: 'platform.task.write', request: spec }, (tx, now, authority) => {
      check(C.rank(spec.permission_ceiling, 'P', 4) <= Math.min(C.rank(authority.policy.permission_ceiling, 'P', 4), C.rank(authority.certificate.permission_ceiling, 'P', 4)), 'PERMISSION_CEILING_EXCEEDED');
      check(spec.requested_capabilities.every(c => G.capabilityAllowed(c, authority.policy) && authority.certificate.capabilities.includes(c) && !G.isHardGovernanceCapability(c)), 'CAPABILITY_DENIED');
      check(C.rank(spec.permission_ceiling, 'P', 4) >= (spec.requested_capabilities.some(c => c !== 'platform.read' && c !== 'web.search') ? 2 : 0), 'PERMISSION_CEILING_EXCEEDED');
      check(spec.capability_certificate_version === authority.certificate.certificate_version, 'CONFIGURATION_VERSION_DRIFT');
      const task = { ...C.versions(spec), task_id: spec.task_id, objective: spec.objective, risk_class: spec.risk_class, agent_role: this.#agent,
        status: 'CREATED', idempotency_key: key, created_at: now, updated_at: now, started_at: null, finished_at: null,
        max_steps: spec.budget.steps, max_tool_calls: spec.budget.tool_calls, max_retries: spec.budget.retries, max_cost: spec.budget.cost,
        budget: spec.budget, used: C.zeroBudget(), allocated: C.zeroBudget(), current_step: 0,
        requested_capabilities: spec.requested_capabilities, granted_capabilities: spec.requested_capabilities, permission_ceiling: spec.permission_ceiling,
        capability_certificate_id: this.#certificate,
        failure_code: null, failure_reason: null, root_task_id: spec.task_id, parent_task_id: null, parent_run_id: null,
        causation_id: spec.task_id, correlation_id: spec.task_id, trace_id: randomUUID(), delegation_depth: 0,
        recovery_state: 'NONE', recovery_owner_run_id: null, recovery_attempts: 0, recovery_due_at: null, last_recovery_at: null, recovery_result: null, fencing_token: 0,
        compensation_required: false, compensation_action: null, compensation_status: 'NOT_REQUIRED',
        kill_switch_snapshot: C.changeHash(authority.kill_switch), data_classification: 'INTERNAL', retention_class: C.RETENTION.tasks };
      const out = this.#put(tx, 'tasks', task.task_id, task); this.#audit(tx, 'TASK_CREATED', spec.policy_version, { type: 'task', id: task.task_id }, null, out, now); return out;
    });
  }
  transitionTask(task_id, expected_version, next, policy_version, key) {
    return this.#operation({ operation: 'task.transition', key, policy: policy_version, capability: 'platform.task.write', request: { task_id, expected_version, next } }, (tx, now, authority) => {
      const before = this.#task(tx, task_id); this.#bind(before, policy_version, authority); C.transition(before.status, next);
      check(before.status !== 'RECOVERING', 'LEASE_CONFLICT');
      const after = this.#replace(tx, 'tasks', { ...before, status: next, updated_at: now, finished_at: C.TERMINAL.has(next) ? now : null }, expected_version);
      if (C.TERMINAL.has(next)) {
        for (const run of tx.list('runs', this.#scope).filter(r => r.task_id === task_id && !C.TERMINAL.has(r.status))) {
          this.#replace(tx, 'runs', { ...run, status: next === 'REJECTED' ? 'FAILED' : next, finished_at: now,
            result_classification: next === 'SUCCEEDED' ? 'LOCAL_FOUNDATION_RESULT' : 'PARTIAL_RESULT' }, run.version);
        }
      }
      this.#audit(tx, C.TERMINAL.has(next) ? 'TASK_COMPLETED' : 'TASK_TRANSITIONED', policy_version, { type: 'task', id: task_id }, before, after, now); return after;
    });
  }
  startRun(task_id, expected_version, spec, key) {
    C.id(spec.run_id); C.text(spec.model_provider); C.text(spec.model_id); C.strings(spec.skill_versions); C.versions(spec); C.budget(spec.budget);
    return this.#operation({ operation: 'run.start', key, policy: spec.policy_version, capability: 'platform.task.write', request: { task_id, expected_version, spec } }, (tx, now, authority) => {
      const before = this.#task(tx, task_id); check(before.status === 'PLANNING', 'INVALID_TASK_TRANSITION');
      this.#bind(before, spec.policy_version, authority);
      check(C.VERSION_KEYS.every(k => spec[k] === before[k]) && spec.capability_certificate_version === authority.certificate.certificate_version, 'CONFIGURATION_VERSION_DRIFT');
      check(C.BUDGET_KEYS.every(k => spec.budget[k] <= before.budget[k] - before.used[k] - before.allocated[k]), 'BUDGET_EXCEEDED');
      check(!tx.list('runs', this.#scope).some(r => r.task_id === task_id && ['RUNNING', 'RECOVERING'].includes(r.status)), 'LEASE_CONFLICT');
      const after = this.#replace(tx, 'tasks', { ...before, status: 'RUNNING', updated_at: now, started_at: now }, expected_version);
      const run = this.#put(tx, 'runs', spec.run_id, { ...C.versions(spec), run_id: spec.run_id, task_id, agent_role: this.#agent,
        model_provider: spec.model_provider, model_id: spec.model_id, skill_versions: spec.skill_versions, started_at: now, finished_at: null, status: 'RUNNING',
        steps_used: 0, tool_calls_used: 0, input_tokens: 0, output_tokens: 0, estimated_cost: 0, used: C.zeroBudget(), budget: spec.budget,
        checkpoint_id: null, result_classification: null, error_code: null, capability_certificate_id: this.#certificate, kill_switch_snapshot: C.changeHash(authority.kill_switch),
        data_classification: 'INTERNAL', retention_class: C.RETENTION.runs });
      this.#audit(tx, 'TASK_STARTED', spec.policy_version, { type: 'task', id: task_id }, before, after, now);
      this.#audit(tx, 'MODEL_SELECTED', spec.policy_version, { type: 'run', id: run.run_id }, null, run, now); return run;
    });
  }
  #charge(tx, task, run, delta, now) {
    C.budget(delta); this.#active(task); check(task.status === 'RUNNING' && run.status === 'RUNNING', 'RUN_NOT_ACTIVE');
    const exhausted = C.BUDGET_KEYS.some(k => task.used[k] + task.allocated[k] + delta[k] > task.budget[k] || run.used[k] + delta[k] > run.budget[k]);
    if (exhausted) {
      const after = this.#replace(tx, 'tasks', { ...task, status: 'FAILED', failure_code: 'BUDGET_EXCEEDED', failure_reason: 'BUDGET_EXCEEDED', finished_at: now, updated_at: now }, task.version);
      this.#replace(tx, 'runs', { ...run, status: 'FAILED', finished_at: now, result_classification: 'PARTIAL_RESULT', error_code: 'BUDGET_EXCEEDED' }, run.version);
      this.#audit(tx, 'BUDGET_EXCEEDED', task.policy_version, { type: 'task', id: task.task_id }, task, after, now);
      return { stopped: true, error_code: 'BUDGET_EXCEEDED', result_classification: 'PARTIAL_RESULT' };
    }
    const used = Object.fromEntries(C.BUDGET_KEYS.map(k => [k, task.used[k] + delta[k]]));
    const runUsed = Object.fromEntries(C.BUDGET_KEYS.map(k => [k, run.used[k] + delta[k]]));
    const nextTask = this.#replace(tx, 'tasks', { ...task, used, current_step: used.steps, updated_at: now }, task.version);
    const nextRun = this.#replace(tx, 'runs', { ...run, used: runUsed, steps_used: runUsed.steps, tool_calls_used: runUsed.tool_calls, estimated_cost: runUsed.cost }, run.version);
    return { stopped: false, task: nextTask, run: nextRun };
  }
  consumeBudget(task_id, run_id, delta, policy_version, key) {
    return this.#operation({ operation: 'budget.consume', key, policy: policy_version, capability: 'platform.task.write', request: { task_id, run_id, delta } }, (tx, now, authority) => {
      const task = this.#task(tx, task_id); const run = this.#must(tx, 'runs', run_id); check(run.task_id === task_id && task.policy_version === policy_version, 'PROJECT_SCOPE_VIOLATION');
      this.#bind(task, policy_version, authority, run);
      const result = this.#charge(tx, task, run, delta, now); if (!result.stopped) this.#audit(tx, 'BUDGET_CONSUMED', policy_version, { type: 'run', id: run_id }, run, result.run, now); return result;
    });
  }
  recordModelUsage(task_id, run_id, usage, policy_version, key) {
    check(usage && ['input_tokens', 'output_tokens', 'cost'].every(k => Number.isSafeInteger(usage[k]) && usage[k] >= 0), 'BUDGET_INVALID');
    return this.#operation({ operation: 'model.usage', key, policy: policy_version, capability: 'platform.task.write', request: { task_id, run_id, usage } }, (tx, now, authority) => {
      const task = this.#task(tx, task_id); const run = this.#must(tx, 'runs', run_id); this.#bind(task, policy_version, authority, run);
      check(Number.isSafeInteger(run.input_tokens + usage.input_tokens) && Number.isSafeInteger(run.output_tokens + usage.output_tokens), 'BUDGET_INVALID');
      const result = this.#charge(tx, task, run, { steps: 0, tool_calls: 0, retries: 0, cost: usage.cost }, now);
      if (result.stopped) return result;
      const after = this.#replace(tx, 'runs', { ...result.run, input_tokens: run.input_tokens + usage.input_tokens, output_tokens: run.output_tokens + usage.output_tokens }, result.run.version);
      this.#audit(tx, 'MODEL_USAGE_RECORDED', policy_version, { type: 'run', id: run_id }, run, after, now); return after;
    });
  }
  delegate(task_id, parent_run_id, child, policy_version, key) {
    C.id(child.task_id); C.id(child.agent_role); C.budget(child.budget); C.strings(child.requested_capabilities); C.rank(child.permission_ceiling, 'P', 4); C.rank(child.risk_class, 'R', 3); C.text(child.objective);
    return this.#operation({ operation: 'task.delegate', key, policy: policy_version, capability: 'platform.task.write', request: { task_id, parent_run_id, child } }, (tx, now, authority) => {
      const p = this.#task(tx, task_id); this.#active(p); const run = this.#must(tx, 'runs', parent_run_id);
      this.#bind(p, policy_version, authority, run); check(p.status === 'RUNNING', 'RUN_NOT_ACTIVE');
      check(run.task_id === task_id && run.status === 'RUNNING' && p.policy_version === policy_version, 'RUN_NOT_ACTIVE'); check(p.delegation_depth < 3, 'DELEGATION_DEPTH_EXCEEDED');
      check((child.workspace_id ?? p.workspace_id) === p.workspace_id && (child.project_id ?? p.project_id) === p.project_id, 'PROJECT_SCOPE_VIOLATION');
      check(C.rank(child.permission_ceiling, 'P', 4) <= C.rank(p.permission_ceiling, 'P', 4) && C.rank(child.risk_class, 'R', 3) <= C.rank(p.risk_class, 'R', 3), 'DELEGATION_CEILING_EXCEEDED');
      check(child.requested_capabilities.every(c => p.granted_capabilities.includes(c)), 'DELEGATION_CAPABILITY_DENIED');
      check(C.BUDGET_KEYS.every(k => child.budget[k] <= p.budget[k] - p.used[k] - p.allocated[k]), 'BUDGET_EXCEEDED');
      this.#replace(tx, 'tasks', { ...p, allocated: Object.fromEntries(C.BUDGET_KEYS.map(k => [k, p.allocated[k] + child.budget[k]])), updated_at: now }, p.version);
      const data = { ...p, task_id: child.task_id, agent_role: child.agent_role, objective: child.objective, status: 'CREATED', created_at: now, updated_at: now, started_at: null, finished_at: null,
        permission_ceiling: child.permission_ceiling, risk_class: child.risk_class, requested_capabilities: child.requested_capabilities, granted_capabilities: child.requested_capabilities,
        budget: child.budget, used: C.zeroBudget(), allocated: C.zeroBudget(), max_steps: child.budget.steps, max_tool_calls: child.budget.tool_calls, max_retries: child.budget.retries, max_cost: child.budget.cost,
        current_step: 0, idempotency_key: key, parent_task_id: task_id, parent_run_id, causation_id: parent_run_id, delegation_depth: p.delegation_depth + 1,
        recovery_state: 'NONE', recovery_owner_run_id: null, recovery_attempts: 0, recovery_due_at: null, last_recovery_at: null, recovery_result: null, fencing_token: 0 };
      delete data.id; delete data.version;
      const out = this.#put(tx, 'tasks', child.task_id, data); this.#audit(tx, 'TASK_DELEGATED', policy_version, { type: 'task', id: child.task_id }, null, out, now); return out;
    });
  }
  saveCheckpoint(task_id, run_id, spec, policy_version, key) {
    C.id(spec.checkpoint_id); C.strings(spec.completed_steps); C.strings(spec.pending_steps); C.assertSafeData(spec.checkpoint_payload);
    check(spec.completed_steps.every(s => !spec.pending_steps.includes(s)), 'CHECKPOINT_INVALID');
    return this.#operation({ operation: 'checkpoint.save', key, policy: policy_version, capability: 'platform.task.write', request: { task_id, run_id, spec } }, (tx, now, authority) => {
      const task = this.#task(tx, task_id); this.#active(task); const run = this.#must(tx, 'runs', run_id); check(run.task_id === task_id && run.status === 'RUNNING' && task.policy_version === policy_version, 'RUN_NOT_ACTIVE');
      this.#bind(task, policy_version, authority, run); check(task.status === 'RUNNING', 'RUN_NOT_ACTIVE');
      const cp = { ...C.versions(run), ...this.#scope, checkpoint_id: spec.checkpoint_id, task_id, run_id, current_step: task.current_step,
        completed_steps: spec.completed_steps, pending_steps: spec.pending_steps, checkpoint_payload: spec.checkpoint_payload,
        budget_remaining: Object.fromEntries(C.BUDGET_KEYS.map(k => [k, Math.min(task.budget[k] - task.used[k] - task.allocated[k], run.budget[k] - run.used[k])])),
        last_successful_tool_call: spec.last_successful_tool_call || null, recovery_attempts: task.recovery_attempts,
        created_at: now, data_classification: 'INTERNAL', retention_class: C.RETENTION.checkpoints };
      cp.checkpoint_hash = C.contentHash(cp);
      const out = this.#put(tx, 'checkpoints', cp.checkpoint_id, cp); this.#replace(tx, 'runs', { ...run, checkpoint_id: cp.checkpoint_id }, run.version);
      this.#audit(tx, 'CHECKPOINT_SAVED', policy_version, { type: 'checkpoint', id: cp.checkpoint_id }, null, out, now); return out;
    });
  }
  resumeCheckpoint(checkpoint_id, recovery_owner_run_id, currentVersions, key) {
    C.id(recovery_owner_run_id); C.versions(currentVersions);
    return this.#operation({ operation: 'checkpoint.resume', key, policy: currentVersions.policy_version, capability: 'platform.task.write', request: { checkpoint_id, recovery_owner_run_id, currentVersions } }, (tx, now, authority) => {
      const cp = this.#must(tx, 'checkpoints', checkpoint_id); check(cp.checkpoint_hash === C.contentHash(cp, ['checkpoint_hash']), 'CHECKPOINT_CORRUPT');
      check(C.VERSION_KEYS.every(k => cp[k] === currentVersions[k]) && currentVersions.capability_certificate_version === authority.certificate.certificate_version, 'CHECKPOINT_VERSION_DRIFT');
      const task = this.#task(tx, cp.task_id); this.#active(task); const run = this.#must(tx, 'runs', cp.run_id);
      this.#bind(task, currentVersions.policy_version, authority, run);
      const owner = this.#must(tx, 'runs', recovery_owner_run_id); check(owner.task_id === task.task_id && owner.agent_role === this.#agent, 'PROJECT_SCOPE_VIOLATION');
      check(['RUNNING', 'RECOVERING', 'RETRY_PENDING'].includes(task.status) && run.status === 'RUNNING', 'RUN_NOT_ACTIVE');
      check(!task.recovery_due_at || Date.parse(task.recovery_due_at) <= Date.parse(now), 'LEASE_CONFLICT');
      check(task.used.retries + task.allocated.retries < task.budget.retries && run.used.retries < run.budget.retries, 'BUDGET_EXCEEDED');
      const out = this.#replace(tx, 'tasks', { ...task, status: 'RECOVERING', recovery_state: 'OWNED', recovery_owner_run_id,
        recovery_attempts: task.recovery_attempts + 1, used: { ...task.used, retries: task.used.retries + 1 },
        recovery_due_at: new Date(Date.parse(now) + 30000).toISOString(), last_recovery_at: now, fencing_token: task.fencing_token + 1, updated_at: now }, task.version);
      this.#replace(tx, 'runs', { ...run, used: { ...run.used, retries: run.used.retries + 1 } }, run.version);
      this.#audit(tx, 'RECOVERY_CLAIMED', task.policy_version, { type: 'task', id: task.task_id }, task, out, now);
      return { task: out, checkpoint: cp, fence: out.fencing_token };
    });
  }
  finishRecovery(task_id, owner, fence, policy_version, key) {
    return this.#operation({ operation: 'recovery.finish', key, policy: policy_version, capability: 'platform.task.write', request: { task_id, owner, fence } }, (tx, now, authority) => {
      const task = this.#task(tx, task_id); check(task.status === 'RECOVERING' && task.recovery_owner_run_id === owner && task.fencing_token === fence && Date.parse(task.recovery_due_at) > Date.parse(now), 'LEASE_CONFLICT');
      this.#bind(task, policy_version, authority);
      const out = this.#replace(tx, 'tasks', { ...task, status: 'RUNNING', recovery_state: 'COMPLETED', recovery_result: 'CHECKPOINT_VALIDATED_NO_TOOL_REPLAY', recovery_due_at: null, updated_at: now }, task.version);
      this.#audit(tx, 'RECOVERY_COMPLETED', policy_version, { type: 'task', id: task_id }, task, out, now); return out;
    });
  }
  stageToolIntent(request, policy_version, approval_id, key) {
    try { return this.#stageToolIntent(request, policy_version, approval_id, key); }
    catch (error) {
      // Denial evidence is a separate diagnostic transaction after the governed
      // transaction has rolled back. It contains only hashes/known error codes.
      if (error.code === 'AUDIT_WRITE_FAILED' || error.code === 'AUDIT_INTEGRITY_FAILURE') throw error;
      const code = typeof error.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : 'TOOL_SCHEMA_MISMATCH';
      const now = this.#now(); const denial = C.changeHash({ key: typeof key === 'string' ? key : null, agent: this.#agent, code });
      this.#repo.transaction(tx => {
        if (this.#get(tx, 'idempotency', denial)) return;
        const event = this.#audit(tx, 'TOOL_DENIED', typeof policy_version === 'string' ? policy_version : 'UNKNOWN', { type: 'tool_request', id: denial }, null, null, now, { error_code: code });
        this.#put(tx, 'idempotency', denial, { operation: 'tool.denied', idempotency_key: denial, request_hash: denial, result: { event_id: event.event_id, error_code: code }, created_at: now });
      });
      C.fail(code);
    }
  }
  #stageToolIntent(request, policy_version, approval_id, key) {
    const contract = this.#tools.get(`${request.tool_id}@${request.tool_version}`); check(contract, 'TOOL_UNKNOWN');
    const intent = prepareToolCall({ request, contract });
    check(request.workspace_id === this.#scope.workspace_id && request.project_id === this.#scope.project_id && request.environment === 'local', 'PROJECT_SCOPE_VIOLATION');
    check(request.idempotency_key === key, 'IDEMPOTENCY_CONFLICT');
    return this.#operation({ operation: 'tool.stage', key, policy: policy_version, capability: contract.required_capability, request: { request, approval_id: approval_id || null } }, (tx, now, authority) => {
      const task = this.#task(tx, request.task_id); const run = this.#must(tx, 'runs', request.run_id);
      this.#bind(task, policy_version, authority, run, contract.required_capability);
      check(run.task_id === task.task_id && task.policy_version === policy_version, 'PROJECT_SCOPE_VIOLATION');
      check(task.granted_capabilities.includes(contract.required_capability), 'CAPABILITY_DENIED');
      check(task.tool_contract_version === contract.version && run.capability_certificate_version === authority.certificate.certificate_version, 'CONFIGURATION_VERSION_DRIFT');
      check(C.rank(contract.risk_class, 'R', 3) <= C.rank(task.risk_class, 'R', 3), 'RISK_CEILING_EXCEEDED');
      check(C.rank(task.permission_ceiling, 'P', 4) >= ({ R0: 0, R1: 1, R2: 2, R3: 4 }[contract.risk_class]), 'PERMISSION_CEILING_EXCEEDED');
      if (contract.side_effect !== 'NONE') check(!authority.kill_switch.controls.EXTERNAL_WRITE, 'KILL_SWITCH_ACTIVE');
      const control = contract.control_domain || (/deploy/i.test(contract.tool_id) ? 'DEPLOYMENT' : /schedule/i.test(contract.tool_id) ? 'SCHEDULES' : 'AGENT_EXECUTION');
      check(authority.kill_switch.controls[control] === false, 'KILL_SWITCH_ACTIVE');
      const proposal = { workspace_id: this.#scope.workspace_id, project_id: this.#scope.project_id, proposal_id: request.proposal_id || key,
        environment: 'local', target: request.target, capability: contract.required_capability, risk_class: contract.risk_class, diff_hash: intent.payload_hash };
      let approval = null;
      if (contract.side_effect !== 'NONE' || contract.approval_requirement !== 'NONE') {
        check(approval_id, 'APPROVAL_REQUIRED'); approval = this.#must(tx, 'approvals', approval_id);
        check(approval.status === 'APPROVED' && approval.consumed_at === null, 'APPROVAL_REPLAY'); C.id(approval.nonce);
        check(approval.approved_by && approval.approved_by !== this.#agent && approval.actor_type === 'HUMAN', 'APPROVER_INVALID'); C.utc(approval.approved_at); C.utc(approval.expires_at);
        check(Date.parse(approval.approved_at) <= Date.parse(now) && Date.parse(approval.expires_at) > Date.parse(now), 'APPROVAL_EXPIRED');
        check(Object.keys(proposal).every(k => approval[k] === proposal[k]), 'APPROVAL_BINDING_MISMATCH');
      }
      const charged = this.#charge(tx, task, run, { steps: 1, tool_calls: 1, retries: 0, cost: contract.estimated_cost || 0 }, now);
      if (charged.stopped) return charged;
      if (approval) this.#replace(tx, 'approvals', { ...approval, status: 'CONSUMED', consumed_at: now }, approval.version);
      const outbox_id = randomUUID();
      this.#audit(tx, 'TOOL_REQUESTED', policy_version, { type: 'outbox', id: outbox_id }, null, { task_id: task.task_id, run_id: run.run_id, payload_hash: intent.payload_hash }, now);
      const audit = this.#audit(tx, 'TOOL_ALLOWED', policy_version, { type: 'outbox', id: outbox_id }, null, { task_id: task.task_id, run_id: run.run_id, payload_hash: intent.payload_hash }, now);
      const record = { outbox_id, task_id: task.task_id, run_id: run.run_id, idempotency_key: key, target: request.target || request.tool_id,
        tool_id: contract.tool_id, tool_contract_version: contract.version, payload_hash: intent.payload_hash, attempt_count: 0, next_retry_at: null,
        status: 'STAGED_DISABLED', error_classification: null, audit_event_id: audit.event_id, approval_id: approval_id || null,
        execution_enabled: false, production_writes: 0, created_at: now, recovery_state: 'NONE', recovery_owner_run_id: null,
        recovery_attempts: 0, recovery_due_at: null, last_recovery_at: null, recovery_result: null,
        compensation_required: false, compensation_action: 'RECONCILE_BEFORE_ANY_FUTURE_RETRY', compensation_status: 'NOT_REQUIRED', data_classification: 'INTERNAL' };
      return this.#put(tx, 'outbox', outbox_id, record);
    });
  }
  recordEvidence(record, policy_version, key) {
    C.id(record.evidence_id); C.id(record.created_by_run_id); C.text(record.source_type); C.text(record.source_ref); C.utc(record.observed_at);
    check(/^[a-f0-9]{64}$/.test(record.content_hash), 'EVIDENCE_HASH_INVALID'); check(['PUBLIC', 'INTERNAL'].includes(record.data_classification), 'DATA_CLASSIFICATION_DENIED');
    check(['UNVERIFIED', 'OBSERVED', 'INDEPENDENTLY_VERIFIED'].includes(record.reliability_class), 'EVIDENCE_RELIABILITY_INVALID');
    check((record.workspace_id ?? this.#scope.workspace_id) === this.#scope.workspace_id && (record.project_id ?? this.#scope.project_id) === this.#scope.project_id, 'PROJECT_SCOPE_VIOLATION');
    return this.#operation({ operation: 'evidence.record', key, policy: policy_version, capability: 'platform.evidence.write', request: record }, (tx, now, authority) => {
      const run = this.#must(tx, 'runs', record.created_by_run_id); const task = this.#task(tx, run.task_id); this.#bind(task, policy_version, authority, run, 'platform.evidence.write');
      check(Date.parse(record.observed_at) <= Date.parse(now), 'STALE_DATA');
      const charged = this.#charge(tx, task, run, { steps: 1, tool_calls: 0, retries: 0, cost: 0 }, now); if (charged.stopped) return charged;
      const out = this.#put(tx, 'evidence', record.evidence_id, { ...record, retention_class: C.RETENTION.evidence });
      this.#audit(tx, 'EVIDENCE_RECORDED', policy_version, { type: 'evidence', id: record.evidence_id }, null, out, now); return out;
    });
  }
  proposeClaim(record, policy_version, key) {
    C.id(record.claim_id); C.id(record.created_by_run_id); C.strings(record.evidence_ids); check(record.evidence_ids.length > 0 && ['FACT_CANDIDATE', 'LESSON_CANDIDATE'].includes(record.kind), 'CLAIM_INVALID');
    C.utc(record.last_verified_at); C.utc(record.expires_at); C.text(record.statement); C.text(record.revalidation_policy);
    check(Number.isFinite(record.confidence) && record.confidence >= 0 && record.confidence <= 1, 'CLAIM_INVALID');
    check((record.workspace_id ?? this.#scope.workspace_id) === this.#scope.workspace_id && (record.project_id ?? this.#scope.project_id) === this.#scope.project_id, 'PROJECT_SCOPE_VIOLATION');
    return this.#operation({ operation: 'claim.propose', key, policy: policy_version, capability: 'platform.evidence.write', request: record }, (tx, now, authority) => {
      const run = this.#must(tx, 'runs', record.created_by_run_id); const task = this.#task(tx, run.task_id); this.#bind(task, policy_version, authority, run, 'platform.evidence.write');
      record.evidence_ids.forEach(id => this.#must(tx, 'evidence', id));
      check(Date.parse(record.last_verified_at) <= Date.parse(now) && Date.parse(record.expires_at) > Date.parse(now), 'STALE_DATA');
      if (record.kind === 'LESSON_CANDIDATE') { C.strings(record.observation_ids); check(record.observation_ids.length >= 2 && record.independent_evaluator && record.independent_evaluator !== this.#agent, 'INDEPENDENT_EVALUATOR_REQUIRED'); record.observation_ids.forEach(id => this.#must(tx, 'evidence', id)); }
      const charged = this.#charge(tx, task, run, { steps: 1, tool_calls: 0, retries: 0, cost: 0 }, now); if (charged.stopped) return charged;
      const out = this.#put(tx, 'claims', record.claim_id, { ...record, status: 'CANDIDATE', scope: 'PROJECT', created_by: this.#agent, created_at: now, data_classification: 'INTERNAL' });
      this.#audit(tx, 'MEMORY_PROPOSED', policy_version, { type: 'claim', id: record.claim_id }, null, out, now); return out;
    });
  }
  proposeSkill(record, policy_version, key) {
    C.id(record.skill_id); C.id(record.created_by_run_id); C.text(record.skill_version); C.text(record.provenance); C.strings(record.tool_dependencies); C.text(record.eval_suite);
    check(record.creator === this.#agent && record.status === 'CANDIDATE' && record.evaluator === null, 'SELF_PROMOTION_DENIED');
    check(/^[a-f0-9]{64}$/.test(record.content_hash), 'SKILL_HASH_INVALID'); C.rank(record.permission_ceiling, 'P', 4);
    check((record.workspace_id ?? this.#scope.workspace_id) === this.#scope.workspace_id && (record.project_id ?? this.#scope.project_id) === this.#scope.project_id, 'PROJECT_SCOPE_VIOLATION');
    return this.#operation({ operation: 'skill.propose', key, policy: policy_version, capability: 'platform.evidence.write', request: record }, (tx, now, authority) => {
      const run = this.#must(tx, 'runs', record.created_by_run_id); const task = this.#task(tx, run.task_id); this.#bind(task, policy_version, authority, run, 'platform.evidence.write');
      check(C.rank(record.permission_ceiling, 'P', 4) <= Math.min(C.rank(authority.policy.permission_ceiling, 'P', 4), C.rank(authority.certificate.permission_ceiling, 'P', 4)), 'PERMISSION_CEILING_EXCEEDED');
      check(record.tool_dependencies.every(c => authority.certificate.capabilities.includes(c) && G.capabilityAllowed(c, authority.policy)), 'CAPABILITY_DENIED');
      const charged = this.#charge(tx, task, run, { steps: 1, tool_calls: 0, retries: 0, cost: 0 }, now); if (charged.stopped) return charged;
      const out = this.#put(tx, 'skills', record.skill_id, { ...record, created_at: now, data_classification: 'INTERNAL' });
      this.#audit(tx, 'SKILL_PROPOSED', policy_version, { type: 'skill', id: record.skill_id }, null, out, now); return out;
    });
  }
}
module.exports = { ControlPlane };
