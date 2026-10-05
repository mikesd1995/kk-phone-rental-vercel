'use strict';

const Phase2Artifact=require('./kk-ultra-deep-phase2-artifact.js');

const VERSION='KK_ULTRA_DEEP_PHASE3_CONTROLLER_V2';
const BASE_PHONE=690;
const BASE_BUNDLE=890;
const DEFAULT_LENS=200;
const DEFAULT_MAX_PRICE_AGE_DAYS=30;
const MAX_ABS_ADJUSTMENT=400;
const MIN_COMPARABLE_SCORE=0.45;
const MIN_PRIOR_SCORE=0.35;

function text(v){return String(v==null?'':v).trim();}
function money(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null;}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
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
function priceAgeDays(row={},now=Date.now()){
 if(Number.isFinite(Number(row.source_age_days)))return Math.max(0,Number(row.source_age_days));
 const raw=text(row.source_published_at||row.published_at);
 if(!raw)return null;
 const t=new Date(raw).getTime();if(!Number.isFinite(t))return null;
 return Math.max(0,(Number(now)-t)/86400000);
}
function freshness(row={},options={}){
 const max=Math.max(1,Number(options.max_price_age_days||DEFAULT_MAX_PRICE_AGE_DAYS));
 const age=priceAgeDays(row,options.now||Date.now());
 if(age===null)return {status:'UNKNOWN',age_days:null,max_age_days:max};
 return {status:age<=max?'FRESH':'STALE',age_days:Number(age.toFixed(2)),max_age_days:max};
}
function normalizeEvidence(rows=[],options={}){
 return arr(rows).map(r=>{
  const fresh=freshness(r,options);
  return {
   competitor_id:text(r.competitor_id||r.account||r.shop).toLowerCase(),
   event_key:text(r.event_key||r.candidate_id),
   package_type:normalizePackage(r.package_type),
   price:money(r.price),
   source_url:text(r.source_url),
   source_published_at:text(r.source_published_at||r.published_at),
   source_age_days:fresh.age_days,
   freshness:fresh.status,
   semantic_confidence:text(r.semantic_confidence).toUpperCase()||'UNKNOWN',
   device_compatible:r.device_compatible===false?false:true,
   exact_event:r.exact_event===true
  };
 }).filter(r=>r.competitor_id&&r.package_type&&r.price&&/^https:\/\//i.test(r.source_url)&&r.device_compatible!==false);
}
function independent(rows=[]){
 const map=new Map();
 for(const r of rows){
  const k=r.competitor_id+'|'+r.package_type;
  const prior=map.get(k);
  if(!prior||num(r.source_age_days)<num(prior.source_age_days))map.set(k,r);
 }
 return [...map.values()];
}
function filterOutliers(rows=[]){
 const unique=independent(rows);
 const kept=[];const outliers=[];
 for(const type of ['PHONE_ONLY','PHONE_LENS_BUNDLE','LENS_ONLY']){
  const group=unique.filter(x=>x.package_type===type);
  if(group.length<5){kept.push(...group);continue;}
  const mid=median(group.map(x=>x.price));
  const deviations=group.map(x=>Math.abs(x.price-mid));
  const mad=median(deviations)||0;
  const threshold=Math.max(250,3*mad);
  for(const row of group)(Math.abs(row.price-mid)>threshold?outliers:kept).push(row);
 }
 return {kept,outliers};
}
function packageMedians(rows=[]){
 const filtered=filterOutliers(rows);
 const unique=filtered.kept;
 const phone=unique.filter(x=>x.package_type==='PHONE_ONLY').map(x=>x.price);
 const bundle=unique.filter(x=>x.package_type==='PHONE_LENS_BUNDLE').map(x=>x.price);
 const lens=unique.filter(x=>x.package_type==='LENS_ONLY').map(x=>x.price);
 return {
  phone:median(phone),bundle:median(bundle),lens:median(lens),
  evidence:unique,outliers:filtered.outliers,
  competitor_count:new Set(unique.map(x=>x.competitor_id)).size
 };
}
function currentPrices(candidate={}){
 const p=candidate.current_prices||{};
 return {phone:money(p.phone||candidate.current_phone_price),bundle:money(p.bundle||candidate.current_bundle_price),lens:money(p.lens||candidate.current_lens_price)};
}
function bookingCount(candidate={}){
 return Math.max(0,num(candidate.booking_count),num(candidate.date_booking_count));
}
function bookingLocked(candidate={}){return bookingCount(candidate)>0;}
function isHidden(candidate={}){return candidate.owner_hidden===true||candidate.tombstone===true||text(candidate.visibility_status).toUpperCase()==='OWNER_HIDDEN_TOMBSTONE';}
function demandAdjustment(candidate={}){
 const verified=candidate.demand_signal_verified===true||candidate.seatmap_signal_verified===true;
 if(!verified)return 0;
 const raw=Number(candidate.demand_seatmap_adjustment||0);
 if(!Number.isFinite(raw))return 0;
 return Math.max(-MAX_ABS_ADJUSTMENT,Math.min(MAX_ABS_ADJUSTMENT,Math.round(raw/10)*10));
}
function normList(v){
 const values=Array.isArray(v)?v:[v];
 return [...new Set(values.map(x=>text(x).toLowerCase()).filter(Boolean))];
}
function overlap(a=[],b=[]){
 const x=new Set(normList(a)),y=new Set(normList(b));if(!x.size||!y.size)return false;
 for(const v of x)if(y.has(v))return true;return false;
}
function comparableScore(candidate={},reference={}){
 let score=0;const reasons=[];
 if(overlap(candidate.artist||candidate.artists,reference.artist||reference.artists)){score+=0.30;reasons.push('ARTIST');}
 if(overlap(candidate.fandom,reference.fandom)){score+=0.20;reasons.push('FANDOM');}
 if(text(candidate.event_type)&&text(candidate.event_type).toLowerCase()===text(reference.event_type).toLowerCase()){score+=0.20;reasons.push('EVENT_TYPE');}
 const a=num(candidate.venue_capacity),b=num(reference.venue_capacity);
 if(a>0&&b>0){
  const delta=Math.abs(a-b)/Math.max(a,b);
  if(delta<=0.20){score+=0.15;reasons.push('VENUE_CAPACITY_STRONG');}
  else if(delta<=0.40){score+=0.08;reasons.push('VENUE_CAPACITY_WEAK');}
 }else if(text(candidate.venue)&&text(candidate.venue).toLowerCase()===text(reference.venue).toLowerCase()){
  score+=0.10;reasons.push('SAME_VENUE');
 }
 if(text(candidate.seat_map_class)&&text(candidate.seat_map_class).toLowerCase()===text(reference.seat_map_class).toLowerCase()){score+=0.15;reasons.push('SEAT_MAP');}
 return {score:Number(score.toFixed(2)),reasons};
}
function qualifiedReferenceMedian(candidate={},rows=[],minimum=MIN_COMPARABLE_SCORE){
 const qualified=[];
 for(const row of arr(rows)){
  const price=money(row.price);const url=text(row.source_url);
  if(!price||!/^https:\/\//i.test(url))continue;
  const match=comparableScore(candidate,row);
  if(match.score<minimum)continue;
  qualified.push({...row,price,match_score:match.score,match_reasons:match.reasons});
 }
 return {median:median(qualified.map(x=>x.price)),qualified};
}
function phase2Gate(input={}){
 const p=input.phase2&&typeof input.phase2==='object'?input.phase2:null;const blockers=[];
 const artifact=input.phase2_artifact;
 if(!artifact)blockers.push('PHASE2_ARTIFACT_REQUIRED');
 else{
  const checked=Phase2Artifact.validateForPhase3(artifact);
  for(const b of checked.blockers)blockers.push('PHASE2_ARTIFACT:'+b);
 }
 if(p){
  if(p.status!=='PHASE2_ACCEPTED')blockers.push('PHASE2_ACCEPTED_REQUIRED');
  if(p.ready_for_phase3!==true)blockers.push('PHASE2_READY_FOR_PHASE3_REQUIRED');
  if(Number(p.production_writes||0)!==0)blockers.push('PHASE2_PRODUCTION_WRITES_MUST_BE_ZERO');
  if(p.phase3_started!==false)blockers.push('PHASE2_PHASE3_STARTED_MUST_BE_FALSE');
 }
 return {pass:blockers.length===0,blockers};
}
function candidateSetGate(input={}){
 const artifact=input.phase2_artifact;
 if(!artifact)return {pass:false,blockers:['PHASE2_ARTIFACT_REQUIRED'],expected:[],actual:[]};
 const checked=Phase2Artifact.validateForPhase3(artifact);
 if(!checked.pass)return {pass:false,blockers:checked.blockers.map(x=>'PHASE2_ARTIFACT:'+x),expected:checked.pricing_candidate_ids||[],actual:[]};
 const expected=[...checked.pricing_candidate_ids].sort();
 const actual=arr(input.candidates).map(candidateId).filter(Boolean).sort();
 const blockers=[];
 if(actual.length!==arr(input.candidates).length)blockers.push('PHASE3_CANDIDATE_ID_REQUIRED');
 if(new Set(actual).size!==actual.length)blockers.push('PHASE3_DUPLICATE_CANDIDATE_ID');
 if(expected.length!==actual.length||expected.some((id,i)=>id!==actual[i]))blockers.push('PHASE2_PHASE3_CANDIDATE_SET_MISMATCH');
 return {pass:blockers.length===0,blockers,expected,actual,fingerprint:checked.fingerprint};
}
function rawEvidenceForCandidate(input={},id=''){
 return arr(input.competitor_prices).filter(r=>text(r.event_key||r.candidate_id)===id);
}
function learningMisses(candidate={},input={},analysis={}){
 const id=candidateId(candidate);const raw=rawEvidenceForCandidate(input,id);const misses=[];
 const stale=raw.filter(r=>freshness(r,input).status==='STALE');
 const unknown=raw.filter(r=>freshness(r,input).status==='UNKNOWN');
 const missingIdentity=arr(input.competitor_prices).filter(r=>!text(r.event_key||r.candidate_id)&&r.exact_event===true);
 const ambiguous=raw.filter(r=>!normalizePackage(r.package_type)||['LOW','UNKNOWN'].includes(text(r.semantic_confidence).toUpperCase()));
 if(stale.length)misses.push({candidate_id:id,miss_class:'STALE_PRICE_GAP',count:stale.length});
 if(unknown.length)misses.push({candidate_id:id,miss_class:'PRICE_FRESHNESS_UNKNOWN',count:unknown.length});
 if(missingIdentity.length)misses.push({candidate_id:id,miss_class:'COMPETITOR_IDENTITY_GAP',count:missingIdentity.length});
 if(ambiguous.length)misses.push({candidate_id:id,miss_class:'PACKAGE_AMBIGUITY',count:ambiguous.length});
 if(analysis.outliers&&analysis.outliers.length)misses.push({candidate_id:id,miss_class:'OUTLIER_PRICE_GAP',count:analysis.outliers.length});
 if(!analysis.hasFreshExact)misses.push({candidate_id:id,miss_class:'NO_EXACT_PRICE_GAP'});
 if(!analysis.hasFreshExact&&!analysis.comparableQualified&&!analysis.priorQualified)misses.push({candidate_id:id,miss_class:'COMPARABLE_GAP'});
 return misses;
}
function resolveCandidate(candidate={},input={}){
 const id=candidateId(candidate);
 const base={candidate_id:id,title:text(candidate.title),event_date:text(candidate.event_date),production_writes:0};
 if(!id)return {...base,status:'HOLD',reason:'CANDIDATE_ID_REQUIRED',learning_misses:[]};
 if(isHidden(candidate))return {...base,status:'SKIP_OWNER_HIDDEN',reason:'OWNER_HIDDEN_TOMBSTONE_DO_NOT_READD',learning_misses:[]};
 const phase2Disposition=text(candidate.phase2_disposition||candidate.disposition||'VERIFIED').toUpperCase();
 if(phase2Disposition!=='VERIFIED')return {...base,status:'SKIP_NOT_VERIFIED',reason:phase2Disposition||'NOT_VERIFIED',learning_misses:[]};
 if(bookingLocked(candidate)){
  const cur=currentPrices(candidate);
  if(!cur.phone&&!cur.bundle)return {...base,status:'HOLD',reason:'BOOKED_PRICE_SOT_REQUIRED',booking_count:bookingCount(candidate),learning_misses:[]};
  return {...base,status:'PRICE_LOCKED_BOOKING',reason:'BOOKING_PRICE_LOCK',booking_count:bookingCount(candidate),target_prices:cur,price_source:'CURRENT_BOOKED_PRICE',price_confidence:'LOCKED',adjustment:0,learning_misses:[]};
 }
 const normalized=normalizeEvidence(input.competitor_prices,input).filter(r=>r.exact_event&&r.event_key===id);
 const fresh=normalized.filter(r=>r.freshness==='FRESH');
 const exact=packageMedians(fresh);
 const lens=exact.lens||money(input.lens_baseline)||DEFAULT_LENS;
 const comparable=qualifiedReferenceMedian(candidate,candidate.comparable_prices||(input.comparable_prices_by_candidate&&input.comparable_prices_by_candidate[id])||[],MIN_COMPARABLE_SCORE);
 const prior=qualifiedReferenceMedian(candidate,candidate.prior_month_comparable_prices||(input.prior_month_comparable_prices_by_candidate&&input.prior_month_comparable_prices_by_candidate[id])||[],MIN_PRIOR_SCORE);
 const analysis={
  hasFreshExact:Boolean(exact.phone||exact.bundle),
  outliers:exact.outliers,
  comparableQualified:comparable.qualified.length,
  priorQualified:prior.qualified.length
 };
 const misses=learningMisses(candidate,input,analysis);
 if(exact.phone||exact.bundle){
  let phone=exact.phone||(exact.bundle?Math.max(1,exact.bundle-lens):null);
  let bundle=exact.bundle||(phone?phone+lens:null);
  let packageParity='OK';
  if(phone&&bundle){
   const delta=bundle-phone;
   if(delta<100||delta>500){bundle=phone+lens;packageParity='RECONSTRUCTED_FROM_PHONE_PLUS_LENS';}
  }
  const confidence=exact.competitor_count>=5?'HIGH':(exact.competitor_count>=3?'MEDIUM_HIGH':'MEDIUM');
  return {...base,status:'PRICE_READY',reason:'EXACT_EVENT_COMPETITOR_MEDIAN',price_source:'EXACT_EVENT_COMPETITOR_MEDIAN',price_confidence:confidence,target_prices:{phone,bundle,lens},competitor_count:exact.competitor_count,evidence:exact.evidence,outliers:exact.outliers,package_parity:packageParity,adjustment:0,learning_misses:misses};
 }
 if(comparable.median){
  return {...base,status:'PRICE_READY',reason:'COMPARABLE_EVENT_MEDIAN',price_source:'COMPARABLE_EVENT_MEDIAN',price_confidence:'MEDIUM_LOW',target_prices:{phone:comparable.median,bundle:comparable.median+lens,lens},comparable_evidence:comparable.qualified,competitor_count:0,adjustment:0,learning_misses:misses};
 }
 if(prior.median){
  return {...base,status:'PRICE_READY',reason:'PRIOR_MONTH_COMPARABLE_MEDIAN',price_source:'PRIOR_MONTH_COMPARABLE_MEDIAN',price_confidence:'LOW_MEDIUM',target_prices:{phone:prior.median,bundle:prior.median+lens,lens},prior_evidence:prior.qualified,competitor_count:0,adjustment:0,learning_misses:misses};
 }
 const adj=demandAdjustment(candidate);
 const phone=BASE_PHONE+adj;
 const bundle=BASE_BUNDLE+adj;
 return {...base,status:'PRICE_READY',reason:adj?'BASE_690_890_PLUS_VERIFIED_DEMAND_SEATMAP':'BASE_690_890',price_source:adj?'BASE_690_890_PLUS_VERIFIED_DEMAND_SEATMAP':'BASE_690_890',price_confidence:adj?'LOW_WITH_VERIFIED_ADJUSTMENT':'LOW_BASE',target_prices:{phone,bundle,lens},competitor_count:0,adjustment:adj,learning_misses:misses};
}
function evaluate(input={},options={}){
 const diagnostic=options.diagnostic_only===true;
 const phase2_gate=phase2Gate(input);
 const candidate_set=diagnostic?{pass:true,blockers:[],expected:[],actual:arr(input.candidates).map(candidateId)}:candidateSetGate(input);
 const gateBlockers=[...phase2_gate.blockers,...candidate_set.blockers];
 if(!diagnostic&&gateBlockers.length)return {version:VERSION,status:'PHASE3_BLOCKED',blockers:[...new Set(gateBlockers)],results:[],ready_for_phase4:false,production_writes:0,phase4_started:false};
 const candidates=arr(input.candidates);
 const results=candidates.map(c=>resolveCandidate(c,input));
 const holds=results.filter(x=>x.status==='HOLD');
 const blockers=[...(!candidates.length?['PHASE3_CANDIDATE_SET_EMPTY']:[]),...holds.map(x=>'PRICE_HOLD:'+x.candidate_id+':'+x.reason)];
 const learning_misses=results.flatMap(x=>arr(x.learning_misses));
 return {
  version:VERSION,status:blockers.length?'PHASE3_HOLD':'PHASE3_ACCEPTED',diagnostic_only:diagnostic,
  phase2_gate,candidate_set,candidate_count:candidates.length,results,learning_misses,
  blockers,ready_for_phase4:!diagnostic&&blockers.length===0,production_writes:0,phase4_started:false
 };
}
module.exports={
 VERSION,BASE_PHONE,BASE_BUNDLE,DEFAULT_LENS,DEFAULT_MAX_PRICE_AGE_DAYS,MAX_ABS_ADJUSTMENT,MIN_COMPARABLE_SCORE,MIN_PRIOR_SCORE,
 text,money,num,arr,median,candidateId,normalizePackage,priceAgeDays,freshness,normalizeEvidence,independent,filterOutliers,packageMedians,
 currentPrices,bookingCount,bookingLocked,isHidden,demandAdjustment,normList,overlap,comparableScore,qualifiedReferenceMedian,
 phase2Gate,candidateSetGate,rawEvidenceForCandidate,learningMisses,resolveCandidate,evaluate
};
