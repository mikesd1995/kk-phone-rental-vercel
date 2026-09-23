'use strict';

const net = require('node:net');
const G = require('../server/agent-governance-contract.js');

const ENVIRONMENTS = Object.freeze(['local', 'test', 'staging', 'preview']);
const CLASSIFICATIONS = Object.freeze(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET']);
const SECRET_KEYS = /(?:authorization|cookie|password|passwd|secret|token|api[_-]?key|private[_-]?key|service[_-]?role|pin)$/i;
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function object(value, code = 'TOOL_SCHEMA_MISMATCH') {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(code);
  return value;
}

function exactKeys(value, allowed, required = allowed, code = 'TOOL_SCHEMA_MISMATCH') {
  object(value, code);
  if (Object.keys(value).some((key) => UNSAFE_KEYS.has(key) || !allowed.includes(key)) ||
      required.some((key) => !Object.hasOwn(value, key))) fail(code);
}

function identity(value, code = 'IDENTITY_INVALID') {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value) ||
      UNSAFE_KEYS.has(value)) fail(code);
  return value;
}

function assertEnvironment(value) {
  if (!ENVIRONMENTS.includes(value)) fail('ENVIRONMENT_DENIED');
  return value;
}

// Validate JSON before hashing or copying: reject accessors, cycles, prototype keys,
// non-finite numbers, and values JSON would otherwise silently discard.
function assertSafeJson(value, { max_bytes = 65536, max_depth = 12, forbid_secrets = true } = {}) {
  const active = new Set();
  let nodes = 0;
  function visit(item, depth) {
    if (++nodes > 10000 || depth > max_depth) fail('PAYLOAD_TOO_LARGE');
    if (item === null || typeof item === 'boolean') return;
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) fail('TOOL_SCHEMA_MISMATCH');
      return;
    }
    if (typeof item === 'string') {
      if (item.length > max_bytes) fail('PAYLOAD_TOO_LARGE');
      if (forbid_secrets && /-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----|\bBearer\s+[A-Za-z0-9._~+\/-]{8,}|\b(?:sk_live_|ghp_|github_pat_)[A-Za-z0-9_]{8,}/i.test(item)) fail('SECRET_DATA_DENIED');
      return;
    }
    if (!item || typeof item !== 'object' || active.has(item)) fail('TOOL_SCHEMA_MISMATCH');
    if (!Array.isArray(item)) object(item);
    active.add(item);
    for (const key of Object.keys(item)) {
      if (UNSAFE_KEYS.has(key)) fail('TOOL_SCHEMA_MISMATCH');
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('TOOL_SCHEMA_MISMATCH');
      if (forbid_secrets && SECRET_KEYS.test(key)) fail('SECRET_DATA_DENIED');
      visit(descriptor.value, depth + 1);
    }
    if (Array.isArray(item) && Object.keys(item).length !== item.length) fail('TOOL_SCHEMA_MISMATCH');
    active.delete(item);
  }
  visit(value, 0);
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > max_bytes) fail('PAYLOAD_TOO_LARGE');
  return value;
}

