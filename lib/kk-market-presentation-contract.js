'use strict';
const {canonicalIdentity,assessCurrentExactMarket}=require('./kk-competitor-current-market');
const {evidenceTrue,readCount}=require('./kk-evidence-validation');

function text(v){return String(v==null?'':v).trim();}
function upper(v){return text(v).toUpperCase();}
function num(v){const n=Number(String(v??'').replace(/,/g,'').trim());return Number.isFinite(n)&&n>0?n:null;}
function nonneg(v){const n=Number(v);return Number.isFinite(n)&&n>=0?n:0;}

function priceObservationPersistenceGate(observation={}){
  const id=canonicalIdentity(observation);
  const price=num(observation.current_bundle_price ?? observation.bundle_price);
  const packageType=text(id.package_key).toUpperCase();
  const sourceRow=Number(observation.source_evidence_row||0);
  const reasons=[];
  if(!id.event_key) reasons.push('MISSING_EVENT_KEY');
  if(!id.competitor_key) reasons.push('MISSING_COMPETITOR_IDENTITY');
  if(packageType!=='VIVO_X300_PRO+LENS') reasons.push('NOT_EXACT_X300_PRO_LENS');
  if(price===null) reasons.push('INVALID_BUNDLE_PRICE');
  if(!Number.isInteger(sourceRow)||sourceRow<=0) reasons.push('MISSING_SOURCE_LINEAGE');
  if(observation.exact_event===false) reasons.push('NOT_EXACT_EVENT');
  const eligible=reasons.length===0;
  return {eligible,reasons,append_price_evidence:eligible,upsert_current_after_append:eligible,identity:id,price};
}

function latestHistoryPrices(history=[],options={}){
  const own=new Set((options.own_competitor_ids||[]).map(v=>text(v).replace(/^@+/,'').toLowerCase()));
  return history.filter(r=>{
    const id=canonicalIdentity(r);
    return id.event_key===text(options.event_key||options.eventKey) && id.package_key===upper(options.package_key||options.packageKey)
      && id.competitor_key && !own.has(id.competitor_key)
      && (!options.show_id || text(r.show_id)===text(options.show_id));
  }).map(r=>num(r.current_bundle_price ?? r.bundle_price)).filter(v=>v!==null);
}

function monthlyMarketSummary(currentRows=[],historyRows=[],options={}){
  const assessed=assessCurrentExactMarket(currentRows,options);
  const count=assessed.independent_competitor_count;
  if(count>=3) return {status:'FRESH',kind:'RANGE_PLUS_MEDIAN',fresh_shops:count,range:assessed.market_range,median:assessed.median};
  if(count===2) return {status:'FRESH',kind:'RANGE',fresh_shops:2,range:assessed.market_range,median:null};
  if(count===1){const price=num(assessed.accepted[0].current_bundle_price ?? assessed.accepted[0].bundle_price);return {status:'FRESH',kind:'REFERENCE',fresh_shops:1,reference:price,median:null};}
  const history=latestHistoryPrices(historyRows,options);
  if(history.length) return {status:'STALE',kind:'LAST_KNOWN',fresh_shops:0,range:history.length>=2?{min:Math.min(...history),max:Math.max(...history)}:null,reference:history.length===1?history[0]:null,median:null};
  return {status:'NO_EXACT_BUNDLE_YET',kind:'NONE',fresh_shops:0,median:null};
}

function sameShopPackagePriceChange(previous={},current={},options={}){
  const p=canonicalIdentity(previous), c=canonicalIdentity(current);
  const prev=num(previous.current_bundle_price ?? previous.bundle_price), next=num(current.current_bundle_price ?? current.bundle_price);
  const prevAt=Date.parse(text(previous.last_checked||previous.observed_at)), nextAt=Date.parse(text(current.last_checked||current.observed_at)), now=Date.parse(text(options.now||new Date().toISOString()));
  const windowMs=(Number(options.window_hours||24))*3600000;
  const same=p.event_key&&p.event_key===c.event_key&&p.competitor_key&&p.competitor_key===c.competitor_key&&p.package_key&&p.package_key===c.package_key;
  const recent=Number.isFinite(nextAt)&&Number.isFinite(now)&&nextAt<=now&&now-nextAt<=windowMs;
  const changed=same&&prev!==null&&next!==null&&prev!==next&&Number.isFinite(prevAt)&&Number.isFinite(nextAt)&&nextAt>prevAt&&recent;
  return {price_updated:changed,previous_price:prev,current_price:next,delta:changed?next-prev:null,visual:changed?'PURPLE':null};
}

const HOLD_TOKENS=['CANCELLED','POSTPONED','OUT_OF_AREA','NON_PROMOTABLE','HOLD','PENDING_VERIFICATION'];
function lifecycleTierOverride(status=''){
  const s=upper(status);
  if(s.includes('SKIP')||s.includes('EXTERNAL_LENS_PROHIBITED')) return 'SKIP';
  if(HOLD_TOKENS.some(x=>s.includes(x))) return 'HOLD';
  return null;
}

function rentalOpportunityTier(score,status=''){
  const override=lifecycleTierOverride(status);
  if(override) return override;
  const n=num(score);
  if(n===null) return 'PENDING';
  if(n>=95) return 'S+';
  if(n>=90) return 'S';
  if(n>=85) return 'A+';
  if(n>=80) return 'A';
  if(n>=75) return 'B+';
  return 'B';
}

function monthlySortKey(row={}){
  const date=text(row.start_date_iso||row.startDateIso||row.show_date||row.showDate);
  const ms=Date.parse(date);
  const status=text(row.status||row.lifecycle_state||row.lifecycleState);
  const tier=rentalOpportunityTier(row.score??row.opportunity_score??row.kk_action_score,status);
  const score=num(row.score??row.opportunity_score??row.kk_action_score)||0;
  const bucket=(tier==='HOLD'||tier==='SKIP')?2:(tier==='PENDING'?1:0);
  const name=text(row.event_name||row.canonical_event_name||row.name).toLowerCase();
  return [Number.isFinite(ms)?ms:Number.MAX_SAFE_INTEGER,bucket,-score,name];
}

function monthlyCompare(a,b){
  const x=monthlySortKey(a), y=monthlySortKey(b);
  for(let i=0;i<x.length;i++){if(x[i]<y[i]) return -1;if(x[i]>y[i]) return 1;}
  return 0;
}

function monthlyNormalizerGate(input={}){
  const reasons=[];
  for(const field of ['duplicate_event_key','canonical_monthly_gap','formula_ref_error']){
    if(readCount(input,field,reasons)>0) reasons.push(field.toUpperCase());
  }
  for(const field of ['sort_order_pass','tier_mapping_pass','color_rule_present','week_separator_pass','full_row_integrity_pass']){
    if(!evidenceTrue(input[field])) reasons.push('MISSING_OR_FAILED_'+field.toUpperCase());
  }
  return {can_commit:reasons.length===0,reasons};
}

function priceOnlyMonthlyReorderRequired(change={}){
  return !!(change.date_changed||change.score_changed||change.status_changed||change.identity_changed||change.venue_changed);
}

module.exports={priceObservationPersistenceGate,monthlyMarketSummary,sameShopPackagePriceChange,lifecycleTierOverride,rentalOpportunityTier,monthlySortKey,monthlyCompare,monthlyNormalizerGate,priceOnlyMonthlyReorderRequired};
