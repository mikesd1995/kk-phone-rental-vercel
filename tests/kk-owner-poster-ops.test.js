'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Ops=require('../server/kk-owner-poster-ops.js');
const Registry=require('../server/kk-agent-registry.js');
const Router=require('../server/kk-agent-task-router.js');
const Reliability=require('../server/kk-reliability-learning-agent.js');

const idA='EVT-20261017-SHADES-GL-FANSIGN';
const idB='EVT-20261014-LOVE-ON-HIRE-BLESSING';
const idC='EVT-20261029-ANTIDOTES-PHUWIN-SECRET-WHITE-GARDEN';
const fileA='NEW_SHADES_IMAGE_20261017';
const fileB='NEW_LOVE_IMAGE_20261014';
const fileC='NEW_ANTIDOTES_IMAGE_20261029';
const mk=(id,date,poster='https://drive.google.com/thumbnail?id=OLD_POSTER_FILE_12345&sz=w1200')=>({
  event_id:id,event_date:date,event_name:id,venue:'Exact Venue',
  poster_image_url:poster,event_status:'open',active_on_web:true
});
const target=(r,drive_file_id,extra={})=>({
  event_id:r.event_id,event_date:r.event_date,event_name:r.event_name,venue:r.venue,
  event_status:r.event_status,active_on_web:r.active_on_web,
  uploaded_image_ref:'supplied-in-conversation',drive_file_id,drive_access_verified:true,
  old_poster_url:r.poster_image_url,...extra
});
const before=[mk(idA,'17/10/2026'),mk(idB,'14/10/2026'),mk(idC,'29/10/2026')];
const after=before.map((r,i)=>({...r,poster_image_url:Ops.canonicalPoster([fileA,fileB,fileC][i])}));
const targets=before.map((r,i)=>target(r,[fileA,fileB,fileC][i]));

test('owner poster route and advisory agents are wired without production writes',async()=>{
  const route=Registry.routeForIntent('owner_poster_update');
  assert.equal(route.runtime_available,true);
  assert.deepEqual(route.required_agents,['kk-owner-poster-ops','kk-reliability-learning']);
  assert.equal(Registry.AGENTS['kk-owner-poster-ops'].production_writes,0);
  const out=await Router.executeTask('owner_poster_update',{
    owner_authorized:true,targets,core_events:before,
    reliability_observations:[{code:'OWNER_POSTER_UPDATE_REPEATED_HANDOFF'}]
  });
  assert.deepEqual(out.invoked_agents,['kk-owner-poster-ops','kk-reliability-learning']);
  assert.equal(out.result.status,'READY_FOR_OWNER_GOVERNED_POSTER_ONLY_WRITE');
  assert.equal(out.result.agent_production_writes,0);
  assert.equal(out.result.reliability_learning.incidents[0].fingerprint_id,'OWNER_POSTER_UPDATE_REPEATED_HANDOFF');
});

test('one owner request can prepare three independent immutable poster replacements',()=>{
  const plan=Ops.validateTargets({owner_authorized:true,targets,core_events:before});
  assert.equal(plan.status,'READY_FOR_OWNER_GOVERNED_POSTER_ONLY_WRITE');
  assert.equal(plan.targets.length,3);
  assert.deepEqual(plan.targets.map(x=>x.new_drive_file_id),[fileA,fileB,fileC]);
  assert.ok(plan.targets.every(x=>x.canonical_field==='01_Events.poster_image_url'));
  assert.equal(plan.safety.price_writes,0);
  assert.equal(plan.safety.booking_writes,0);
  assert.equal(plan.safety.visibility_writes,0);
});

test('missing owner permission, unmatched event date, duplicate or reused file ID all block',()=>{
  assert.equal(Ops.validateTargets({targets,core_events:before}).status,'BLOCKED_PRECONDITION');
  const mismatch=[target(before[0],fileA,{event_date:'2026-10-18'})];
  assert.match(Ops.validateTargets({owner_authorized:true,targets:mismatch,core_events:before}).blockers.join(','),/DATE_IDENTITY_MISMATCH/);
  const dup=[targets[0],targets[0]];
  assert.match(Ops.validateTargets({owner_authorized:true,targets:dup,core_events:before}).blockers.join(','),/DUPLICATE_EVENT_ID/);
  const reused=[target(before[0],'OLD_POSTER_FILE_12345')];
  assert.match(Ops.validateTargets({owner_authorized:true,targets:reused,core_events:before}).blockers.join(','),/REUSE_OLD_DRIVE_ID_FORBIDDEN/);
  const unknown=[target(before[0],fileA,{event_id:'EVT-20261017-OTHER'})];
  assert.match(Ops.validateTargets({owner_authorized:true,targets:unknown,core_events:before}).blockers.join(','),/EXACT_CORE_ROW_REQUIRED/);
});

test('already supplied image before Drive upload yields actionable progress, not a repeat-owner prompt',()=>{
  const t=[target(before[0],null)];
  const result=Ops.validateTargets({owner_authorized:true,targets:t,core_events:before});
  assert.equal(result.status,'AWAITING_IMMUTABLE_DRIVE_UPLOAD');
  assert.match(result.next_step,/Upload supplied originals as NEW Drive files/i);
});

test('backend readback does not count as production feed or rendered visual acceptance',()=>{
  const base={targets,core_events:after,web_ready:after};
  assert.equal(Ops.acceptReadback(base).status,'BACKEND_DONE_PRODUCTION_UNVERIFIED');
  assert.equal(Ops.acceptReadback({...base,production_feed:after}).status,'BACKEND_DONE_BUT_VISUAL_UNVERIFIED');
  const visual=targets.map(t=>({event_id:t.event_id,image_loaded:true,not_cropped:true}));
  assert.equal(Ops.acceptReadback({...base,production_feed:after,visual_evidence:visual}).status,'COMPLETE_VERIFIED');
  assert.equal(Ops.acceptReadback({...base,production_feed:[...after.slice(0,2),before[2]],visual_evidence:visual}).status,'BLOCKED_READBACK_MISMATCH');
});

test('partial Core/Web Ready update and business-state drift never pass acceptance',()=>{
  const onlyTwo=[...after.slice(0,2),before[2]];
  const partial=Ops.acceptReadback({targets,core_events:after,web_ready:onlyTwo});
  assert.equal(partial.status,'BLOCKED_READBACK_MISMATCH');
  assert.match(partial.issues.join(','),/WEB_READY_POSTER_MISMATCH/);
  const mutated=[...after];
  mutated[0]={...mutated[0],event_status:'hidden'};
  const bad=Ops.acceptReadback({targets,core_events:mutated,web_ready:after});
  assert.equal(bad.status,'BLOCKED_READBACK_MISMATCH');
  assert.match(bad.issues.join(','),/EVENT_STATUS_CHANGED/);
});

test('Reliability Learning recognizes repeated handoff but never gains automatic write authority',()=>{
  const diagnosed=Reliability.classifyObservation({code:'OWNER_POSTER_UPDATE_REPEATED_HANDOFF'});
  assert.equal(diagnosed.known,true);
  assert.equal(diagnosed.fingerprint_id,'OWNER_POSTER_UPDATE_REPEATED_HANDOFF');
  assert.match(diagnosed.known_repair,/FIRST explicit owner poster/i);
  assert.equal(Reliability.loadMemory().learning_contract.auto_apply,false);
  assert.equal(Reliability.loadMemory().learning_contract.production_writes,0);
});
