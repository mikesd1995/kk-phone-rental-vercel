'use strict';

const VERSION='KK_FINAL_PRICING_POLICY_V4';

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
  // Prefer the complete (deduplicated) peer set when the discovery stage
  // selected just one package for its own reference proposal.
  const evidence=Array.isArray(pricing.all_package_evidence)&&pricing.all_package_evidence.length
    ?pricing.all_package_evidence:(Array.isArray(pricing.evidence)?pricing.evidence:[]);
  const lens=lensBaseline(input);
  const groups={PHONE_ONLY:[],PHONE_LENS:[]};
  const seen=new Set();
  for(const row of evidence){
    const price=money(row&&row.price);
    const raw=text(row&&row.package_type).toUpperCase();
    const type=['PHONE_ONLY','PHONE'].includes(raw)?'PHONE_ONLY':
      ['PHONE_LENS','PHONE_LENS_BUNDLE','PHONE_LENS_PACKAGE','BUNDLE','PHONE_PLUS_LENS'].includes(raw)?'PHONE_LENS':'';
    if(!price||!type) continue;
    const shop=text(row.competitor_id||row.account||row.shop).toLowerCase();
    if(shop){
      const key=shop+'|'+type;
      if(seen.has(key))continue;
      seen.add(key);
    }
    groups[type].push({price,shop});
  }
  const phoneMedian=median(groups.PHONE_ONLY.map(row=>row.price));
  const bundleMedian=median(groups.PHONE_LENS.map(row=>row.price));
  if(!phoneMedian&&!bundleMedian)return null;
  // Missing package price is a STORE LENS BASELINE ESTIMATE,
  // never a directly observed exact-event competitor quote.
  const phone=phoneMedian||(bundleMedian>lens?bundleMedian-lens:null);
  const bundle=bundleMedian||(phoneMedian?phoneMedian+lens:null);
  if(!phone||!bundle)return null;
  const distinct=(type)=>new Set(groups[type].map(row=>row.shop).filter(Boolean)).size;
  const phoneShops=distinct('PHONE_ONLY');
  const bundleShops=distinct('PHONE_LENS');
  const phoneCertified=!!phoneMedian&&phoneShops>=3;
  const bundleCertified=!!bundleMedian&&bundleShops>=3;
  const ids=templateIds(input,fallbackPolicy(input));
  return {
    phone,bundle,lens,
    phone_observed_median:phoneMedian,
    bundle_observed_median:bundleMedian,
    independent_phone_sellers:phoneShops,
    independent_bundle_sellers:bundleShops,
    phone_derived_from_bundle:!phoneMedian,
    bundle_derived_from_phone:!bundleMedian,
    market_certified_both_packages:phoneCertified&&bundleCertified,
    final_prices:[
      {template_id:ids.phone,override_price:phone,active_override:true,
        override_note:phoneMedian?'EXACT_EVENT_PHONE_ONLY_QUOTED_MEDIAN':'DERIVED_BUNDLE_MEDIAN_MINUS_KK_LENS_BASELINE'},
      {template_id:ids.lens,override_price:lens,active_override:false,override_note:'LENS_ONLY_HIDDEN_STORE_BASELINE'},
      {template_id:ids.bundle,override_price:bundle,active_override:true,
        override_note:bundleMedian?'EXACT_EVENT_BUNDLE_QUOTED_MEDIAN':'DERIVED_PHONE_MEDIAN_PLUS_KK_LENS_BASELINE'}
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

function resolve(input={}){
  const competitorCount=exactCompetitorCount(input);
  const date=eventDate(input);
  const weekend=isWeekendDate(date);
  const exact=competitorCount>0?exactCompetitorMedian(input):null;
  const fallback=!exact?scoreFallback(input):null;

  if(exact){
    const needsRecheck=!exact.market_certified_both_packages;
    return {
      schema_version:VERSION,
      status:'FINAL_PRICES_RESOLVED',
      final_prices:decorate(exact.final_prices,{needs_price_recheck:needsRecheck}),
      policy_approved:true,
      source:'EXACT_EVENT_COMPETITOR_MEDIAN',
      pricing_status:needsRecheck?'PROVISIONAL_NEEDS_PRICE_RECHECK':'APPROVED_EXACT_EVENT_MEDIAN',
      price_confidence:needsRecheck?'PROVISIONAL':'HIGH',
      needs_price_recheck:needsRecheck,
      quoted_phone_median:exact.phone_observed_median,
      quoted_bundle_median:exact.bundle_observed_median,
      exact_independent_phone_sellers:exact.independent_phone_sellers,
      exact_independent_bundle_sellers:exact.independent_bundle_sellers,
      phone_price_derived:exact.phone_derived_from_bundle,
      bundle_price_derived:exact.bundle_derived_from_phone,
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
  median,lensBaseline,exactCompetitorMedian,baselinePrices,
  resolve
};
