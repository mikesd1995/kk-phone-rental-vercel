'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Owner=require('../server/kk-ultra-deep-owner-core-lineage.js');
const Learning=require('../server/kk-ultra-deep-v2-learning-agent.js');
const ID='EVT-20261021-PANPURI-PHUTATCHAI-THAI-POPUP';
const TITLE='PAÑPURI LIMINAL CURRENTS HOLIDAY 2027 POP-UP — PHUTATCHAI | THAI';
const VENUE='Beacon 3, ชั้น 1, centralwOrld, Bangkok';
function fixture(){
 return {
  as_of:'2026-10-13T16:08:00+07:00',event_ids:[ID],
  events:[{event_id:ID,event_name:TITLE,event_date:'21/10/2026',venue:VENUE,
   active_on_web:'TRUE',poster_image_url:'https://drive.google.com/thumbnail?id=owner-image',
   event_note:'OWNER_EXPLICIT_ADD_2026-10-13_PRICE_490_590|invited guests only'}],
  web_ready:[{event_id:ID,event_name:TITLE,event_date_text:'21/10/2026',venue:VENUE,
   action_for_web:'show',available_phone_count:'2',available_lens_count:'2'}],
  web_packages:[
   {event_id:ID,package_type:'phone_only',price:'490',package_status:'available'},
   {event_id:ID,package_type:'lens_only',price:'0',package_status:'hidden'},
   {event_id:ID,package_type:'phone_lens_bundle',price:'590',package_status:'available'}
  ],
  visibility_locks:[{event_id:ID,lock_id:'LOCK|'+ID,lock_state:'SEEN_CORE',
   event_date:'46316',venue:VENUE,lock_reason:'OWNER_EXPLICIT_ADD_2026-10-13',source_evidence:'SOURCE_OWNER_IMAGE_2026-10-13'}],
  tracker_candidates:[],tracker_monthly:[],miss_learning:[],bookings:[]
 };
}
function addProposals(snapshot,plan){
 const proposals=plan.events[0].proposals;
 const q=proposals.find(p=>p.surface==='_Candidate_Queue');
 const m=proposals.find(p=>p.surface==='ต.ค. 2569');
 const l=proposals.find(p=>p.surface==='_Miss_Learning');
 if(q)snapshot.tracker_candidates.push({
  'Event Name / Keyword':TITLE,'Suspected Event Date':'21 ต.ค. 2569',
  'Suspected Venue':VENUE,Notes:q.note,Status:q.status
 });
 if(m)snapshot.tracker_monthly.push({
  'ชื่องาน':TITLE,'วันที่งานจัด':'21 ต.ค. 2569','สถานที่จัดงาน':VENUE,
  Status:m.status
 });
 if(l)snapshot.miss_learning.push({
  'Miss ID':l.miss_id,'Event Name':TITLE,'Event Date':'21/10/2026',
  Venue:VENUE,Notes:l.note,Status:l.status
 });
}
test('authoritative owner-added PAÑPURI Core is NOT missing, duplicate or scanner-discovered',()=>{
 const snapshot=fixture(),before=JSON.stringify(snapshot);
 const result=Owner.prepare(snapshot),event=result.events[0];
 assert.equal(result.status,'STAGED_REVIEW_ONLY');
 assert.equal(result.review_proposal_count,3);
 assert.deepEqual(event.missing_surfaces,['tracker_candidates','tracker_monthly','miss_learning']);
 assert.equal(event.core_exists,true);
 assert.equal(event.core_active_on_web,true);
 assert.equal(event.core_webready_action,'show');
 assert.equal(event.existing_core_packages,3);
 assert.equal(event.owner_provenance_confirmed,true);
 assert.equal(event.visibility_lock,'SEEN_CORE');
 assert.equal(event.active_booking_present,false);
 assert.equal(event.scanner_discovered,false);
 assert.equal(event.primary_source_verified,false);
 assert.equal(result.authority.may_create_core_event,false);
 assert.equal(result.authority.may_mark_miss_learned,false);
 assert.equal(result.authority.production_writes,0);
 assert.equal(JSON.stringify(snapshot),before);
 const candidate=event.proposals.find(x=>x.surface==='_Candidate_Queue');
 const learning=event.proposals.find(x=>x.surface==='_Miss_Learning');
 const monthly=event.proposals.find(x=>x.surface==='ต.ค. 2569');
 assert.equal(candidate.discovery_channel,'OWNER_REVERSE_CORE_NOT_SCANNER');
 assert.equal(candidate.discovery_source_url,null);
 assert.equal(candidate.status,'HOLD_OWNER_CORE_LINEAGE_REVIEW');
 assert.equal(learning.status,'PROPOSED_REVIEW_NOT_LEARNED');
 assert.equal(learning.training_eligible,false);
 assert.equal(learning.verified_scanner_failure,false);
 assert.equal(monthly.proposed_price,null);
 assert.equal(monthly.proposed_visibility,null);
});
test('repeated readback is deterministic and already-staged canonical rows do not duplicate',()=>{
 const snapshot=fixture(),first=Owner.prepare(snapshot);
 assert.deepEqual(first,Owner.prepare(snapshot));
 addProposals(snapshot,first);
 const again=Owner.prepare(snapshot);
 assert.equal(again.status,'ALREADY_RECONCILED');
 assert.equal(again.review_proposal_count,0);
 assert.deepEqual(again.events[0].missing_surfaces,[]);
 assert.equal(again.events[0].known_miss_can_be_auto_accepted,false);
});
test('partial reconciliation stages only missing surfaces',()=>{
 const snapshot=fixture();
 snapshot.tracker_candidates.push({'Event Name / Keyword':TITLE,
  'Suspected Event Date':'21 ต.ค. 2569','Suspected Venue':VENUE,Status:'HOLD'});
 const result=Owner.prepare(snapshot);
 assert.equal(result.review_proposal_count,2);
 assert.equal(result.events[0].lineage_found.tracker_candidates,1);
 assert.ok(result.events[0].proposals.every(x=>x.surface!=='_Candidate_Queue'));
});
test('duplicate Core IDs or duplicated canonical identity fail closed',()=>{
 const a=fixture();a.events.push({...a.events[0]});
 assert.ok(Owner.prepare(a).events[0].blockers.includes('CORE_DUPLICATE_EVENT_ID'));
 const b=fixture();b.events.push({...b.events[0],event_id:'EVT-DUPLICATE-SAME-IDENTITY'});
 assert.ok(Owner.prepare(b).events[0].blockers.includes('CORE_DUPLICATE_EVENT_IDENTITY'));
 assert.equal(Owner.prepare(b).review_proposal_count,0);
});
test('candidate identity conflict blocks rather than fuzzy joining a different venue/date',()=>{
 const snapshot=fixture();
 snapshot.tracker_candidates.push({'Event Name / Keyword':TITLE,'Suspected Event Date':'21 ต.ค. 2569',
  'Suspected Venue':'IMPACT Arena'});
 const p=Owner.prepare(snapshot);
 assert.ok(p.events[0].blockers.includes('IDENTITY_CONFLICT_TRACKER_CANDIDATES'));
 assert.equal(p.review_proposal_count,0);
 const other=fixture();
 other.tracker_candidates.push({'Event Name / Keyword':TITLE,'Suspected Event Date':'22 ต.ค. 2569',
  'Suspected Venue':VENUE});
 assert.equal(Owner.prepare(other).review_proposal_count,3,'different show dates cannot be merged');
});
test('explicit Core event ID with conflicting date is held and not considered lineage',()=>{
 const snapshot=fixture();
 snapshot.tracker_candidates.push({'Event Name / Keyword':TITLE,'Suspected Event Date':'22 ต.ค. 2569',
   'Suspected Venue':VENUE,Notes:'EXISTING_CORE_EVENT_ID='+ID+'; suspicious'});
 const result=Owner.prepare(snapshot);
 assert.equal(result.status,'HOLD_IDENTITY_OR_SAFETY_CONFLICT');
 assert.ok(result.events[0].blockers.includes('EXPLICIT_CORE_ID_CONFLICT_TRACKER_CANDIDATES'));
 assert.equal(result.review_proposal_count,0);
});
test('duplicate Tracker rows fail closed and never enqueue a third',()=>{
 const snapshot=fixture();
 const candidate={'Event Name / Keyword':TITLE,'Suspected Event Date':'21 ต.ค. 2569','Suspected Venue':VENUE};
 snapshot.tracker_candidates.push(candidate,{...candidate});
 const result=Owner.prepare(snapshot);
 assert.ok(result.events[0].blockers.includes('DUPLICATE_TRACKER_CANDIDATES'));
 assert.equal(result.review_proposal_count,0);
});
test('tombstone LOCKED and mismatching lock date stop reconciliation staging',()=>{
 const a=fixture();a.visibility_locks[0].lock_state='LOCKED';
 assert.ok(Owner.prepare(a).events[0].blockers.includes('OWNER_TOMBSTONE_LOCKED'));
 const b=fixture();b.visibility_locks[0].event_date='46317';
 assert.ok(Owner.prepare(b).events[0].blockers.includes('VISIBILITY_LOCK_IDENTITY_CONFLICT'));
 const c=fixture();c.visibility_locks=[];
 assert.ok(Owner.prepare(c).events[0].blockers.includes('VISIBILITY_LOCK_SNAPSHOT_MISMATCH'));
});
test('owner-hidden event is never auto-reopened, repriced, or published',()=>{
 const snapshot=fixture();
 snapshot.events[0].active_on_web='FALSE';
 snapshot.web_ready[0].action_for_web='hide';
 const result=Owner.prepare(snapshot);
 assert.equal(result.events[0].core_active_on_web,false);
 assert.equal(result.events[0].core_webready_action,'hide');
 assert.equal(result.authority.may_change_visibility,false);
 assert.equal(result.authority.may_change_price,false);
 assert.equal(result.events[0].proposals.find(x=>x.surface==='ต.ค. 2569').proposed_visibility,null);
});
test('active booking protects Core and draft never carries customer details',()=>{
 const snapshot=fixture();
 snapshot.bookings.push({booking_id:'PRIVATE-1',event_id:ID,booking_status:'confirmed',customer_name:'PRIVATE_CUSTOMER'});
 const result=Owner.prepare(snapshot);
 assert.equal(result.events[0].active_booking_present,true);
 assert.equal(JSON.stringify(result).includes('PRIVATE_CUSTOMER'),false);
 assert.equal(result.events[0].pricing_mutation,false);
 assert.equal(result.authority.backend_writes,0);
});
test('missing or corrupt source surfaces are HOLD, never treated as empty',()=>{
 const snapshot=fixture();delete snapshot.miss_learning;
 assert.equal(Owner.prepare(snapshot).status,'HOLD_MISSING_REQUIRED_INPUT');
 const noIds=fixture();noIds.event_ids=[];
 assert.equal(Owner.prepare(noIds).status,'HOLD_MISSING_REQUIRED_INPUT');
 const headers=sheetInput(fixture());headers.tracker_candidates_values[0]=['NOT_A_HEADER'];
 assert.equal(Owner.prepareFromSheets(headers).status,'HOLD_SNAPSHOT_HEADER_MISMATCH');
});
function sheetInput(f){
 function values(headers,rows){return [headers,...rows.map(x=>headers.map(k=>x[k]||''))];}
 return {
  event_ids:f.event_ids,as_of:f.as_of,
  events_values:values(['event_id','event_name','event_date','venue','active_on_web','event_note'],f.events),
  web_ready_values:values(['event_id','event_name','event_date_text','venue','action_for_web'],f.web_ready),
  web_packages_values:values(['event_id','package_type','price','package_status'],f.web_packages),
  visibility_locks_values:values(['lock_id','event_id','event_date','venue','lock_state','lock_reason'],f.visibility_locks),
  tracker_candidates_values:values(['Discovered At','Event Name / Keyword','Suspected Event Date','Suspected Venue','Notes'],f.tracker_candidates),
  tracker_monthly_values:[['KK Events'],[],[],['วันที่สแกนเจอ','วันที่งานจัด','ชื่องาน','สถานที่จัดงาน'],
    ...f.tracker_monthly.map(x=>['',x['วันที่งานจัด'],x['ชื่องาน'],x['สถานที่จัดงาน']])],
  miss_learning_values:values(['Miss ID','Event Name','Event Date','Venue','Notes'],f.miss_learning),
  bookings_values:values(['booking_id','event_id','booking_status'],f.bookings)
 };
}
test('actual Sheet header offsets decode a complete missing-lineage snapshot',()=>{
 const result=Owner.prepareFromSheets(sheetInput(fixture()));
 assert.equal(result.status,'STAGED_REVIEW_ONLY');
 assert.equal(result.review_proposal_count,3);
 assert.equal(result.events[0].event_id,ID);
 assert.equal(Owner.isoDate('21 ต.ค. 2569'),'2026-10-21');
 assert.equal(Owner.isoDate('46316'),'2026-10-21');
 assert.equal(Owner.isoDate('22 ต.ค. 2569'),'2026-10-22');
 assert.equal(Owner.isoDate('31/02/2026'),'');
 assert.equal(Owner.isoDate('2026-02-31'),'');
 assert.equal(Owner.normalize('PAÑPURI'),Owner.normalize('PANPURI'));
});
test('Learning Agent consumes proposed owner lineage without creating a verified scanner miss',()=>{
 const snapshot=fixture();
 const out=Learning.learn({owner_core_snapshot:snapshot});
 assert.equal(out.version,'KK_ULTRA_DEEP_V2_LEARNING_AGENT_V7');
 assert.equal(out.status,'OWNER_CORE_REVIEW_PENDING');
 assert.equal(out.owner_core_learning_accepted,false);
 assert.equal(out.owner_core_reconciliation.review_proposal_count,3);
 assert.equal(out.change_log.missed_events,0);
 assert.equal(out.change_log.owner_core_review_proposals,3);
 assert.equal(out.adaptive.query_terms.length,0);
 assert.equal(out.adaptive.miss_classes.length,0);
 assert.equal(out.authority.may_auto_write_tracker,false);
 assert.equal(out.authority.may_mark_owner_core_gap_as_verified_miss,false);
 assert.ok(out.recommendations.includes('OWNER_CORE_TRACKER_LINEAGE_GOVERNED_REVIEW_REQUIRED'));
 assert.equal(out.authority.production_writes,0);
});


