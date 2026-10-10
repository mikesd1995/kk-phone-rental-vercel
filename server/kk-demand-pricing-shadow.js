'use strict';

// This is a ZERO-COST EVIDENCE-BASED agent policy, not a fitted ML model.
// Advisory shadow only; never submit a business write from this module.
const VERSION='KK_DEMAND_PRICING_SHADOW_V2_VALIDATED_QUOTE_SAFETY';
const PRICE_BANDS=Object.freeze([490,590,690,790,890,990,1090,1290]);
const SIGNAL_WEIGHTS=Object.freeze({
 fandom_photo_intent:0.38,
 public_engagement:0.21,
 ticket_demand:0.18,
 qualified_inquiry_intent:0.23
});
const COMPLETED=new Set(['completed']);
function text(v){return String(v===null||v===undefined?'':v).trim();}
// Sheets readback can use TRUE/FALSE or 0/1 strings; never interpret a
// nonempty string such as "FALSE" as an affirmative owner/booking lock.
function enabled(v){return v===true||v===1||['true','1','yes','on'].includes(text(v).toLowerCase());}
function number(v){if(v===null||v===undefined||text(v)==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function price(v){
 // Read-only Google Sheets returns display-formatted THB such as "1,090".
 // Accept strictly grouped thousands, but never coerce malformed grouping.
 const raw=typeof v==='string'?v.trim():'';
 const normalized=/^\d{1,3}(,\d{3})+(?:\.\d+)?$/.test(raw)?raw.replace(/,/g,''):v;
 const n=number(normalized);
 return n!==null&&n>0&&n<=10000?n:null;
}
function score(v){const n=number(v);return n!==null&&n>=0&&n<=100?n:null;}
function median(xs){const a=xs.filter(Number.isFinite).sort((a,b)=>a-b);if(!a.length)return null;const mid=a.length>>1;return a.length%2?a[mid]:(a[mid-1]+a[mid])/2;}
function nearestBand(v){return PRICE_BANDS.reduce((a,b)=>Math.abs(b-v)<Math.abs(a-v)?b:a);}
function uniqueQuotes(rows){
 const result=[],map=new Map();
 for(const [index,item] of (Array.isArray(rows)?rows:[]).entries()){
  const r=item||{},shop=text(r.shop||r.shop_id||r.competitor_account||r.account);
  // Unknown source rows must NOT count as N independent rental shops.
  const key=shop?shop.toLowerCase():'UNKNOWN_SOURCE_ROW_'+index;
  if(!map.has(key)){
   const v={shop:shop||'UNIDENTIFIED',phone_price:null,bundle_price:null,
    source_url:text(r.source_url||r.post_url),observed_at:text(r.observed_at||r.checked_at)};
   map.set(key,v);result.push(v);
  }
  const v=map.get(key),kind=text(r.package_type).toUpperCase();
  if(['PHONE','PHONE_ONLY'].includes(kind)&&v.phone_price===null)v.phone_price=price(r.price);
  if(['PHONE_LENS','PHONE_LENS_BUNDLE','BUNDLE'].includes(kind)&&v.bundle_price===null)v.bundle_price=price(r.price);
 }
 return result;
}
function verifiedIndependentShopCount(rows=[],asOfDate=''){
 // Median/reference claims from 3+ peers require individual receipts,
 // verified comparability, identity, and recent timestamps; no raw count trust.
 const observed=new Set();
 const anchor=/^\d{4}-\d{2}-\d{2}$/.test(text(asOfDate))?Date.parse(asOfDate+'T00:00:00Z'):null;
 if(anchor===null||!Number.isFinite(anchor))return 0;
 for(const r of Array.isArray(rows)?rows:[]){
  if(!r||r.verified!==true||r.comparable_verified!==true)continue;
  const shop=text(r.shop||r.shop_id||r.competitor_account||r.account).toLowerCase();
  const url=text(r.source_url||r.post_url),checked=text(r.observed_at||r.checked_at).slice(0,10);
  if(!shop||!/^https:\/\//i.test(url)||!/^\d{4}-\d{2}-\d{2}$/.test(checked))continue;
  const ts=Date.parse(checked+'T00:00:00Z');
  if(!Number.isFinite(ts))continue;
  // 14-day freshness window applies only to verifying *current* shop
  // price evidence; do not silently label older historical posts current.
  if(anchor!==null&&(ts>anchor||anchor-ts>14*86400000))continue;
  if(!['PHONE','PHONE_ONLY','PHONE_LENS','PHONE_LENS_BUNDLE','BUNDLE']
   .includes(text(r.package_type).toUpperCase())||price(r.price)===null)continue;
  observed.add(shop);
 }
 return observed.size;
}
function verifiedSignals(input={}){
 const available=[];
 for(const [key,weight] of Object.entries(SIGNAL_WEIGHTS)){
  const row=(input.signals||{})[key]||{};
  const val=score(row.score);
  // Numeric "engagement" alone is NOT evidence; require source and date.
  const ref=text(row.source_url||row.source_ref);
  const at=text(row.observed_at);
  if(row.verified===true&&val!==null&&ref&&at){
   available.push({signal:key,score:val,weight,source_ref:ref,observed_at:at});
  }
 }
 const total=available.reduce((v,s)=>v+s.weight,0);
 const weighted=total?Math.round(available.reduce((v,s)=>v+s.score*s.weight,0)/total):null;
 return {signals:available,score:weighted,missing:Object.keys(SIGNAL_WEIGHTS).filter(k=>!available.some(s=>s.signal===k))};
}
function verifiedPaidHistory(rows=[],eventId=''){
 // Real completed Google Booking bundle receipts are NOT phone-only prices.
 const out=[],seen=new Set();
 for(const row of Array.isArray(rows)?rows:[]){
  const r=row||{},id=text(r.event_id),type=text(r.package_type).toLowerCase();
  if(r.comparable_verified!==true||r.verified!==true||
   !COMPLETED.has(text(r.booking_status).toLowerCase())||!id||id===eventId||
   !text(r.event_date)||!text(r.source_ref))continue;
  // Never let a typed BUNDLE receipt poison phone-only observations even
  // if an imported record incorrectly has both paid_phone_price fields.
  const phone=type==='phone_lens_bundle'||type==='bundle'?null:
   price(r.paid_phone_price)||(['phone_only','phone'].includes(type)?price(r.paid_price):null);
  const bundle=['phone_only','phone'].includes(type)?null:
   price(r.paid_bundle_price)||(['phone_lens_bundle','bundle'].includes(type)?price(r.paid_price):null);
  if(phone===null&&bundle===null)continue;
  const key=id+'|'+text(r.booking_id||r.observation_id||r.source_ref);
  if(seen.has(key))continue;
  seen.add(key);
  out.push({event_id:id,event_date:text(r.event_date),
    package_type:bundle!==null?'phone_lens_bundle':'phone_only',
    paid_phone_price:phone,paid_bundle_price:bundle,source_ref:text(r.source_ref)});
 }
 return out;
}
function guard(input={}){
 if(enabled(input.event_source_conflict)||enabled(input.event_date_conflict)||
  (text(input.official_event_date)&&text(input.official_event_date)!==text(input.event_date)))
  return 'HOLD_CONFLICTING_EVENT_DATE_OR_SOURCE';
 if(enabled(input.tombstone_locked)||enabled(input.owner_hidden))return 'HOLD_OWNER_HIDDEN_TOMBSTONE';
 if(enabled(input.has_active_booking_on_date)||enabled(input.booking_day_locked))return 'HOLD_BOOKING_DATE_PRICE_LOCK';
 if(enabled(input.owner_price_locked)||enabled(input.owner_final_price))return 'HOLD_OWNER_FINAL_PRICE_LOCK';
 // Numeric zero, string "0", negative or uncertain inventory must never
 // lead to a positive phone-price proposal. Zero-price Lens offers are separate.
 const available=number(input.available_inventory);
 if(enabled(input.inventory_conflict)||(available!==null&&available<=0))return 'HOLD_NO_INVENTORY_OR_COLLISION';
 if(!Number.isSafeInteger(available)||available<1)return 'HOLD_INVENTORY_NOT_VERIFIED';
 if(input.event_verified!==true)return 'HOLD_EVENT_NOT_VERIFIED';
 if(!text(input.event_id)||!/^\d{4}-\d{2}-\d{2}$/.test(text(input.event_date)))return 'HOLD_EVENT_IDENTITY_DATE_REQUIRED';
 const d=new Date(text(input.event_date)+'T00:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==text(input.event_date))return 'HOLD_EVENT_IDENTITY_DATE_REQUIRED';
 return '';
}
function base(input,status,extras={}){
 return Object.assign({
  schema_version:VERSION,status,mode:'SHADOW_ONLY',
  event_id:text(input.event_id),event_date:text(input.event_date),
  current_prices:{phone:price(input.current_phone_price),bundle:price(input.current_bundle_price)},
  suggested_prices:null,production_writes:0,publishes:0,auto_reprice:false,
  owner_approval_required:true,existing_prices_preserved:true,
  cost_spend_allowed:false,learning_writes:0,verifier_required:true
 },extras);
}
function propose(input={}){
 const blocked=guard(input);
 if(blocked)return base(input,blocked,{blockers:[blocked]});
 const quotes=uniqueQuotes(input.competitor_evidence);
 const count=number(input.independent_competitors);
 const identified=quotes.filter(q=>q.shop!=='UNIDENTIFIED').length;
 const known=Math.max(identified,count===null?0:count);
 const anonymousRows=quotes.some(q=>q.shop==='UNIDENTIFIED');
 // Do NOT conflate unscanned with searched-zero.
 const marketStatus=text(input.competitor_market_status).toUpperCase();
 if((known>0&&known<3)||(marketStatus.startsWith('COMPETITOR_FOUND')&&known===0)){
  return base(input,'HOLD_COMPETITOR_QUOTES_OWNER_DECISION',{
   competitor_quotes:quotes,competitor_shops_found:known,
   review_note:'รายงานราคาคู่แข่งแต่ละร้าน ให้เจ้าของร้านตัดสินใจเอง ห้ามปรับราคาอัตโนมัติ'
  });
 }
 const trusted=verifiedIndependentShopCount(input.competitor_evidence,input.scan_date||input.as_of_date||'');
 if(anonymousRows||known>0&&trusted<3){
  return base(input,'HOLD_COMPETITOR_EVIDENCE_INCOMPLETE',{
   competitor_quotes:quotes,competitor_shops_found:known,competitor_shops_verified_fresh:trusted,
   blockers:[anonymousRows?'UNIDENTIFIED_COMPETITOR_SHOP':'COMPETITOR_VERIFIED_FRESH_SHOPS_LT_3']
  });
 }
 const signals=verifiedSignals(input);
 const history=verifiedPaidHistory(input.completed_history,text(input.event_id));
 const knownSampleCount=history.length;
 const phoneHistory=history.filter(x=>x.paid_phone_price!==null);
 const bundleHistory=history.filter(x=>x.paid_bundle_price!==null);
 const observedBundleMedian=median(bundleHistory.map(x=>x.paid_bundle_price));
 if(signals.signals.length<2||signals.score===null||!signals.signals.some(s=>s.signal==='fandom_photo_intent'||s.signal==='qualified_inquiry_intent')){
  return base(input,'HOLD_INSUFFICIENT_DEMAND_EVIDENCE',{
   demand_score:signals.score,verified_signals:signals.signals,missing_signals:signals.missing,
   historical_completed_comparables:knownSampleCount,
   historical_phone_comparables:phoneHistory.length,historical_bundle_comparables:bundleHistory.length,
   historical_paid_bundle_median:observedBundleMedian,
   blockers:['MIN_TWO_VERIFIED_SIGNALS_ONE_PHOTO_OR_INQUIRY']
  });
 }
 // No weekday/weekend hardcoded rate. These bands are testable hypotheses,
 // NOT machine-learned demand elasticities or proven optimal revenue.
 const demand=signals.score;
 const band=demand>=92?990:demand>=82?890:demand>=68?790:demand>=52?690:demand>=35?590:490;
 const observed=median(phoneHistory.map(x=>x.paid_phone_price));
 // Avoid sudden downpricing an observed, verified comparable willingness to pay.
 const anchor=observed===null?null:nearestBand(observed);
 const hypothesis=anchor===null?band:Math.max(anchor,Math.min(band,anchor+100));
 const floor=price(input.minimum_viable_phone_price);
 const currentPhone=price(input.current_phone_price),currentBundle=price(input.current_bundle_price);
 if(floor!==null&&hypothesis<floor)return base(input,'HOLD_BELOW_VERIFIED_PRICE_FLOOR',{
   demand_score:demand,blockers:['PROPOSED_BELOW_OWNER_COST_FLOOR'],minimum_viable_phone_price:floor});
 // Keep the store's existing bundle premium; cannot invent lens cost.
 const premium=currentPhone!==null&&currentBundle!==null&&currentBundle>=currentPhone?currentBundle-currentPhone:null;
 const confidence=signals.signals.length>=3&&phoneHistory.length>=5?'MEDIUM':'LOW';
 const issues=[];
 if(phoneHistory.length<3)issues.push('LIMITED_COMPLETED_PHONE_ONLY_HISTORY');
 if(bundleHistory.length&&phoneHistory.length<3)issues.push('BUNDLE_ONLY_OBSERVATIONS_NOT_PHONE_PRICE');
 if(signals.signals.length<3)issues.push('LIMITED_DEMAND_SIGNAL_COVERAGE');
 if(premium===null)issues.push('NO_VERIFIED_CURRENT_BUNDLE_PREMIUM');
 if(known===0&&count===null&&marketStatus!=='NO_COMPETITOR_FOUND')issues.push('COMPETITOR_MARKET_NOT_VERIFIED');
 return base(input,'SHADOW_PRICE_PROPOSAL_OWNER_REVIEW',{
  suggested_prices:{phone:hypothesis,bundle:premium===null?null:hypothesis+premium},
  demand_score:demand,model_type:'ZERO_COST_EVIDENCE_WEIGHTED_HEURISTIC_NOT_TRAINED_AI',
  confidence,verified_signals:signals.signals,missing_signals:signals.missing,
  historical_completed_comparables:knownSampleCount,
  historical_paid_price_median:observed,
  historical_paid_bundle_median:observedBundleMedian,
  historical_phone_comparables:phoneHistory.length,
  historical_bundle_comparables:bundleHistory.length,
  price_basis:{demand_band:band,historical_verified_anchor:anchor,used_weekday_multiplier:false},
  evidence_gaps:issues,
  competitor_quotes:quotes,
  competitor_shops_found:known,
  review_note:'ราคาเสนอเพื่อพิจารณาเท่านั้น ไม่มีการเปลี่ยนราคาในหน้าบ้าน'
 });
}
function learn(input={}){
 const proposal=input.proposal||{};
 const rows=Array.isArray(input.outcomes)?input.outcomes:[];
 // Deduplicate proven outcome receipts before computing Actual, confidence or
 // cancellations. Repeated ingestion of one receipt is not another rental.
 const seen=new Set();
 const verified=rows.filter(r=>{
  if(!r||r.verified!==true||!text(proposal.event_id)||text(r.event_id)!==text(proposal.event_id)||
     !text(r.source_ref)||!['completed','cancelled','no_show'].includes(text(r.booking_status).toLowerCase()))return false;
  const receiptId=text(r.booking_id||r.observation_id||r.source_ref);
  const key=text(r.event_id)+'|'+receiptId;
  if(seen.has(key))return false;
  seen.add(key);
  return true;
 });
 const completed=verified.filter(r=>text(r.booking_status).toLowerCase()==='completed'&&price(r.paid_price)!==null);
 const gross=completed.reduce((a,b)=>a+price(b.paid_price),0);
 const packageRows=completed.reduce((acc,r)=>{
   const t=text(r.package_type).toLowerCase();
   const key=['phone_only','phone'].includes(t)?'phone_only':
     ['phone_lens_bundle','bundle'].includes(t)?'phone_lens_bundle':'unattributed';
   acc[key].push(price(r.paid_price));return acc;
 },{phone_only:[],phone_lens_bundle:[],unattributed:[]});
 const byPackage=Object.fromEntries(Object.entries(packageRows).map(([key,prices])=>[key,{
   completed_count:prices.length,observed_completed_gross:prices.reduce((a,b)=>a+b,0),
   observed_paid_median:median(prices)
 }]));
 const noPaid=verified.filter(r=>text(r.booking_status).toLowerCase()!=='completed').length;
 // Observational sales do NOT identify counterfactual conversion rates.
 const acceptable=verified.length>=5;
 return {
  schema_version:VERSION,status:acceptable?'OUTCOME_REVIEW_FOR_OWNER':'INSUFFICIENT_OBSERVED_OUTCOMES',
  event_id:text(proposal.event_id),outcome_count:verified.length,completed_count:completed.length,
  excluded_cancelled_or_no_show:noPaid,observed_completed_gross:gross,
  completed_by_package:byPackage,
  observed_completed_average_paid:completed.length?Math.round(gross/completed.length):null,
  causal_price_lift_claim:false,trained_model_updated:false,
  learning_signal:acceptable?'REVIEW_PRICE_HYPOTHESIS_WITH_EXPOSURE_BASELINE':'NEED_MORE_RENTAL_AND_INQUIRY_EVIDENCE',
  owner_review_required:true,production_writes:0,learning_writes:0
 };
}
module.exports={VERSION,PRICE_BANDS,SIGNAL_WEIGHTS,uniqueQuotes,verifiedIndependentShopCount,verifiedSignals,verifiedPaidHistory,propose,learn};
