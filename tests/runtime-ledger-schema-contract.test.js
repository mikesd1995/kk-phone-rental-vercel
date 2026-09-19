'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const sql=fs.readFileSync(
  path.join(__dirname,'..','supabase','staging','kk-runtime-ledger-v1.sql'),
  'utf8'
);

test('runtime ledger staging SQL never grants all public sequences to service_role',()=>{
  assert.doesNotMatch(sql,/grant\s+usage\s*,\s*select\s+on\s+all\s+sequences\s+in\s+schema\s+public\s+to\s+service_role/i);
});

test('runtime ledger staging SQL clears project-default table grants before exact grants',()=>{
  for(const table of [
    'kk_runtime_expectations',
    'kk_runtime_observations',
    'kk_task_state_events',
    'kk_control_plane_incidents'
  ]){
    assert.match(
      sql,
      new RegExp(`revoke\\s+all\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+public,\\s*anon,\\s*authenticated,\\s*service_role`,'i')
    );
  }
});

test('expectations table permits service_role UPDATE only on status',()=>{
  assert.match(sql,/grant\s+select\s*,\s*insert\s+on\s+table\s+public\.kk_runtime_expectations\s+to\s+service_role/i);
  assert.match(sql,/grant\s+update\s*\(\s*status\s*\)\s+on\s+table\s+public\.kk_runtime_expectations\s+to\s+service_role/i);
  assert.doesNotMatch(sql,/grant\s+[^;]*update[^;]*on\s+table\s+public\.kk_runtime_expectations\s+to\s+service_role/i,
    'broad expectations UPDATE grant must not return');
});

test('runtime ledger V1 remains witness-only and nonce-constrained',()=>{
  assert.match(sql,/nonce\s+text\s+not\s+null\s+check\s*\(nonce\s+~\s+'\^\[-A-Za-z0-9_:\.\]\{16,128\}\$'\)/i);
  assert.match(sql,/mode\s+text\s+not\s+null\s+default\s+'WITNESS_ONLY'\s+check\s*\(mode\s*=\s*'WITNESS_ONLY'\)/i);
  assert.match(sql,/unique\s*\(nonce\)/i);
});

test('service_role sequence grants are limited to the three ledger identity sequences',()=>{
  const grants=[...sql.matchAll(/grant\s+usage\s*,\s*select\s+on\s+sequence\s+public\.([a-z0-9_]+)\s+to\s+service_role/gi)]
    .map(m=>m[1])
    .sort();
  assert.deepEqual(grants,[
    'kk_control_plane_incidents_id_seq',
    'kk_runtime_observations_id_seq',
    'kk_task_state_events_id_seq'
  ]);
});
