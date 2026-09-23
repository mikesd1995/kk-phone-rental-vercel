'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../../platform/security-boundaries.js');
const rejects = (fn, code) => assert.throws(fn, (error) => error.code === code);

test('SSRF rejects local, private, mapped, transition and reserved addresses', () => {
  for (const address of ['127.0.0.1', '0.0.0.0', '10.1.2.3', '172.16.1.1', '172.31.255.255',
    '192.168.1.1', '169.254.169.254', '100.64.0.1', '198.18.0.1', '192.0.2.1', '198.51.100.1',
    '203.0.113.1', '224.0.0.1', '255.255.255.255', '::', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1',
    '2001:db8::1', '2001::1', '2002:7f00:1::', '64:ff9b::7f00:1', '3fff::1']) {
    assert.equal(S.isPublicAddress(address), false, address);
  }
  for (const address of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111', '2001:4860:4860::8888']) {
    assert.equal(S.isPublicAddress(address), true, address);
  }
});

test('URL guard blocks URL credentials, schemes, weird localhost encoding and destination bypasses', () => {
  for (const url of ['https://localhost/', 'https://foo.localhost/', 'https://foo.internal/', 'https://foo.local/',
    'https://127.0.0.1/', 'https://2130706433/', 'https://0177.0.0.1/', 'https://0x7f000001/',
    'https://[::1]/', 'https://[::ffff:127.0.0.1]/', 'https://user:pass@example.com/',
    'file:///etc/passwd', 'http://example.com/', 'ftp://example.com/', 'data:text/plain,hi',
    'https://example.com:444/', 'https://example.com/#redirect', 'https://example.com\\@127.0.0.1/',
    'https://example.com.evil.com/', 'https://example.com./', 'https://example.com\n/']) {
    assert.throws(() => S.validatePublicUrl(url, { allowed_hosts: ['example.com'] }), url);
  }
});

test('DNS destinations require every resolved address to be public and future connections pinned', () => {
  const options = { allowed_hosts: ['example.com'] };
  rejects(() => S.validateNetworkDestination('https://example.com/', options), 'SSRF_RESOLUTION_DENIED');
  for (const resolved_addresses of [[], ['1.1.1.1', '127.0.0.1'], ['::ffff:10.1.1.1'], ['not-ip']]) {
    rejects(() => S.validateNetworkDestination('https://example.com/', { ...options, resolved_addresses }), 'SSRF_RESOLUTION_DENIED');
  }
  const result = S.validateNetworkDestination('https://example.com/', { ...options, resolved_addresses: ['1.1.1.1'] });
  assert.deepEqual(result.validated_addresses, ['1.1.1.1']);
  assert.equal(result.redirect_policy, 'DENY');
  assert.equal(result.requires_address_pinning, true);
  assert.equal(result.execution_enabled, false);
  assert.equal(S.validateNetworkDestination('https://1.1.1.1/', { allowed_hosts: ['1.1.1.1'] }).status, 'ADDRESS_PINNING_REQUIRED');
});

test('sandbox path guard blocks Unix and Windows traversal and alternate-stream/device paths', () => {
  for (const value of ['../secret', 'a/../../secret', 'a\\..\\secret', '/etc/passwd', '\\server\\share',
    'C:\\secret', 'safe.txt:secret', 'a/%2e%2e/secret', 'a/%252e%252e/secret', 'a//b', 'a/./b',
    'a/.. /b', 'a/b.', 'a/NUL.txt', 'COM1', 'a\u0000b', '', 'a/'.repeat(300)]) {
    rejects(() => S.validateRelativePath(value), 'PATH_SCOPE_VIOLATION');
  }
  assert.equal(S.validateRelativePath('work\\outputs\\report.json'), 'work/outputs/report.json');
  assert.equal(S.validateRelativePath('src/example.test.js'), 'src/example.test.js');
});

test('command boundary only accepts exact allowlisted argv vectors, never shell strings', () => {
  const allow = [{ executable: 'node', argv: ['--version'] }, { executable: 'git', argv: ['status', '--short'] }];
  assert.deepEqual(S.validateCommand({ executable: 'node', argv: ['--version'] }, allow),
    { executable: 'node', argv: ['--version'], shell: false });
  for (const command of [{ executable: 'node', argv: ['-e', 'execute()'] }, { executable: 'git', argv: ['push'] },
    { executable: 'cmd', argv: ['/c', 'dir'] }, { executable: 'pwsh', argv: ['-Command', 'dir'] },
    { executable: '../node', argv: ['--version'] }, { executable: 'node', argv: ['--version;rm'] },
    { executable: 'node', argv: ['$(other)'] }, { executable: 'node', argv: ['--version'], shell: true },
    { executable: 'node', argv: ['--version'], cwd: '../outside' }]) assert.throws(() => S.validateCommand(command, allow));
});

