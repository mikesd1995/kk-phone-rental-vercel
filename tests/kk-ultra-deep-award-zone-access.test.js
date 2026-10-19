'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Access=require('../server/kk-ultra-deep-award-zone-access.js');
const Adapter=require('../server/kk-ultra-deep-v2-runtime-adapter.js');

const howe={
 event_key:'howe-awards-20261020',title:'HOWE Awards 2026 — Mable & Pangjie',
 event_date:'2026-10-20',venue:'BITEC Grand Hall 201-203',
 vote_end_date:'2026-08-09',ceremony_invitation_only:true,
 competitor_rental_activity:100,social_engagement:100,ticket_demand:100,
 fandom_photo_intent:100,venue_capture_value:100,historical_market_rental:100
};
const snapshot={assets:[{asset_type:'phone',status:'ready'}],bookings:[],events:[],web_ready:[],web_packages:[],visibility_locks:[]};
const officialAccess={
 red_carpet_public_access_verified:true,
 official_access_source_url:'https://www.bitec.co.th/event/howe-awards-2026-14th-anniversary',
 verified_official_access_source:true
};
const officialPhoto={
 phone_photography_allowed_verified:true,external_lens_allowed_verified:true,
 official_camera_rules_source_url:'https://howemagazine.com/verified-camera-rules',
 verified_official_camera_rules_source:true
};
// URLs in test fixtures are synthetic evidence fields, not claims that these rules have been published.
test('award/red-carpet detection covers HOWE Thai award and ignores generic concerts',()=>{
 assert.equal(Access.isAwardLike(howe),true);
 assert.equal(Access.isAwardLike({title:'งานประกาศรางวัลและพรมแดง'}),true);
 assert.equal(Access.isAwardLike({title:'0WAVE Live in Bangkok'}),false);
});
test('HOWE public red carpet is separate from private ceremony and still held for missing camera policy',()=>{
 const a=Access.evaluate({...howe,...officialAccess});
 assert.equal(a.zone,'PUBLIC_RED_CARPET');
 assert.equal(a.ceremony_access_authorized,false);
 assert.equal(a.access_clearance,false);
 assert.ok(a.missing.includes('phone_photography_allowed'));
 assert.ok(a.missing.includes('external_lens_allowed'));
 assert.equal(a.decision,'VERIFY_ACCESS');
});
test('unverified or forged source never grants red carpet photo/lens clearance',()=>{
 const a=Access.evaluate({...howe,...officialAccess,...officialPhoto,official_camera_rules_source_url:'http://localhost/x'});
 assert.equal(a.access_clearance,false);
 assert.ok(a.missing.includes('official_camera_rules_source'));
 const b=Access.evaluate({...howe,...officialAccess,...officialPhoto,owner_hidden:true});
 assert.equal(b.access_clearance,false);
 assert.ok(b.missing.includes('not_owner_blocked'));
});
test('non-award public event stays subject to ordinary rentability policy only',()=>{
 assert.equal(Access.evaluate({title:'CONCERT IN BANGKOK'}).decision,'NOT_APPLICABLE');
 assert.equal(Access.evaluate({title:'CONCERT IN BANGKOK'}).production_writes,0);
});
test('runtime adapter never plans HOWE publication from demand score while photo/lens rules unknown',()=>{
 const out=Adapter.buildReadOnlyPlan({month:'2026-10',snapshot,candidates:[{...howe,...officialAccess}]});
 assert.equal(out.selected_count,0);
 assert.equal(out.excluded_count,1);
 assert.equal(out.excluded[0].decision,'VERIFY_ACCESS');
 assert.equal(out.excluded[0].award_access.zone,'PUBLIC_RED_CARPET');
 assert.equal(out.excluded[0].award_access.ceremony_access_authorized,false);
 assert.equal(out.plan.planned_mutation_count,0);
 assert.equal(out.production_writes,0);
});
test('completely verified access only removes access hold; still retains pricing/poster and owner publishing gates',()=>{
 const out=Adapter.buildReadOnlyPlan({month:'2026-10',snapshot,candidates:[{...howe,...officialAccess,...officialPhoto}]});
 assert.equal(out.selected_count,1);
 assert.equal(out.excluded_count,0);
 assert.equal(out.production_writes,0);
 assert.equal(out.plan.status!==undefined,true);
});
test('zero inventory outranks access review even with public red-carpet permission',()=>{
 const x=Adapter.normalizeCandidate({...howe,...officialAccess}, {...snapshot,assets:[]});
 assert.equal(x.rentability.decision,'NO_CAPACITY');
 assert.equal(x.award_access.access_clearance,false);
});
test('the 9 August vote deadline never becomes the 20 October event date',()=>{
 const x=Adapter.normalizeCandidate({...howe,...officialAccess},snapshot);
 assert.equal(x.event_date,'2026-10-20');
 assert.equal(x.award_access.decision,'VERIFY_ACCESS');
});

test('the Smart Operational scanner actually plans HOWE award queries in Thai and English',()=>{
 const Query=require('../server/kk-monthly-deep-scan-query-plan.js');
 const plan=Query.buildOperational({month:'2026-10'});
 const awards=plan.gap_tasks.filter(x=>x.source_tier==='AWARD_RED_CARPET');
 assert.equal(awards.length,1);
 assert.equal(awards[0].source_id,'smart-award-red-carpet');
 assert.match(awards[0].query,/HOWE Awards/);
 assert.ok(awards[0].query_variants.some(q=>q.includes('ประกาศรางวัล')&&q.includes('ตุลาคม 2569')));
 assert.equal(plan.production_writes,0);
 assert.equal(plan.verifier_required,true);
});
