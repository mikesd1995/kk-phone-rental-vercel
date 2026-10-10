'use strict';

// This is a ZERO-COST EVIDENCE-BASED agent policy, not a fitted ML model.
// Advisory shadow only; never submit a business write from this module.
const VERSION='KK_DEMAND_PRICING_SHADOW_V1';
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
  const r=item||{};
  const shop=text(r.shop||r.shop_id||r.competitor_account||r.account);
  const key=shop?shop.toLowerCase():'UNKNOWN_'+index;
  if(!map.has(key)){const v={shop:shop||'UNIDENTIFIED',phone_price:null,bundle_price:null,source_url:text(r.source_url||r.post_url),observed_at:text(r.observed_at||r.checked_at)};map.set(key,v);result.push(v);}
  const v=map.get(key),kind=text(r.package_type).toUpperCase();
  if(['PHONE','PHONE_ONLY'].includes(kind)&&v.phone_price===null)v.phone_price=price(r.price);
  if(['PHONE_LENS','PHONE_LENS_BUNDLE','BUNDLE'].includes(kind)&&v.bundle_price===null)v.bundle_price=price(r.price);
 }
 return result;
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
 return (Array.isArray(rows)?rows:[]).filter(x=>{
  const r=x||{};
  // A real comparable means completed + dated event + verified source.
  // Never count same current event as a prior observation.
  return r.comparable_verified===true&&r.verified===true&&COMPLETED.has(text(r.booking_status).toLowerCase())&&
   text(r.event_id)&&text(r.event_id)!==eventId&&text(r.event_date)&&text(r.source_ref)&&price(r.paid_phone_price)!==null;
 }).map(r=>({event_id:text(r.event_id),event_date:text(r.event_date),paid_phone_price:price(r.paid_phone_price),source_ref:text(r.source_ref)}));
}
function guard(input={}){
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
 const known=Math.max(quotes.length,count===null?0:count);
 // Do NOT conflate unscanned with searched-zero.
 const marketStatus=text(input.competitor_market_status).toUpperCase();
 if((known>0&&known<3)||(marketStatus.startsWith('COMPETITOR_FOUND')&&known===0)){
  return base(input,'HOLD_COMPETITOR_QUOTES_OWNER_DECISION',{
   competitor_quotes:quotes,competitor_shops_found:known,
   review_note:'รายงานราคาคู่แข่งแต่ละร้าน ให้เจ้าของร้านตัดสินใจเอง ห้ามปรับราคาอัตโนมัติ'
  });
 }
 if(known>0&&quotes.length<3){
  return base(input,'HOLD_COMPETITOR_EVIDENCE_INCOMPLETE',{
   competitor_quotes:quotes,competitor_shops_found:known,
   blockers:['COMPETITOR_VERIFIED_QUOTES_LT_3']
  });
 }
 const signals=verifiedSignals(input);
 const history=verifiedPaidHistory(input.completed_history,text(input.event_id));
 const knownSampleCount=history.length;
 if(signals.signals.length<2||signals.score===null||!signals.signals.some(s=>s.signal==='fandom_photo_intent'||s.signal==='qualified_inquiry_intent')){
  return base(input,'HOLD_INSUFFICIENT_DEMAND_EVIDENCE',{
   demand_score:signals.score,verified_signals:signals.signals,missing_signals:signals.missing,
   historical_completed_comparables:knownSampleCount,blockers:['MIN_TWO_VERIFIED_SIGNALS_ONE_PHOTO_OR_INQUIRY']
  });
 }
 // No weekday/weekend hardcoded rate. These bands are testable hypotheses,
 // NOT machine-learned demand elasticities or proven optimal revenue.
 const demand=signals.score;
 const band=demand>=92?990:demand>=82?890:demand>=68?790:demand>=52?690:demand>=35?590:490;
 const observed=median(history.map(x=>x.paid_phone_price));
 // Avoid sudden downpricing an observed, verified comparable willingness to pay.
 const anchor=observed===null?null:nearestBand(observed);
 const hypothesis=anchor===null?band:Math.max(anchor,Math.min(band,anchor+100));
 const floor=price(input.minimum_viable_phone_price);
 const currentPhone=price(input.current_phone_price),currentBundle=price(input.current_bundle_price);
 if(floor!==null&&hypothesis<floor)return base(input,'HOLD_BELOW_VERIFIED_PRICE_FLOOR',{
   demand_score:demand,blockers:['PROPOSED_BELOW_OWNER_COST_FLOOR'],minimum_viable_phone_price:floor});
 // Keep the store's existing bundle premium; cannot invent lens cost.
 const premium=currentPhone!==null&&currentBundle!==null&&currentBundle>=currentPhone?currentBundle-currentPhone:null;
 const confidence=signals.signals.length>=3&&knownSampleCount>=5?'MEDIUM':'LOW';
 const issues=[];
 if(history.length<3)issues.push('LIMITED_COMPLETED_RENTAL_HISTORY');
 if(signals.signals.length<3)issues.push('LIMITED_DEMAND_SIGNAL_COVERAGE');
 if(premium===null)issues.push('NO_VERIFIED_CURRENT_BUNDLE_PREMIUM');
 if(known===0&&count===null&&marketStatus!=='NO_COMPETITOR_FOUND')issues.push('COMPETITOR_MARKET_NOT_VERIFIED');
 return base(input,'SHADOW_PRICE_PROPOSAL_OWNER_REVIEW',{
  suggested_prices:{phone:hypothesis,bundle:premium===null?null:hypothesis+premium},
  demand_score:demand,model_type:'ZERO_COST_EVIDENCE_WEIGHTED_HEURISTIC_NOT_TRAINED_AI',
  confidence,verified_signals:signals.signals,missing_signals:signals.missing,
  historical_completed_comparables:knownSampleCount,
  historical_paid_price_median:observed,
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
 const noPaid=verified.filter(r=>text(r.booking_status).toLowerCase()!=='completed').length;
 // Observational sales do NOT identify counterfactual conversion rates.
 const acceptable=verified.length>=5;
 return {
  schema_version:VERSION,status:acceptable?'OUTCOME_REVIEW_FOR_OWNER':'INSUFFICIENT_OBSERVED_OUTCOMES',
  event_id:text(proposal.event_id),outcome_count:verified.length,completed_count:completed.length,
  excluded_cancelled_or_no_show:noPaid,observed_completed_gross:gross,
  observed_completed_average_paid:completed.length?Math.round(gross/completed.length):null,
  causal_price_lift_claim:false,trained_model_updated:false,
  learning_signal:acceptable?'REVIEW_PRICE_HYPOTHESIS_WITH_EXPOSURE_BASELINE':'NEED_MORE_RENTAL_AND_INQUIRY_EVIDENCE',
  owner_review_required:true,production_writes:0,learning_writes:0
 };
}
module.exports={VERSION,PRICE_BANDS,SIGNAL_WEIGHTS,uniqueQuotes,verifiedSignals,verifiedPaidHistory,propose,learn};
