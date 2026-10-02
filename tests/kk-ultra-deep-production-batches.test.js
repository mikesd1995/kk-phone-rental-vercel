'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const B=require('../scripts/kk-ultra-deep-production-batches.js');

test('builds one isolated production handoff per verified event',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kk-batches-'));
 const handoff={
  month:'2026-10',
  verifier:{verified_candidates:[
   {event_key:'A',title:'A Concert'},
   {event_key:'B',title:'B Fan Meeting'}
  ]},
  posters:[{event_key:'A',image_url:'https://img/a.jpg'},{event_key:'B',image_url:'https://img/b.jpg'}],
  competitor_prices:[{event_key:'A',price:690},{event_key:'B',price:790}]
 };
 const files=B.buildBatchFiles(handoff,dir);
 assert.equal(files.length,2);
 const a=JSON.parse(fs.readFileSync(files[0].file,'utf8'));
 assert.equal(a.verifier.verified_candidates.length,1);
 assert.equal(a.verifier.verified_candidates[0].event_key,'A');
 assert.deepEqual(a.posters.map(x=>x.event_key),['A']);
 assert.deepEqual(a.competitor_prices.map(x=>x.event_key),['A']);
});

test('aggregate sums verified writes and preserves partial blockers',()=>{
 const out=B.aggregate([
  {ok:true,result:{status:'COMPLETE',production_writes:1,counts:{total:1,created_verified:1},blockers:[],dispositions:[],acceptance:{complete:true}}},
  {ok:true,result:{status:'PARTIAL_SAFE_EXECUTION',production_writes:1,counts:{total:1,updated_verified:1},blockers:['AMBIGUOUS_EXISTING_EVENT_REVIEW'],dispositions:[{status:'HOLD_AMBIGUOUS_EXISTING'}],acceptance:{complete:false}}}
 ]);
 assert.equal(out.status,'PARTIAL_SAFE_EXECUTION');
 assert.equal(out.production_writes,2);
 assert.equal(out.counts.created_verified,1);
 assert.equal(out.counts.updated_verified,1);
 assert.deepEqual(out.blockers,['AMBIGUOUS_EXISTING_EVENT_REVIEW']);
});

test('aggregate is COMPLETE only when every batch completes',()=>{
 const out=B.aggregate([
  {ok:true,result:{status:'COMPLETE',production_writes:0,counts:{total:0},blockers:[],dispositions:[{status:'SKIPPED_BOOKING_DATE'}],acceptance:{complete:true}}},
  {ok:true,result:{status:'COMPLETE',production_writes:1,counts:{total:1,created_verified:1},blockers:[],dispositions:[],acceptance:{complete:true}}}
 ]);
 assert.equal(out.status,'COMPLETE');
 assert.equal(out.acceptance.complete,true);
 assert.equal(out.production_writes,1);
});
