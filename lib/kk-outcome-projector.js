'use strict';

/**
 * Real CRM booking aggregate -> Machine-SOT Business Outcome candidate.
 * Requires an exact verified Machine-SOT <-> CRM event crosswalk and emits no PII.
 * It deliberately does not call amount_received accounting revenue.
 */

function text(v){ return String(v == null ? '' : v).trim(); }
function lower(v){ return text(v).toLowerCase(); }
function num(v){ const n=Number(text(v).replace(/,/g,'')); return Number.isFinite(n)?n:0; }
function requireCrosswalk(x){
  if(!x || x.identity_verified!==true) throw new Error('crosswalk identity_verified=true required');
  const family=text(x.event_family_id), show=text(x.show_id), crm=text(x.crm_event_id), date=text(x.event_date);
  if(!family || !show || !crm || !date) throw new Error('crosswalk family/show/crm/date required');
  const evidence=Array.isArray(x.identity_evidence)?x.identity_evidence.map(text).filter(Boolean):[];
  if(evidence.length<2) throw new Error('crosswalk requires >=2 identity evidence items');
  return {family,show,crm,date,evidence};
}
function assertNoPiiOutput(out){
  const s=JSON.stringify(out).toLowerCase();
  for(const key of ['customer_name','customer_phone','customer_contact','passport','id_card']){
    if(s.includes(key)) throw new Error('PII field leaked into outcome');
  }
}

function projectOutcome(input){
  const x=requireCrosswalk(input && input.crosswalk);
  const observedAt=text(input.observed_at);
  if(!Number.isFinite(Date.parse(observedAt))) throw new Error('observed_at invalid');
  const exact=(input.booking_rows||[]).filter(r=>text(r.event_id)===x.crm);
  if(!exact.length) throw new Error('no exact CRM booking rows');

  const cancelled=exact.filter(r=>lower(r.booking_status)==='cancelled');
  const effective=exact.filter(r=>lower(r.booking_status)!=='cancelled');
  const completed=effective.filter(r=>lower(r.booking_status)==='completed');
  const active=effective.filter(r=>['pending','confirmed','prepared','picked_up','returned','uploaded'].includes(lower(r.booking_status)));
  const booked=effective.length>0;

  const prices=effective.map(r=>num(r.package_price)).filter(n=>n>0);
  const avgPrice=prices.length?Math.round((prices.reduce((a,b)=>a+b,0)/prices.length)*100)/100:null;

  const phoneUnits=completed.filter(r=>text(r.phone_asset_id)).length;
  const lensUnits=completed.filter(r=>text(r.lens_asset_id)).length;

  const outcome={
    outcome_id:`OUTCOME|CRM|${x.crm}|${observedAt}`,
    event_family_id:x.family,
    show_id:x.show,
    event_date:x.date,
    posted_x:false,
    bookings:effective.length,
    units_rented:phoneUnits+lensUnits,
    actual_price:avgPrice,
    booked,
    cancellation_count:cancelled.length,
    outcome_confidence:completed.length?'CRM_COMPLETED_BOOKING_AGGREGATE':'CRM_BOOKING_STAGE_AGGREGATE',
    source:'CRM_BOOKING_AGGREGATE_READ_ONLY',
    recorded_at:observedAt,
    origin_work_id:x.crm,
    policy_version:text(input.policy_version),
    notes:`completed_bookings=${completed.length}; active_bookings=${active.length}; accounting_revenue_not_projected=true; exact_identity_evidence=${x.evidence.join(' | ')}`,
    gross_revenue:null,
    net_revenue:null,
    amount_received_not_used_as_revenue:true
  };
  assertNoPiiOutput(outcome);
  return outcome;
}

module.exports={projectOutcome};
