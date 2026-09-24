'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Gate=require('../server/tracker-core-promotion-gate.js');

function tracker(extra={}){
  return Object.assign({
    event_family_id:'FAM|sample-event|20261010',
    tracker_show_id:'SHOW|sample-event|20261010|S1',
    event_date:'2026-10-10',
    event_name:'Sample Event',
    venue:'Bangkok Hall',
    canonical_status:'VERIFIED',
    verifier_confirmed:true
  },extra);
}
function lineage(core='EVT-20261010-SAMPLE'){
  return [{
    event_family_id:'FAM|sample-event|20261010',
    tracker_show_id:'SHOW|sample-event|20261010|S1',
    event_date:'2026-10-10',
    core_event_id:core
  }];
}
function writerReady(){
  return {ready:true,configured_actions:['updateEvent'],create_event_routed:false};
}

test('RAW or unconfirmed truth cannot promote',()=>{
  const a=Gate.evaluatePromotion({trackerEvent:tracker({verifier_confirmed:false})});
  assert.equal(a.decision,'BLOCKED');
  assert.equal(a.reason,'VERIFIER_CONFIRMATION_REQUIRED');
  assert.equal(a.production_writes,0);

  const b=Gate.evaluatePromotion({trackerEvent:tracker({canonical_status:'HOLD'})});
  assert.equal(b.decision,'BLOCKED');
  assert.equal(b.reason,'CANONICAL_STATUS_NOT_PROMOTABLE');
});

test('explicit lineage resolves existing Core event but remains gated without accepted writer',()=>{
  const r=Gate.evaluatePromotion({
    trackerEvent:tracker(),
    lineageRows:lineage(),
    coreEvents:[{event_id:'EVT-20261010-SAMPLE',event_name:'Sample Event',event_date:'2026-10-10'}],
    directWriterState:{ready:false,configured_actions:[],create_event_routed:false}
  });
  assert.equal(r.decision,'UPDATE_EXISTING_GATED');
  assert.equal(r.core_event_id,'EVT-20261010-SAMPLE');
  assert.equal(r.action,'updateEvent');
  assert.equal(r.ready_for_execution,false);
  assert.equal(r.production_writes,0);
});

test('explicit lineage plus accepted updateEvent writer produces a safe update plan only',()=>{
  const r=Gate.evaluatePromotion({
    trackerEvent:tracker(),
    lineageRows:lineage(),
    coreEvents:[{event_id:'EVT-20261010-SAMPLE',event_name:'Sample Event',event_date:'2026-10-10'}],
    directWriterState:writerReady()
  });
  assert.equal(r.decision,'READY_UPDATE_EXISTING');
  assert.equal(r.ready_for_execution,true);
  assert.deepEqual(r.payload,{
    action:'updateEvent',
    event_id:'EVT-20261010-SAMPLE',
    event_name:'Sample Event',
    event_date:'2026-10-10',
    venue:'Bangkok Hall',
    status:'active'
  });
  assert.equal(r.production_writes,0);
});

test('existing Core identity without explicit lineage never auto-creates or auto-maps',()=>{
  const r=Gate.evaluatePromotion({
    trackerEvent:tracker(),
    coreEvents:[{event_id:'EVT-LEGACY',event_name:'  sample   event ',event_date:'2026-10-10'}],
    directWriterState:writerReady()
  });
  assert.equal(r.decision,'RECONCILE_LINEAGE_REQUIRED');
  assert.deepEqual(r.candidate_core_event_ids,['EVT-LEGACY']);
  assert.equal(r.ready_for_execution,false);
});

test('no lineage and no Core identity match remains createEvent-authority gated',()=>{
  const r=Gate.evaluatePromotion({
    trackerEvent:tracker(),
    coreEvents:[{event_id:'EVT-OTHER',event_name:'Other Event',event_date:'2026-10-10'}],
    directWriterState:writerReady()
  });
  assert.equal(r.decision,'CREATE_EVENT_AUTHORITY_REQUIRED');
  assert.equal(r.action,'createEvent');
  assert.equal(r.create_event_routed,false);
  assert.equal(r.ready_for_execution,false);
});

test('lineage pointing to missing Core event fails closed',()=>{
  const r=Gate.evaluatePromotion({
    trackerEvent:tracker(),
    lineageRows:lineage('EVT-MISSING'),
    coreEvents:[],
    directWriterState:writerReady()
  });
  assert.equal(r.decision,'BLOCKED');
  assert.equal(r.reason,'LINEAGE_POINTS_TO_MISSING_CORE');
});

test('multi-day SHOWSET remains date-scoped through the lineage bridge',()=>{
  const event=tracker({
    event_family_id:'FAM|multi|20261010-11',
    tracker_show_id:'SHOWSET|multi|20261010-11',
    event_date:'2026-10-11',
    event_name:'Multi Event'
  });
  const r=Gate.evaluatePromotion({
    trackerEvent:event,
    lineageRows:[{
      event_family_id:'FAM|multi|20261010-11',
      tracker_show_id:'SHOWSET|multi|20261010-11',
      event_date:'2026-10-11',
      core_event_id:'EVT-MULTI-DAY2'
    }],
    coreEvents:[{event_id:'EVT-MULTI-DAY2',event_name:'Multi Event',event_date:'2026-10-11'}],
    directWriterState:writerReady()
  });
  assert.equal(r.decision,'READY_UPDATE_EXISTING');
  assert.equal(r.core_event_id,'EVT-MULTI-DAY2');
});

test('summary is deterministic and zero-write',()=>{
  const s=Gate.summarize([
    {decision:'READY_UPDATE_EXISTING'},
    {decision:'CREATE_EVENT_AUTHORITY_REQUIRED'},
    {decision:'CREATE_EVENT_AUTHORITY_REQUIRED'}
  ]);
  assert.equal(s.total,3);
  assert.equal(s.counts.READY_UPDATE_EXISTING,1);
  assert.equal(s.counts.CREATE_EVENT_AUTHORITY_REQUIRED,2);
  assert.equal(s.production_writes,0);
});
