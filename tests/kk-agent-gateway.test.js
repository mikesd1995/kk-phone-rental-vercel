'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Registry = require('../server/kk-agent-registry.js');
const Gateway = require('../server/kk-agent-gateway.js');
const Ledger = require('../server/kk-agent-invocation-ledger.js');

function goodPayload() {
  return {
    message: 'ขอโพสปล่อยเช่างานนี้บน X',
    input: {
      event: 'Example Concert',
      venue: 'Example Hall',
      verified_event: true,
      verified_pricing: true,
      price_display: 'vivo X300 Pro 690฿ | เพิ่ม Lens +200฿',
      inventory_available: true,
      recent_posts: ['ตัวอย่าง hook เก่า']
    }
  };
}

test('registry requires strategy and content agent for direct rental X requests', () => {
  const route = Registry.routeForIntent('direct_rental_x');
  assert.ok(route);
  assert.deepEqual(route.required_agents, ['kk-content-strategy', 'kk-content-agent']);
  assert.equal(route.persistent_invocation_evidence_required, true);
});

test('gateway invokes registered content path and persists invocation evidence before ready status', async () => {
  const rows = [];
  const result = await Gateway.executeAgentRequest(goodPayload(), {
    ledgerFn: async row => {
      rows.push(row);
      return { ok: true, inserted: true, invocation_id: row.invocation_id };
    }
  });

  assert.equal(result.status, 'READY_FOR_OWNER_REVIEW');
  assert.equal(result.invocation_check.pass, true);
  assert.deepEqual(result.invocation.required_agents, ['kk-content-strategy', 'kk-content-agent']);
  assert.deepEqual(result.invocation.invoked_agents, ['kk-content-strategy', 'kk-content-agent']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].production_writes, 0);
  assert.equal(rows[0].publishes, 0);
  assert.match(result.route.generation_prompt, /exactly 3 complete variants/i);
});

test('gateway fail-closes commercial content gate and removes generation prompt from blocked response', async () => {
  const payload = goodPayload();
  payload.input.verified_pricing = false;
  delete payload.input.price_display;

  const result = await Gateway.executeAgentRequest(payload, {
    ledgerFn: async row => ({ ok: true, inserted: true, invocation_id: row.invocation_id })
  });

  assert.equal(result.status, 'BLOCKED_CONTENT_GATE');
  assert.match(result.invocation.blocked_reason, /PRICING_NOT_VERIFIED/);
  assert.equal(result.route.generation_prompt, undefined);
  assert.equal(result.production_writes, 0);
  assert.equal(result.publishes, 0);
});

test('gateway blocks usable output when invocation ledger cannot be written', async () => {
  const result = await Gateway.executeAgentRequest(goodPayload(), {
    ledgerFn: async () => {
      throw Object.assign(new Error('down'), { code: 'LEDGER_DOWN' });
    }
  });

  assert.equal(result.status, 'BLOCKED_LEDGER_UNAVAILABLE');
  assert.equal(result.blocker, 'LEDGER_DOWN');
  assert.equal(result.route.generation_prompt, undefined);
});

test('gateway detects registered-agent bypass and blocks it', async () => {
  const result = await Gateway.executeAgentRequest(goodPayload(), {
    contentRouteFn: () => ({ matched: false, content_gate: 'PASS' }),
    ledgerFn: async row => ({ ok: true, inserted: true, invocation_id: row.invocation_id })
  });

  assert.equal(result.status, 'BLOCKED_REQUIRED_AGENT_NOT_INVOKED');
  assert.deepEqual(result.invocation_check.missing_agents, ['kk-content-strategy', 'kk-content-agent']);
});

test('non-content requests are not hijacked by chat content gateway', async () => {
  let ledgerCalls = 0;
  const result = await Gateway.executeAgentRequest({
    message: 'ตรวจสอบราคาคู่แข่งงานนี้แบบละเอียด'
  }, {
    ledgerFn: async () => {
      ledgerCalls += 1;
      return { ok: true };
    }
  });

  assert.equal(result.status, 'NO_AGENT_ROUTE');
  assert.equal(ledgerCalls, 0);
});

test('invocation record stores hashes and agent evidence instead of raw message', async () => {
  let row;
  await Gateway.executeAgentRequest(goodPayload(), {
    ledgerFn: async value => {
      row = value;
      return { ok: true, inserted: true, invocation_id: value.invocation_id };
    }
  });

  assert.match(row.request_hash, /^[0-9a-f]{64}$/);
  assert.match(row.truth_hash, /^[0-9a-f]{64}$/);
  assert.equal(Object.hasOwn(row, 'message'), false);
  assert.equal(Object.hasOwn(row, 'input'), false);
});

test('ledger row contract rejects any production write or publish evidence', () => {
  const base = {
    invocation_id:'agi_1234567890abcdef',
    request_type:'CHAT_CONTENT_REQUEST',
    intent:'direct_rental_x',
    gate_status:'READY_FOR_OWNER_REVIEW',
    required_agents:['kk-content-strategy','kk-content-agent'],
    invoked_agents:['kk-content-strategy','kk-content-agent'],
    request_hash:'a'.repeat(64),
    truth_hash:'b'.repeat(64),
    production_writes:0,
    publishes:0
  };
  assert.deepEqual(Ledger.validateRow(base).errors, []);
  assert.match(
    Ledger.validateRow({ ...base, production_writes:1 }).errors.join(','),
    /PRODUCTION_WRITES_NONZERO/
  );
  assert.match(
    Ledger.validateRow({ ...base, publishes:1 }).errors.join(','),
    /PUBLISHES_NONZERO/
  );
});

test('Supabase invocation ledger migrations preserve append-only service-role access', () => {
  const first = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20260927022226_agent_invocation_ledger_v1.sql'),
    'utf8'
  ).toLowerCase();
  const least = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20260927022311_agent_invocation_ledger_least_privilege_v1.sql'),
    'utf8'
  ).toLowerCase();

  assert.match(first, /enable row level security/);
  assert.match(first, /revoke all on table public\.kk_agent_invocations from anon, authenticated/);
  assert.match(first, /production_writes = 0/);
  assert.match(first, /publishes = 0/);
  assert.match(least, /revoke all on table public\.kk_agent_invocations from service_role/);
  assert.match(least, /grant select, insert on table public\.kk_agent_invocations to service_role/);
  assert.doesNotMatch(least, /grant[^;]*(update|delete)/);
});
