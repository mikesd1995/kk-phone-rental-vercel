'use strict';

const VERSION='KK_VERIFIER_STOREFRONT_PROMOTION_V2';

function text(v){return String(v==null?'':v).trim();}
function isIsoDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(text(v));}
function https(v){try{const u=new URL(text(v));return u.protocol==='https:'?u.toString():'';}catch(_){return '';}}

function preparePromotion(input={}){
  const c=input.candidate||{};
  const blockers=[];
  if(text(c.status)!=='READY_FOR_FINAL_VERIFIER') blockers.push('COMMERCIAL_EVIDENCE_NOT_READY');
  if(!text(c.title)) blockers.push('EVENT_TITLE_REQUIRED');
  if(!isIsoDate(c.event_date)) blockers.push('EVENT_DATE_INVALID');
  if(!text(c.venue)) blockers.push('EVENT_VENUE_REQUIRED');
  const poster=https(c.poster&&c.poster.selected&&c.poster.selected.image_url);
  if(!poster) blockers.push('VERIFIED_POSTER_REQUIRED');
  const pricing=c.pricing||{};
  const proposal=pricing.proposal||{};
  if(proposal.proposal_available!==true||!Number.isFinite(Number(proposal.proposed_reference_price))){
    blockers.push('PRICING_REFERENCE_REQUIRED');
  }
  if(proposal.auto_final_price===true) blockers.push('AUTO_FINAL_PRICE_PROHIBITED');
  const policy=input.final_pricing_policy||{};
  const finalPrices=Array.isArray(input.final_prices)&&input.final_prices.length?input.final_prices:(policy.policy_approved===true&&['KK_APPROVED_BASELINE','KK_ACTIVE_STANDARD_PACKAGE_SOT'].includes(policy.source)&&Array.isArray(policy.final_prices)?policy.final_prices:[]);
  if(!finalPrices.length) blockers.push('FINAL_KK_PRICE_REQUIRED');
  const cleanPrices=finalPrices.map(p=>({
    template_id:text(p.template_id),
    override_price:Number(p.override_price),
    active_override:p.active_override===false?false:true,
    override_note:text(p.override_note||'VERIFIER_APPROVED')
  }));
  if(cleanPrices.some(p=>!p.template_id||!Number.isFinite(p.override_price)||p.override_price<=0)) blockers.push('FINAL_KK_PRICE_INVALID');
  if(input.verifier_approved!==true) blockers.push('FINAL_VERIFIER_APPROVAL_REQUIRED');
  const ownerPublishAllowed=input.owner_publish_allowed===true||(policy.policy_approved===true&&['KK_APPROVED_BASELINE','KK_ACTIVE_STANDARD_PACKAGE_SOT'].includes(policy.source));
  if(!ownerPublishAllowed) blockers.push('OWNER_PUBLISH_POLICY_REQUIRED');

  const payload=blockers.length?null:{
    action:'createEvent',
    event_name:text(c.title),
    event_date:text(c.event_date),
    venue:text(c.venue),
    poster_url:poster,
    status:'open',
    active_on_web:true,
    note:text(input.note||'Verifier-approved discovery promotion'),
    event_price_overrides:cleanPrices
  };
  return {
    schema_version:VERSION,
    status:blockers.length?'HOLD_FOR_FINAL_PROMOTION':'READY_FOR_GOVERNED_ADMIN_CREATE',
    blockers,
    admin_action:'createEvent',
    admin_payload:payload,
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
  }
  return {
    schema_version:VERSION,
    status:blockers.length?'PROMOTION_READBACK_FAILED':'STOREFRONT_PROMOTION_VERIFIED',
    blockers,
    event_id:text(event.event_id),
    verified:blockers.length===0
  };
}
module.exports={VERSION,preparePromotion,verifyStorefrontReadback};
