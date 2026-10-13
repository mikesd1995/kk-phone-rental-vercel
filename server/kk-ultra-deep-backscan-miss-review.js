'use strict';
// October 2026 backscan -> review proposals for existing _Miss_Learning.
// Pure, zero-write and never a substitute for source Verifier or real FULL receipts.
const Owner=require('./kk-ultra-deep-owner-core-lineage.js');
const VERSION='KK_ULTRA_DEEP_OCT_BACKSCAN_MISS_REVIEW_V1';
const BACKSCAN_CASES=Object.freeze([
 {case_id:'weeknd-boat-party-20261014',title:'THE WEEKND BOAT PARTY by ONLYUS',date:'2026-10-14',aliases:['THE WEEKND BOAT PARTY'],sources:['https://www.eventpop.me/e/174645'],source_tier:'TICKET_LISTING',lane:'TICKETED_SIDE_EVENT',rental_fit:'UNVERIFIED'},
 {case_id:'guerlain-blue-20261015',title:'BLUE PONGTIWAT — Guerlain Holiday Collection 2026',date:'2026-10-15',aliases:['BLUE PONGTIWAT @ Guerlain Holiday Collection 2026'],sources:['https://hoshilive.com/en/event/guerlain-holiday-collection-2026'],source_tier:'SECONDARY_AGGREGATOR',lane:'BRAND_ARTIST_APPEARANCE',rental_fit:'UNVERIFIED'},
 {case_id:'onitsuka-popup-20261015',title:'Onitsuka Tiger Pop-up — BLUE PONGTIWAT / PIMRAT',date:'2026-10-15',aliases:['Onitsuka Tiger Pop-up Central Embassy'],sources:['https://eveduler.com/province/bangkok'],source_tier:'CONFLICTING_SECONDARY_SCHEDULE',lane:'BRAND_ARTIST_APPEARANCE',venue_conflict:true,rental_fit:'UNVERIFIED'},
 {case_id:'melody-life17-20261016',title:'Melody Of Life 17 — Day 16',date:'2026-10-16',aliases:['Melody of Life 17 Day 16'],sources:['https://music.apple.com/th/playlist/wave-stage-melody-of-life-17/pl.c7fb2334ce194e57b0e034fe2aea3517','https://music.apple.com/th/playlist/sun-stage-melody-of-life-17/pl.bdd632d84afa46a9a6d4060a26147720'],source_tier:'ORGANIZER_STAGE_PLAYLIST',lane:'FREE_FESTIVAL_DAY_SPECIFIC_SCHEDULE',rental_fit:'UNVERIFIED'},
 {case_id:'kebdao-miu-20261019',title:'Miu Natsha — KEB DAO by Caltex Grand Opening',date:'2026-10-19',aliases:['Miu Natsha KEB DAO Caltex'],sources:['https://asiangl.com/event/miu-natsha-keb-dao-caltex-october-19-2026/'],source_tier:'SECONDARY_SCHEDULE_VENUE_CONFLICT',lane:'BRAND_ARTIST_APPEARANCE',venue_conflict:true,rental_fit:'UNVERIFIED'},
 {case_id:'howe-mable-20261020',title:'HOWE Awards 2026 — Mable & Pangjie appearance',date:'2026-10-20',sources:['https://www.bitec.co.th/event/howe-awards-2026-14th-anniversary'],source_tier:'VENUE_OFFICIAL_EVENT_NOT_FAN_ACCESS',lane:'PRIVATE_BRAND_AWARDS',rental_fit:'RESTRICTED'},
 {case_id:'everpink-tlefirstone-20261022',title:'EVERPINK A Touch of Love with TleFirstOne',date:'2026-10-22',sources:['https://www.beautynailhairsalons.com/TH/Bangkok/100505691409142/EVERPINK-COSMETICS'],source_tier:'BRAND_POST_MIRROR',lane:'LUCKY_FAN_BRAND_CAMPAIGN',rental_fit:'RESTRICTED'},
 {case_id:'lenamiu-eveandboy-20261026',title:'LenaMiu at EVEANDBOY The New Underground',date:'2026-10-26',sources:['https://asiangl.com/event/miu-natsha-eveandboy-new-underground-october-26-2026/'],source_tier:'SECONDARY_ARTIST_SCHEDULE',lane:'BRAND_ARTIST_APPEARANCE',rental_fit:'UNVERIFIED'},
 {case_id:'zato-blackbeans-20261026',title:'ZATO PRESENTS BASE 022 : Blackbeans SPECIAL SHOW',date:'2026-10-26',sources:['https://www.zipeventapp.com/e/volume-base-022'],source_tier:'TICKET_LISTING',lane:'TICKETING_EVENT',rental_fit:'UNVERIFIED'},
 {case_id:'persona-bangkok-20261027',title:'PERSONA LIVE TOUR 2026 — Resonance',date:'2026-10-27',aliases:['PERSONA LIVE TOUR 2026','PERSONA LIVE TOUR 2026 - Resonance'],sources:['https://www.eventpop.me/e/171450','https://cloud11bangkok.com/happenings/all-events/6abfbaeac51a82b625124598'],source_tier:'ORGANIZER_TICKET_AND_VENUE',lane:'TICKET_TO_CORE_HANDOFF',rental_fit:'PHOTO_POLICY_PENDING'},
 {case_id:'face-shop-teeteepor-20261030',title:'THE FACE SHOP Rice & Radiance Experience with TeeTeePor',date:'2026-10-30',sources:['https://www.thefaceshopthailand.com/index.php/','https://03-presentation.twstalker.com/thefaceshop_th'],source_tier:'BRAND_SITE_AND_INDEXED_BRAND_POST_NEEDS_DIRECT_EVENT_POST',lane:'BRAND_ARTIST_APPEARANCE',rental_fit:'UNVERIFIED'},
 {case_id:'lenamiu-plslove-20261030',title:'LenaMiu PLS Love Promotion (Oct 30)',date:'2026-10-30',sources:['https://asiangl.com/events/'],source_tier:'ARTIST_SCHEDULE',lane:'TV_BRAND_APPEARANCE',rental_fit:'UNVERIFIED'},
 {case_id:'siam-halloween-20261030',title:'SIAM HALLOWEEN 2026 — Flex 104.5 × PMCU',date:'2026-10-30',aliases:['Flex 104.5 PMCU SIAM HALLOWEEN 2026'],sources:['https://www.flexconnect.net/'],source_tier:'MEDIA_ORGANIZER',lane:'FREE_FESTIVAL',rental_fit:'UNVERIFIED'}
]);
const ACTIVE=new Set(['pending','confirmed','prepared','picked_up','returned','uploaded']);
function text(x){return String(x==null?'':x).trim();}
function norm(x){return text(x).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();}
function dateOf(x){
 const s=text(x);const strict=Owner.isoDate(s);if(strict)return strict;
 const iso=s.match(/^(\d{4}-\d{2}-\d{2})(?=\D|$)/);
 if(iso)return Owner.isoDate(iso[1]);
 const th=s.match(/^(\d{1,2}\s+(?:ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s+\d{4})/);
 if(th)return Owner.isoDate(th[1]);
 const en=s.match(/^(\d{1,2})\s+(Oct|October)\s+2026\b/i);
 return en?Owner.isoDate('2026-10-'+en[1].padStart(2,'0')):'';
}
function rowName(row={}){return text(row.event_name||row['Event Name / Keyword']||row['ชื่องาน']||row['Event Name']);}
function rowDate(row={}){return dateOf(row.event_date||row.event_date_text||row['Suspected Event Date']||row['วันที่งานจัด']||row['Event Date']);}
function matches(row={},c={}){
 const aliases=[c.title,...(c.aliases||[])].map(norm);
 return aliases.includes(norm(rowName(row)))&&rowDate(row)===c.date;
}
function missId(c){return 'MISS|OCTBACKSCAN|'+c.date.replace(/-/g,'')+'|'+c.case_id.toUpperCase();}
function review(input={}){
 const required=['events','web_ready','tracker_candidates','tracker_monthly','miss_learning','bookings','visibility_locks'];
 const absent=required.filter(k=>!Array.isArray(input[k]));
 const asOf=dateOf(input.as_of);
 const cases=Array.isArray(input.cases)?input.cases:BACKSCAN_CASES;
 if(absent.length||!asOf||!Array.isArray(cases))
  return {version:VERSION,status:'HOLD_INCOMPLETE_SNAPSHOT',missing_surfaces:absent,invalid_as_of:!asOf,cases:[],proposals:[],proposal_count:0,authority:{production_writes:0,may_write_tracker:false,may_mark_learned:false,may_publish:false}};
 const coreById=new Map(input.events.map(x=>[text(x.event_id),x]));
 const booked=new Set();
 let unresolvedActiveBookings=0;
 for(const b of input.bookings){
  if(!ACTIVE.has(text(b.booking_status).toLowerCase()))continue;
  const e=coreById.get(text(b.event_id));
  const date=e?dateOf(e.event_date):dateOf(b.event_date);
  if(date)booked.add(date);else unresolvedActiveBookings++;
 }
 for(const d of input.owner_exclusive_dates||[])if(dateOf(d))booked.add(dateOf(d));
 const processed=[];
 const proposals=[];
 const used=new Set();
 for(const c of cases){
  const id=text(c.case_id),date=dateOf(c.date);
  const valid=/^[a-z0-9][a-z0-9-]+$/.test(id)&&date.startsWith('2026-10-')&&text(c.title).length>5&&
   Array.isArray(c.sources)&&c.sources.length>0&&c.sources.every(x=>/^https:\/\/[^/\s]+/.test(text(x)))&&!used.has(id);
  if(!valid){
   processed.push({case_id:id,disposition:'HOLD_INVALID_OR_DUPLICATE_CASE',proposal:false});continue;
  }
  used.add(id);
  const matchCore=input.events.filter(x=>matches(x,c));
  const matchCandidate=input.tracker_candidates.filter(x=>matches(x,c));
  const matchMonthly=input.tracker_monthly.filter(x=>matches(x,c));
  const existingMiss=input.miss_learning.filter(x=>text(x['Miss ID'])===missId(c)||matches(x,c));
  let disposition='';
  let blocker='';
  const protectedDay=booked.has(date);
  const past=date<asOf;
  if(unresolvedActiveBookings){disposition='HOLD_UNRESOLVED_BOOKINGS';blocker='ACTIVE_BOOKING_DATE_UNRESOLVED';}
  else if(protectedDay){disposition='REPORT_ONLY_PROTECTED_BOOKING_DAY';blocker='BOOKING_DAY_EXCLUSIVITY';}
  else if(matchCore.length>1){disposition='HOLD_CORE_DUPLICATE_IDENTITY';blocker='DUPLICATE_CORE';}
  else if(matchCore.length===1){
   const core=matchCore[0],web=input.web_ready.find(x=>text(x.event_id)===text(core.event_id));
   const lock=input.visibility_locks.filter(x=>text(x.event_id)===text(core.event_id));
   disposition=lock.some(x=>text(x.lock_state).toUpperCase()==='LOCKED')?'EXISTING_CORE_OWNER_LOCKED':
    (text(web&&web.action_for_web)==='hide'||text(core.active_on_web).toUpperCase()==='FALSE')?
     'EXISTING_CORE_EFFECTIVE_HIDE':'EXISTING_CORE_ALREADY_PRESENT';
  }else if(past){disposition='REPORT_ONLY_PAST_DATE';blocker='HISTORICAL_EVENT';}
  else if(matchCandidate.length>1||matchMonthly.length>1){disposition='HOLD_DUPLICATED_TRACKER_IDENTITY';blocker='TRACKER_DUPLICATE';}
  else if(c.venue_conflict){disposition='HOLD_SOURCE_VENUE_CONFLICT';blocker='VENUE_PRIMARY_CONFLICT';}
  else if(matchCandidate.length||matchMonthly.length){
   disposition='TRACKER_TO_CORE_REVIEW';blocker='VERIFIER_AND_PHOTO_POLICY_REQUIRED';
  }else{disposition='DISCOVERY_REVIEW_NOT_IN_TRACKER';blocker='SCANNER_FAILURE_NOT_PROVEN';}
  const current={case_id:id,event_date:date,title:c.title,lane:c.lane||'UNKNOWN',
   disposition,blocked_reason:blocker,core_count:matchCore.length,
   candidate_count:matchCandidate.length,monthly_count:matchMonthly.length,
   prior_miss_count:existingMiss.length,protected_booking_day:protectedDay,
   source_primary_verified:false,training_eligible:false,may_create_core:false,may_publish:false,
   proposed_miss_id:missId(c),proposal:false};
  const reportOnly=disposition.startsWith('REPORT_ONLY_')||disposition.startsWith('EXISTING_CORE_')||
   disposition==='HOLD_INVALID_OR_DUPLICATE_CASE'||disposition==='HOLD_UNRESOLVED_BOOKINGS'||disposition==='HOLD_CORE_DUPLICATE_IDENTITY'||disposition==='HOLD_DUPLICATED_TRACKER_IDENTITY';
  if(!reportOnly&&!existingMiss.length){
   const reason=disposition==='TRACKER_TO_CORE_REVIEW'?'KNOWN_IN_TRACKER_NOT_IN_CORE':
    disposition==='HOLD_SOURCE_VENUE_CONFLICT'?'VENUE_CONFLICT_REVIEW':
     'UNVERIFIED_EXTERNAL_BACKSCAN_LEAD';
   proposals.push({
    'Miss ID':missId(c),'Detected At':text(input.as_of),'Event Name':c.title,'Event Date':date,
    'Venue':c.venue_conflict?'CONFLICT_HOLD':'UNVERIFIED',
    'Manual / Discovery Source':c.sources.join(' | '),
    'Miss Reason':reason,'Root Cause':'UNDETERMINED_AWAIT_SCANNER_AND_VERIFIER_RECEIPTS',
    'New Source / Alias':text(c.lane),'Registry Action':'REVIEW_ONLY_NO_AUTO_TRAIN',
    'Status':'PROPOSED_REVIEW_NOT_LEARNED','Learned At':'',
    'Notes':'CASE_ID='+id+'; source_tier='+text(c.source_tier)+'; booking_safe=true; primary_source_verified=false; scanner_failure_unproven=true; no_price/no_publish/no_auto_write'
   });
   current.proposal=true;
  }
  processed.push(current);
 }
 return {version:VERSION,status:'STAGED_REVIEW_ONLY',as_of:asOf,case_count:processed.length,
  reviewed_canonical_identities:processed.map(x=>x.case_id),
  booked_dates:[...booked].sort(),unresolved_active_bookings:unresolvedActiveBookings,
  cases:processed,proposals,proposal_count:proposals.length,
  authority:{production_writes:0,backend_writes:0,may_write_tracker:false,
   may_mark_learned:false,may_retrain:false,may_publish:false,may_modify_booking:false,
   may_modify_price:false,may_reopen_owner_hidden:false}};
}
module.exports={VERSION,BACKSCAN_CASES,dateOf,missId,matches,review};
