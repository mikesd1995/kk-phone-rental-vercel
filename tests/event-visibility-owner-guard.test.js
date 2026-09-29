'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Guard=require('../server/event-visibility-owner-guard.js');

test('owner-hidden event cannot be reopened without explicit owner intent',()=>{
  const checked=Guard.evaluateTransition(
    {event_id:'EVT-1',active_on_web:false},
    {event_id:'EVT-1',active_on_web:true}
  );
  assert.equal(checked.ok,false);
  assert.equal(checked.code,'EVENT_VISIBILITY_OWNER_LOCKED');
});

test('explicit owner reopen can transition hidden event back to visible',()=>{
  const checked=Guard.evaluateTransition(
    {event_id:'EVT-1',active_on_web:false},
    {event_id:'EVT-1',active_on_web:true,visibility_owner_intent:Guard.OWNER_REOPEN_INTENT}
  );
  assert.equal(checked.ok,true);
  assert.equal(checked.code,'OWNER_REOPEN_CONFIRMED');
  assert.equal(checked.owner_reopen,true);
});

test('hiding an event and no-op visibility updates remain allowed',()=>{
  assert.equal(Guard.evaluateTransition({active_on_web:true},{active_on_web:false}).ok,true);
  assert.equal(Guard.evaluateTransition({active_on_web:false},{active_on_web:false}).ok,true);
  assert.equal(Guard.evaluateTransition({active_on_web:false},{event_name:'Edited'}).ok,true);
});

test('sync merge helper preserves owner-hidden state instead of silently reactivating it',()=>{
  const merged=Guard.preserveOwnerHidden(
    {event_id:'EVT-1',active_on_web:false},
    {event_id:'EVT-1',active_on_web:true,event_name:'Existing Event'}
  );
  assert.equal(merged.preserved,true);
  assert.equal(merged.reason,'OWNER_HIDDEN_PRESERVED');
  assert.equal(merged.payload.active_on_web,false);
  assert.equal(Object.prototype.hasOwnProperty.call(merged.payload,'visibility_owner_intent'),false);
});

test('snapshot lookup evaluates exact event identity',()=>{
  const checked=Guard.evaluateSnapshotTransition({
    events:[
      {event_id:'EVT-1',active_on_web:false},
      {event_id:'EVT-2',active_on_web:true}
    ]
  },{event_id:'EVT-1',active_on_web:true});
  assert.equal(checked.ok,false);
  assert.equal(checked.event_id,'EVT-1');
  assert.equal(checked.code,'EVENT_VISIBILITY_OWNER_LOCKED');

  const missing=Guard.evaluateSnapshotTransition({events:[]},{event_id:'EVT-X',active_on_web:true});
  assert.equal(missing.ok,false);
  assert.equal(missing.code,'EVENT_VISIBILITY_EVENT_NOT_FOUND');
});


test('persistent LOCKED tombstone blocks reopen even if Core active flag was already overwritten true',()=>{
  const checked=Guard.evaluateSnapshotTransition({
    events:[{event_id:'EVT-1',event_name:'Old Event',event_date:'2026-10-11',venue:'Union Hall',active_on_web:true}],
    visibility_locks:[{event_id:'EVT-1',lock_state:'LOCKED',lock_reason:'OWNER_HIDE'}]
  },{event_id:'EVT-1',active_on_web:true});
  assert.equal(checked.ok,false);
  assert.equal(checked.code,'EVENT_VISIBILITY_TOMBSTONE_LOCKED');
});

test('explicit owner reopen can clear a persistent LOCKED transition gate while retaining history',()=>{
  const checked=Guard.evaluateSnapshotTransition({
    events:[{event_id:'EVT-1',event_name:'Old Event',event_date:'2026-10-11',venue:'Union Hall',active_on_web:false}],
    visibility_locks:[{event_id:'EVT-1',lock_state:'LOCKED',lock_reason:'OWNER_HIDE'}]
  },{event_id:'EVT-1',active_on_web:true,visibility_owner_intent:Guard.OWNER_REOPEN_INTENT});
  assert.equal(checked.ok,true);
  assert.equal(checked.code,'OWNER_REOPEN_CONFIRMED_TOMBSTONE');
  assert.equal(checked.owner_reopen,true);
});

test('create guard blocks owner-hidden history recreated under a new event id',()=>{
  const snapshot={visibility_locks:[{
    event_id:'EVT-OLD',
    event_name:'Same Event',
    event_date:'2026-10-11',
    venue:'Union Hall',
    lock_state:'LOCKED'
  }]};
  const r=Guard.evaluateCreateAgainstHistory(snapshot,{
    event_id:'EVT-NEW-ID',
    event_name:'Same Event',
    event_date:'11/10/2026',
    venue:'Union Hall'
  });
  assert.equal(r.ok,false);
  assert.equal(r.code,'EVENT_VISIBILITY_TOMBSTONE_LOCKED');
  assert.equal(r.history.match_kind,'IDENTITY');
});

test('create guard blocks any previously seen Core identity from automatic recreation',()=>{
  const snapshot={visibility_locks:[{
    event_id:'EVT-HISTORY',
    event_name:'Previously Published Event',
    event_date:'2026-11-01',
    venue:'IMPACT Arena',
    lock_state:'SEEN_CORE'
  }]};
  const r=Guard.evaluateCreateAgainstHistory(snapshot,{
    event_name:'Previously Published Event',
    event_date:'2026-11-01',
    venue:'IMPACT Arena'
  });
  assert.equal(r.ok,false);
  assert.equal(r.code,'EVENT_HISTORY_RECREATE_PROHIBITED');
  const fresh=Guard.evaluateCreateAgainstHistory(snapshot,{
    event_name:'Actually New Event',
    event_date:'2026-11-02',
    venue:'IMPACT Arena'
  });
  assert.equal(fresh.ok,true);
});
