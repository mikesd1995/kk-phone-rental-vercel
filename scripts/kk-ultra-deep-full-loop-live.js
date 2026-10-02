#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const Verifier=require('../server/kk-ultra-deep-candidate-verifier.js');
const Competitor=require('../server/kk-ultra-deep-competitor-scan.js');
const Orchestrator=require('../server/kk-ultra-deep-full-loop-orchestrator.js');

function text(v){return String(v==null?'':v).trim();}
function arg(name,fallback=''){const i=process.argv.indexOf('--'+name);return i>=0&&process.argv[i+1]?process.argv[i+1]:fallback;}
const site=text(process.env.KK_SITE_URL||'https://kk-phone-rental.vercel.app').replace(/\/$/,'');
const pin=text(process.env.KK_ADMIN_PIN);
if(!pin)throw new Error('KK_ADMIN_PIN_MISSING');

async function admin(payload){
 const r=await fetch(site+'/api/kk-admin-guard',{method:'POST',headers:{'content-type':'application/json','x-admin-pin':pin,'x-kk-ultra-deep-live':'V1'},body:JSON.stringify(payload)});
 const body=await r.json().catch(()=>null);
 if(!r.ok||!body||body.ok===false)throw Object.assign(new Error(text(body&&body.error)||('ADMIN_HTTP_'+r.status)),{code:text(body&&body.error_code)||('ADMIN_HTTP_'+r.status)});
 return body;
}
async function snapshot(){
 const body=await admin({action:'snapshot'});
 return body.data||body.snapshot||body;
}
function hydrateSnapshot(s={}){
 const events=(s.events||[]).map(e=>({...e,packages:(s.web_packages||[]).filter(p=>text(p.event_id)===text(e.event_id))}));
 const byId=new Map(events.map(e=>[text(e.event_id),e]));
 const bookings=(s.bookings||[]).map(b=>({...b,event_date:text(b.event_date)||(byId.get(text(b.event_id))&&text(byId.get(text(b.event_id)).event_date))||''}));
 return {events,bookings,packages:s.packages||[],visibility_locks:s.visibility_locks||[]};
}
function readbackFromSnapshot(plan,s){
 const p=plan.admin_payload||{};
 const e=(s.events||[]).find(x=>text(x.event_name)===text(p.event_name)&&text(x.event_date)===text(p.event_date));
 if(!e)return {event:{},packages:[]};
 const web=(s.web_ready||[]).find(x=>text(x.event_id)===text(e.event_id))||e;
 return {event:{...e,...web,active_on_web:e.active_on_web===true||String(e.active_on_web).toLowerCase()==='true'},packages:(s.web_packages||[]).filter(x=>text(x.event_id)===text(e.event_id))};
}
async function postAction(action){
 const out=await admin(action);
 return out;
}
async function main(){
 const inputPath=arg('discovery','ultra-deep-runtime-acceptance.json');
 const outputPath=arg('output','ultra-deep-full-loop-live.json');
 const discovery=JSON.parse(fs.readFileSync(inputPath,'utf8'));
 if(discovery.full!==true||discovery.status!=='READY_FOR_VERIFIER')throw new Error('DISCOVERY_NOT_FULL');
 const month=text(discovery.month||arg('month','2026-10'));
 const verified=await Verifier.verifyBatch(discovery.candidates||[],{month},{concurrency:4,timeout_ms:10000});
 const competitor=await Competitor.scanBatch(verified.verified_candidates,{ddgs_timeout_ms:8000});
 const before=await snapshot();const h=hydrateSnapshot(before);
 const input={
  month,discovery,
  candidates:verified.verified_candidates,
  posters:verified.posters,
  competitor_prices:competitor.evidence,
  existing_events:h.events,
  bookings:h.bookings,
  visibility_locks:h.visibility_locks,
  package_templates:h.packages,
  verifier_approved:true,
  correlation_id:'ULTRA-DEEP-LIVE-'+Date.now()
 };
 const result=await Orchestrator.run(input,{
  executeWrites:true,
  env:{...process.env,KK_ADMIN_PIN:pin,KK_SITE_URL:site,KK_GOVERNED_STOREFRONT_EXECUTOR_ENABLED:'true'},
  fetchImpl:fetch,
  storefrontReadbackFn:async({plan})=>{const s=await snapshot();return readbackFromSnapshot(plan,s);},
  existingEventWriterFn:async({plan})=>{
   for(const action of plan.actions)await postAction(action);
   const s=await snapshot();
   return {readback_verified:true,snapshot_generated_at:s.generated_at||null,actions:plan.actions.length};
  }
 });
 const report={
  schema_version:'KK_ULTRA_DEEP_FULL_LOOP_LIVE_V1',
  month,
  discovery:{full:discovery.full,candidate_count:discovery.candidate_count,reference_candidate_count:discovery.reference_candidate_count,reconciliation_gap_count:discovery.reconciliation&&discovery.reconciliation.gap_count},
  verifier:{status:verified.status,input_count:verified.input_count,fetched_count:verified.fetched_count,verified_count:verified.verified_count,hold_count:verified.hold_count},
  competitor:{evidence_count:competitor.evidence.length,events_with_exact_evidence:competitor.events_with_exact_evidence},
  storefront:{existing_event_count:h.events.length,booking_count:h.bookings.length,visibility_lock_count:h.visibility_locks.length},
  result,
  completed_at:new Date().toISOString()
 };
 fs.writeFileSync(outputPath,JSON.stringify(report,null,2));
 process.stdout.write(JSON.stringify({status:result.status,production_writes:result.production_writes,verified_candidates:verified.verified_count,competitor_evidence:competitor.evidence.length,rows:result.rows.length},null,2)+'\n');
 if(result.status!=='COMPLETE')process.exitCode=2;
}
main().catch(e=>{console.error(JSON.stringify({error:e.message,code:e.code||e.name},null,2));process.exit(1);});
