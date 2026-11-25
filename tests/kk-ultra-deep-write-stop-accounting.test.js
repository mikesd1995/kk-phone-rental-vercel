'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const Direct=require('../server/kk-ultra-deep-direct-zero-cost.js');
const Writer=require('../server/kk-ultra-deep-v2-governed-writer.js');
const Executor=require('../server/kk-governed-storefront-executor.js');
const Adapter=require('../server/kk-ultra-deep-v2-runtime-adapter.js');
const V2=require('../server/kk-ultra-deep-full-loop-v2.js');
const Runtime=require('../server/kk-ultra-deep-runtime-runner.js');
const PublicWeb=require('../server/kk-ultra-deep-public-web-adapters.js');
const Snapshot=require('../server/admin-sheet-fallback.js');
const guard=require('../api/kk-admin-guard.js');

const templates=[
 {template_id:'P',package_type:'phone_only',standard_price:690},
 {template_id:'L',package_type:'lens_only',standard_price:200},
 {template_id:'B',package_type:'phone_lens_bundle',standard_price:890}
];
const env={KK_ADMIN_PIN:'offline-fixture-pin',KK_SITE_URL:'https://offline.invalid'};
const discoveryCandidate={title:'Offline Fanmeeting',event_date:'2026-11-20',venue:'Union Hall',source_url:'https://www.eventpop.me/e/999999/offline'};
const html='<script type="application/ld+json">'+JSON.stringify({'@type':'MusicEvent',name:discoveryCandidate.title,startDate:discoveryCandidate.event_date,location:{name:'Union Hall'},image:'https://offline.invalid/poster.jpg'})+'</script>';

function isolate(t){
 const savedFetch=global.fetch;
 const savedEnv={};
 for(const key of Object.keys(process.env)){
  if(/(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|ADMIN_PIN|PRIVATE_KEY)/i.test(key)){savedEnv[key]=process.env[key];delete process.env[key];}
 }
 let forbiddenCalls=0;
 global.fetch=async()=>{forbiddenCalls++;throw new Error('NETWORK_FORBIDDEN');};
 t.after(()=>{global.fetch=savedFetch;for(const key of Object.keys(process.env))if(/(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|ADMIN_PIN|PRIVATE_KEY)/i.test(key))delete process.env[key];for(const key of Object.keys(savedEnv))process.env[key]=savedEnv[key];assert.equal(forbiddenCalls,0,'no uncontrolled network transport may be invoked');});
}