test('owner lineage CLI explicitly refuses any write, update or deployment flags',()=>{
 const CLI=require('../scripts/kk-ultra-deep-owner-lineage-review.js');
 assert.deepEqual(CLI.parseArgs(['--snapshot-json','./snapshots/oct.json','--event-id',ID]),
  {'snapshot-json':'./snapshots/oct.json','event-id':ID});
 assert.throws(()=>CLI.parseArgs(['--write','true','--event-id',ID]),/READ_ONLY_FLAGS_ONLY/);
 assert.throws(()=>CLI.parseArgs(['--event-id',ID]),/EXPLICIT_INPUT_REQUIRED/);
});

test('Core/WebReady identity mismatches or already-closed event block owner lineage staging',()=>{
 const swapped=fixture();swapped.web_ready[0].event_name='Another artist fanmeet';
 assert.ok(Owner.prepare(swapped).events[0].blockers.includes('CORE_WEBREADY_MISMATCH'));
 const closed=fixture();closed.events[0].event_status='cancelled';
 assert.ok(Owner.prepare(closed).events[0].blockers.includes('CORE_EVENT_STATUS_NOT_OPEN'));
 const hidden=fixture();hidden.events[0].active_on_web='FALSE';
 assert.ok(Owner.prepare(hidden).events[0].blockers.includes('OWNER_HIDDEN_BUT_WEBREADY_VISIBLE'));
});
