'use strict';

const VisibilityGuard=require('./event-visibility-owner-guard.js');
const VERSION='KK_VERIFIER_STOREFRONT_PROMOTION_V7_PHASE3_LOCK';
const OWNER_REOPEN_INTENT='explicit_owner_reopen';

function text(v){return String(v==null?'':v).trim();}
function isIsoDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(text(v));}
function https(v){try{const u=new URL(text(v));return u.protocol==='https:'?u.toString():'';}catch(_){return '';}}
function isLensOnlyPriceRow(p={}){
  const type=text(p.package_type).toLowerCase();
  const id=text(p.template_id).toUpperCase();
  return type==='lens_only'||id==='TPL-ZEISS-2-35X-LENS';
}
function isWeekendDate(v){
  if(!isIsoDate(v)) return false;
  const d=new Date(text(v)+'T00:00:00Z').getUTCDay();
  return d===0||d===5||d===6;
}
function publishEligibility(candidate={}){
  const supplied=candidate.publish_eligibility&&typeof candidate.publish_eligibility==='object'?candidate.publish_eligibility:{};
  if(supplied.eligible===true) return Object.assign({status:'ELIGIBLE'},supplied);
  if(supplied.eligible===false) return Object.assign({status:'REJECTED_LOW_RENTAL_FIT'},supplied);
  const n=Number(candidate.rental_fit_score);
  if(Number.isFinite(n)){
    return {
      status:n>=7?'ELIGIBLE':'REJECTED_LOW_RENTAL_FIT',
      eligible:n>=7,
      rental_fit_score:n,
      minimum_publish_score:7
    };
  }
  return {status:'UNSCORED',eligible:null,rental_fit_score:null,minimum_publish_score:7};
}

function preparePromotion(input={}){
  const c=input.candidate||{};
  const blockers=[];
  if(text(c.status)!=='READY_FOR_FINAL_VERIFIER') blockers.push('COMMERCIAL_EVIDENCE_NOT_READY');
  if(!text(c.title)) blockers.push('EVENT_TITLE_REQUIRED');
  if(!isIsoDate(c.event_date)) blockers.push('EVENT_DATE_INVALID');
  if(!text(c.venue)) blockers.push('EVENT_VENUE_REQUIRED');

  const poster=https(c.poster&&c.poster.selected&&c.poster.selected.image_url);
  if(!poster) blockers.push('VERIFIED_POSTER_REQUIRED');

  const eligibility=publishEligibility(c);
  if(eligibility.eligible===false) blockers.push('RENTAL_FIT_BELOW_PUBLISH_THRESHOLD');

  const pricing=c.pricing||{};
  const proposal=pricing.proposal||{};
  const policy=input.final_pricing_policy||{};
  const policyApproved=policy.policy_approved===true&&[
    'KK_APPROVED_BASELINE',
    'KK_ACTIVE_STANDARD_PACKAGE_SOT',
    'KK_RENTAL_FIT_SCORE_FALLBACK',
    'EXACT_EVENT_COMPETITOR_MEDIAN',
    'PHASE3_LOCKED_TARGET'
  ].includes(text(policy.source));

  const proposalReady=proposal.proposal_available===true&&Number.isFinite(Number(proposal.proposed_reference_price));
  const scoreBridgeAllowed=eligibility.eligible===true&&policyApproved;
  if(!proposalReady&&!scoreBridgeAllowed) blockers.push('PRICING_REFERENCE_REQUIRED');
  if(proposal.auto_final_price===true) blockers.push('AUTO_FINAL_PRICE_PROHIBITED');

  const finalPrices=Array.isArray(input.final_prices)&&input.final_prices.length
    ? input.final_prices
    : (policyApproved&&Array.isArray(policy.final_prices)?policy.final_prices:[]);
  if(!finalPrices.length) blockers.push('FINAL_KK_PRICE_REQUIRED');

  const zeroExactCompetitor=Number(pricing.independent_competitors||0)===0;
  const needsPriceRecheck=policy.needs_price_recheck===true||(isWeekendDate(c.event_date)&&zeroExactCompetitor&&eligibility.eligible===true);
  const pricingStatus=text(policy.pricing_status)||(needsPriceRecheck?'PROVISIONAL_NEEDS_PRICE_RECHECK':'FINAL_PRICE_APPROVED');
  const priceConfidence=text(policy.price_confidence)||(needsPriceRecheck?'PROVISIONAL':'APPROVED');

  const cleanPrices=finalPrices.map(p=>{
    const lensOnly=isLensOnlyPriceRow(p);
    const rawNote=text(p.override_note||'VERIFIER_APPROVED');
    const note=rawNote+(needsPriceRecheck&&!rawNote.includes('PROVISIONAL_NEEDS_PRICE_RECHECK')?'|PROVISIONAL_NEEDS_PRICE_RECHECK':'');
    return {
      template_id:text(p.template_id),
      override_price:Number(p.override_price),
      active_override:lensOnly?false:(p.active_override===false?false:true),
      override_note:note
    };
  });
  if(cleanPrices.some(p=>!p.template_id||!Number.isFinite(p.override_price)||p.override_price<=0)) blockers.push('FINAL_KK_PRICE_INVALID');

  if(input.verifier_approved!==true) blockers.push('FINAL_VERIFIER_APPROVAL_REQUIRED');
  const ownerPublishAllowed=input.owner_publish_allowed===true||policyApproved;
  if(!ownerPublishAllowed) blockers.push('OWNER_PUBLISH_POLICY_REQUIRED');

  const existing=input.existing_event||{};
  if(text(existing.event_id)){
    if(existing.active_on_web===false){
      if(text(input.visibility_owner_intent)===OWNER_REOPEN_INTENT) blockers.push('OWNER_REOPEN_REQUIRES_EXISTING_EVENT_UPDATE');
      else blockers.push('OWNER_HIDDEN_REOPEN_PROHIBITED');
    }else{
      blockers.push('EXISTING_EVENT_RECONCILE_REQUIRED');
    }
  }

  const historyRows=Array.isArray(input.visibility_locks)?input.visibility_locks:
    (Array.isArray(input.visibility_history)?input.visibility_history:[]);
  const historyCheck=VisibilityGuard.evaluateCreateAgainstHistory({visibility_locks:historyRows},{
    event_name:text(c.title),event_date:text(c.event_date),venue:text(c.venue)
  });
  if(!historyCheck.ok){
    if(historyCheck.code==='EVENT_VISIBILITY_TOMBSTONE_LOCKED') blockers.push('OWNER_HIDDEN_RECREATE_PROHIBITED');
    else blockers.push('HISTORICAL_EVENT_RECREATE_PROHIBITED');
  }

  const baseNote=text(input.note||'Verifier-approved discovery promotion');
  const pricingNote=needsPriceRecheck?'PRICING=PROVISIONAL_NEEDS_PRICE_RECHECK':'PRICING='+pricingStatus;
  const payload=blockers.length?null:{
    action:'createEvent',
    event_name:text(c.title),
    event_date:text(c.event_date),
    venue:text(c.venue),
    poster_url:poster,
    status:'open',
    active_on_web:true,
    note:[baseNote,pricingNote].filter(Boolean).join(' | '),
    event_price_overrides:cleanPrices
  };

  return {
    schema_version:VERSION,
    status:blockers.length?'HOLD_FOR_FINAL_PROMOTION':'READY_FOR_GOVERNED_ADMIN_CREATE',
    blockers,
    admin_action:'createEvent',
    admin_payload:payload,
    publish_eligibility:eligibility,
    pricing_status:pricingStatus,
    price_confidence:priceConfidence,
    needs_price_recheck:needsPriceRecheck,
    competitor_evidence_count:Number(pricing.independent_competitors||0),
    duplicate_guard_required:true,
    exact_storefront_readback_required:true,
    production_writes:0,
    publishes:0
  };
}