function isPublicAddress(address) {
  if (typeof address !== 'string') return false;
  const version = net.isIP(address);
  if (version === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0) || (a === 192 && b === 2) ||
      (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (version === 6) {
    const normalized = new URL(`https://[${address}]/`).hostname.slice(1, -1).toLowerCase();
    const second = parseInt(normalized.split(':')[1] || '0', 16);
    // Only ordinary global unicast; deny mapped/NAT64/transition and reserved space.
    return /^[23][0-9a-f]{3}:/.test(normalized) &&
      !(normalized.startsWith('2001:') && (second < 0x200 || second === 0xdb8)) &&
      !normalized.startsWith('2002:') && !normalized.startsWith('3fff:');
  }
  return false;
}

function validatePublicUrl(value, { allowed_hosts = [] } = {}) {
  if (typeof value !== 'string' || value.length > 4096 || /[\s\\\u0000-\u001f\u007f]/.test(value)) fail('NETWORK_DESTINATION_DENIED');
  let url;
  try { url = new URL(value); } catch { fail('NETWORK_DESTINATION_DENIED'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
      url.port && url.port !== '443') fail('NETWORK_DESTINATION_DENIED');
  const host = url.hostname.toLowerCase();
  const literal = host.startsWith('[') ? host.slice(1, -1) : host;
  if (net.isIP(literal)) {
    if (!isPublicAddress(literal)) fail('SSRF_DESTINATION_DENIED');
  } else if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ||
      /(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid|onion)$/.test(host)) {
    fail('SSRF_DESTINATION_DENIED');
  }
  if (!Array.isArray(allowed_hosts) || !allowed_hosts.includes(host)) fail('NETWORK_DESTINATION_DENIED');
  return { url: url.href, hostname: host, literal_address: net.isIP(literal) ? literal : null,
    redirect_policy: 'DENY', requires_address_pinning: true };
}

function validateNetworkDestination(value, { allowed_hosts = [], resolved_addresses } = {}) {
  const destination = validatePublicUrl(value, { allowed_hosts });
  const addresses = destination.literal_address ? [destination.literal_address] : resolved_addresses;
  if (!Array.isArray(addresses) || addresses.length === 0 || addresses.length > 32 ||
      addresses.some((address) => !isPublicAddress(address))) fail('SSRF_RESOLUTION_DENIED');
  return { ...destination, validated_addresses: [...new Set(addresses)],
    execution_enabled: false, status: 'ADDRESS_PINNING_REQUIRED' };
}

function validateRelativePath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512 ||
      /^[\\/]/.test(value) || /[:%\u0000-\u001f\u007f]/.test(value)) fail('PATH_SCOPE_VIOLATION');
  const parts = value.split(/[\\/]/);
  if (parts.some((part) => !part || part === '.' || part === '..' || /[. ]$/.test(part) ||
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part) || /[<>"|?*]/.test(part))) fail('PATH_SCOPE_VIOLATION');
  return parts.join('/');
}

// Commands are data for a future argv-only executor. No shell parsing is allowed.
// Each executable has an exact argument sequence allowlist; a program allowlist
// alone would still allow interpreter flags or dangerous tool subcommands.
function validateCommand(value, allowed_commands = []) {
  assertSafeJson(value);
  exactKeys(value, ['executable', 'argv', 'cwd'], ['executable', 'argv']);
  if (typeof value.executable !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(value.executable) ||
      /^(?:cmd|powershell|pwsh|bash|sh|zsh|csh|fish|wscript|cscript)$/i.test(value.executable) ||
      !Array.isArray(value.argv) || value.argv.length > 32 || value.argv.some((arg) =>
        typeof arg !== 'string' || arg.length > 1024 || /[\u0000-\u001f\u007f;&|`$<>]/.test(arg))) fail('COMMAND_DENIED');
  if (value.cwd !== undefined) validateRelativePath(value.cwd);
  if (!Array.isArray(allowed_commands) || !allowed_commands.some((allowed) =>
    allowed.executable === value.executable && Array.isArray(allowed.argv) &&
    JSON.stringify(allowed.argv) === JSON.stringify(value.argv))) fail('COMMAND_DENIED');
  return { executable: value.executable, argv: [...value.argv], ...(value.cwd ? { cwd: value.cwd } : {}), shell: false };
}

function validateQuery(value, definitions = {}) {
  assertSafeJson(value);
  exactKeys(value, ['query_id', 'parameters']);
  identity(value.query_id, 'QUERY_DENIED');
  object(definitions, 'QUERY_DENIED');
  if (!Object.hasOwn(definitions, value.query_id)) fail('QUERY_DENIED');
  object(value.parameters, 'QUERY_DENIED');
  const names = definitions[value.query_id];
  if (!Array.isArray(names)) fail('QUERY_DENIED');
  exactKeys(value.parameters, names, names, 'QUERY_DENIED');
  for (const item of Object.values(value.parameters)) {
    if (!(item === null || ['string', 'number', 'boolean'].includes(typeof item))) fail('QUERY_DENIED');
  }
  assertSafeJson(value);
  return { query_id: value.query_id, parameters: { ...value.parameters }, parameterized: true };
}

function createCredentialReference(request) {
  assertSafeJson(request);
  exactKeys(request, ['credential_reference_id', 'workspace_id', 'project_id', 'environment',
    'capability', 'credential_class', 'ttl_seconds']);
  for (const key of ['credential_reference_id', 'workspace_id', 'project_id', 'capability']) identity(request[key]);
  assertEnvironment(request.environment);
  G.assertCapabilityNotHardGovernance(request.capability);
  if (request.credential_class !== 'SCOPED_SHORT_LIVED' ||
      !Number.isInteger(request.ttl_seconds) || request.ttl_seconds < 1 || request.ttl_seconds > 900) fail('CREDENTIAL_SCOPE_DENIED');
  return Object.freeze({ ...request, status: 'REFERENCE_ONLY', execution_enabled: false, contains_credentials: false });
}

function acquireCredential() { fail('CREDENTIAL_BROKER_NOT_CONFIGURED'); }

function validateSandboxPlan(plan) {
  assertSafeJson(plan);
  exactKeys(plan, ['environment', 'filesystem_scope', 'ephemeral', 'production_credentials',
    'production_database', 'production_network', 'timeout_ms', 'memory_mb', 'network_egress', 'allowed_hosts']);
  assertEnvironment(plan.environment);
  identity(plan.filesystem_scope);
  if (plan.ephemeral !== true || plan.production_credentials !== false || plan.production_database !== false ||
      plan.production_network !== false || !Number.isInteger(plan.timeout_ms) || plan.timeout_ms < 1 || plan.timeout_ms > 300000 ||
      !Number.isInteger(plan.memory_mb) || plan.memory_mb < 16 || plan.memory_mb > 2048 ||
      !['DENY', 'ALLOWLIST'].includes(plan.network_egress) || !Array.isArray(plan.allowed_hosts) ||
      plan.allowed_hosts.length > 32 || plan.network_egress === 'DENY' && plan.allowed_hosts.length) fail('SANDBOX_BOUNDARY_UNVERIFIED');
  for (const host of plan.allowed_hosts) validatePublicUrl(`https://${host}/`, { allowed_hosts: [host] });
  if (plan.network_egress === 'ALLOWLIST' && !plan.allowed_hosts.length) fail('SANDBOX_BOUNDARY_UNVERIFIED');
  return { ...plan, allowed_hosts: [...plan.allowed_hosts], execution_enabled: false,
    status: 'PLAN_ONLY', required_executor_controls: ['NO_SYMLINK_ESCAPE', 'OS_FILESYSTEM_ISOLATION',
      'PROCESS_RESOURCE_LIMITS', 'EGRESS_ADDRESS_PINNING', 'NO_REDIRECTS', 'NO_PRODUCTION_CREDENTIALS'] };
}

function redactTrace(value, classification = 'INTERNAL') {
  if (!CLASSIFICATIONS.includes(classification)) fail('DATA_CLASSIFICATION_UNKNOWN');
  if (classification === 'SECRET' || classification === 'CONFIDENTIAL') return { classification, payload: '[REDACTED]' };
  // Trace payloads are never copied, even for PUBLIC data: source labels alone
  // cannot establish that arbitrary strings contain no credentials or PII.
  assertSafeJson(value, { forbid_secrets: false });
  return { classification, payload_hash: G.changeHash(value), payload: '[OMITTED]' };
}

module.exports = { ENVIRONMENTS, CLASSIFICATIONS, fail, object, exactKeys, identity,
  assertEnvironment, assertSafeJson, isPublicAddress, validatePublicUrl, validateNetworkDestination,
  validateRelativePath, validateCommand, validateQuery, createCredentialReference, acquireCredential,
  validateSandboxPlan, redactTrace };
