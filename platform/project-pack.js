'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { assertSafeJson } = require('./security-boundaries.js');

const FLAG_NAMES = Object.freeze([
  'agent_runtime', 'scheduler', 'providers', 'gateway_writes',
  'self_improvement', 'production_executor'
]);
const VERSION_NAMES = Object.freeze([
  'agent', 'skill', 'tool_contract', 'workflow', 'policy', 'eval_dataset'
]);
const SECTIONS = Object.freeze(['skills', 'workflows', 'evals', 'sources', 'adapters']);

function reject(reason) {
  throw Object.assign(new Error(reason), { code: 'PROJECT_PACK_INVALID' });
}

function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) reject(`${label}: object required`);
  if (Object.keys(value).some(key => !keys.includes(key))) reject(`${label}: unknown field`);
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) reject(`${label}: missing ${key}`);
  }
}

function identity(value, label) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{1,79}$/.test(value)) reject(`${label}: invalid identity`);
}

function version(value, label) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    reject(`${label}: explicit stable version required`);
  }
}

function ceiling(value, label) {
  if (typeof value !== 'string' || !/^P[0-4]$/.test(value)) reject(`${label}: Phase 0 ceiling exceeds P4 or is invalid`);
}

function stringList(value, label) {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !/^[a-z][a-z0-9_.-]{0,99}$/.test(item)) ||
      new Set(value).size !== value.length) reject(`${label}: unique identifiers required`);
}

function referencePath(value) {
  if (typeof value !== 'string' || value.length > 240 || value.includes('\\') ||
      !/^[a-zA-Z0-9_.\/-]+$/.test(value) || value.startsWith('/') ||
      value.split('/').some(part => !part || part === '.' || part === '..')) reject('reference path: unsafe repository path');
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

function validateProjectPack(input) {
  try { assertSafeJson(input); }
  catch { reject('pack: unsafe or oversized JSON'); }
  object(input, ['project', 'policy', 'agents'], 'pack');
  const { project, policy, agents } = input;
  object(project, ['schema_version', 'project_id', 'workspace_id', 'name', 'project_pack_version',
    'phase', 'environment', 'permission_ceiling', 'feature_flags', 'versions', 'references'], 'project');
  if (project.schema_version !== 1) reject('project: unsupported schema version');
  identity(project.project_id, 'project_id');
  identity(project.workspace_id, 'workspace_id');
  if (typeof project.name !== 'string' || !project.name.trim() || project.name.length > 120) reject('name: invalid');
  version(project.project_pack_version, 'project_pack_version');
  if (project.phase !== 'phase0' || project.environment !== 'local') reject('Phase 0 requires local environment');
  ceiling(project.permission_ceiling, 'project permission');
  object(project.feature_flags, FLAG_NAMES, 'feature_flags');
  if (Object.values(project.feature_flags).some(flag => flag !== false)) reject('feature flags must all be explicitly OFF');
  object(project.versions, VERSION_NAMES, 'versions');
  for (const name of VERSION_NAMES) version(project.versions[name], name);
  object(project.references, SECTIONS, 'references');
  for (const section of SECTIONS) {
    if (!Array.isArray(project.references[section])) reject(`${section}: reference array required`);
    const paths = new Set();
    for (const ref of project.references[section]) {
      object(ref, ['path', 'version', 'revision'], `${section} reference`);
      referencePath(ref.path);
      version(ref.version, 'reference version');
      if (typeof ref.revision !== 'string' || !/^[a-f0-9]{40}$/.test(ref.revision)) reject('reference revision: commit identity required');
      if (paths.has(ref.path)) reject('duplicate reference');
      paths.add(ref.path);
    }
  }
  object(policy, ['schema_version', 'project_id', 'workspace_id', 'policy_version', 'permission_ceiling',
    'allow_capabilities', 'deny_capabilities', 'production_authority'], 'policy');
  if (policy.schema_version !== 1) reject('policy: unsupported schema version');
  version(policy.policy_version, 'policy_version');
  ceiling(policy.permission_ceiling, 'policy permission');
  if (policy.policy_version !== project.versions.policy || policy.project_id !== project.project_id ||
      policy.workspace_id !== project.workspace_id) reject('policy: scope or version mismatch');
  if (Number(policy.permission_ceiling[1]) > Number(project.permission_ceiling[1])) reject('policy: permission escalation');
  stringList(policy.allow_capabilities, 'allow_capabilities');
  stringList(policy.deny_capabilities, 'deny_capabilities');
  if (policy.allow_capabilities.length !== 0 || policy.production_authority !== false) reject('Phase 0 pack cannot grant execution authority');
  object(agents, ['schema_version', 'project_id', 'workspace_id', 'agent_version', 'definitions'], 'agents');
  if (agents.schema_version !== 1 || agents.project_id !== project.project_id || agents.workspace_id !== project.workspace_id ||
      agents.agent_version !== project.versions.agent) reject('agents: scope or version mismatch');
  if (!Array.isArray(agents.definitions) || !agents.definitions.length) reject('agents: definitions required');
  const agentIds = new Set();
  for (const definition of agents.definitions) {
    object(definition, ['agent_id', 'role', 'version', 'permission_ceiling', 'execution_enabled', 'provider', 'model_id'], 'agent');
    identity(definition.agent_id, 'agent_id');
    identity(definition.role, 'role');
    version(definition.version, 'agent version');
    if (definition.version !== agents.agent_version) reject('agent definition version mismatch');
    ceiling(definition.permission_ceiling, 'agent permission');
    if (Number(definition.permission_ceiling[1]) > Number(policy.permission_ceiling[1])) reject('agent permission escalation');
    if (definition.execution_enabled !== false || definition.provider !== null || definition.model_id !== null) {
      reject('Phase 0 agent definitions cannot activate execution or providers');
    }
    if (agentIds.has(definition.agent_id)) reject('duplicate agent identity');
    agentIds.add(definition.agent_id);
  }
  return deepFreeze(JSON.parse(JSON.stringify(input)));
}

function contained(root, target) {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function loadProjectPack(directory, { repositoryRoot } = {}) {
  if (!repositoryRoot) reject('repository root required');
  const root = fs.realpathSync(repositoryRoot);
  const packRoot = fs.realpathSync(directory);
  if (!contained(root, packRoot)) reject('pack directory outside repository');
  const bundle = {};
  for (const name of ['project', 'policy', 'agents']) {
    const filename = fs.realpathSync(path.join(packRoot, `${name}.json`));
    if (!contained(packRoot, filename)) reject('pack file escapes pack directory');
    const stat = fs.statSync(filename);
    if (!stat.isFile() || stat.size > 65536) reject('pack file must be bounded JSON');
    try { bundle[name] = JSON.parse(fs.readFileSync(filename, 'utf8')); }
    catch { reject('pack file: invalid JSON'); }
  }
  const pack = validateProjectPack(bundle);
  for (const refs of Object.values(pack.project.references)) {
    for (const ref of refs) {
      const target = fs.realpathSync(path.resolve(root, ref.path));
      if (!contained(root, target) || !fs.statSync(target).isFile()) reject('reference outside repository or not a file');
    }
  }
  return pack;
}

module.exports = { FLAG_NAMES, VERSION_NAMES, validateProjectPack, loadProjectPack };