function verifyStorefrontReadback(plan={},readback={}){
  const payload=plan.admin_payload||{};
  const event=readback.event||{};
  const packages=Array.isArray(readback.packages)?readback.packages:[];
  const expected=Array.isArray(payload.event_price_overrides)?payload.event_price_overrides:[];
  const blockers=[];
  if(!text(event.event_id)) blockers.push('EVENT_ID_MISSING');
  if(text(event.event_name)!==text(payload.event_name)) blockers.push('EVENT_NAME_MISMATCH');
  if(text(event.venue)!==text(payload.venue)) blockers.push('EVENT_VENUE_MISMATCH');
  if(event.active_on_web!==true) blockers.push('EVENT_NOT_ACTIVE_ON_WEB');
  if(!https(event.poster_image_url||event.poster_url)) blockers.push('POSTER_READBACK_MISSING');

  for(const p of expected){
    const row=packages.find(x=>text(x.template_id||x.package_id).includes(text(p.template_id)));
    if(!row||Number(row.price)!==Number(p.override_price)) blockers.push('PACKAGE_PRICE_READBACK_MISMATCH:'+text(p.template_id));
    if(row&&isLensOnlyPriceRow(p)){
      const status=text(row.package_status||row.status).toLowerCase();
      if(status==='available'||status==='open') blockers.push('LENS_ONLY_VISIBLE_ON_CREATE:'+text(p.template_id));
    }
  }

  return {
    schema_version:VERSION,
    status:blockers.length?'PROMOTION_READBACK_FAILED':'STOREFRONT_PROMOTION_VERIFIED',
    blockers,
    event_id:text(event.event_id),
    pricing_status:text(plan.pricing_status),
    needs_price_recheck:plan.needs_price_recheck===true,
    verified:blockers.length===0
  };
}

module.exports={
  VERSION,
  OWNER_REOPEN_INTENT,
  VisibilityGuard,
  isLensOnlyPriceRow,
  isWeekendDate,
  publishEligibility,
  preparePromotion,
  verifyStorefrontReadback
};
