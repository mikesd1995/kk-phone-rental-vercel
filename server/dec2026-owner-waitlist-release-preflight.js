'use strict';

/**
 * Read-only exact-date owner-curation preflight for Happy BUSDAY 1 + 2 = 3.
 * Never writes Google Sheets, Admin, Booking, customer, inventory or Vercel.
 * Returns a proposed Admin updateEvent payload only when the exact live
 * read-only snapshot and independent production release gates agree.
 */
const {evaluateSnapshotTransition}=require('./event-visibility-owner-guard');

const TARGETS=Object.freeze([
  Object.freeze({date:'2026-12-05',event_id:'EVT-20261205-HAPPY-BUSDAY-1-2-3',poster_id:'1QwU7u1YqE6Bg2M36EpLF6MfrHbfWnoaP'}),
  Object.freeze({date:'2026-12-06',event_id:'EVT-20261206-HAPPY-BUSDAY-1-2-3',poster_id:'1w4S7FPokElqBgWppHOGeWUQGdK4dtXx-'})
]);
const PHONES=Object.freeze(['PHONE-001','PHONE-002']);
const ACTIVE_BOOKING_STATUSES=new Set(['pending','confirmed','prepared','picked_up']);
const GATES=Object.freeze([
  'independent_review_approved',
  'p0_booking_fail_closed_live_verified',
  'p0_zero_phone_plus_lens_show_full_live_verified',
  'deployed_gas_identity_verified',
  'owner_admin_authenticated',
  'customer_line_waitlist_e2e_verified',
  'exact_web_ready_and_package_readback_available',
  'poster_identity_visual_readback_verified',
  'production_release_authorized'
]);
const text=v=>String(v===null||v===undefined?'':v).trim();
const asBool=v=>v===true||['true','yes','1'].includes(text(v).toLowerCase());
const num=v=>{const raw=text(v).replace(/,/g,'');if(raw==='')return NaN;const n=Number(raw);return Number.isFinite(n)?n:NaN;};

