'use strict';

const VERSION='KK_FINAL_PRICING_POLICY_V7_OWNER_QUOTES_NO_AUTO_REPRICE';

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

// An unknown/unscanned competitor count is NOT the same thing as a verified
// zero. Preserve that distinction before using the special 790/990 uplift.
function explicitCompetitorCount(input={}){
  const sources=[
    input.independent_competitors,
    input.pricing&&input.pricing.independent_competitors,
    input.candidate&&input.candidate.pricing&&input.candidate.pricing.independent_competitors
  ];
  for(const v of sources){
    if(v===null||v===undefined||text(v)==='')continue;
    const n=Number(v);
    if(Number.isInteger(n)&&n>=0)return n;
  }
  return null;
}
function exactCompetitorCount(input={}){
  const count=explicitCompetitorCount(input);
  return count===null?0:count;
}

function eventDate(input={}){
  const raw=text(input.event_date||(input.candidate&&input.candidate.event_date));
  const thai=raw.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  if(thai)return thai[3]+'-'+thai[2].padStart(2,'0')+'-'+thai[1].padStart(2,'0');
  return raw;
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

// Owner clarification 2026-10-10: zero exact-event rental competitors FOUND
// in checked sources => Fri-Sun 790/990; with competitors found but NO
// usable quotes => retain the distinct Fri-Sun 690/890 provisional baseline.
// Mon-Thu remains 490/590. "Not found" is not proof of web-wide absence.
// Booked and owner-final dates are never repriced.
function ownerWeekpartFallback(input={}){
 const date=eventDate(input);
 if(!isIsoDate(date))return null;
 const parsed=new Date(date+'T00:00:00Z');
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)return null;
 const n=parsed.getUTCDay();
 const weekend=n===0||n===5||n===6;
 const pricing=input.pricing||{};
 const evidence=Array.isArray(pricing.evidence)?pricing.evidence:[];
 const count=explicitCompetitorCount(input);
 const marketStatus=text(pricing.market_status||input.competitor_market_status).toUpperCase();
 const competitorExists=(count!==null&&count>0)||evidence.some(r=>money(r&&r.price))||marketStatus.startsWith('COMPETITOR_FOUND');
 const noCompetitorFound=!competitorExists&&(count===0||marketStatus==='NO_COMPETITOR_FOUND');
 const phone=weekend?(noCompetitorFound?790:690):490;
 const bundle=weekend?(noCompetitorFound?990:890):590;
 const ids=templateIds(input,fallbackPolicy(input));
 const lens=lensBaseline(input);
 const note=weekend?(noCompetitorFound?'OWNER_WEEKEND_NO_COMPETITOR_FOUND':competitorExists?'OWNER_WEEKEND_COMPETITOR_FOUND_NO_VALID_QUOTE':'OWNER_WEEKEND_COMPETITOR_STATUS_UNKNOWN'):'OWNER_MON_THU_FALLBACK';
 return {weekend,phone,bundle,lens,
  final_prices:[
   {template_id:ids.phone,override_price:phone,active_override:true,override_note:note+'|NOT_COMPETITOR_MEDIAN'},
   {template_id:ids.lens,override_price:lens,active_override:false,override_note:'LENS_ONLY_DISABLED|NOT_COMPETITOR_MEDIAN'},
   {template_id:ids.bundle,override_price:bundle,active_override:true,override_note:note+'|NOT_COMPETITOR_MEDIAN'}
  ]};
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
// Retained export name for callers. For one/two independent shops this is a
// *reference*, not a reliable market median; only three+ yields a median.
// Each quote must have been verified as the same event/date and comparable
// rental model upstream. Group package quotes by shop: use its actual phone
// AND bundle values where offered, not an invented flat lens add-on.
// Unnamed source rows cannot be confidently joined, so keep them separate.
function exactCompetitorMedian(input={}){
  const pricing=input.pricing||{};
  const evidence=Array.isArray(pricing.evidence)?pricing.evidence:[];
  const lens=lensBaseline(input);
  const shops=new Map();
  let unnamed=0;
  for(const row of evidence){
    const p=money(row&&row.price);if(!p)continue;
    const type=text(row&&row.package_type).toUpperCase();
    const phoneType=type==='PHONE_ONLY'||type==='PHONE';
    const bundleType=type==='PHONE_LENS'||type==='PHONE_LENS_BUNDLE'||type==='BUNDLE';
    if(!phoneType&&!bundleType)continue;
    const account=text(row.shop_id||row.competitor_account||row.shop||row.account||row.source_shop).toLowerCase();
    const key=account||'unnamed-shop-row-'+(++unnamed);
    if(!shops.has(key))shops.set(key,{phone:null,bundle:null});
    const shop=shops.get(key);
    if(phoneType&&shop.phone===null)shop.phone=p;
    if(bundleType&&shop.bundle===null)shop.bundle=p;
  }
  const samples=[];
  for(const shop of shops.values()){
    const phone=shop.phone||(shop.bundle&&shop.bundle>lens?shop.bundle-lens:null);
    const bundle=shop.bundle||(shop.phone?shop.phone+lens:null);
    if(phone>0&&bundle>0)samples.push({phone,bundle});
  }
  const count=Math.min(exactCompetitorCount(input),samples.length);
  if(count<1)return null;
  const selected=samples.slice(0,count);
  const phoneValues=selected.map(v=>v.phone),bundleValues=selected.map(v=>v.bundle);
  const phone=median(phoneValues),bundle=median(bundleValues);
  if(!phone||!bundle)return null;
  const referenceOnly=count<3;
  const method=count>=3?'EXACT_EVENT_COMPETITOR_MEDIAN':count===2?'EXACT_EVENT_TWO_SHOP_REFERENCE_MIDPOINT':'EXACT_EVENT_ONE_SHOP_REFERENCE';
  const policy=fallbackPolicy(input);
  const ids=templateIds(input,policy);
  return {
    phone,lens,bundle,shop_count:count,reference_only:referenceOnly,method,
    sample_range:[Math.min(...phoneValues),Math.max(...phoneValues)],
    bundle_price_range:[Math.min(...bundleValues),Math.max(...bundleValues)],
    final_prices:[
      {template_id:ids.phone,override_price:phone,active_override:true,override_note:method+(referenceOnly?'|PROVISIONAL_RECHECK_COMPETITOR':'')},
      {template_id:ids.lens,override_price:lens,active_override:false,override_note:'LENS_ONLY_HIDDEN_STORE_BASELINE'},
      {template_id:ids.bundle,override_price:bundle,active_override:true,override_note:method+'_BUNDLE'+(referenceOnly?'|PROVISIONAL_RECHECK_COMPETITOR':'')}
    ]
  };
}

// Report actual published competing prices verbatim; do NOT compute a
// suggested midpoint or synthesize an absent bundle for owner review.
function competitorQuoteReports(input={}){
  const evidence=Array.isArray(input.pricing&&input.pricing.evidence)?input.pricing.evidence:[];
  const reports=[],byShop=new Map();
  for(let i=0;i<evidence.length;i++){
    const row=evidence[i]||{};
    const price=money(row.price);
    const type=text(row.package_type).toUpperCase();
    const group=(type==='PHONE_ONLY'||type==='PHONE')?'phone':
      (type==='PHONE_LENS'||type==='PHONE_LENS_BUNDLE'||type==='BUNDLE')?'bundle':null;
    if(!group||!price)continue;
    const shop=text(row.shop_id||row.competitor_account||row.shop||row.account||row.source_shop);
    const key=shop?shop.toLowerCase():'unknown-source-row-'+i;
    let report=byShop.get(key);
    if(!report){
      report={shop:shop||'UNIDENTIFIED_SHOP',phone_price:null,bundle_price:null,
        source_url:text(row.post_url||row.source_url||row.url),
        checked_at:text(row.last_checked||row.checked_at||row.observed_at),
        freshness:text(row.freshness||row.market_freshness)};
      byShop.set(key,report);reports.push(report);
    }
    if(report[group+'_price']===null)report[group+'_price']=price;
    if(!report.source_url)report.source_url=text(row.post_url||row.source_url||row.url);
    if(!report.checked_at)report.checked_at=text(row.last_checked||row.checked_at||row.observed_at);
  }
  return reports;
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
  // A booked date is a price lock, including one remaining unallocated phone.
  if(input.has_active_booking_on_date===true || input.booking_day_locked===true){
    return {schema_version:VERSION,status:'HOLD_BOOKING_DATE_PRICE_LOCK',
      final_prices:[],policy_approved:false,source:'BOOKING_DAY_LOCK',
      pricing_status:'NO_REPRICE_ON_BOOKING_DATE',price_confidence:'NONE',
      needs_price_recheck:false,competitor_reference_used_as_final:false,
      requires_per_event_owner_price_decision:false,production_writes:0};
  }
  // Preserve user-approved event-specific prices before any market reference.
  if(input.owner_price_locked===true || input.has_owner_final_price===true ||
     input.owner_approved_price_locked===true){
    return {schema_version:VERSION,status:'HOLD_OWNER_FINAL_PRICE_LOCK',
      final_prices:[],policy_approved:false,source:'OWNER_PRICE_LOCK',
      pricing_status:'NO_REPRICE_ON_OWNER_LOCKED_EVENT',price_confidence:'NONE',
      needs_price_recheck:false,competitor_reference_used_as_final:false,
      requires_per_event_owner_price_decision:false,production_writes:0};
  }
  const competitorCount=exactCompetitorCount(input);
  const observedQuotes=competitorQuoteReports(input);
  const competitorStatus=text((input.pricing||{}).market_status||input.competitor_market_status).toUpperCase();
  const competitorFound=competitorCount>0||observedQuotes.length>0||competitorStatus.startsWith('COMPETITOR_FOUND');
  const date=eventDate(input);
  // A typed but unparseable date cannot safely choose the owner daypart.
  // Preserve approved explicit pricing with absent date for historic callers;
  // NEVER silently fall through to expensive scored tiers on an invalid date.
  if(date&&!ownerWeekpartFallback(input)){
    return {schema_version:VERSION,status:'HOLD_FOR_VALID_EVENT_DATE',
      final_prices:[],policy_approved:false,source:'INVALID_EVENT_DATE',
      pricing_status:'DATE_REQUIRED_FOR_WEEKPART',price_confidence:'NONE',
      needs_price_recheck:false,competitor_reference_used_as_final:false,
      requires_per_event_owner_price_decision:false,production_writes:0};
  }
  const weekend=isWeekendDate(date);
  const exact=competitorCount>0?exactCompetitorMedian(input):null;

  // Owner final clarification: even ONE or TWO independent competing shops
  // must be reported with their ACTUAL prices, without changing the initial
  // existing event price. The owner will decide per event. Also fail closed
  // when competing shops exist but their current prices are unverified.
  // Only 3+ independently evidenced shops may reach the median path below.
  if(competitorFound&&(!exact||exact.shop_count<3)){
    return {
      schema_version:VERSION,
      status:'HOLD_FOR_OWNER_COMPETITOR_PRICE_DECISION',
      final_prices:[],
      policy_approved:false,
      source:'COMPETITOR_QUOTES_REPORT_ONLY',
      pricing_status:observedQuotes.length?'OWNER_REVIEW_1_2_COMPETITOR_QUOTES':'COMPETITOR_FOUND_PRICE_EVIDENCE_MISSING',
      price_confidence:'REFERENCE_ONLY',
      needs_price_recheck:true,
      competitor_evidence_count:Math.max(competitorCount,observedQuotes.length),
      competitor_quotes:observedQuotes,
      competitor_reference_used_as_final:false,
      existing_prices_preserved:true,
      requires_per_event_owner_price_decision:true,
      production_writes:0
    };
  }

  const candidateScore=eventScore(input);
  const fitThreshold=fallbackPolicy(input).minimum_publish_score;
  const lowFit=candidateScore!==null&&candidateScore<fitThreshold;
  const weekpart=!exact && !lowFit?ownerWeekpartFallback(input):null;
  const fallback=!weekpart && !exact && !lowFit?scoreFallback(input):null;

  if(exact){
    return {
      schema_version:VERSION,
      status:'FINAL_PRICES_RESOLVED',
      final_prices:decorate(exact.final_prices,{needs_price_recheck:exact.reference_only}),
      policy_approved:true,
      source:exact.method,
      pricing_status:exact.reference_only?'PROVISIONAL_EXACT_EVENT_REFERENCE':'APPROVED_EXACT_EVENT_MEDIAN',
      price_confidence:exact.reference_only?(exact.shop_count===1?'LOW':'MEDIUM'):'HIGH',
      needs_price_recheck:exact.reference_only,
      rental_fit_score:eventScore(input),
      minimum_publish_score:fallbackPolicy(input).minimum_publish_score,
      competitor_evidence_count:exact.shop_count,
      competitor_price_range:exact.sample_range,
      competitor_bundle_range:exact.bundle_price_range,
      competitor_reference_used_as_final:true,
      requires_per_event_owner_price_decision:false
    };
  }

  if(weekpart){
    return {
      schema_version:VERSION,
      status:'FINAL_PRICES_RESOLVED',
      final_prices:decorate(weekpart.final_prices,{needs_price_recheck:true}),
      policy_approved:true,
      source:'OWNER_WEEKPART_FALLBACK',
      pricing_status:'PROVISIONAL_NEEDS_PRICE_RECHECK',
      price_confidence:'PROVISIONAL',
      needs_price_recheck:true,
      rental_fit_score:candidateScore,
      minimum_publish_score:fitThreshold,
      competitor_evidence_count:competitorCount,
      competitor_reference_used_as_final:false,
      requires_per_event_owner_price_decision:false,
      production_writes:0
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
  explicitCompetitorCount,exactCompetitorCount,
  eventScore,
  fallbackPolicy,
  templateIds,
  ownerWeekpartFallback,
  scoreFallback,
  median,lensBaseline,exactCompetitorMedian,competitorQuoteReports,baselinePrices,
  resolve
};
