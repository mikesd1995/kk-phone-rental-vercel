'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../server/agent-governance-contract.js');

test('external web content cannot authorize a capability', () => {
  const result = G.evaluateExternalInstruction({
    source_type: 'WEB',
    requested_capability: 'production.deploy'
  });
  assert.equal(result.allowed, false);
  assert.equal(result.classification, 'UNTRUSTED_DATA_CANNOT_AUTHORIZE_ACTION');
});

test('lower policy cannot re-allow a capability denied by a higher policy', () => {
  const resolved = G.resolvePolicyLayers([
    {
      level: 'PLATFORM_HARD',
      allow: ['github.read', 'production.deploy'],
      deny: ['production.deploy'],
      permission_ceiling: 'P4'
    },
    {
      level: 'PROJECT',
      allow: ['github.read', 'production.deploy'],
      deny: [],
      permission_ceiling: 'P5'
    }
  ]);
  assert.deepEqual(resolved.allow, ['github.read']);
  assert.equal(resolved.deny.includes('production.deploy'), true);
  assert.equal(resolved.permission_ceiling, 'P4');
});

test('policy layers can narrow but cannot raise permission ceiling', () => {
  const resolved = G.resolvePolicyLayers([
    { level: 'PLATFORM_HARD', allow: ['github.read'], permission_ceiling: 'P4' },
    { level: 'PROJECT', allow: ['github.read'], permission_ceiling: 'P2' },
    { level: 'TASK', allow: ['github.read'], permission_ceiling: 'P6' }
  ]);
  assert.equal(resolved.permission_ceiling, 'P2');
});

test('self privilege escalation fails closed', () => {
  assert.throws(
    () => G.assertNoPrivilegeEscalation('P3', 'P4'),
    (error) => error && error.code === 'PRIVILEGE_ESCALATION_DENIED'
  );
  assert.equal(G.assertNoPrivilegeEscalation('P3', 'P2'), true);
});

test('hard governance capabilities cannot be self-assigned', () => {
  assert.throws(
    () => G.assertCapabilityNotHardGovernance('permission.modify'),
    (error) => error && error.code === 'HARD_GOVERNANCE_DENIED'
  );
});

test('R4 and R5 changes require human approval', () => {
  assert.equal(G.requiresHumanApproval('R3'), false);
  assert.equal(G.requiresHumanApproval('R4'), true);
  assert.equal(G.requiresHumanApproval('R5'), true);
});

test('approval is bound to exact change hash and expires', () => {
  const change = { target: 'skill', version: '1.1.0', diff: { recall: '+5%' } };
  const approval = {
    diff_hash: G.changeHash(change),
    approved_by: 'owner',
    expires_at: '2026-09-23T00:00:00Z'
  };
  assert.equal(G.validateApproval(approval, change, Date.parse('2026-09-22T00:00:00Z')).ok, true);
  assert.equal(
    G.validateApproval(approval, { ...change, version: '1.2.0' }, Date.parse('2026-09-22T00:00:00Z')).reason,
    'APPROVAL_HASH_MISMATCH'
  );
  assert.equal(G.validateApproval(approval, change, Date.parse('2026-09-24T00:00:00Z')).reason, 'APPROVAL_EXPIRED');
});

test('unknown policy level fails closed', () => {
  assert.throws(
    () => G.resolvePolicyLayers([{ level: 'INVENTED', allow: ['github.read'] }]),
    (error) => error && error.code === 'POLICY_LEVEL_UNKNOWN'
  );
});
