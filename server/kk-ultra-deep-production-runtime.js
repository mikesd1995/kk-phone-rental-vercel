'use strict';

const AdminSheetFallback=require('./admin-sheet-fallback.js');
const Orchestrator=require('./kk-ultra-deep-full-loop-orchestrator.js');
const KnownMiss=require('./kk-ultra-deep-known-miss-regression.js');
const VisibilityGuard=require('./event-visibility-owner-guard.js');
const CandidateVerifier=require('./kk-ultra-deep-candidate-verifier.js');

const VERSION='KK_ULTRA_DEEP_PRODUCTION_RUNTIME_V2';
const DEFAULT_SITE='https://kk-phone-rental.vercel.app';
const DEFAULT_SHEET_ID='12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';

const AUTO_PROMOTION_MARKER='Verifier-approved discovery promotion';

function malformedAutoPromotionRows(snapshot={}){
 const eventById=new Map((snapshot.events||[]).map(e=>[text(e.event_id),e]));
 return (snapshot.web_ready||[]).filter(row=>{
  const id=text(row.event_id);const event=eventById.get(id)||{};
  const note=text(row.event_note||event.note||event.event_note);
  const action=text(row.action_for_web).toLowerCase();
  const active=!['hide','hidden'].includes(action);
  const quality=CandidateVerifier.titleQuality(row.event_name||event.event_name);
  return !!id&&active&&note.includes(AUTO_PROMOTION_MARKER)&&quality.ok===false;
 }).map(row=>({
  event_id:text(row.event_id),
  event_name:text(row.event_name),
  event_date:date(row.event_date),
  quality:CandidateVerifier.titleQuality(row.event_name)
 }));
}

async function quarantineMalformedAutoPromotions(snapshot={},options={}){
 const env=options.env||process.env,fetchImpl=options.fetchImpl||global.fetch;
 const rows=malformedAutoPromotionRows(snapshot);
 const results=[];const blockers=[];let production_writes=0;
 for(const row of rows){
  try{
   await postAdmin({action:'updateEvent',event_id:row.event_id,active_on_web:false},{env,fetchImpl});
   production_writes++;
   const fresh=await freshSnapshot(env,fetchImpl);
   const rb=readbackForEvent(fresh,row.event_id,row.event_name,row.event_date);
   const verified=text(rb.event.event_id)===row.event_id&&rb.event.active_on_web===false;
   results.push({...row,status:verified?'QUARANTINED_VERIFIED':'QUARANTINE_READBACK_FAILED',readback_verified:verified});
   if(!verified)blockers.push('AUTO_QUARANTINE_READBACK_FAILED:'+row.event_id);
  }catch(err){
   blockers.push('AUTO_QUARANTINE_FAILED:'+row.event_id+':'+text(err&&err.code||err&&err.name||'ERROR'));
   results.push({...row,status:'QUARANTINE_FAILED',readback_verified:false});
  }
 }
 return {status:blockers.length?'QUARANTINE_BLOCKED':'QUARANTINE_COMPLETE',candidate_count:rows.length,quarantined_verified:results.filter(x=>x.readback_verified).length,production_writes,results,blockers};
}

