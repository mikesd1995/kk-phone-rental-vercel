'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Access=require('../server/kk-ultra-deep-event-type-access.js');
const Prod=require('../server/kk-ultra-deep-production-runtime.js');
const Registry=require('../server/kk-ultra-deep-source-registry.js');
const snap=()=>({assets:[{asset_type:'phone',status:'available'},{asset_type:'phone',status:'available'}],bookings:[],events:[],web_ready:[],web_packages:[],visibility_locks:[]});
test('GMMTV first-episode stage event needs recording and lens rights',()=>{
 const event={title:'Lovers & Gangsters The Legend Begins',event_type:'TICKETED_FIRST_EP',event_date:'2026-10-30',venue:'Union Hall F6'};
 assert.equal(Access.category(event),'OFFLINE_PREMIERE');
 assert.equal(Access.evaluate(event).access_clearance,false);
 assert.equal(Prod.reconcileCandidates([event],snap()).safe_candidates.length,0);
 assert.equal(Access.category({title:'Lovers & Gangsters',poster_kind:'SERIES_KEY_VISUAL'}),'BROADCAST_ONLY');
});
test('PERSONA live tour cannot pass photo-rights gate on ticket evidence alone',()=>{
 const event={title:'PERSONA LIVE TOUR 2026 — Resonance',event_date:'2026-10-27',venue:'Cloud 11 Hall',official_event_source_verified:true};
 assert.equal(Access.category(event),'LIVE_TOUR');
 assert.equal(Access.evaluate(event).access_clearance,false);
 assert.ok(Access.evaluate(event).missing.includes('external_lens_rights'));
 assert.equal(Prod.reconcileCandidates([event],snap()).safe_candidates.length,0);
});
test('winner-only private event requires event-specific verified renter access and owner approval',()=>{
 const e={title:'EVERPINK A Touch of Love with TleFirstOne',event_type:'PRIVATE_LUCKY_FAN',event_date:'2026-10-22',venue:'Private brand event',in_person_activity_verified:true,official_event_source_verified:true,official_event_source_url:'https://www.everpink.com',phone_recording_allowed_verified:true,external_lens_allowed_verified:true,official_camera_policy_verified:true,official_camera_policy_url:'https://www.everpink.com/terms'};
 const p=Access.evaluate(e);
 assert.equal(p.category,'BRAND_PRIVATE_EVENT');
 assert.ok(p.missing.includes('verified_renter_entry_eligibility'));
 assert.ok(p.missing.includes('explicit_owner_private_event_approval'));
 assert.equal(Prod.reconcileCandidates([e],snap()).safe_candidates.length,0);
});
test('original sources have generic October first-episode, soundtrack and private-winner recovery queries',()=>{
 const p=Registry.buildUniversePlan({month:'2026-10'});
 for(const id of ['gmmtv','eventpop','brand-private-experience-campaigns']){const s=p.tasks.find(x=>x.source_id===id);assert.ok(s&&s.required,id);assert.ok(s.query_variants.length>6,id);}
});