// The approved fixture replaces only Direct's plan boundary: the real verifier
// currently drops demand fields needed for new-event admission. It is not proof
// of discovery-to-CREATE admission. Runtime, verifier, commercial preparation,
// V2 plan construction, writer, executor and acceptance all execute real code.
function scenario(t,options={}){
 isolate(t);
 const saved={snapshot:Snapshot.buildSnapshot,page:PublicWeb.fetchPage,search:PublicWeb.runDdgsSearch,plan:Adapter.buildReadOnlyPlan};
 const updates=options.updates===undefined?1:options.updates,creates=options.creates===undefined?2:options.creates;
 const candidates=[];
 const rows=[];
 for(let i=0;i<updates;i++){
  candidates.push({event_key:'update-'+i,title:'Existing '+i,event_date:'2026-11-20',exists_in_canonical:true,canonical_event_id:'E'+i,current_venue:'Old Hall',verified_venue:'New Hall',venue_change_verified:true});
  rows.push({event_id:'E'+i,event_name:'Existing '+i,event_date:'2026-11-20',venue:'Old Hall',active_on_web:true});
 }
 for(let i=0;i<creates;i++)candidates.push({event_key:'create-'+i,title:'New Fanmeeting '+i,event_date:'2026-11-21',verified_venue:'Union Hall',exists_in_canonical:false,exact_event_verified:true,latest_official_poster_verified:true,latest_official_poster_url:'https://offline.invalid/new-'+i+'.jpg',governed_fallback_price:690});
 const plan=V2.buildPlan({month:'2026-11',candidates});
 const calls=[];let snapshots=0;
 Snapshot.buildSnapshot=async()=>{
  snapshots++;
  if(options.snapshotFailureAt===snapshots){
   if(Object.hasOwn(options,'snapshotFailureValue'))throw options.snapshotFailureValue;
   throw Object.assign(new Error('opaque snapshot provider failure'),{code:'FIXTURE_SNAPSHOT_FAILED',body:{private:'must not escape'}});
  }
  return {events:rows.map(x=>({...x})),web_ready:rows.map(x=>({...x})),web_packages:rows.flatMap(x=>(x.event_price_overrides||[]).map(p=>({event_id:x.event_id,template_id:p.template_id,package_id:p.template_id,price:options.createReadbackMismatch&&x.event_id.startsWith('NEW')?1:p.override_price,package_status:p.active_override?'available':'hidden'}))),packages:templates,assets:[{asset_type:'phone',status:'ready'}],bookings:[],visibility_locks:[]};
 };
 PublicWeb.fetchPage=async address=>{assert.equal(address,discoveryCandidate.source_url);return html;};
 PublicWeb.runDdgsSearch=async()=>[];
 Adapter.buildReadOnlyPlan=()=>({status:'READY',plan,production_writes:0});
 const providers=Object.fromEntries([...Runtime.UNKNOWN_SEARCH_PROVIDERS].map(key=>[key,async()=>[discoveryCandidate]]));
 const fetchImpl=async(address,init)=>{
  assert.equal(address,'https://offline.invalid/api/kk-admin-guard');
  const payload=JSON.parse(init.body);calls.push(payload);
  if(options.adminFailureAt===calls.length)throw Object.assign(new Error('opaque provider failure'),{code:'FIXTURE_ADMIN_FAILED',body:{private:'must not escape'}});
  if(payload.action==='updateEvent'){
   const row=rows.find(x=>x.event_id===payload.event_id);
   if(!options.updateReadbackMismatch)Object.assign(row,payload);
  }else if(payload.action==='createEvent')rows.push({...payload,event_id:'NEW'+calls.length,poster_image_url:payload.poster_url});
  else assert.fail('unexpected protected operation '+payload.action);
  if(options.malformedAdminReceiptAt===calls.length)return {ok:true,status:200,json:async()=>({})};
  return {ok:true,status:200,json:async()=>({ok:true,result:{event_id:rows.at(-1).event_id}})};
 };
 t.after(()=>{Snapshot.buildSnapshot=saved.snapshot;PublicWeb.fetchPage=saved.page;PublicWeb.runDdgsSearch=saved.search;Adapter.buildReadOnlyPlan=saved.plan;});
 return {calls,plan,fetchImpl,run:()=>Direct.run({month:'2026-11'},{operational:true,executeWrites:true,env,fetchImpl,providers})};
}

test('Direct stops before CREATE after an update exact-readback mismatch',async t=>{
 const s=scenario(t,{updateReadbackMismatch:true});
 const result=await s.run();
 assert.deepEqual(s.calls.map(x=>x.action),['updateEvent']);
 assert.equal(result.status,'V2_COMMIT_INCOMPLETE');
 assert.equal(result.production_writes,1);
 assert.equal(result.v2_write.verified_writes,0);
});

test('Direct stops after first accepted CREATE loses exact readback and retains its known write',async t=>{
 const s=scenario(t,{createReadbackMismatch:true});
 const result=await s.run();
 assert.deepEqual(s.calls.map(x=>x.action),['updateEvent','createEvent']);
 assert.equal(result.status,'V2_COMMIT_INCOMPLETE');
 assert.equal(result.production_writes,2);
 assert.equal(result.v2_write.verified_writes,1);
 assert.equal(result.v2_write.attempted_writes,2);
 assert.equal(result.v2_write.unknown_write_outcomes,0);
 assert.equal(JSON.stringify(result).includes('must not escape'),false);
});

test('Direct preserves earlier verified update when the next update transport is ambiguous',async t=>{
 const s=scenario(t,{updates:3,adminFailureAt:2});
 const result=await s.run();
 assert.deepEqual(s.calls.map(x=>x.action),['updateEvent','updateEvent']);
 assert.equal(result.production_writes,1);
 assert.equal(result.v2_write.verified_writes,1);
 assert.equal(result.v2_write.attempted_writes,2);
 assert.equal(result.v2_write.unknown_write_outcomes,1);
 assert.equal(result.v2_acceptance.status,'INCOMPLETE');
 assert.equal(JSON.stringify(result).includes('must not escape'),false);
});

