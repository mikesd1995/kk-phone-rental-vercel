'use strict';

const VERSION='KK_ULTRA_DEEP_PHASE3_CONTROLLER_V1';
const BASE_PHONE=690;
const BASE_BUNDLE=890;
const MAX_ABS_ADJUSTMENT=400;

function text(v){return String(v==null?'':v).trim();}
function money(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null;}
function arr(v){return Array.isArray(v)?v:[];}
function median(values=[]){const a=values.map(Number).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function candidateId(row={}){return text(row.candidate_id||row.event_key||row.id);}
function normalizePackage(v=''){
 const s=text(v).toUpperCase();
 if(['PHONE','PHONE_ONLY','MACHINE'].includes(s))return 'PHONE_ONLY';
 if(['BUNDLE','PHONE_LENS','PHONE_LENS_BUNDLE'].includes(s))return 'PHONE_LENS_BUNDLE';
 if(['LENS','LENS_ONLY'].includes(s))return 'LENS_ONLY';
 return '';
}
function normalizeEvidence(rows=[]){
 return arr(rows).map(r=>({
  competitor_id:text(r.competitor_id||r.account||r.shop).toLowerCase(),
  event_key:text(r.event_key||r.candidate_id),
  package_type:normalizePackage(r.package_type),
  price:money(r.price),
  source_url:text(r.source_url),
  exact_event:r.exact_event===true
 })).filter(r=>r.competitor_id&&r.package_type&&r.price&&/^https:\/\//i.test(r.source_url));
}
function independent(rows=[]){
 const map=new Map();
 for(const r of rows){const k=r.competitor_id+'|'+r.package_type;if(!map.has(k))map.set(k,r);}
 return [...map.values()];
}
function packageMedians(rows=[]){
 const unique=independent(rows);
 const phone=unique.filter(x=>x.package_type==='PHONE_ONLY').map(x=>x.price);
 const bundle=unique.filter(x=>x.package_type==='PHONE_LENS_BUNDLE').map(x=>x.price);
 const lens=unique.filter(x=>x.package_type==='LENS_ONLY').map(x=>x.price);
 return {phone:median(phone),bundle:median(bundle),lens:median(lens),evidence:unique,competitor_count:new Set(unique.map(x=>x.competitor_id)).size};
}
function currentPrices(candidate={}){
 const p=candidate.current_prices||{};
 return {phone:money(p.phone||candidate.current_phone_price),bundle:money(p.bundle||candidate.current_bundle_price),lens:money(p.lens||candidate.current_lens_price)};
}
function bookingLocked(candidate={}){return Number(candidate.booking_count||candidate.date_booking_count||0)>0;}
function isHidden(candidate={}){return candidate.owner_hidden===true||candidate.tombstone===true||text(candidate.visibility_status).toUpperCase()==='OWNER_HIDDEN_TOMBSTONE';}
function demandAdjustment(candidate={}){
 const raw=Number(candidate.demand_seatmap_adjustment||0);
 if(!Number.isFinite(raw))return 0;
 return Math.max(-MAX_ABS_ADJUSTMENT,Math.min(MAX_ABS_ADJUSTMENT,Math.round(raw/10)*10));
}
function referenceMedian(rows=[]){return median(arr(rows).map(r=>money(r.price)).filter(Boolean));}
function resolveCandidate(candidate={},input={}){
 const id=candidateId(candidate);
 const base={candidate_id:id,title:text(candidate.title),event_date:text(candidate.event_date),production_writes:0};
 if(!id)return {...base,status:'HOLD',reason:'CANDIDATE_ID_REQUIRED'};
 if(isHidden(candidate))return {...base,status:'SKIP_OWNER_HIDDEN',reason:'OWNER_HIDDEN_TOMBSTONE_DO_NOT_READD'};
 const phase2Disposition=text(candidate.phase2_disposition||candidate.disposition).toUpperCase();
 if(phase2Disposition&&phase2Disposition!=='VERIFIED')return {...base,status:'SKIP_NOT_VERIFIED',reason:phase2Disposition||'NOT_VERIFIED'};
 if(bookingLocked(candidate)){
  const cur=currentPrices(candidate);
  if(!cur.phone&&!cur.bundle)return {...base,status:'HOLD',reason:'BOOKED_PRICE_SOT_REQUIRED'};
  return {...base,status:'PRICE_LOCKED_BOOKING',reason:'BOOKING_PRICE_LOCK',target_prices:cur,price_source:'CURRENT_BOOKED_PRICE',adjustment:0};
 }
 const exactAll=normalizeEvidence(input.competitor_prices).filter(r=>r.exact_event);
 const byEvent=exactAll.filter(r=>!r.event_key||r.event_key===id);
 const exact=packageMedians(byEvent);
 const lens=exact.lens||money(input.lens_baseline)||200;
 if(exact.phone||exact.bundle){
  const phone=exact.phone||(exact.bundle?Math.max(1,exact.bundle-lens):null);
  const bundle=exact.bundle||(phone?phone+lens:null);
  return {...base,status:'PRICE_READY',reason:'EXACT_EVENT_COMPETITOR_MEDIAN',price_source:'EXACT_EVENT_COMPETITOR_MEDIAN',target_prices:{phone,bundle,lens},competitor_count:exact.competitor_count,evidence:exact.evidence,adjustment:0};
 }
 const comparable=referenceMedian(candidate.comparable_prices||input.comparable_prices_by_candidate&&input.comparable_prices_by_candidate[id]);
 if(comparable){
  return {...base,status:'PRICE_READY',reason:'COMPARABLE_EVENT_MEDIAN',price_source:'COMPARABLE_EVENT_MEDIAN',target_prices:{phone:comparable,bundle:comparable+lens,lens},competitor_count:0,adjustment:0};
 }
 const prior=referenceMedian(candidate.prior_month_comparable_prices||input.prior_month_comparable_prices_by_candidate&&input.prior_month_comparable_prices_by_candidate[id]);
 if(prior){
  return {...base,status:'PRICE_READY',reason:'PRIOR_MONTH_COMPARABLE_MEDIAN',price_source:'PRIOR_MONTH_COMPARABLE_MEDIAN',target_prices:{phone:prior,bundle:prior+lens,lens},competitor_count:0,adjustment:0};
 }
 const adj=demandAdjustment(candidate);
 const phone=BASE_PHONE+adj;
 const bundle=BASE_BUNDLE+adj;
 return {...base,status:'PRICE_READY',reason:adj?'BASE_690_890_PLUS_DEMAND_SEATMAP':'BASE_690_890',price_source:adj?'BASE_690_890_PLUS_DEMAND_SEATMAP':'BASE_690_890',target_prices:{phone,bundle,lens},competitor_count:0,adjustment:adj};
}
function phase2Gate(input={}){
 const p=input.phase2||{};const blockers=[];
 if(p.status!=='PHASE2_ACCEPTED')blockers.push('PHASE2_ACCEPTED_REQUIRED');
 if(p.ready_for_phase3!==true)blockers.push('PHASE2_READY_FOR_PHASE3_REQUIRED');
 if(Number(p.production_writes||0)!==0)blockers.push('PHASE2_PRODUCTION_WRITES_MUST_BE_ZERO');
 if(p.phase3_started!==false)blockers.push('PHASE2_PHASE3_STARTED_MUST_BE_FALSE');
 return {pass:blockers.length===0,blockers};
}
function evaluate(input={},options={}){
 const diagnostic=options.diagnostic_only===true;
 const gate=phase2Gate(input);
 if(!diagnostic&&!gate.pass)return {version:VERSION,status:'PHASE3_BLOCKED',blockers:gate.blockers,results:[],ready_for_phase4:false,production_writes:0,phase4_started:false};
 const candidates=arr(input.candidates);
 const results=candidates.map(c=>resolveCandidate(c,input));
 const holds=results.filter(x=>x.status==='HOLD');
 const blockers=[...(!candidates.length?['PHASE3_CANDIDATE_SET_EMPTY']:[]),...holds.map(x=>'PRICE_HOLD:'+x.candidate_id+':'+x.reason)];
 return {version:VERSION,status:blockers.length?'PHASE3_HOLD':'PHASE3_ACCEPTED',diagnostic_only:diagnostic,phase2_gate:gate,candidate_count:candidates.length,results,blockers,ready_for_phase4:!diagnostic&&blockers.length===0,production_writes:0,phase4_started:false};
}
module.exports={VERSION,BASE_PHONE,BASE_BUNDLE,MAX_ABS_ADJUSTMENT,text,money,arr,median,candidateId,normalizePackage,normalizeEvidence,independent,packageMedians,currentPrices,bookingLocked,isHidden,demandAdjustment,referenceMedian,resolveCandidate,phase2Gate,evaluate};