test('query boundary accepts named parameterized queries and forbids raw query expressions', () => {
  const result = S.validateQuery({ query_id: 'find_task', parameters: { task_id: 'id-a' } }, { find_task: ['task_id'] });
  assert.equal(result.parameterized, true);
  rejects(() => S.validateQuery({ query_id: 'SELECT * FROM tasks', parameters: {} }, {}), 'QUERY_DENIED');
  rejects(() => S.validateQuery({ query_id: 'find_task', parameters: { task_id: 'id-a', project_id: 'other' } }, { find_task: ['task_id'] }), 'QUERY_DENIED');
  rejects(() => S.validateQuery({ query_id: 'find_task', parameters: { task_id: { raw: 'SQL' } } }, { find_task: ['task_id'] }), 'QUERY_DENIED');
});

test('credential contract returns references only and acquisition remains disabled', () => {
  const request = { credential_reference_id: 'cred-a', workspace_id: 'ws-a', project_id: 'project-a', environment: 'test',
    capability: 'github.read', credential_class: 'SCOPED_SHORT_LIVED', ttl_seconds: 60 };
  const ref = S.createCredentialReference(request);
  assert.equal(ref.contains_credentials, false);
  assert.equal(ref.execution_enabled, false);
  assert.equal(ref.status, 'REFERENCE_ONLY');
  rejects(() => S.acquireCredential(ref), 'CREDENTIAL_BROKER_NOT_CONFIGURED');
  rejects(() => S.createCredentialReference({ ...request, environment: 'production' }), 'ENVIRONMENT_DENIED');
  rejects(() => S.createCredentialReference({ ...request, ttl_seconds: 901 }), 'CREDENTIAL_SCOPE_DENIED');
  rejects(() => S.createCredentialReference({ ...request, capability: 'secret.read.raw' }), 'HARD_GOVERNANCE_DENIED');
  rejects(() => S.createCredentialReference({ ...request, raw_credential: 'fixture' }), 'TOOL_SCHEMA_MISMATCH');
});

test('sandbox contract requires bounded isolated plan and cannot attest host enforcement', () => {
  const plan = { environment: 'test', filesystem_scope: 'workspace-a', ephemeral: true, production_credentials: false,
    production_database: false, production_network: false, timeout_ms: 1000, memory_mb: 128,
    network_egress: 'DENY', allowed_hosts: [] };
  const result = S.validateSandboxPlan(plan);
  assert.equal(result.status, 'PLAN_ONLY');
  assert.equal(result.execution_enabled, false);
  assert.ok(result.required_executor_controls.includes('NO_SYMLINK_ESCAPE'));
  for (const change of [{ ephemeral: false }, { production_credentials: true }, { production_database: true },
    { production_network: true }, { timeout_ms: 300001 }, { memory_mb: 4097 },
    { network_egress: 'ANY' }, { allowed_hosts: ['example.com'] }, { network_egress: 'ALLOWLIST' }]) {
    rejects(() => S.validateSandboxPlan({ ...plan, ...change }), 'SANDBOX_BOUNDARY_UNVERIFIED');
  }
  rejects(() => S.validateSandboxPlan({ ...plan, environment: 'production' }), 'ENVIRONMENT_DENIED');
  rejects(() => S.validateSandboxPlan({ ...plan, memory_mb: Infinity }), 'TOOL_SCHEMA_MISMATCH');
});

test('trace redaction never copies arbitrary secret or customer values into logs', () => {
  const payload = { authorization: 'fixture-auth', cookie: 'fixture-cookie', password: 'fixture-password',
    customer: 'fixture-customer', nested: { content: 'arbitrary-sensitive-text' } };
  for (const classification of ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET']) {
    const result = JSON.stringify(S.redactTrace(payload, classification));
    assert.equal(result.includes('fixture-'), false);
    assert.equal(result.includes('arbitrary-sensitive-text'), false);
  }
  rejects(() => S.redactTrace(payload, 'UNKNOWN'), 'DATA_CLASSIFICATION_UNKNOWN');
});
