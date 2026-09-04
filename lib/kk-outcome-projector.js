'use strict';

/**
 * Real CRM aggregate -> Machine-SOT Business Outcome candidate.
 *
 * Safety properties:
 * - exact verified Machine-SOT <-> CRM identity only;
 * - exact CRM event snapshot required, so zero-booking observations are provable;
 * - PRE_EVENT_SNAPSHOT is never eligible for final Business Outcome learning;
 * - X state is tri-state and is populated only from explicit provider evidence;
 * - amount_received is never promoted to accounting revenue;
 * - output contains no customer/contact/KYC PII.
 */

function text(v){ return String(v == null ? '' : v).trim(); }
function lower(v){ return text(v).toLowerCase(); }
function positiveNumberOrNull(v){
  const s=text(v).replace(/,/g,'');
  if(!s) return null;
  const n=Number(s);
  return Number.isFinite(n) && n>0 ? n : null;
}
function exactOne(rows,predicate,label){
  const hits=(rows||[]).filter(predicate);
  if(hits.length!==1) throw new Error(`${label}: expected exactly one row, got ${hits.length}`);
  return hits[0];
}
function requireCrosswalk(x){
  if(!x || x.identity_verified!==true) throw new Error('crosswalk identity_verified=true required');
  const family=text(x.event_family_id), show=text(x.show_id), crm=text(x.crm_event_id), date=text(x.event_date);
  if(!family || !show || !crm || !date) throw new Error('crosswalk family/show/crm/date required');
  const evidence=Array.isArray(x.identity_evidence)?x.identity_evidence.map(text).filter(Boolean):[];
  if(evidence.length<2) throw new Error('crosswalk requires >=2 identity evidence items');
  return {family,show,crm,date,evidence};
}
function resolveXEvidence(e){
  if(e == null) return {posted_x:null,post_at:null,x_evidence_ref:null,x_post_id:null,x_post_url:null};
  if(typeof e!=='object' || (e.posted!==true && e.posted!==false)) throw new Error('x_post_evidence.posted boolean required');
  const evidence=text(e.provider_evidence_ref);
  if(!evidence) throw new Error('x_post_evidence.provider_evidence_ref required');
  if(e.posted===false) return {posted_x:false,post_at:null,x_evidence_ref:evidence,x_post_id:null,x_post_url:null};
  const postId=text(e.post_id), postUrl=text(e.post_url), postAt=text(e.post_at);
  if(!postId || !postUrl) throw new Error('published X evidence requires post_id and post_url');
  if(!Number.isFinite(Date.parse(postAt))) throw new Error('published X evidence post_at invalid');
  return {posted_x:true,post_at:postAt,x_evidence_ref:evidence,x_post_id:postId,x_post_url:postUrl};
}
function assertNoPiiOutput(out){
  const s=JSON.stringify(out).toLowerCase();
  for(const key of ['customer_name','customer_phone','customer_contact','passport','id_card','kyc_document']){
    if(s.includes(key)) throw new Error('PII field leaked into outcome');
  }
}

