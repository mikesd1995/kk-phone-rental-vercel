'use strict';
const {evidenceCount,evidenceTimestamp}=require('./kk-evidence-validation');

/**
 * Real CRM aggregate -> Machine-SOT Business Outcome candidate.
 *
 * Safety properties:
 * - exact verified Machine-SOT <-> CRM identity only;
 * - exact CRM event snapshot required, so zero-booking observations are provable;
 * - POST_EVENT_FINAL is allowed only after the event date and with no unresolved active booking;
 * - X state is tri-state and positive state requires canonical provider evidence;
 * - amount_received is never promoted to accounting revenue;
 * - output contains no customer/contact/KYC PII.
 */
function text(v){ return String(v == null ? '' : v).trim(); }
function lower(v){ return text(v).toLowerCase(); }
function positiveNumberOrNull(v){ if(typeof v!=='number'&&typeof v!=='string')return null; const s=text(v).replace(/,/g,''); if(!s)return null; const n=Number(s); return Number.isFinite(n)&&n>0?n:null; }
function exactOne(rows,predicate,label){ const hits=(rows||[]).filter(predicate); if(hits.length!==1) throw new Error(`${label}: expected exactly one row, got ${hits.length}`); return hits[0]; }
function parseInstant(v,label){ if(!evidenceTimestamp(v))throw new Error(`${label} invalid`); return Date.parse(v); }
function dateKey(v,label){
  const s=text(v); let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/), y,mo,d;
  if(m){y=Number(m[1]);mo=Number(m[2]);d=Number(m[3]);}
  else {m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(!m)throw new Error(`${label} invalid`);y=Number(m[3]);if(y>2500)y-=543;mo=Number(m[2]);d=Number(m[1]);}
  const key=`${String(y).padStart(4,'0')}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  if(!evidenceTimestamp(key+'T00:00:00Z'))throw new Error(`${label} invalid`);
  return key;
}
function requireCrosswalk(x){
  if(!x || x.identity_verified!==true) throw new Error('crosswalk identity_verified=true required');
  const family=text(x.event_family_id), show=text(x.show_id), crm=text(x.crm_event_id), date=text(x.event_date);
  if(!family || !show || !crm || !date) throw new Error('crosswalk family/show/crm/date required');
  const evidence=Array.isArray(x.identity_evidence)?x.identity_evidence.map(text).filter(Boolean):[];
  const unique=[...new Set(evidence)];
  if(unique.length<2) throw new Error('crosswalk requires >=2 independent identity evidence items');
  return {family,show,crm,date,evidence:unique};
}
function canonicalX(postId,postUrl){
  const id=text(postId), raw=text(postUrl); if(!id||!raw) throw new Error('published X evidence requires post_id and post_url');
  let u; try{u=new URL(raw);}catch(_){throw new Error('published X evidence post_url invalid');}
  if(u.protocol!=='https:' || u.hostname.toLowerCase()!=='x.com' || u.username || u.password || u.port) throw new Error('published X evidence requires canonical x.com URL');
  const m=u.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/([0-9]+)\/?$/); if(!m) throw new Error('published X evidence post_url shape invalid');
  if(m[2]!==id) throw new Error('published X evidence post_id/url mismatch');
  if(u.search||u.hash) throw new Error('published X evidence URL query/hash forbidden');
  return {post_id:id,post_url:`https://x.com/${m[1]}/status/${id}`,account:m[1].toLowerCase()};
}
function resolveXEvidence(e,observedMs,originWorkId,expectedAccount){
  if(e == null) return {posted_x:null,post_at:null,x_evidence_ref:null,x_post_id:null,x_post_url:null};
  if(typeof e!=='object' || (e.posted!==true && e.posted!==false)) throw new Error('x_post_evidence.posted boolean required');
  const evidence=text(e.provider_evidence_ref); if(!evidence) throw new Error('x_post_evidence.provider_evidence_ref required');
  if(text(e.origin_work_id)!==originWorkId)throw new Error('X outcome origin_work_id binding required');
  if(e.posted===false) return {posted_x:false,post_at:null,x_evidence_ref:evidence,x_post_id:null,x_post_url:null};
  const receipt=canonicalX(e.post_id,e.post_url); const postAt=text(e.post_at); const postMs=parseInstant(postAt,'published X evidence post_at');
  if(!/^[a-z0-9_]{1,15}$/i.test(text(expectedAccount)) || receipt.account!==lower(expectedAccount))throw new Error('X outcome account binding required');
  if(postMs>observedMs) throw new Error('published X evidence post_at after observation');
  return {posted_x:true,post_at:postAt,x_evidence_ref:evidence,x_post_id:receipt.post_id,x_post_url:receipt.post_url};
}
function assertNoPiiOutput(out){
  const s=JSON.stringify(out).toLowerCase();
  for(const key of ['customer_name','customer_phone','customer_contact','passport','id_card','kyc_document','payment_slip']) if(s.includes(key)) throw new Error('PII field leaked into outcome');
}