function bookDate(booking,events){
  const event=events.find(x=>x.event_id===booking.event_id);
  const date=text(booking.event_date||booking.event_date_text||event&& (event.event_date||event.event_date_text));
  if(/^\d{4}-\d\d-\d\d$/.test(date))return date;
  const m=date.match(/^(\d\d)\/(\d\d)\/(\d{4})$/);
  if(m)return m[3]+'-'+m[2]+'-'+m[1];
  const id=text(booking.event_id).match(/^EVT-(20\d{2})(\d\d)(\d\d)-/);
  return id?id[1]+'-'+id[2]+'-'+id[3]:'';
}
function preflightBusWaitlist(snapshot={},releaseGates={}){
  const blockers=[];
  const rows=[];
  const events=Array.isArray(snapshot.events)?snapshot.events:[];
  const booking=Array.isArray(snapshot.bookings)?snapshot.bookings:[];
  const pkgs=Array.isArray(snapshot.web_packages)?snapshot.web_packages:[];
  const web=Array.isArray(snapshot.web_ready)?snapshot.web_ready:[];
  const locks=Array.isArray(snapshot.visibility_locks)?snapshot.visibility_locks:[];
  if(!events.length||!booking.length||!pkgs.length||!web.length||!locks.length){
    blockers.push('REQUIRED_LIVE_SNAPSHOT_MISSING');
  }
  for(const t of TARGETS){
    const key=t.event_id;
    const event=events.filter(x=>text(x.event_id)===key);
    const lock=locks.filter(x=>text(x.event_id)===key);
    const ready=web.filter(x=>text(x.event_id)===key);
    const packs=pkgs.filter(x=>text(x.event_id)===key);
    const item={date:t.date,event_id:key,booking_confirmation_allowed:false,expected_status:'เต็มแล้ว',expected_action:'show_full',available_phone_count:0};
    rows.push(item);
    if(event.length!==1||ready.length!==1||lock.length!==1){
      blockers.push(key+':EXACT_SOURCE_ID_MISSING_OR_DUPLICATE');continue;
    }
    const e=event[0],w=ready[0],l=lock[0];
    const canonicalDate=bookDate({event_id:key},events);
    if(canonicalDate!==t.date || text(e.event_name)!=='Happy BUSDAY 1 + 2 = 3' ||
       text(e.event_status||e.status).toLowerCase()!=='open' || text(e.data_health)!=='OK' ||
       !['false','0','no'].includes(text(e.active_on_web).toLowerCase())){
      blockers.push(key+':EVENT_SOURCE_NOT_EXACT_HIDDEN_HEALTHY');continue;
    }
    if(text(l.lock_state).toUpperCase()!=='LOCKED' ||
       !text(l.lock_reason||l.reason).includes('BOOKED_DAY_OTHER_EVENT_HIDE')){
      blockers.push(key+':OWNER_TOMBSTONE_NOT_EXPECTED');continue;
    }
    if(text(e.poster_image_url).indexOf(t.poster_id)<0){
      blockers.push(key+':EXISTING_POSTER_ID_CHANGED');continue;
    }
    if(bookDate({event_id:key,event_date_text:w.event_date_text||t.date},events)!==t.date||
       num(w.available_phone_count)!==0||text(w.action_for_web)!=='hide'){
      blockers.push(key+':WEB_READY_UNEXPECTED_BASELINE');continue;
    }
    const types=['phone_only','lens_only','phone_lens_bundle'];
    if(packs.length!==types.length || new Set(packs.map(p=>text(p.package_id))).size!==packs.length ||
       !types.every(type=>packs.filter(p=>text(p.package_type)===type).length===1) ||
       packs.some(p=>text(p.package_status).toLowerCase()!=='hidden') ||
       packs.some(p=>['phone_only','phone_lens_bundle'].includes(text(p.package_type)) && num(p.available_count)!==0)){
      blockers.push(key+':PACKAGES_MUST_BE_UNAVAILABLE_AND_HIDDEN');continue;
    }
    const taken=booking.filter(b=>ACTIVE_BOOKING_STATUSES.has(text(b.booking_status||b.status).toLowerCase())&&bookDate(b,events)===t.date);
    if(taken.some(b=>!PHONES.includes(text(b.phone_id||b.phone_asset_id)))){
      blockers.push(key+':BOOKED_DEVICE_ID_UNKNOWN');continue;
    }
    const phones=taken.map(b=>text(b.phone_id||b.phone_asset_id));
    if(phones.length!==PHONES.length || new Set(phones).size!==PHONES.length ||
       !PHONES.every(id=>phones.includes(id)) ||
       taken.some(b=>text(b.event_id)===key)){
      blockers.push(key+':DATE_SHARED_STOCK_NOT_EXACTLY_FULL_BY_OTHER_EVENTS');continue;
    }
    const payload={event_id:key,active_on_web:true,visibility_owner_intent:'explicit_owner_reopen'};
    const guard=evaluateSnapshotTransition(snapshot,payload);
    if(!guard.ok||!guard.owner_reopen||guard.code!=='OWNER_REOPEN_CONFIRMED_TOMBSTONE'){
      blockers.push(key+':OWNER_VISIBILITY_GUARD_NOT_ACCEPTED');continue;
    }
    item.proposed_admin_action={action:'updateEvent',payload};
  }
  for(const gate of GATES)if(releaseGates[gate]!==true)blockers.push('RELEASE_GATE_MISSING:'+gate);
  // Never emit even a partial executable Admin payload if ANY row or release gate fails.
  if(blockers.length)for(const item of rows)delete item.proposed_admin_action;
  // Even with all checks green, no service API is called here. An authenticated,
  // audited Admin executor must re-read actual date-wide stock before each write.
  return {
    status:blockers.length?'BLOCKED':'PROPOSAL_READY_FOR_GOVERNED_OWNER_ADMIN',
    production_writes:0,
    calls_performed:0,
    blockers,
    proposed_rows:rows,
    safe_to_execute_by_this_function:false,
    required_postwrite_readback:['01_Events','18_Event_Visibility_Locks','08_Web_Ready','09_Web_Packages','LINE waitlist browser E2E']
  };
}
module.exports={TARGETS,PHONES,GATES,preflightBusWaitlist};