test('Direct preserves accepted update when readback provider throws and performs no CREATE',async t=>{
 const s=scenario(t,{snapshotFailureAt:2});
 const result=await s.run();
 assert.equal(s.calls.length,1);
 assert.equal(result.production_writes,1);
 assert.equal(result.v2_write.verified_writes,0);
 assert.equal(result.v2_write.unknown_write_outcomes,0);
 assert.equal(result.v2_acceptance.status,'INCOMPLETE');
});

test('Direct stops after ambiguous CREATE transport and never reports its unknown outcome as verified',async t=>{
 const s=scenario(t,{adminFailureAt:2});
 const result=await s.run();
 assert.deepEqual(s.calls.map(x=>x.action),['updateEvent','createEvent']);
 assert.equal(result.production_writes,1);
 assert.equal(result.v2_write.verified_writes,1);
 assert.equal(result.v2_write.unknown_write_outcomes,1);
 assert.equal(result.v2_write.attempted_writes,2);
 assert.equal(result.v2_acceptance.status,'INCOMPLETE');
});

test('Direct completes only after every real update and atomic CREATE is accepted and verified',async t=>{
 const s=scenario(t);
 const result=await s.run();
 assert.deepEqual(s.calls.map(x=>x.action),['updateEvent','createEvent','createEvent']);
 assert.equal(result.status,'COMPLETE');
 assert.equal(result.production_writes,3);
 assert.equal(result.v2_write.verified_writes,3);
 assert.equal(result.v2_write.unknown_write_outcomes,0);
});

// Contract-fault tests deliberately inject malformed writer returns. They prove
// Direct rejects missing evidence; normal and provider-failure cases above keep
// the real writer/executor and are not replaced by these fixtures.
for(const receipt of [null,{}, {production_writes:1,readback_verified:false}, {production_writes:1,readback_verified:true}, {status:'STOREFRONT_PROMOTION_VERIFIED',production_writes:1,verified_writes:1,attempted_writes:1,unknown_write_outcomes:0,readback_verified:true}]){
 test('Direct stops on malformed CREATE receipt '+JSON.stringify(receipt),async t=>{
  const s=scenario(t,{updates:0});
  const original=Writer.executeCreate;let attemptedCreates=0;
  Writer.executeCreate=async()=>{attemptedCreates++;return receipt;};
  t.after(()=>{Writer.executeCreate=original;});
  const result=await s.run();
  assert.equal(attemptedCreates,1);
  assert.equal(result.status,'V2_COMMIT_INCOMPLETE');
  assert.equal(result.production_writes,receipt&&receipt.production_writes===1?1:0);
  if(!receipt||receipt.production_writes===undefined)assert.equal(result.v2_write.unknown_write_outcomes,1);
 });
}

test('Direct refuses COMPLETE update status with missing mutation receipts before any CREATE',async t=>{
 const s=scenario(t);
 const original=Writer.execute;
 Writer.execute=async()=>({status:'COMPLETE',production_writes:1,verified_writes:1,attempted_writes:1,unknown_write_outcomes:0});
 t.after(()=>{Writer.execute=original;});
 const result=await s.run();
 assert.equal(s.calls.length,0);
 assert.equal(result.status,'V2_COMMIT_INCOMPLETE');
 assert.equal(result.production_writes,1);
});

test('Direct refuses a claimed successful update receipt whose readback does not match the mutation',async t=>{
 const s=scenario(t,{creates:0});
 const original=Writer.execute;
 Writer.execute=async()=>({status:'COMPLETE',production_writes:1,verified_writes:1,attempted_writes:1,unknown_write_outcomes:0,receipts:[{event_key:'update-0',type:'UPDATE_VENUE',ok:true,readback:{event:{venue:'Old Hall'},packages:[]}}]});
 t.after(()=>{Writer.execute=original;});
 const result=await s.run();
 assert.equal(result.status,'V2_COMMIT_INCOMPLETE');
});