function projectOutcome(input){
  const x=requireCrosswalk(input && input.crosswalk);
  const observedAt=text(input.observed_at); const observedMs=parseInstant(observedAt,'observed_at');
  const policyVersion=text(input.policy_version); if(!policyVersion) throw new Error('policy_version required');
  const stage=text(input.observation_stage); if(!['PRE_EVENT_SNAPSHOT','POST_EVENT_FINAL'].includes(stage)) throw new Error('observation_stage must be PRE_EVENT_SNAPSHOT or POST_EVENT_FINAL');

  const event=exactOne(input.event_rows||[],r=>text(r.event_id)===x.crm,'exact CRM event snapshot');
  const eventName=text(event.event_name); const crosswalkDate=dateKey(x.date,'crosswalk event_date'); const crmDate=dateKey(event.event_date,'CRM event_date');
  if(crmDate!==crosswalkDate) throw new Error('crosswalk/CRM event_date mismatch');
  if(!text(input.crm_timezone))throw new Error('crm_timezone readback required');
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:input.crm_timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(observedMs));
  const part=t=>parts.find(p=>p.type===t).value;
  const observationDate=`${part('year')}-${part('month')}-${part('day')}`;
  if(stage==='POST_EVENT_FINAL' && observationDate<=crosswalkDate) throw new Error('POST_EVENT_FINAL requires observation after event date');

  if(!Array.isArray(input.booking_rows))throw new Error('booking_rows explicit readback required');
  const ids=new Set();
  for(const r of input.booking_rows){const id=typeof r.booking_id==='string'?r.booking_id.trim():'';if(!id||ids.has(id))throw new Error('booking identity missing or duplicate');ids.add(id);if(!text(r.event_id))throw new Error('booking event identity missing');}
  const exact=input.booking_rows.filter(r=>text(r.event_id)===x.crm);
  const allowedStatuses=new Set(['pending','confirmed','prepared','picked_up','returned','uploaded','completed','no_show','cancelled']);
  for(const r of exact){const st=lower(r.booking_status);if(!allowedStatuses.has(st)) throw new Error(`unsupported booking_status in outcome snapshot: ${st||'<blank>'}`);}
  const cancelled=exact.filter(r=>lower(r.booking_status)==='cancelled');
  const effective=exact.filter(r=>lower(r.booking_status)!=='cancelled');
  const completed=effective.filter(r=>lower(r.booking_status)==='completed');
  const active=effective.filter(r=>['pending','confirmed','prepared','picked_up','returned','uploaded'].includes(lower(r.booking_status)));
  if(stage==='POST_EVENT_FINAL' && active.length) throw new Error('POST_EVENT_FINAL blocked by unresolved active bookings');
  const booked=effective.length>0;
  const prices=effective.map(r=>positiveNumberOrNull(r.package_price)).filter(n=>n!=null);
  const avgPrice=prices.length?Math.round((prices.reduce((a,b)=>a+b,0)/prices.length)*100)/100:null;
  const phoneUnits=completed.filter(r=>text(r.phone_asset_id)).length; const lensUnits=completed.filter(r=>text(r.lens_asset_id)).length;
  const xState=resolveXEvidence(input.x_post_evidence,observedMs,x.crm,input.x_account);
  const finalEligible=stage==='POST_EVENT_FINAL';
  const confidence=completed.length?'CRM_COMPLETED_BOOKING_AGGREGATE':effective.length?'CRM_BOOKING_STAGE_AGGREGATE':finalEligible?'CRM_ZERO_BOOKING_FINAL':'CRM_ZERO_BOOKING_PRE_EVENT_SNAPSHOT';
  const outcome={
    outcome_id:`OUTCOME|CRM|${x.crm}|${observedAt}`,event_family_id:x.family,show_id:x.show,event_date:x.date,posted_x:xState.posted_x,post_at:xState.post_at,
    bookings:effective.length,units_rented:phoneUnits+lensUnits,actual_price:avgPrice,booked,cancellation_count:cancelled.length,outcome_confidence:confidence,
    source:'CRM_BOOKING_AGGREGATE_READ_ONLY',recorded_at:observedAt,origin_work_id:x.crm,policy_version:policyVersion,observation_stage:stage,
    eligible_for_business_outcome:finalEligible,unresolved_active_bookings:active.length,
    notes:`crm_event=${x.crm}; event_name=${eventName}; completed_bookings=${completed.length}; active_bookings=${active.length}; accounting_revenue_not_projected=true; exact_identity_evidence=${x.evidence.join(' | ')}${xState.x_evidence_ref?`; x_evidence_ref=${xState.x_evidence_ref}`:''}`,
    gross_revenue:null,net_revenue:null,amount_received_not_used_as_revenue:true,x_post_id:xState.x_post_id,x_post_url:xState.x_post_url
  };
  assertNoPiiOutput(outcome); return outcome;
}
function toBusinessOutcomeRow(o){
  if(!o || o.eligible_for_business_outcome!==true) throw new Error('outcome is not eligible for final Business Outcome write');
  if(evidenceCount(o.unresolved_active_bookings)!==0) throw new Error('final Business Outcome blocked by unresolved active bookings');
  if(o.observation_stage!=='POST_EVENT_FINAL'||!['outcome_id','event_family_id','show_id','origin_work_id','policy_version','source'].every(k=>typeof o[k]==='string'&&o[k].trim()))throw new Error('final Business Outcome identity/stage invalid');
  if(!evidenceTimestamp(o.recorded_at)||['bookings','units_rented','cancellation_count'].some(k=>evidenceCount(o[k])===null))throw new Error('final Business Outcome evidence invalid');
  const row={'Outcome ID':o.outcome_id,'Event Family ID':o.event_family_id,'Show ID':o.show_id,'Event Date':o.event_date,'Posted X':o.posted_x,'Post At':o.post_at,'Impressions':null,'Engagements':null,'Inquiries':null,'Quotes':null,'Bookings':o.bookings,'Units Rented':o.units_rented,'Gross Revenue':null,'Discounts':null,'Net Revenue':null,'Avg Rental Price':o.actual_price,'Stock Fill %':null,'Inquiry→Booking %':null,'Outcome Confidence':o.outcome_confidence,'Source':o.source,'Recorded At':o.recorded_at,'Notes':o.notes,'Clicks':null,'Suggested Price':null,'Actual Price':o.actual_price,'Booked':o.booked,'Competitor Min':null,'Competitor Max':null,'Lead Time Hours':null,'Utilization %':null,'Cancellation Count':o.cancellation_count,'Waitlist Conversion %':null,'First Draft Approved':null,'Revision Count':null,'Worker Error Count':null,'Confidence Accurate':null,'Origin Work ID':o.origin_work_id,'Policy Version':o.policy_version};
  assertNoPiiOutput(row); return row;
}
module.exports={projectOutcome,toBusinessOutcomeRow};
