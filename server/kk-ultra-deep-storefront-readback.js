'use strict';

// Read-only Core -> derived Web Ready reconciliation for Ultra Deep / Poster /
// Pricing scanners. Core active_on_web is owner intent, not public visibility;
// Web Ready action_for_web is the effective storefront eligibility signal.
const VERSION='KK_ULTRA_DEEP_STOREFRONT_READBACK_V1';
const SHOWN=new Set(['show','show_full']);
const ACTIVE_BOOKING=new Set(['pending','confirmed','prepared','picked_up','returned','uploaded','completed']);
const TEMP_BRAND_POSTER_URL='https://kk-phone-rental.vercel.app/assets/kk-brand-hero-final-20260920.png';
function temporaryPoster(url){return text(url).split(/[?#]/)[0]===TEMP_BRAND_POSTER_URL;}
const DATE_RE=/^(\d{4})-(\d{2})-(\d{2})$/;

function text(v){return String(v==null?'':v).trim();}
function truthy(v){return v===true||v===1||['true','1','yes'].includes(text(v).toLowerCase());}
function isoDate(v){
 const s=text(v),m=DATE_RE.exec(s);
 // Native Google Sheets readback can expose dates as Excel/Sheets day serials.
 // Handle integer and integer-looking values explicitly before DD/MM parsing;
 // never silently rely on Core fallback when a typed booking date is present.
 if(/^\d{5}(?:\.0+)?$/.test(s)){
  const serial=Number(s);
  if(serial>=30000&&serial<=80000){
   const d=new Date(Date.UTC(1899,11,30)+serial*86400000);
   return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):'';
  }
 }
 if(m){const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:'';}
 const parts=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
 if(!parts)return '';
 return isoDate(parts[3]+'-'+parts[2]+'-'+parts[1]);
}
function table(raw,required){
 if(!Array.isArray(raw)||!raw.length)throw Error('READBACK_TABLE_MISSING');
 if(raw[0]&&!Array.isArray(raw[0]))return raw;
 const headers=raw[0].map(text);
 if(required.some(key=>!headers.includes(key)))throw Error('READBACK_HEADERS_MISSING:'+required.join(','));
 return raw.slice(1).filter(r=>Array.isArray(r)&&r.some(v=>text(v))).map(r=>Object.fromEntries(headers.map((key,i)=>[key,r[i]])));
}
const LIFECYCLE_HEADERS=['booking_id','booking_status','payment_status','amount_received','return_status','file_transfer_status','drive_link'];
const VERIFIED_RETURN=new Set(['returned','complete','completed','done','yes','true']);
const VERIFIED_UPLOAD=new Set(['uploaded','complete','completed','done','yes','true']);
function amount(v){
 const s=text(v).replace(/,/g,'');
 if(!s)return 0;
 const n=Number(s);
 return Number.isFinite(n)&&n>=0?n:NaN;
}
function auditLifecycleEvidence(raw,bookings){
 const columns=new Set(Array.isArray(raw&&raw[0])?raw[0].map(text):Object.keys(raw&&raw[0]||{}));
 const missing=LIFECYCLE_HEADERS.filter(key=>!columns.has(key));
 if(missing.length)return {status:'NOT_VERIFIABLE_SCHEMA',missing_columns:missing,
  completed_total:null,completed_missing_proof:null,confirmed_unpaid_amount_ambiguous:null,
  cancelled_paid_review:null,gaps:[],warnings:[],
  safety:{production_writes:0,auto_complete:false,actual_revenue_status_rule:'completed_only'}};
 const gaps=[],warnings=[];
 let completed=0,ambiguous=0,cancelledPaid=0;
 for(const b of bookings){
  const st=text(b.booking_status).toLowerCase(),id=text(b.booking_id)||'UNKNOWN_BOOKING_ID';
  const pay=text(b.payment_status).toLowerCase(),money=amount(b.amount_received);
  if(st==='completed'){
   completed++;
   const failed=[];
   if(pay!=='paid')failed.push('PAYMENT_NOT_VERIFIED_PAID');
   if(!(money>0))failed.push('RECEIPT_AMOUNT_NOT_VERIFIED_POSITIVE');
   if(!VERIFIED_RETURN.has(text(b.return_status).toLowerCase()))failed.push('RETURN_NOT_VERIFIED');
   if(!VERIFIED_UPLOAD.has(text(b.file_transfer_status).toLowerCase()))failed.push('FILE_UPLOAD_NOT_VERIFIED');
   if(!/^https:\/\/(?:drive|docs)\.google\.com\//i.test(text(b.drive_link)))failed.push('GOOGLE_DRIVE_LINK_MISSING_OR_UNVERIFIED');
   if(failed.length)gaps.push({booking_id:id,missing_evidence:failed});
  }
  if(st==='confirmed'&&pay==='unpaid'&&money>0){
   ambiguous++;
   warnings.push({booking_id:id,reason:'CONFIRMED_UNPAID_AMOUNT_FIELD_IS_NOT_CASH_RECEIPT'});
  }
  if(st==='cancelled'&&pay==='paid'){
   cancelledPaid++;
   warnings.push({booking_id:id,reason:'CANCELLED_PAID_REFUND_RECONCILIATION_REQUIRED'});
  }
 }
 return {status:gaps.length||cancelledPaid?'EVIDENCE_GAPS_REVIEW_REQUIRED':'READ_ONLY_RECONCILED',
  completed_total:completed,completed_missing_proof:gaps.length,
  confirmed_unpaid_amount_ambiguous:ambiguous,cancelled_paid_review:cancelledPaid,
  gaps,warnings,
  safety:{production_writes:0,auto_complete:false,actual_revenue_status_rule:'completed_only'}};
}
function audit(input={}){
 const core=table(input.core_rows,['event_id','event_date','active_on_web']);
 const derived=table(input.web_ready_rows,['event_id','event_date_text','action_for_web','poster_image_url']);
 const bookings=table(input.booking_rows,['booking_status','event_id']);
 const lifecycleEvidence=auditLifecycleEvidence(input.booking_rows,bookings);
 const current=isoDate(input.as_of_date);
 if(!current)throw Error('AS_OF_DATE_REQUIRED');
 const byCore=new Map(),coreDuplicates=[],webDuplicates=[],byWeb=new Map();
 for(const e of core){const id=text(e.event_id);if(!id)continue;if(byCore.has(id)){coreDuplicates.push(id);continue;}byCore.set(id,e);}
 for(const e of derived){const id=text(e.event_id);if(!id)continue;if(byWeb.has(id)){webDuplicates.push(id);continue;}byWeb.set(id,e);}
 const locked=new Map(),unresolvedActiveBookings=[],bookingDateConflicts=[];
 for(const b of bookings){
  const status=text(b.booking_status).toLowerCase();
  if(!ACTIVE_BOOKING.has(status))continue;
  const eventId=text(b.event_id);
  const enteredDate=isoDate(b.event_date);
  const coreDate=isoDate(byCore.get(eventId)?.event_date);
  const webDate=isoDate(byWeb.get(eventId)?.event_date_text);
  if(enteredDate&&coreDate&&enteredDate!==coreDate){
   bookingDateConflicts.push({event_id:eventId,booking_date:enteredDate,core_date:coreDate,
    reason:'ACTIVE_BOOKING_DATE_CONFLICT'});
  }
  const date=enteredDate||coreDate||webDate;
  if(!date){unresolvedActiveBookings.push({event_id:eventId,booking_status:status,reason:'BOOKING_EVENT_DATE_UNRESOLVED'});continue;}
  const r=locked.get(date)||{date,active_bookings:0,related_event_ids:new Set()};
  r.active_bookings+=1;r.related_event_ids.add(eventId);locked.set(date,r);
 }
 const sourceDateConflicts=[];
 for(const [id,e] of byWeb){
  const counterpart=byCore.get(id);
  if(!counterpart)continue;
  const coreDate=isoDate(counterpart.event_date),webDate=isoDate(e.event_date_text);
  if(coreDate&&webDate&&coreDate!==webDate){
   sourceDateConflicts.push({event_id:id,core_date:coreDate,web_date:webDate,
    reason:'CORE_WEB_READY_DATE_MISMATCH'});
  }
 }
 const active=[...byCore.values()].filter(e=>truthy(e.active_on_web));
 const publicRows=[...byWeb.values()].filter(e=>SHOWN.has(text(e.action_for_web).toLowerCase()));
 const publicIds=new Set(publicRows.map(e=>text(e.event_id)));
 const coreActiveNotPublic=active.filter(e=>!publicIds.has(text(e.event_id))).map(e=>({
  event_id:text(e.event_id),event_date:isoDate(e.event_date),
  derived_action:text(byWeb.get(text(e.event_id))?.action_for_web)||'MISSING',
  classification:'CORE_ACTIVE_NOT_PUBLIC_REVIEW_ONLY'
 }));
 const publicCoreInactive=publicRows.filter(e=>!truthy(byCore.get(text(e.event_id))?.active_on_web)).map(e=>text(e.event_id));
 const publicUnverifiedDates=publicRows.filter(e=>{
  const row=byCore.get(text(e.event_id));
  return row&&text(row.data_health).toUpperCase().includes('SOURCE_DATE_UNVERIFIED');
 }).map(e=>({event_id:text(e.event_id),status:'HOLD_PUBLIC_DATE_NOT_OFFICIALLY_VERIFIED'}));
 const publicMissing=publicRows.filter(e=>!text(e.poster_image_url)).map(e=>({
  event_id:text(e.event_id),event_date:isoDate(e.event_date_text),
  status:'HOLD_CANONICAL_POSTER_MISSING'
 }));
 const publicTemporary=publicRows.filter(e=>temporaryPoster(e.poster_image_url)).map(e=>({
  event_id:text(e.event_id),event_date:isoDate(e.event_date_text),
  status:'HOLD_TEMP_BRAND_PLACEHOLDER_OFFICIAL_POSTER_REQUIRED'
 }));
 const publicFuture=publicRows.filter(e=>{const date=isoDate(e.event_date_text);return date&&date>=current;});
 const publicFutureLocked=publicFuture.filter(e=>locked.has(isoDate(e.event_date_text))).map(e=>({
  event_id:text(e.event_id),event_date:isoDate(e.event_date_text),reason:'BOOKING_DAY_LOCK'
 }));
 // A date with an existing confirmed/active booking can still expose non-booked
 // sold-out waitlist cards. Report separately: zero stock is NOT proof of a
 // second rentable phone, but the owner may want all other cards hidden.
 // Never infer authority to mutate derived visibility from this audit.
 const otherPublicOnBookedDates=publicFuture.filter(e=>{
  const lock=locked.get(isoDate(e.event_date_text));
  return lock&&!lock.related_event_ids.has(text(e.event_id));
 }).map(e=>{
  const date=isoDate(e.event_date_text),lock=locked.get(date);
  const phones=Number(e.available_phone_count||0),lens=Number(e.available_lens_count||0);
  const hasStock=Number.isFinite(phones)&&phones>0||Number.isFinite(lens)&&lens>0;
  return {event_id:text(e.event_id),event_date:date,action_for_web:text(e.action_for_web),
   booked_event_ids:[...lock.related_event_ids].sort(),
   available_phone_count:Number.isFinite(phones)?phones:null,
   available_lens_count:Number.isFinite(lens)?lens:null,
   classification:hasStock?'REVIEW_BOOKED_DATE_NONBOOKED_EVENT_WITH_STOCK':'REVIEW_BOOKED_DATE_NONBOOKED_EVENT_WAITLIST_ONLY'};
 });
 const publicUnknownDates=publicRows.filter(e=>!isoDate(e.event_date_text)).map(e=>text(e.event_id));
 const hasIntegrityRisk=sourceDateConflicts.length>0||bookingDateConflicts.length>0||
  publicUnknownDates.length>0||coreDuplicates.length>0||webDuplicates.length>0||publicCoreInactive.length>0||publicUnverifiedDates.length>0||
  otherPublicOnBookedDates.some(e=>e.classification==='REVIEW_BOOKED_DATE_NONBOOKED_EVENT_WITH_STOCK');
 const protectedDates=[...locked.values()].map(r=>({date:r.date,active_bookings:r.active_bookings,
  event_ids:[...r.related_event_ids].sort()})).sort((a,b)=>a.date.localeCompare(b.date));
 return {
  schema_version:VERSION,as_of_date:current,status:unresolvedActiveBookings.length?'READ_ONLY_AUDIT_WITH_UNRESOLVED_BOOKINGS':
   hasIntegrityRisk?'READ_ONLY_AUDIT_WITH_INTEGRITY_CONFLICTS':
   publicTemporary.length?'READ_ONLY_AUDIT_WITH_TEMPORARY_POSTERS':'READ_ONLY_AUDIT',
  counts:{core_active:active.length,effective_public_visible:publicRows.length,
   public_current_or_future:publicFuture.length,core_active_not_public:coreActiveNotPublic.length,
   public_missing_canonical_posters:publicMissing.length,
   public_temporary_brand_posters:publicTemporary.length,
   public_awaiting_official_posters:publicMissing.length+publicTemporary.length,
   public_future_on_booked_date:publicFutureLocked.length,
   public_other_events_on_booked_date:otherPublicOnBookedDates.length,
   public_other_events_on_booked_date_with_stock:otherPublicOnBookedDates.filter(e=>e.classification==='REVIEW_BOOKED_DATE_NONBOOKED_EVENT_WITH_STOCK').length,
   unresolved_active_booking_dates:unresolvedActiveBookings.length,
   source_date_conflicts:sourceDateConflicts.length,
   booking_date_conflicts:bookingDateConflicts.length,
   public_unresolved_event_dates:publicUnknownDates.length,
   public_unverified_source_dates:publicUnverifiedDates.length,
   owner_core_hidden_but_public:publicCoreInactive.length,
   core_duplicate_ids:coreDuplicates.length,web_duplicate_ids:webDuplicates.length},
  core_active_not_public:coreActiveNotPublic,
  public_missing_canonical_posters:publicMissing,
  public_temporary_brand_posters:publicTemporary,
  public_future_booked_date_locks:publicFutureLocked,
  public_other_events_on_booked_date:otherPublicOnBookedDates,
  protected_dates:protectedDates,
  booking_lifecycle_evidence:lifecycleEvidence,
  integrity:{public_core_inactive_ids:publicCoreInactive,core_duplicate_ids:coreDuplicates,web_duplicate_ids:webDuplicates,
   unresolved_active_booking_dates:unresolvedActiveBookings,
   source_date_conflicts:sourceDateConflicts,booking_date_conflicts:bookingDateConflicts,
   public_unresolved_event_date_ids:publicUnknownDates,
   public_unverified_source_dates:publicUnverifiedDates,
   booked_date_other_event_rentable_exposure_ids:otherPublicOnBookedDates.filter(e=>e.classification==='REVIEW_BOOKED_DATE_NONBOOKED_EVENT_WITH_STOCK').map(e=>e.event_id)},
  provenance:{core:'01_Events',derived:'08_Web_Ready',bookings:'00_Master_Booking'},
  safety:{production_writes:0,price_writes:0,poster_writes:0,auto_unhide:false,
   pricing_write_authorized:false,booking_changes:0,requires_live_verifier:true}
 };
}
module.exports={VERSION,SHOWN,ACTIVE_BOOKING,TEMP_BRAND_POSTER_URL,temporaryPoster,isoDate,table,audit,auditLifecycleEvidence};
