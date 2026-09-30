'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const K=require('../server/kk-ultra-deep-known-miss-regression.js');

test('known-miss corpus contains ten historical discovery misses',()=>{
 assert.equal(K.CORPUS.length,10);
 assert.ok(K.CORPUS.some(x=>x.case_id==='remaster-20261010'));
 assert.ok(K.CORPUS.some(x=>x.case_id==='bai-lu-meet-love-20261025'));
 assert.ok(K.CORPUS.some(x=>x.case_id==='fortreasure-20261129'));
});

test('known-miss regression fails when a case is neither discovered nor classified',()=>{
 const candidates=K.CORPUS.slice(1).map((c,i)=>({title:c.title,event_date:c.event_date,source_url:'https://example.com/'+i}));
 const out=K.evaluate(candidates,[]);
 assert.equal(out.complete,false);
 assert.ok(out.missing_cases.includes('remaster-20261010'));
});

test('explicit executed classification is valid proof for a non-eligible known miss',()=>{
 const candidates=K.CORPUS.slice(1).map((c,i)=>({title:c.title,event_date:c.event_date,source_url:'https://example.com/'+i}));
 const out=K.evaluate(candidates,[{case_id:'remaster-20261010',executed:true,status:'NOT_ELIGIBLE'}]);
 assert.equal(out.complete,true);
});

test('known-miss alias matching accepts realistic social/search result titles',()=>{
 assert.equal(K.sameCase({title:'WeSpark official #bailu Bai Lu WeSpark Exclusive Overseas Fanmeeting',event_date:'2026-10-25'},{title:'MEET & LOVE BAI LU SPECIAL FANMEETING',aliases:['bailu wespark','bai lu special fanmeeting'],event_date:'2026-10-25'}),true);
 assert.equal(K.sameCase({title:'TutorYim updated fan activity',event_date:'2026-10-18'},{title:'TUTOR YIM',aliases:['tutor yim'],event_date:'2026-10-18'}),true);
 assert.equal(K.sameCase({title:'FORTREASURE : BEYOND THE HORIZON CONCERT',event_date:'2026-11-29'},{title:'FORTREASURE BEYOND THE HORIZON CONCERT',aliases:['fortreasure concert'],event_date:'2026-11-29'}),true);
});


test('evidence-grounded query hints are present for the three remaining live misses',()=>{
 const byId=new Map(K.CORPUS.map(x=>[x.case_id,x]));
 assert.ok(byId.get('scoopify-james-su-20261024').search_queries.includes('SCOOPIFYYogurtAndJamesSu SummerVibeTH'));
 assert.ok(byId.get('tle-firstone-20261022').search_queries.includes('EVERPINKxTleFirstone'));
 assert.ok(byId.get('fortreasure-20261129').search_queries.includes('FORTREASURE site:eventpop.me'));
});


test('dated known-miss cases reject candidates with missing or mismatched dates',()=>{
 const c=K.CORPUS.find(x=>x.case_id==='bai-lu-meet-love-20261025');
 assert.equal(K.sameCase({title:'WeSpark Bai Lu Special Fanmeeting'},c),false);
 assert.equal(K.sameCase({title:'WeSpark Bai Lu Special Fanmeeting',event_date:'2026-10-24'},c),false);
 assert.equal(K.sameCase({title:'WeSpark Bai Lu Special Fanmeeting',event_date:'2026-10-25'},c),true);
});

test('deterministic replay covers all ten historical matcher patterns',()=>{
 const out=K.replayRegression();
 assert.equal(out.complete,true);
 assert.equal(out.passed,10);
 assert.equal(out.fixture_count,10);
 assert.equal(out.deterministic,true);
 assert.equal(out.fixture_authority,'TEST_ONLY_NO_BUSINESS_TRUTH');
 assert.equal(out.production_writes,0);
});

test('deterministic replay fails when one fixture date is mutated',()=>{
 const fixtures=K.REPLAY_FIXTURES.map(x=>({...x}));
 fixtures[0].event_date='2026-10-11';
 const out=K.replayRegression(fixtures);
 assert.equal(out.complete,false);
 assert.ok(out.missing_cases.includes('remaster-20261010'));
});
