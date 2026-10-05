'use strict';

const VERSION='KK_FINAL_PRICING_POLICY_V5';

const DEFAULT_SCORE_FALLBACK_POLICY=Object.freeze({
  policy_approved:true,
  minimum_publish_score:7,
  template_ids:Object.freeze({
    phone:'TPL-VIVO-X300-PRO-PHONE',
    lens:'TPL-ZEISS-2-35X-LENS',
    bundle:'TPL-VIVO-X300-PRO-BUNDLE'
  }),
  tiers:Object.freeze([
    Object.freeze({minimum_score:9,phone:890,lens:200,bundle:1090}),
    Object.freeze({minimum_score:8,phone:790,lens:200,bundle:990}),
    Object.freeze({minimum_score:7,phone:690,lens:200,bundle:890})
  ])
});

function text(v){return String(v==null?'':v).trim();}
function money(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null;}
function score(v){const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=10?n:null;}
function isIsoDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(text(v));}

function isWeekendDate(v){
  if(!isIsoDate(v)) return false;
  const d=new Date(text(v)+'T00:00:00Z').getUTCDay();
  return d===0||d===5||d===6;
}

function exactCompetitorCount(input={}){
  const sources=[
    input.independent_competitors,
    input.pricing&&input.pricing.independent_competitors,
    input.candidate&&input.candidate.pricing&&input.candidate.pricing.independent_competitors
  ];
  for(const v of sources){
    const n=Number(v);
    if(Number.isFinite(n)&&n>=0) return n;
  }
  return 0;
}

function eventDate(input={}){
  return text(input.event_date||(input.candidate&&input.candidate.event_date));
}

function eventScore(input={}){
  const sources=[
    input.rental_fit_score,
    input.publish_eligibility&&input.publish_eligibility.rental_fit_score,
    input.candidate&&input.candidate.rental_fit_score,
    input.candidate&&input.candidate.publish_eligibility&&input.candidate.publish_eligibility.rental_fit_score
  ];
  for(const v of sources){
    const n=score(v);
    if(n!==null) return n;
  }
  return null;
}

function fallbackPolicy(input={}){
  const supplied=input.score_fallback_policy&&typeof input.score_fallback_policy==='object'?input.score_fallback_policy:null;
  if(!supplied) return DEFAULT_SCORE_FALLBACK_POLICY;
  const approved=supplied.policy_approved===true;
  const minimum=score(supplied.minimum_publish_score);
  const templateIds=Object.assign({},DEFAULT_SCORE_FALLBACK_POLICY.template_ids,supplied.template_ids||{});
  const tiers=Array.isArray(supplied.tiers)&&supplied.tiers.length?supplied.tiers:DEFAULT_SCORE_FALLBACK_POLICY.tiers;
  return {
    policy_approved:approved,
    minimum_publish_score:minimum===null?DEFAULT_SCORE_FALLBACK_POLICY.minimum_publish_score:minimum,
    template_ids:templateIds,
    tiers
  };
}

function templateIds(input={},policy=DEFAULT_SCORE_FALLBACK_POLICY){
  const ids=Object.assign({},policy.template_ids||DEFAULT_SCORE_FALLBACK_POLICY.template_ids);
  const templates=Array.isArray(input.package_templates)?input.package_templates:[];
  for(const row of templates){
    const id=text(row.template_id||row.package_id);
    const type=text(row.package_type).toLowerCase();
    if(!id) continue;
    if(type==='phone_only') ids.phone=id;
    else if(type==='lens_only') ids.lens=id;
    else if(type==='phone_lens_bundle') ids.bundle=id;
  }
  return ids;
}

function scoreFallback(input={}){
  const policy=fallbackPolicy(input);
  const value=eventScore(input);
  if(policy.policy_approved!==true||value===null||value<policy.minimum_publish_score) return null;
  const tiers=(policy.tiers||[]).map(r=>({
    minimum_score:score(r.minimum_score),
    phone:money(r.phone),
    lens:money(r.lens),
    bundle:money(r.bundle)
  })).filter(r=>r.minimum_score!==null&&r.phone&&r.lens&&r.bundle).sort((a,b)=>b.minimum_score-a.minimum_score);
  const tier=tiers.find(r=>value>=r.minimum_score);
  if(!tier) return null;
  const ids=templateIds(input,policy);
  return {
    rental_fit_score:value,
    minimum_publish_score:policy.minimum_publish_score,
    tier_minimum_score:tier.minimum_score,
    final_prices:[
      {template_id:ids.phone,override_price:tier.phone,active_override:true,override_note:'OWNER_APPROVED_RENTAL_FIT_FALLBACK'},
      {template_id:ids.lens,override_price:tier.lens,active_override:false,override_note:'LENS_ONLY_HIDDEN_STORE_BASELINE'},
      {template_id:ids.bundle,override_price:tier.bundle,active_override:true,override_note:'OWNER_APPROVED_RENTAL_FIT_FALLBACK'}
    ]
  };
}

