'use strict';
const Production=require('./kk-ultra-deep-production-runtime.js');
const VERSION='KK_ULTRA_DEEP_V2_GOVERNED_WRITER_V1';
function text(v){return String(v==null?'':v).trim();}
function mapMutation(m={},decision={}){
 const eventId=text(decision.canonical_event_id);
 if(m.type==='UPDATE_PRICE'){
  if(decision.price_locked===true) throw Object.assign(new Error('booked price locked'),{code:'V2_BOOKED_PRICE_LOCK'});
  if(!eventId||!text(m.package_type)||!text(m.template_id)) throw Object.assign(new Error('price target identity missing'),{code:'V2_PRICE_TARGET_MISSING'});
  return {action:'upsertEventOverride',event_id:eventId,template_id:text(m.template_id),override_price:Number(m.to),active_override:true,override_note:'ULTRA_DEEP_V2_MARKET_ALIGNMENT'};
 }
 if(['UPDATE_DATE','UPDATE_VENUE','UPDATE_POSTER'].includes(m.type)){
  if(!eventId) throw Object.assign(new Error('event identity missing'),{code:'V2_EVENT_ID_MISSING'});
  const a={action:'updateEvent',event_id:eventId,note:'ULTRA_DEEP_V2_VERIFIED_METADATA'};
  if(m.type==='UPDATE_DATE')a.event_date=text(m.to);
  if(m.type==='UPDATE_VENUE')a.venue=text(m.to);
  if(m.type==='UPDATE_POSTER')a.poster_url=text(m.to);
  return a;
 }
 if(m.type==='CREATE_EVENT') return {action:'createEvent',event_name:text(decision.title),event_date:text(decision.event_date),venue:text(decision.verified_venue||decision.venue),poster_url:text(m.poster_url),active_on_web:true,__v2_create_price:Number(m.price)};
 throw Object.assign(new Error('unsupported V2 mutation '+text(m.type)),{code:'V2_MUTATION_UNSUPPORTED'});
}
function compile(plan={}){
 const byKey=new Map((plan.decisions||[]).map(d=>[text(d.event_key),d]));const actions=[];
 for(const m of plan.mutations||[]){const d=byKey.get(text(m.event_key));if(!d)throw Object.assign(new Error('decision missing'),{code:'V2_DECISION_MISSING'});actions.push({event_key:text(m.event_key),mutation:m,decision:d,admin:mapMutation(m,d)});}
 return {version:VERSION,status:'COMPILED',action_count:actions.length,actions,production_writes:0};
}
function exactMatch(action,rb={}){
 const e=rb.event||{},a=action.admin||{},m=action.mutation||{};
 if(m.type==='UPDATE_DATE')return Production.date(e.event_date)===Production.date(a.event_date);
 if(m.type==='UPDATE_VENUE')return Production.norm(e.venue)===Production.norm(a.venue);
 if(m.type==='UPDATE_POSTER')return text(e.poster_image_url||e.poster_url)===text(a.poster_url);
 if(m.type==='UPDATE_PRICE'){const row=(rb.packages||[]).find(p=>text(p.package_type).toUpperCase()===text(m.package_type).toUpperCase()||Production.packageTemplateId(p.package_id)===text(a.template_id));return !!row&&Number(row.price)===Number(a.override_price);}
 if(m.type==='CREATE_EVENT')return !!text(e.event_id)&&Production.norm(e.event_name)===Production.norm(a.event_name)&&Production.date(e.event_date)===Production.date(a.event_date)&&text(e.poster_image_url||e.poster_url)===text(a.poster_url);
 return false;
}
async function execute(plan={},options={}){
 const compiled=compile(plan);if(options.executeWrites!==true)return {...compiled,status:'READ_ONLY_COMPILED'};
 const env=options.env||process.env,fetchImpl=options.fetchImpl||global.fetch,receipts=[];let writes=0;
 for(const x of compiled.actions){
  if(x.mutation.type==='CREATE_EVENT') throw Object.assign(new Error('V2 create requires package-aware governed create executor'),{code:'V2_CREATE_EXECUTOR_REQUIRED'});
  const result=await Production.postAdmin(x.admin,{env,fetchImpl});writes++;
  let rb={event:{},packages:[]};
  for(let i=0;i<5;i++){const snap=await Production.freshSnapshot(env,fetchImpl);rb=Production.readbackForEvent(snap,x.admin.event_id,x.decision.title,x.decision.event_date);if(exactMatch(x,rb))break;if(i<4)await new Promise(r=>setTimeout(r,650));}
  const ok=exactMatch(x,rb);receipts.push({event_key:x.event_key,type:x.mutation.type,ok,readback:rb});if(!ok)return {version:VERSION,status:'READBACK_FAILED',production_writes:writes,receipts,blockers:['EXACT_READBACK_MISMATCH']};
 }
 return {version:VERSION,status:'COMPLETE',production_writes:writes,receipts,blockers:[]};
}
module.exports={VERSION,mapMutation,compile,exactMatch,execute};
