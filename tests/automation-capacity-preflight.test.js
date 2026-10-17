'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {assess} = require('../scripts/automation-capacity-preflight.cjs');
const ids = {scanner:'canonical-scanner', verifier:'canonical-verifier'};
const tasks = [
  {id:ids.scanner,is_enabled:false},
  {id:ids.verifier,is_enabled:false},
  {id:'other-1',is_enabled:true},
  {id:'other-2',is_enabled:true},
  {id:'other-3',is_enabled:true}
];
const params = {tasks, inventoryComplete:true, limit:5, canonicalIds:ids, ownerPause:false};
test('verified five slots with three active tasks requires no displacement for both canonicals', () => {
  const r=assess(params);
  assert.equal(r.ok,true);
  assert.equal(r.active_count,3);
  assert.equal(r.canonical_off,2);
  assert.equal(r.slots_to_free,0);
  assert.equal(r.classification,'READY_FOR_SEPARATE_OWNER_REVIEW');
  assert.equal(r.approval_required,true);
  assert.equal(r.can_auto_enable,false);
});
test('four active tasks and two missing canonicals need one separately approved change', () => {
  const r=assess({...params,tasks:tasks.concat({id:'other-4',is_enabled:true})});
  assert.equal(r.ok,false);
  assert.equal(r.classification,'HOLD_CAPACITY_REBALANCE_REQUIRED');
  assert.equal(r.slots_to_free,1);
});
test('unknown account limit never silently assumes five', () => {
  const r=assess({...params,limit:undefined});
  assert.equal(r.classification,'HOLD_UNVERIFIED_ACCOUNT_LIMIT');
});
test('partial registry blocks optimistic slot counting', () => {
  const r=assess({...params,inventoryComplete:false});
  assert.equal(r.classification,'HOLD_INCOMPLETE_TASK_INVENTORY');
});
test('paused or unknown owner intent cannot authorize restore', () => {
  for(const ownerPause of [true,undefined,null]) {
    assert.equal(assess({...params,ownerPause}).classification,'HOLD_OWNER_PAUSE_NOT_CLEAR');
  }
});
test('missing, duplicate or malformed canonical registry entry fails closed', () => {
  assert.equal(assess({...params,tasks:tasks.slice(1)}).classification,'HOLD_CANONICAL_TASK_MISSING');
  assert.equal(assess({...params,tasks:tasks.concat(tasks[2])}).classification,'HOLD_TASK_STATE_OR_ID_INVALID');
  assert.equal(assess({...params,tasks:tasks.map((t,i)=>i===2?{id:t.id,is_enabled:'false'}:t)}).classification,'HOLD_TASK_STATE_OR_ID_INVALID');
  assert.equal(assess({...params,canonicalIds:{scanner:ids.scanner,verifier:ids.scanner}}).classification,'HOLD_CANONICAL_IDENTITY_INVALID');
});
test('already enabled canonical pair does not require additional slots', () => {
  const all=tasks.map((t,i)=>i<2?{...t,is_enabled:true}:t);
  const r=assess({...params,tasks:all});
  assert.equal(r.ok,true);
  assert.equal(r.canonical_off,0);
  assert.equal(r.active_count,5);
});
test('no result can write automation or production and approvals are always required', () => {
  const cases=[params,{...params,limit:3},{...params,limit:null},{...params,ownerPause:true}];
  for(const p of cases){
    const r=assess(p);
    assert.equal(r.task_writes,0);
    assert.equal(r.production_writes,0);
    assert.equal(r.can_auto_enable,false);
    assert.equal(r.can_auto_disable,false);
    assert.equal(r.approval_required,true);
  }
});
