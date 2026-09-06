'use strict';
const {canonicalIdentity,assessCurrentExactMarket}=require('./kk-competitor-current-market');

function text(v){return String(v==null?'':v).trim();}
function num(v){const n=Number(String(v??'').replace(/,/g,'').trim());return Number.isFinite(n)&&n>0?n:null;}

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

function latestHistoryPrices(history=[]){
  return history.map(r=>num(r.current_bundle_price ?? r.bundle_price)).filter(v=>v!==null);
}

function monthlyMarketSummary(currentRows=[],historyRows=[],options={}){
  const assessed=assessCurrentExactMarket(currentRows,options);
  const count=assessed.independent_competitor_count;
  if(count>=3) return {status:'FRESH',kind:'RANGE_PLUS_MEDIAN',fresh_shops:count,range:assessed.market_range,median:assessed.median};
  if(count===2) return {status:'FRESH',kind:'RANGE',fresh_shops:2,range:assessed.market_range,median:null};
  if(count===1){
    const price=num(assessed.accepted[0].current_bundle_price);
    return {status:'FRESH',kind:'REFERENCE',fresh_shops:1,reference:price,median:null};
  }
  const history=latestHistoryPrices(historyRows);
  if(history.length){
    return {status:'STALE',kind:'LAST_KNOWN',fresh_shops:0,range:history.length>=2?{min:Math.min(...history),max:Math.max(...history)}:null,reference:history.length===1?history[0]:null,median:null};
  }
  return {status:'NO_EXACT_BUNDLE_YET',kind:'NONE',fresh_shops:0,median:null};
}

function sameShopPackagePriceChange(previous={},current={},options={}){
  const p=canonicalIdentity(previous), c=canonicalIdentity(current);
  const prev=num(previous.current_bundle_price ?? previous.bundle_price);
  const next=num(current.current_bundle_price ?? current.bundle_price);
  const prevAt=Date.parse(text(previous.last_checked||previous.observed_at));
  const nextAt=Date.parse(text(current.last_checked||current.observed_at));
  const now=Date.parse(text(options.now||new Date().toISOString()));
  const windowMs=(Number(options.window_hours||24))*3600000;
  const same=p.event_key&&p.event_key===c.event_key&&p.competitor_key&&p.competitor_key===c.competitor_key&&p.package_key&&p.package_key===c.package_key;
  const recent=Number.isFinite(nextAt)&&Number.isFinite(now)&&nextAt<=now&&now-nextAt<=windowMs;
  const changed=same&&prev!==null&&next!==null&&prev!==next&&Number.isFinite(prevAt)&&Number.isFinite(nextAt)&&nextAt>prevAt&&recent;
  return {price_updated:changed,previous_price:prev,current_price:next,delta:changed?next-prev:null,visual:changed?'PURPLE':null};
}

module.exports={priceObservationPersistenceGate,monthlyMarketSummary,sameShopPackagePriceChange};
