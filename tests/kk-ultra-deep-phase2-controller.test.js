'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../server/kk-ultra-deep-phase2-controller.js');

test('verification gap feeds Learning V6 and recovery',()=>{
 const out=C.next({expected_candidate_count:1,expected_candidate_ids:['c1'],candidate_master_pool_frozen:true,production_writes:0,results:[{candidate_id:'c1',title:'Example',disposition:'VERIFY_REQUIRED',reason:'secondary evidence only',evidence:['https://example.com']} ]});
 assert.equal(out.status,'RECOVERY_REQUIRED');
 assert.ok(out.learning_misses.some(x=>x.miss_class==='SECONDARY_ONLY_VERIFICATION_GAP'));
 assert.ok(out.mandatory_expansion.includes('OFFICIAL_ARTIST_ORGANIZER_ESCALATION'));
});
test('complete verified pool stops for owner before phase 3',()=>{
 const out=C.next({expected_candidate_count:1,expected_candidate_ids:['c1'],candidate_master_pool_frozen:true,production_writes:0,results:[{candidate_id:'c1',title:'Example',disposition:'VERIFIED',evidence:['https://example.com']}]});
 assert.equal(out.status,'PHASE2_ACCEPTED');
 assert.equal(out.phase3_started,false);
 assert.equal(out.next_action,'STOP_AND_REPORT_READY_FOR_OWNER_PHASE3_APPROVAL');
});
test('incomplete pool fails closed',()=>{
 const out=C.next({expected_candidate_count:2,expected_candidate_ids:['c1','c2'],candidate_master_pool_frozen:true,production_writes:0,results:[{candidate_id:'c1',title:'Example',disposition:'VERIFIED',evidence:['https://example.com']}]});
 assert.ok(out.blockers.includes('CANDIDATE_DISPOSITION_INCOMPLETE'));
 assert.ok(out.blockers.includes('CANDIDATE_SET_MISMATCH'));
});
test('invalid disposition cannot be silently normalized',()=>{
 const out=C.next({expected_candidate_count:1,expected_candidate_ids:['c1'],candidate_master_pool_frozen:true,production_writes:0,results:[{candidate_id:'c1',title:'Example',disposition:'MAYBE',reason:'unknown',evidence:['https://example.com']}]});
 assert.ok(out.blockers.includes('INVALID_DISPOSITION'));
});
test('verified requires evidence',()=>{
 const out=C.next({expected_candidate_count:1,expected_candidate_ids:['c1'],candidate_master_pool_frozen:true,production_writes:0,results:[{candidate_id:'c1',title:'Example',disposition:'VERIFIED'}]});
 assert.ok(out.blockers.includes('VERIFIED_WITHOUT_EVIDENCE'));
});
test('bounded recovery stops with explicit unresolved list',()=>{
 const out=C.next({round:3,max_rounds:3,expected_candidate_count:1,expected_candidate_ids:['c1'],candidate_master_pool_frozen:true,production_writes:0,results:[{candidate_id:'c1',title:'Example',disposition:'VERIFY_REQUIRED',reason:'official source gap',evidence:['https://example.com']}]});
 assert.equal(out.status,'PHASE2_HOLD');
 assert.equal(out.unresolved.length,1);
 assert.equal(out.phase3_started,false);
});