function text(v){return String(v==null?'':v).trim();}
function norm(v){return text(v).normalize('NFKC').toLowerCase().replace(/[^a-z0-9ก-๙]+/g,' ').replace(/\s+/g,' ').trim();}
function date(v){return VisibilityGuard.normalizeEventDate(v);}
function tokens(v){return norm(v).split(' ').filter(x=>x.length>=3);}
function titleOverlap(a,b){
 const x=tokens(a),y=new Set(tokens(b));if(!x.length)return 0;
 return x.filter(t=>y.has(t)).length/x.length;
}
function venueCompatible(a,b){
 const x=norm(a),y=norm(b);return !x||!y||x===y||x.includes(y)||y.includes(x);
}
function sameKnownMiss(a,b){
 return KnownMiss.CORPUS.some(c=>KnownMiss.sameCase(a,c)&&KnownMiss.sameCase(b,c));
}
function packageTemplateId(packageId){
 const s=text(packageId);const i=s.indexOf('TPL-');return i>=0?s.slice(i):s;
}
function snapshotEvents(snapshot={}){
 const webById=new Map((snapshot.web_ready||[]).map(x=>[text(x.event_id),x]));
 return (snapshot.events||[]).map(e=>{
  const web=webById.get(text(e.event_id))||{};
  const packages=(snapshot.web_packages||[]).filter(p=>text(p.event_id)===text(e.event_id)).map(p=>({
   package_id:text(p.package_id),
   template_id:packageTemplateId(p.package_id),
   package_type:text(p.package_type),
   price:Number(p.price)||0,
   available_count:Number(p.available_count)||0,
   package_status:text(p.package_status),
   active_override:!['hidden'].includes(text(p.package_status).toLowerCase())
  }));
  const lock=(snapshot.visibility_locks||[]).find(x=>text(x.event_id)===text(e.event_id));
  return {
   ...e,
   event_date:date(e.event_date),
   poster_image_url:text(web.poster_image_url||e.poster_url),
   packages,
   tombstone_locked:!!(lock&&text(lock.lock_state).toUpperCase()==='LOCKED'),
   history_state:lock?text(lock.lock_state).toUpperCase():'',
   history_reason:lock?text(lock.lock_reason):''
  };
 });
}
function matchExisting(candidate={},events=[]){
 const d=date(candidate.event_date);if(!d)return {match:null,ambiguous:false,candidates:[]};
 const sameDate=(events||[]).filter(e=>date(e.event_date)===d);
 const scored=[];
 for(const e of sameDate){
  let score=0;let reason='';
  if(norm(e.event_name)===norm(candidate.title)){score=1;reason='EXACT_NAME_DATE';}
  else if(sameKnownMiss({title:e.event_name,event_date:d},{title:candidate.title,event_date:d})){score=.95;reason='KNOWN_MISS_CANONICAL';}
  else{
   const overlap=Math.max(titleOverlap(candidate.title,e.event_name),titleOverlap(e.event_name,candidate.title));
   if(venueCompatible(candidate.venue,e.venue)&&overlap>=.6){score=.8;reason='DATE_VENUE_TITLE_OVERLAP';}
  }
  if(score)scored.push({event:e,score,reason});
 }
 scored.sort((a,b)=>b.score-a.score);
 if(!scored.length)return {match:null,ambiguous:false,candidates:[]};
 if(scored.length>1&&scored[0].score-scored[1].score<.15)return {match:null,ambiguous:true,candidates:scored.slice(0,3)};
 return {match:scored[0],ambiguous:false,candidates:scored.slice(0,3)};
}
function candidateCanonicalId(candidate={}){
 return text(candidate.existing_event_id||candidate.canonical_event_id||candidate.event_id);
}
function historyByCanonicalId(candidate={},locks=[]){
 const id=candidateCanonicalId(candidate);if(!id)return null;
 return (Array.isArray(locks)?locks:[]).find(l=>text(l.event_id)===id)||null;
}
function historicalConflict(candidate={},locks=[]){
 const d=date(candidate.event_date);if(!d)return null;
 for(const l of Array.isArray(locks)?locks:[]){
  if(date(l.event_date)!==d)continue;
  const exact=norm(l.event_name)===norm(candidate.title);
  const known=sameKnownMiss({title:l.event_name,event_date:d},{title:candidate.title,event_date:d});
  const overlap=Math.max(titleOverlap(candidate.title,l.event_name),titleOverlap(l.event_name,candidate.title));
  if(exact||known||(venueCompatible(candidate.venue,l.venue)&&overlap>=.6))return l;
 }
 return null;
}
function candidatePoster(candidate={}){
 return text(candidate.poster_url||candidate.poster_image_url||candidate.official_poster_url);
}
function suppressedHistoryUpdate(candidate={},history={},events=[]){
 const existing=(events||[]).find(e=>text(e.event_id)===text(history.event_id))||{};
 const changes=[];
 const oldDate=date(existing.event_date||history.event_date),newDate=date(candidate.event_date);
 const oldVenue=text(existing.venue||history.venue),newVenue=text(candidate.venue);
 const oldPoster=text(existing.poster_image_url||existing.poster_url),newPoster=candidatePoster(candidate);
 if(oldDate&&newDate&&oldDate!==newDate)changes.push({field:'event_date',from:oldDate,to:newDate});
 if(oldVenue&&newVenue&&norm(oldVenue)!==norm(newVenue))changes.push({field:'venue',from:oldVenue,to:newVenue});
 if(oldPoster&&newPoster&&oldPoster!==newPoster)changes.push({field:'poster',from:oldPoster,to:newPoster});
 const lifecycle=text(candidate.change_state||candidate.lifecycle_state||candidate.ticket_stage||candidate.event_status).toUpperCase();
 const materialLifecycle=['ADDED_SHOW','POSTPONED','CANCELLED','SOLD_OUT','PARTIAL_SOLD_OUT'].includes(lifecycle)?lifecycle:'';
 return {
  event_id:text(history.event_id),
  history_state:text(history.lock_state).toUpperCase(),
  lock_reason:text(history.lock_reason),
  explicit_reopen_required:history.explicit_reopen_required===true||text(history.explicit_reopen_required).toUpperCase()==='TRUE',
  report_only:true,
  publish_allowed:false,
  material_update:changes.length>0||!!materialLifecycle,
  changes,
  lifecycle_signal:materialLifecycle||null
 };
}
const CAPACITY_HOLD_STATUSES=new Set(['pending','confirmed','prepared','picked_up']);
function phoneInventoryCapacity(snapshot={}){
 const phones=(snapshot.assets||[]).filter(a=>{
  if(text(a.asset_type).toLowerCase()!=='phone')return false;
  return !['retired','broken','lost','maintenance'].includes(text(a.status).toLowerCase());
 });
 return phones.length;
}
function bookingCountByDate(snapshot={}){
 const counts=new Map();
 for(const b of snapshot.bookings||[]){
  const s=text(b.booking_status).toLowerCase();
  if(!CAPACITY_HOLD_STATUSES.has(s))continue;
  const d=date(b.event_date);if(!d)continue;
  counts.set(d,(counts.get(d)||0)+1);
 }
 return counts;
}
function fullBookingDateSet(snapshot={}){
 const capacity=phoneInventoryCapacity(snapshot);
 const full=new Set();
 if(capacity<=0)return full;
 for(const [d,count] of bookingCountByDate(snapshot))if(count>=capacity)full.add(d);
 return full;
}
function activeBookingDateSet(snapshot={}){
 const active=new Set();
 for(const [d,count] of bookingCountByDate(snapshot))if(count>0)active.add(d);
 return active;
}
function reconcileCandidates(candidates=[],snapshot={}){
 const events=snapshotEvents(snapshot);
 const booked=activeBookingDateSet(snapshot);
 const fullBooked=fullBookingDateSet(snapshot);
 const safe=[];const dispositions=[];const suppressed_updates=[];
 for(const raw of Array.isArray(candidates)?candidates:[]){
  const c={...raw,event_date:date(raw.event_date)};
  const canonicalId=candidateCanonicalId(c);
  const directExisting=canonicalId?events.find(e=>text(e.event_id)===canonicalId)||null:null;
  const history=historyByCanonicalId(c,snapshot.visibility_locks||[])||historicalConflict(c,snapshot.visibility_locks||[]);
  if(history&&['LOCKED','SEEN_CORE'].includes(text(history.lock_state).toUpperCase())){
   const report=suppressedHistoryUpdate(c,history,events);
   const disposition={event_key:text(c.event_key),title:text(c.title),event_date:c.event_date,status:'SKIPPED_EVENT_HISTORY',history_event_id:text(history.event_id),history_state:text(history.lock_state),update_report:report};
   dispositions.push(disposition);
   if(report.material_update)suppressed_updates.push({...disposition,report});
   continue;
  }
  const match=directExisting
   ? {match:{event:directExisting,score:1,reason:'CANONICAL_EVENT_ID'},ambiguous:false,candidates:[]}
   : matchExisting(c,events);
  if(match.ambiguous){
   dispositions.push({event_key:text(c.event_key),title:text(c.title),event_date:c.event_date,status:'HOLD_AMBIGUOUS_EXISTING',matches:match.candidates.map(x=>({event_id:text(x.event.event_id),event_name:text(x.event.event_name),score:x.score,reason:x.reason}))});
   continue;
  }
  if(match.match){
   c.existing_event_id=text(match.match.event.event_id);
   const bookedSameEvent=(snapshot.bookings||[]).some(b=>
     CAPACITY_HOLD_STATUSES.has(text(b.booking_status).toLowerCase()) &&
     text(b.event_id)===c.existing_event_id && date(b.event_date)===c.event_date
   );
   if(booked.has(c.event_date)&&!bookedSameEvent){
    dispositions.push({event_key:text(c.event_key),title:text(c.title),event_date:c.event_date,status:'SKIPPED_ACTIVE_BOOKING_DATE',reason:'OWNER_BOOKING_DAY_EXCLUSIVITY_OTHER_EVENT'});
    continue;
   }
   dispositions.push({event_key:text(c.event_key),title:text(c.title),event_date:c.event_date,status:'SAFE_EXISTING',existing_event_id:c.existing_event_id,match_reason:match.match.reason});
   safe.push(c);
   continue;
  }
  if(booked.has(c.event_date)){
   dispositions.push({event_key:text(c.event_key),title:text(c.title),event_date:c.event_date,status:'SKIPPED_ACTIVE_BOOKING_DATE',reason:'OWNER_BOOKING_DAY_EXCLUSIVITY_NEW_EVENT'});
   continue;
  }
  dispositions.push({event_key:text(c.event_key),title:text(c.title),event_date:c.event_date,status:'SAFE_NEW'});
  safe.push(c);
 }
 return {events,safe_candidates:safe,dispositions,suppressed_updates,booked_dates:[...booked],full_booked_dates:[...fullBooked],phone_capacity:phoneInventoryCapacity(snapshot)};
}
function storeBaselines(snapshot={}){
 return (snapshot.packages||[]).filter(p=>p.active===true).map(p=>({
  template_id:text(p.template_id),
  package_type:text(p.package_type),
  price:Number(p.standard_price)||0,
  approved:true,
  active:true,
  override_note:'ACTIVE_STANDARD_PACKAGE_SOT'
 })).filter(x=>x.template_id&&x.price>0);
}
async function postAdmin(payload,{env=process.env,fetchImpl=global.fetch}={}){
 const pin=text(env.KK_ADMIN_PIN);if(!pin){const e=new Error('KK_ADMIN_PIN unavailable');e.code='PROMOTION_ADMIN_CREDENTIAL_MISSING';throw e;}
 const base=text(env.KK_SITE_URL||env.SITE_URL||DEFAULT_SITE).replace(/\/$/,'');
 const r=await fetchImpl(base+'/api/kk-admin-guard',{
  method:'POST',
  headers:{'content-type':'application/json','x-admin-pin':pin,'x-kk-ultra-deep-runtime':VERSION},
  body:JSON.stringify(payload)
 });
 const body=await r.json().catch(()=>null);
 if(!r.ok||!body||body.ok===false){
  const e=new Error(text(body&&body.error)||('ADMIN_HTTP_'+r.status));e.code=text(body&&body.error_code)||('ADMIN_HTTP_'+r.status);e.body=body;throw e;
 }
 return body;
}
async function freshSnapshot(env=process.env,fetchImpl=global.fetch){
 const sheetId=text(env.GOOGLE_SHEET_ID)||DEFAULT_SHEET_ID;
 return AdminSheetFallback.buildSnapshot({sheetId,env,fetchImpl,cache:false});
}
function readbackForEvent(snapshot,eventId,expectedName='',expectedDate=''){
 const id=text(eventId);
 let event=(snapshot.web_ready||[]).find(x=>text(x.event_id)===id);
 if(!event&&expectedName){
  event=(snapshot.web_ready||[]).find(x=>norm(x.event_name)===norm(expectedName)&&date(x.event_date)===date(expectedDate));
 }
 if(!event)return {event:{},packages:[]};
 return {
  event:{
   ...event,
   active_on_web:!['hide','hidden'].includes(text(event.action_for_web).toLowerCase()),
   poster_url:text(event.poster_image_url)
  },
  packages:(snapshot.web_packages||[]).filter(p=>text(p.event_id)===text(event.event_id))
 };
}
async function storefrontReadback({plan,created,env=process.env,fetchImpl=global.fetch}={}){
 const createdId=text(created&&created.result&&created.result.event_id)||text(created&&created.event_id);
 let last={event:{},packages:[]};
 for(let i=0;i<5;i++){
  const snap=await freshSnapshot(env,fetchImpl);
  last=readbackForEvent(snap,createdId,plan&&plan.admin_payload&&plan.admin_payload.event_name,plan&&plan.admin_payload&&plan.admin_payload.event_date);
  if(text(last.event.event_id)&&last.packages.length)return last;
  if(i<4)await new Promise(r=>setTimeout(r,650));
 }
 return last;
}
async function existingEventWriter({existing,plan},{env=process.env,fetchImpl=global.fetch}={}){
 const results=[];
 for(const action of plan.actions||[])results.push(await postAdmin(action,{env,fetchImpl}));
 let snap;let rb={event:{},packages:[]};
 for(let i=0;i<5;i++){
  snap=await freshSnapshot(env,fetchImpl);
  rb=readbackForEvent(snap,existing.event_id,existing.event_name,existing.event_date);
  if(text(rb.event.event_id))break;
  if(i<4)await new Promise(r=>setTimeout(r,650));
 }
 const blockers=[];
 for(const action of plan.actions||[]){
  if(action.action==='upsertEventOverride'){
   const row=rb.packages.find(p=>packageTemplateId(p.package_id)===text(action.template_id));
   if(!row||Number(row.price)!==Number(action.override_price))blockers.push('PRICE_READBACK_MISMATCH:'+text(action.template_id));
  }else if(action.action==='updateEvent'){
   if(text(action.poster_url)&&text(rb.event.poster_image_url||rb.event.poster_url)!==text(action.poster_url))blockers.push('POSTER_READBACK_MISMATCH');
   if(text(action.event_date)&&date(rb.event.event_date)!==date(action.event_date))blockers.push('DATE_READBACK_MISMATCH');
   if(text(action.venue)&&norm(rb.event.venue)!==norm(action.venue))blockers.push('VENUE_READBACK_MISMATCH');
  }
 }
 return {status:blockers.length?'UPDATE_READBACK_FAILED':'UPDATED_VERIFIED',results,readback:rb,blockers,readback_verified:blockers.length===0};
}
async function execute(handoff={},options={}){
 const env=options.env||process.env,fetchImpl=options.fetchImpl||global.fetch;
 let snapshot=options.snapshot||await freshSnapshot(env,fetchImpl);
 const quarantine=options.executeWrites===true
  ? await quarantineMalformedAutoPromotions(snapshot,{env,fetchImpl})
  : {status:'QUARANTINE_DRY_RUN',candidate_count:malformedAutoPromotionRows(snapshot).length,quarantined_verified:0,production_writes:0,results:[],blockers:[]};
 if(quarantine.production_writes>0) snapshot=await freshSnapshot(env,fetchImpl);
 const verified=handoff.verifier&&Array.isArray(handoff.verifier.verified_candidates)?handoff.verifier.verified_candidates:[];
 const reconciled=reconcileCandidates(verified,snapshot);
 const input={
  month:text(handoff.month),
  discovery:{full:true,status:'READY_FOR_VERIFIER',month:text(handoff.month)},
  candidates:reconciled.safe_candidates,
  terminal_dispositions:reconciled.dispositions,
  verified_candidate_count:verified.length,
  existing_events:reconciled.events,
  bookings:snapshot.bookings||[],
  package_templates:snapshot.packages||[],
  store_baseline_prices:storeBaselines(snapshot),
  visibility_locks:snapshot.visibility_locks||[],
  competitor_prices:handoff.competitor_prices||[],
  posters:handoff.posters||[],
  verifier_approved:true,
  correlation_id:text(options.correlation_id||handoff.correlation_id)
 };
 const result=await Orchestrator.run(input,{
  executeWrites:options.executeWrites===true,
  env,fetchImpl,
  storefrontReadbackFn:args=>storefrontReadback({...args,env,fetchImpl}),
  existingEventWriterFn:args=>existingEventWriter(args,{env,fetchImpl})
 });
 const ambiguous=reconciled.dispositions.filter(x=>x.status==='HOLD_AMBIGUOUS_EXISTING');
 const blockers=[...(ambiguous.length?['AMBIGUOUS_EXISTING_EVENT_REVIEW']:[]),...(quarantine.blockers||[])];
 return {
  version:VERSION,
  status:blockers.length?'PARTIAL_SAFE_EXECUTION':result.status,
  production_writes:Number(result.production_writes||0)+Number(quarantine.production_writes||0),
  orchestrator:result,
  quarantine,
  dispositions:reconciled.dispositions,
  suppressed_updates:reconciled.suppressed_updates,
  blockers,
  snapshot_source:text(snapshot.snapshot_source),
  snapshot_generated_at:text(snapshot.generated_at)
 };
}

module.exports={
 VERSION,DEFAULT_SITE,DEFAULT_SHEET_ID,AUTO_PROMOTION_MARKER,text,norm,date,tokens,titleOverlap,venueCompatible,sameKnownMiss,packageTemplateId,
 snapshotEvents,matchExisting,candidateCanonicalId,historyByCanonicalId,historicalConflict,candidatePoster,suppressedHistoryUpdate,phoneInventoryCapacity,bookingCountByDate,fullBookingDateSet,activeBookingDateSet,reconcileCandidates,storeBaselines,readbackForEvent,
 malformedAutoPromotionRows,quarantineMalformedAutoPromotions,
 postAdmin,freshSnapshot,storefrontReadback,existingEventWriter,execute
};