function median(values=[]){const a=values.map(Number).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function lensBaseline(input={}){
  const templates=Array.isArray(input.package_templates)?input.package_templates:[];
  const lens=templates.find(r=>text(r.package_type).toLowerCase()==='lens_only');
  return money(lens&&lens.standard_price)||200;
}
function exactCompetitorMedian(input={}){
  const pricing=input.pricing||{};
  const evidence=Array.isArray(pricing.evidence)?pricing.evidence:[];
  const lens=lensBaseline(input);
  const phone=[];
  for(const row of evidence){
    const p=money(row&&row.price);if(!p)continue;
    const type=text(row&&row.package_type).toUpperCase();
    if(type==='PHONE_ONLY'||type==='PHONE') phone.push(p);
    else if(type==='PHONE_LENS'||type==='PHONE_LENS_BUNDLE'||type==='BUNDLE'){
      const derived=p-lens;if(derived>0)phone.push(derived);
    }
  }
  const value=median(phone);
  if(!value)return null;
  const policy=fallbackPolicy(input);
  const ids=templateIds(input,policy);
  return {
    phone:value,
    lens,
    bundle:value+lens,
    final_prices:[
      {template_id:ids.phone,override_price:value,active_override:true,override_note:'EXACT_EVENT_COMPETITOR_MEDIAN'},
      {template_id:ids.lens,override_price:lens,active_override:false,override_note:'LENS_ONLY_HIDDEN_STORE_BASELINE'},
      {template_id:ids.bundle,override_price:value+lens,active_override:true,override_note:'EXACT_EVENT_COMPETITOR_MEDIAN_PLUS_LENS'}
    ]
  };
}

function baselinePrices(input={}){
  const explicit=Array.isArray(input.store_baseline_prices)?input.store_baseline_prices:[];
  const templates=Array.isArray(input.package_templates)?input.package_templates:[];
  const rows=explicit.length?explicit:templates.map(r=>({
    template_id:r.template_id||r.package_id,
    price:r.standard_price,
    active:r.active,
    approved:r.active===true||String(r.active||'').toLowerCase()==='true',
    override_note:'ACTIVE_STANDARD_PACKAGE_SOT'
  }));
  const source=explicit.length?'KK_APPROVED_BASELINE':'KK_ACTIVE_STANDARD_PACKAGE_SOT';
  const approved=rows.map(r=>({
    template_id:text(r.template_id||r.package_id),
    override_price:money(r.price),
    active_override:r.active===false?false:true,
    approved:r.approved===true,
    override_note:text(r.override_note||'APPROVED_KK_BASELINE_AUTOFINAL')
  })).filter(r=>r.template_id&&r.override_price&&r.approved);
  const seen=new Set();const prices=[];
  for(const r of approved){
    if(seen.has(r.template_id)) continue;
    seen.add(r.template_id);
    prices.push({template_id:r.template_id,override_price:r.override_price,active_override:r.active_override,override_note:r.override_note});
  }
  return {source,prices};
}

function decorate(prices=[],meta={}){
  const provisional=meta.needs_price_recheck===true;
  return prices.map(p=>({
    template_id:p.template_id,
    override_price:p.override_price,
    active_override:p.active_override,
    override_note:text(p.override_note)+(provisional?'|PROVISIONAL_NEEDS_PRICE_RECHECK':'')
  }));
}

function phase3LockedTarget(input={}){
  const d=input.phase3_price_decision&&typeof input.phase3_price_decision==='object'?input.phase3_price_decision:null;
  if(!d||!['PRICE_READY','PRICE_LOCKED_BOOKING'].includes(text(d.status)))return null;
  const target=d.target_prices||{};
  const phone=money(target.phone),bundle=money(target.bundle),lens=money(target.lens)||lensBaseline(input);
  if(!phone&&!bundle)return null;
  const resolvedPhone=phone||(bundle?bundle-lens:null);
  const resolvedBundle=bundle||(resolvedPhone?resolvedPhone+lens:null);
  if(!resolvedPhone||!resolvedBundle)return null;
  const ids=templateIds(input,fallbackPolicy(input));
  return {
    decision_status:text(d.status),
    price_source:text(d.price_source)||'PHASE3_LOCKED_TARGET',
    price_confidence:text(d.price_confidence)||'PHASE3_ACCEPTED',
    final_prices:[
      {template_id:ids.phone,override_price:resolvedPhone,active_override:true,override_note:'PHASE3_LOCKED_TARGET'},
      {template_id:ids.lens,override_price:lens,active_override:false,override_note:'LENS_ONLY_HIDDEN_STORE_BASELINE'},
      {template_id:ids.bundle,override_price:resolvedBundle,active_override:true,override_note:'PHASE3_LOCKED_TARGET'}
    ]
  };
}
function resolve(input={}){
 const phase3=phase3LockedTarget(input);
 if(phase3){
  return {
    schema_version:VERSION,
    status:'FINAL_PRICES_RESOLVED',
    final_prices:phase3.final_prices,
    policy_approved:true,
    source:'PHASE3_LOCKED_TARGET',
    upstream_price_source:phase3.price_source,
    pricing_status:'APPROVED_PHASE3_LOCKED_TARGET',
    price_confidence:phase3.price_confidence,
    needs_price_recheck:false,
    rental_fit_score:eventScore(input),
    minimum_publish_score:fallbackPolicy(input).minimum_publish_score,
    competitor_evidence_count:exactCompetitorCount(input),
    competitor_reference_used_as_final:phase3.price_source==='EXACT_EVENT_COMPETITOR_MEDIAN',
    requires_per_event_owner_price_decision:false
  };
 }
  const competitorCount=exactCompetitorCount(input);
  const date=eventDate(input);
  const weekend=isWeekendDate(date);
  const exact=competitorCount>0?exactCompetitorMedian(input):null;
  const fallback=competitorCount===0?scoreFallback(input):null;

  if(exact){
    return {
      schema_version:VERSION,
      status:'FINAL_PRICES_RESOLVED',
      final_prices:decorate(exact.final_prices,{needs_price_recheck:false}),
      policy_approved:true,
      source:'EXACT_EVENT_COMPETITOR_MEDIAN',
      pricing_status:'APPROVED_EXACT_EVENT_MEDIAN',
      price_confidence:competitorCount>=3?'HIGH':'MEDIUM',
      needs_price_recheck:false,
      rental_fit_score:eventScore(input),
      minimum_publish_score:fallbackPolicy(input).minimum_publish_score,
      competitor_evidence_count:competitorCount,
      competitor_reference_used_as_final:true,
      requires_per_event_owner_price_decision:false
    };
  }

  if(fallback){
    const needsRecheck=weekend;
    return {
      schema_version:VERSION,
      status:'FINAL_PRICES_RESOLVED',
      final_prices:decorate(fallback.final_prices,{needs_price_recheck:needsRecheck}),
      policy_approved:true,
      source:'KK_RENTAL_FIT_SCORE_FALLBACK',
      pricing_status:needsRecheck?'PROVISIONAL_NEEDS_PRICE_RECHECK':'APPROVED_SCORE_FALLBACK',
      price_confidence:needsRecheck?'PROVISIONAL':'APPROVED_FALLBACK',
      needs_price_recheck:needsRecheck,
      rental_fit_score:fallback.rental_fit_score,
      minimum_publish_score:fallback.minimum_publish_score,
      competitor_evidence_count:competitorCount,
      competitor_reference_used_as_final:false,
      requires_per_event_owner_price_decision:false
    };
  }

  const baseline=baselinePrices(input);
  const needsRecheck=weekend&&competitorCount===0&&baseline.prices.length>0;
  return {
    schema_version:VERSION,
    status:baseline.prices.length?'FINAL_PRICES_RESOLVED':'HOLD_FOR_APPROVED_BASELINE',
    final_prices:decorate(baseline.prices,{needs_price_recheck:needsRecheck}),
    policy_approved:baseline.prices.length>0,
    source:baseline.source,
    pricing_status:baseline.prices.length?(needsRecheck?'PROVISIONAL_NEEDS_PRICE_RECHECK':'APPROVED_BASELINE'):'HOLD_FOR_APPROVED_BASELINE',
    price_confidence:baseline.prices.length?(needsRecheck?'PROVISIONAL':'APPROVED_BASELINE'):'NONE',
    needs_price_recheck:needsRecheck,
    rental_fit_score:eventScore(input),
    minimum_publish_score:fallbackPolicy(input).minimum_publish_score,
    competitor_evidence_count:competitorCount,
    competitor_reference_used_as_final:false,
    requires_per_event_owner_price_decision:false
  };
}

module.exports={
  VERSION,
  DEFAULT_SCORE_FALLBACK_POLICY,
  isWeekendDate,
  exactCompetitorCount,
  eventScore,
  fallbackPolicy,
  templateIds,
  scoreFallback,
  median,lensBaseline,exactCompetitorMedian,baselinePrices,phase3LockedTarget,
  resolve
};