test('R1 Direct rejects success booleans without the actual Executor and Promotion receipt contract',async t=>{
 const s=scenario(t,{updates:0,creates:1});
 const original=Writer.executeCreate;
 Writer.executeCreate=async()=>({status:'STOREFRONT_PROMOTION_VERIFIED',production_writes:1,verified_writes:1,attempted_writes:1,unknown_write_outcomes:0,readback_verified:true,verification:{verified:true},create_result:{ok:true}});
 t.after(()=>{Writer.executeCreate=original;});
 const result=await s.run();
 assert.equal(result.status,'V2_COMMIT_INCOMPLETE');
 assert.equal(result.production_writes,1,'retain the attributable count even though verification evidence is insufficient');
 assert.equal(s.calls.length,0,'this is a writer-return contract fault, not a real admin write');
});

const malformedSuccessCases=[
 ['missing executor schema',r=>{delete r.schema_version;}],
 ['wrong executor schema',r=>{r.schema_version='UNKNOWN';}],
 ['missing publish count',r=>{delete r.publishes;}],
 ['missing verification schema',r=>{delete r.verification.schema_version;}],
 ['wrong verification schema',r=>{r.verification.schema_version='UNKNOWN';}],
 ['missing verification status',r=>{delete r.verification.status;}],
 ['failed verification status',r=>{r.verification.status='PROMOTION_READBACK_FAILED';}],
 ['missing blockers',r=>{delete r.verification.blockers;}],
 ['nonempty blockers',r=>{r.verification.blockers=['EVENT_ID_MISSING'];}],
 ['blank verification event identity',r=>{r.verification.event_id='  ';}],
 ['missing pricing status',r=>{delete r.verification.pricing_status;}],
 ['contradictory pricing status',r=>{r.verification.pricing_status='UNKNOWN';}],
 ['missing price recheck state',r=>{delete r.verification.needs_price_recheck;}],
 ['contradictory result identity',r=>{r.create_result.result.event_id='OTHER_EVENT';}],
 ['contradictory direct identity',r=>{r.create_result.event_id='OTHER_EVENT';}],
 ['contradictory data identity',r=>{r.create_result.data={event_id:'OTHER_EVENT'};}]
];
for(const [name,corrupt] of malformedSuccessCases){
 test('R1 Direct stops after accepted CREATE with '+name,async t=>{
  const s=scenario(t,{updates:0});
  const original=Writer.executeCreate;
  Writer.executeCreate=async(...args)=>{const receipt=await original(...args);corrupt(receipt);return receipt;};
  t.after(()=>{Writer.executeCreate=original;});
  const result=await s.run();
  assert.equal(s.calls.length,1,'no later CREATE after malformed success evidence');
  assert.equal(result.status,'V2_COMMIT_INCOMPLETE');
  assert.equal(result.production_writes,1);
 });
}

for(const shape of ['no admin identity','data identity','direct identity']){
 test('R1 Direct accepts real verified receipt with supported '+shape,async t=>{
  const s=scenario(t,{updates:0,creates:1});
  const original=Writer.executeCreate;
  Writer.executeCreate=async(...args)=>{
   const receipt=await original(...args);const id=receipt.create_result.result.event_id;
   receipt.create_result=shape==='data identity'?{ok:true,data:{event_id:id}}:shape==='direct identity'?{ok:true,event_id:id}:{ok:true};
   return receipt;
  };
  t.after(()=>{Writer.executeCreate=original;});
  const result=await s.run();
  assert.equal(result.status,'COMPLETE');
  assert.equal(result.production_writes,1);
 });
}