function projectOutcome(input){
  const x=requireCrosswalk(input && input.crosswalk);
  const observedAt=text(input.observed_at);
  if(!Number.isFinite(Date.parse(observedAt))) throw new Error('observed_at invalid');
  const policyVersion=text(input.policy_version);
  if(!policyVersion) throw new Error('policy_version required');
  const stage=text(input.observation_stage);
  if(!['PRE_EVENT_SNAPSHOT','POST_EVENT_FINAL'].includes(stage)) throw new Error('observation_stage must be PRE_EVENT_SNAPSHOT or POST_EVENT_FINAL');

  const event=exactOne(input.event_rows||[],r=>text(r.event_id)===x.crm,'exact CRM event snapshot');
  const eventName=text(event.event_name);
  const exact=(input.booking_rows||[]).filter(r=>text(r.event_id)===x.crm);
  const cancelled=exact.filter(r=>lower(r.booking_status)==='cancelled');
  const effective=exact.filter(r=>lower(r.booking_status)!=='cancelled');
  const completed=effective.filter(r=>lower(r.booking_status)==='completed');
  const active=effective.filter(r=>['pending','confirmed','prepared','picked_up','returned','uploaded'].includes(lower(r.booking_status)));
  const booked=effective.length>0;

  const prices=effective.map(r=>positiveNumberOrNull(r.package_price)).filter(n=>n!=null);
  const avgPrice=prices.length?Math.round((prices.reduce((a,b)=>a+b,0)/prices.length)*100)/100:null;
  const phoneUnits=completed.filter(r=>text(r.phone_asset_id)).length;
  const lensUnits=completed.filter(r=>text(r.lens_asset_id)).length;
  const xState=resolveXEvidence(input.x_post_evidence);
  const finalEligible=stage==='POST_EVENT_FINAL';
  const confidence=completed.length
    ? 'CRM_COMPLETED_BOOKING_AGGREGATE'
    : effective.length
      ? 'CRM_BOOKING_STAGE_AGGREGATE'
      : finalEligible
        ? 'CRM_ZERO_BOOKING_FINAL'
        : 'CRM_ZERO_BOOKING_PRE_EVENT_SNAPSHOT';

  const outcome={
    outcome_id:`OUTCOME|CRM|${x.crm}|${observedAt}`,
    event_family_id:x.family,
    show_id:x.show,
    event_date:x.date,
    posted_x:xState.posted_x,
    post_at:xState.post_at,
    bookings:effective.length,
    units_rented:phoneUnits+lensUnits,
    actual_price:avgPrice,
    booked,
    cancellation_count:cancelled.length,
    outcome_confidence:confidence,
    source:'CRM_BOOKING_AGGREGATE_READ_ONLY',
    recorded_at:observedAt,
    origin_work_id:x.crm,
    policy_version:policyVersion,
    observation_stage:stage,
    eligible_for_business_outcome:finalEligible,
    notes:`crm_event=${x.crm}; event_name=${eventName}; completed_bookings=${completed.length}; active_bookings=${active.length}; accounting_revenue_not_projected=true; exact_identity_evidence=${x.evidence.join(' | ')}${xState.x_evidence_ref?`; x_evidence_ref=${xState.x_evidence_ref}`:''}`,
    gross_revenue:null,
    net_revenue:null,
    amount_received_not_used_as_revenue:true,
    x_post_id:xState.x_post_id,
    x_post_url:xState.x_post_url
  };
  assertNoPiiOutput(outcome);
  return outcome;
}

function toBusinessOutcomeRow(o){
  if(!o || o.eligible_for_business_outcome!==true) throw new Error('outcome is not eligible for final Business Outcome write');
  const row={
    'Outcome ID':o.outcome_id,
    'Event Family ID':o.event_family_id,
    'Show ID':o.show_id,
    'Event Date':o.event_date,
    'Posted X':o.posted_x,
    'Post At':o.post_at,
    'Impressions':null,
    'Engagements':null,
    'Inquiries':null,
    'Quotes':null,
    'Bookings':o.bookings,
    'Units Rented':o.units_rented,
    'Gross Revenue':null,
    'Discounts':null,
    'Net Revenue':null,
    'Avg Rental Price':o.actual_price,
    'Stock Fill %':null,
    'Inquiry→Booking %':null,
    'Outcome Confidence':o.outcome_confidence,
    'Source':o.source,
    'Recorded At':o.recorded_at,
    'Notes':o.notes,
    'Clicks':null,
    'Suggested Price':null,
    'Actual Price':o.actual_price,
    'Booked':o.booked,
    'Competitor Min':null,
    'Competitor Max':null,
    'Lead Time Hours':null,
    'Utilization %':null,
    'Cancellation Count':o.cancellation_count,
    'Waitlist Conversion %':null,
    'First Draft Approved':null,
    'Revision Count':null,
    'Worker Error Count':null,
    'Confidence Accurate':null,
    'Origin Work ID':o.origin_work_id,
    'Policy Version':o.policy_version
  };
  assertNoPiiOutput(row);
  return row;
}

module.exports={projectOutcome,toBusinessOutcomeRow};
