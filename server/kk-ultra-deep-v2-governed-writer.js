'use strict';
const Production=require('./kk-ultra-deep-production-runtime.js');
const Promotion=require('./kk-verifier-storefront-promotion.js');
const Executor=require('./kk-governed-storefront-executor.js');
const VERSION='KK_ULTRA_DEEP_V2_GOVERNED_WRITER_V2';
function text(v){return String(v==null?'':v).trim();}
function mapMutation(m={},decision={}){
 const eventId=text(decision.canonical_event_id);
 if(m.type==='UPDATE_PRICE'){
  if(decision.price_locked===true) throw Object.assign(new Error('booked price locked'),{code:'V2_BOOKED_PRICE_LOCK'});
  if(!eventId||!text(m.package_type)||!text(m.template_id)) throw Object.assign(new Error('price target identity missing'),{code:'V2_PRICE_TARGET_MISSING'});
  return {action:'upsertEventOverride',event_id:eventId,template_id:text(m.template_id),override_price:Number(m.to),active_override:true,override_note:'ULTRA_DEEP_V2_MARKET_ALIGNMENT'};
 }
 if(m.type==='UPDATE_VISIBILITY'){
  if(!eventId) throw Object.assign(new Error('event identity missing'),{code:'V2_EVENT_ID_MISSING'});
  return {action:'updateEvent',event_id:eventId,active_on_web:m.to===true,visibility_lock_reason:text(m.visibility_lock_reason||'OWNER_MONTHLY_DEMAND_PRUNE'),visibility_changed_by:'OWNER_MONTHLY_RECONCILIATION',visibility_source_evidence:'ULTRA_DEEP_EXTERNAL_DEMAND_REQUALIFICATION',note:'ULTRA_DEEP_V2_EXTERNAL_DEMAND_REQUALIFICATION'};
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
 if(m.type==='UPDATE_VISIBILITY')return Boolean(e.active_on_web)===Boolean(a.active_on_web);
 if(m.type==='UPDATE_PRICE'){const row=(rb.packages||[]).find(p=>text(p.package_type).toUpperCase()===text(m.package_type).toUpperCase()||Production.packageTemplateId(p.package_id)===text(a.template_id));return !!row&&Number(row.price)===Number(a.override_price);}
 if(m.type==='CREATE_EVENT')return !!text(e.event_id)&&Production.norm(e.event_name)===Production.norm(a.event_name)&&Production.date(e.event_date)===Production.date(a.event_date)&&text(e.poster_image_url||e.poster_url)===text(a.poster_url);
 return false;
}
async function execute(plan={},options={}){
 const compiled=compile(plan);if(options.executeWrites!==true)return {...compiled,status:'READ_ONLY_COMPILED'};
 const env=options.env||process.env,fetchImpl=options.fetchImpl||global.fetch,receipts=[];let writes=0;
 for(const x of compiled.actions){
  if(x.mutation.type==='CREATE_EVENT') throw Object.assign(new Error('V2 create must be executed by package-aware create plan'),{code:'V2_CREATE_PLAN_REQUIRED'});
  const result=await Production.postAdmin(x.admin,{env,fetchImpl});writes++;
  let rb={event:{},packages:[]};
  for(let i=0;i<5;i++){const snap=await Production.freshSnapshot(env,fetchImpl);rb=Production.readbackForEvent(snap,x.admin.event_id,x.decision.title,x.decision.event_date);if(exactMatch(x,rb))break;if(i<4)await new Promise(r=>setTimeout(r,650));}
  const ok=exactMatch(x,rb);receipts.push({event_key:x.event_key,type:x.mutation.type,ok,readback:rb});if(!ok)return {version:VERSION,status:'READBACK_FAILED',production_writes:writes,receipts,blockers:['EXACT_READBACK_MISMATCH']};
 }
 return {version:VERSION,status:'COMPLETE',production_writes:writes,receipts,blockers:[]};
}
function createPlan(decision={},mutation={},packageTemplates=[]){
 const ids={phone:'',lens:'',bundle:''};for(const p of packageTemplates||[]){const id=text(p.template_id||p.package_id),t=text(p.package_type).toLowerCase();if(t==='phone_only')ids.phone=id;else if(t==='lens_only')ids.lens=id;else if(t==='phone_lens_bundle')ids.bundle=id;}
 const price=Number(mutation.price),lensRow=(packageTemplates||[]).find(p=>text(p.package_type).toLowerCase()==='lens_only'),lens=Number(lensRow&&lensRow.standard_price)||200;
 if(!ids.phone||!ids.lens||!ids.bundle||!Number.isFinite(price)||price<=0)throw Object.assign(new Error('package template/price unavailable'),{code:'V2_CREATE_PACKAGE_IDENTITY_REQUIRED'});
 if(decision.owner_hidden===true||decision.tombstone_locked===true||Number(decision.booking_count)>0)throw Object.assign(new Error('booked or owner-hidden date is not eligible for new event create'),{code:'V2_CREATE_OWNER_OR_BOOKING_LOCK'});
 const phoneRule=text(decision.phone_rule||decision.phoneRule).toUpperCase();
 if(['PROHIBITED','NO_PHOTOGRAPHY','NO_PHONE','NO_PHOTO_VIDEO'].includes(phoneRule))throw Object.assign(new Error('organizer prohibits phone photography'),{code:'V2_CREATE_PHONE_CAPTURE_PROHIBITED'});
 const eventDate=text(decision.event_date),november=eventDate.startsWith('2026-11-');
 if(november&&price<590&&decision.owner_price_exception_verified!==true)throw Object.assign(new Error('November 2026 minimum phone rental price is 590 THB'),{code:'V2_NOVEMBER_PHONE_MINIMUM'});
 const lensRule=text(decision.lens_rule||decision.lensRule||'UNRESOLVED').toUpperCase();
 const lensPermissionVerified=decision.lens_rule_verified===true||decision.lensPermissionVerified===true;
 const bundleAllowed=lensRule==='VERIFIED_ALLOWED'&&lensPermissionVerified;
 const bundlePrice=bundleAllowed?Math.max(price+lens,november?690:0):0;
 const payload={action:'createEvent',event_name:text(decision.title),event_date:eventDate,venue:text(decision.verified_venue),poster_url:text(mutation.poster_url),status:'open',active_on_web:true,note:'ULTRA_DEEP_V2_VERIFIED_CREATE',event_price_overrides:[
  {template_id:ids.phone,override_price:price,active_override:true,override_note:'ULTRA_DEEP_V2_APPROVED_PRICE'},
  {template_id:ids.lens,override_price:0,active_override:false,override_note:'LENS_ONLY_ALWAYS_HIDDEN'},
  {template_id:ids.bundle,override_price:bundlePrice,active_override:bundleAllowed,override_note:bundleAllowed?'ULTRA_DEEP_V2_VERIFIED_ORGANIZER_LENS':'ULTRA_DEEP_V2_HOLD_UNVERIFIED_LENS'}]};
 const plan={status:'READY_FOR_GOVERNED_ADMIN_CREATE',admin_action:'createEvent',admin_payload:payload,duplicate_guard_required:true,exact_storefront_readback_required:true,pricing_status:text(mutation.price_basis),needs_price_recheck:false};
 Promotion.assertReady?Promotion.assertReady(plan):null;return plan;
}
async function executeCreate(decision,mutation,options={}){
 const env=options.env||process.env,fetchImpl=options.fetchImpl||global.fetch,plan=createPlan(decision,mutation,options.packageTemplates||[]);
 return Executor.execute(plan,{env,fetchImpl,correlationId:text(options.correlationId),readbackFn:args=>Production.storefrontReadback({...args,env,fetchImpl})});
}
module.exports={VERSION,mapMutation,compile,exactMatch,createPlan,executeCreate,execute};