for(const [name,value] of [['string','RAW_READBACK_VALUE'],['null',null],['frozen Error',Object.freeze(new Error('RAW_READBACK_VALUE'))]]){
 test('R2 real Executor retains accepted CREATE footprint when readback rejects '+name,async t=>{
  isolate(t);
  const plan=Writer.createPlan({title:'Fixture Fanmeeting',event_date:'2026-11-20',verified_venue:'Union Hall'},{price:690,poster_url:'https://offline.invalid/p.jpg'},templates);
  await assert.rejects(()=>Executor.execute(plan,{env,fetchImpl:async()=>({ok:true,status:200,json:async()=>({ok:true,result:{event_id:'NEW1'}})}),readbackFn:async()=>{throw value;}}),error=>{
   assert.equal(error.code,'PROMOTION_READBACK_FAILED');
   assert.deepEqual(error.write_footprint,{production_writes:1,verified_writes:0,attempted_writes:1,unknown_write_outcomes:0});
   assert.equal(error.message.includes('RAW_READBACK_VALUE'),false);
   assert.equal(JSON.stringify(error).includes('RAW_READBACK_VALUE'),false);
   return true;
  });
 });
 test('R2 real Executor retains dispatched unknown footprint when admin rejects '+name,async t=>{
  isolate(t);
  const plan=Writer.createPlan({title:'Fixture Fanmeeting',event_date:'2026-11-20',verified_venue:'Union Hall'},{price:690,poster_url:'https://offline.invalid/p.jpg'},templates);
  await assert.rejects(()=>Executor.execute(plan,{env,fetchImpl:async()=>{throw value;}}),error=>{
   assert.equal(error.code,'PROMOTION_ADMIN_FAILED');
   assert.deepEqual(error.write_footprint,{production_writes:0,verified_writes:0,attempted_writes:1,unknown_write_outcomes:1});
   assert.equal(error.message.includes('RAW_READBACK_VALUE'),false);
   return true;
  });
 });
 test('R2 Direct stops later CREATEs and preserves prior update plus accepted CREATE on '+name+' readback rejection',async t=>{
  const s=scenario(t,{snapshotFailureAt:3,snapshotFailureValue:value});
  const result=await s.run();
  assert.deepEqual(s.calls.map(x=>x.action),['updateEvent','createEvent']);
  assert.equal(result.status,'V2_COMMIT_INCOMPLETE');
  assert.equal(result.production_writes,2);
  assert.equal(result.v2_write.verified_writes,1);
  assert.equal(result.v2_write.attempted_writes,2);
  assert.equal(result.v2_write.unknown_write_outcomes,0);
  assert.equal(JSON.stringify(result).includes('RAW_READBACK_VALUE'),false);
 });
}

for(const [boundary,priorKnown,throws] of [['update',0,false],['update',1,false],['update',1,true],['create',1,false],['create',1,true]]){
 test('R3 Direct marks the full gap UNKNOWN for '+boundary+' '+(throws?'throw':'return')+' with prior known '+priorKnown,async t=>{
  const s=scenario(t,{updates:boundary==='create'?1:0,creates:2});
  const method=boundary==='create'?'executeCreate':'execute';const original=Writer[method];
  Writer[method]=async()=>{
   const footprint={production_writes:boundary==='update'?priorKnown:0,verified_writes:boundary==='update'?priorKnown:0,attempted_writes:boundary==='update'?priorKnown+1:1,unknown_write_outcomes:0};
   if(throws)throw Object.assign(new Error('opaque contract rejection'),{write_footprint:footprint});
   return {...footprint,status:'INCOMPLETE',receipts:[],readback_verified:false};
  };
  t.after(()=>{Writer[method]=original;});
  const result=await s.run();
  assert.equal(result.status,'V2_COMMIT_INCOMPLETE');
  assert.equal(result.production_writes,priorKnown);
  assert.equal(result.v2_write.verified_writes,priorKnown);
  assert.equal(result.v2_write.attempted_writes,priorKnown+1);
  assert.equal(result.v2_write.unknown_write_outcomes,1);
  assert.equal(result.v2_write.production_writes+result.v2_write.unknown_write_outcomes,result.v2_write.attempted_writes);
 });
}

test('governed executor carries an accepted CREATE footprint through exact-readback failure',async t=>{
 isolate(t);
 const plan=Writer.createPlan({title:'Fixture Fanmeeting',event_date:'2026-11-20',verified_venue:'Union Hall'},{price:690,poster_url:'https://offline.invalid/p.jpg'},templates);
 await assert.rejects(()=>Executor.execute(plan,{env,fetchImpl:async()=>({ok:true,status:200,json:async()=>({ok:true,result:{event_id:'NEW1'}})}),readbackFn:async()=>({event:{},packages:[]})}),error=>{
  assert.equal(error.code,'PROMOTION_READBACK_FAILED');
  assert.deepEqual(error.write_footprint,{production_writes:1,verified_writes:0,attempted_writes:1,unknown_write_outcomes:0});
  return true;
 });
});

test('governed executor distinguishes credential preflight from a dispatched unknown outcome',async t=>{
 isolate(t);
 const plan=Writer.createPlan({title:'Fixture Fanmeeting',event_date:'2026-11-20',verified_venue:'Union Hall'},{price:690,poster_url:'https://offline.invalid/p.jpg'},templates);
 await assert.rejects(()=>Executor.execute(plan,{env:{},fetchImpl:global.fetch}),error=>{
  assert.equal(error.code,'PROMOTION_ADMIN_CREDENTIAL_MISSING');
  assert.deepEqual(error.write_footprint,{production_writes:0,verified_writes:0,attempted_writes:0,unknown_write_outcomes:0});
  return true;
 });
});

for(const operation of ['update','create']){
 test('Direct treats malformed successful admin '+operation+' receipt as an unknown outcome and stops',async t=>{
  const s=scenario(t,{updates:operation==='update'?1:0,malformedAdminReceiptAt:1});
  const result=await s.run();
  assert.equal(s.calls.length,1);
  assert.equal(result.status,'V2_COMMIT_INCOMPLETE');
  assert.equal(result.production_writes,0);
  assert.equal(result.v2_write.attempted_writes,1);
  assert.equal(result.v2_write.unknown_write_outcomes,1);
 });
}

test('generic writer retains earlier accepted update footprint if a later CREATE requires its separate plan',async t=>{
 const s=scenario(t,{updates:1,creates:1});
 await assert.rejects(()=>Writer.execute(s.plan,{executeWrites:true,env,fetchImpl:s.fetchImpl}),error=>{
  assert.equal(error.code,'V2_CREATE_PLAN_REQUIRED');
  assert.deepEqual(error.write_footprint,{production_writes:1,verified_writes:1,attempted_writes:1,unknown_write_outcomes:0});
  return true;
 });
 assert.equal(s.calls.length,1);
});

test('real adapter produces complete terminal and mutation counts for the Direct fixture contract',()=>{
 const out=Adapter.buildReadOnlyPlan({month:'2026-11',snapshot:{events:[{event_id:'E1',event_name:'Existing Fanmeeting',event_date:'2026-11-20',venue:'Old Hall'}],web_ready:[],web_packages:[],bookings:[],assets:[{asset_type:'phone',status:'ready'}]},commercial:{candidates:[]},candidates:[{event_key:'existing',title:'Existing Fanmeeting',event_date:'2026-11-20',venue:'New Hall'}]});
 assert.equal(out.status,'READY');
 assert.equal(out.plan.candidate_count,1);
 assert.equal(out.plan.terminal_disposition_count,1);
 assert.equal(out.plan.planned_mutation_count,1);
 assert.equal(out.plan.decisions[0].decision,'UPDATE');
 assert.equal(out.plan.mutations[0].type,'UPDATE_VENUE');
});

async function callGuard(payload,pin){
 const req=Readable.from([JSON.stringify(payload)]);req.method='POST';req.headers=pin?{'x-admin-pin':pin}:{};
 let body;const res={setHeader(){},end(value){body=JSON.parse(value);}};
 await guard(req,res);return {status:res.statusCode,body};
}

test('actual Direct handler accepts YYYY-MM, blocks malformed months before providers, and enforces PIN authentication',async t=>{
 isolate(t);
 process.env.KK_ADMIN_PIN=env.KK_ADMIN_PIN;
 const previousSnapshot=Snapshot.buildSnapshot;let providerCalls=0;
 Snapshot.buildSnapshot=async()=>{providerCalls++;throw Object.assign(new Error('offline preflight stop'),{code:'FIXTURE_PREFLIGHT_STOP'});};
 t.after(()=>{Snapshot.buildSnapshot=previousSnapshot;});
 const accepted=await callGuard({action:'ultraDeepDirectRun',month:'2026-11'},env.KK_ADMIN_PIN);
 assert.equal(accepted.status,500);
 assert.equal(accepted.body.error_code,'FIXTURE_PREFLIGHT_STOP');
 assert.equal(providerCalls,1);
 for(const month of ['2026-1','202611','2026-11x','\\dddd-\\dd','']){
  const invalid=await callGuard({action:'ultraDeepDirectRun',month,commit:true},env.KK_ADMIN_PIN);
  assert.equal(invalid.status,400,month);
  assert.equal(invalid.body.error_code,'ULTRA_DEEP_MONTH_INVALID');
 }
 const unauthenticated=await callGuard({action:'ultraDeepDirectRun',month:'2026-11',commit:true});
 assert.equal(unauthenticated.status,401);
 assert.equal(providerCalls,1);
});
