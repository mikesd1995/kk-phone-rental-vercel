'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const K=require('../server/kk-ultra-deep-known-miss-regression.js');

const REQUIRED_CASE_IDS=['remaster-20261010', 'pink-aura-20260928', 'minmin-frozen-candy-20260930', 'sport-day-after-match-20261001', 'you-maniac-blind-date-20261003', 'bai-lu-meet-love-20261025', 'tutoryim-updated-20261018', 'scoopify-james-su-20261024', 'tle-firstone-20261022', 'ryo-teeteepor-20261007', 'the-weeknd-20261011', 'mindaryn-20261016', 'klive-bandage-20261017', 'meme-fest-20261017', '0wave-20261021', 'interstellar-live-20261028', 'pixxie-soundscape-20261030', 'nct127-redline-20261031', 'fortreasure-20261129'];

test('known-miss corpus preserves all nineteen historical discovery misses',()=>{
 assert.deepEqual(K.CORPUS.map(x=>x.case_id).sort(),[...REQUIRED_CASE_IDS].sort());
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
 assert.equal(K.sameCase({title:'WeSpark official #bailu Bai Lu WeSpark Exclusive Overseas Fanmeeting'},{title:'MEET & LOVE BAI LU SPECIAL FANMEETING',aliases:['bailu wespark','bai lu special fanmeeting'],event_date:'2026-10-25'}),true);
 assert.equal(K.sameCase({title:'ปล่อยปลาฉลาม Meet TutorYim updated date'},{title:'TUTOR YIM',aliases:['tutor yim','ปล่อยปลาฉลาม'],event_date:'2026-10-18'}),true);
 assert.equal(K.sameCase({title:'FORTREASURE : BEYOND THE HORIZON CONCERT'},{title:'FORTREASURE BEYOND THE HORIZON CONCERT',aliases:['fortreasure concert'],event_date:'2026-11-29'}),true);
});


test('evidence-grounded query hints are present for the three remaining live misses',()=>{
 const byId=new Map(K.CORPUS.map(x=>[x.case_id,x]));
 assert.ok(byId.get('scoopify-james-su-20261024').search_queries.includes('SCOOPIFYYogurtAndJamesSu SummerVibeTH'));
 assert.ok(byId.get('tle-firstone-20261022').search_queries.includes('EVERPINKxTleFirstone'));
 assert.ok(byId.get('fortreasure-20261129').search_queries.includes('FORTREASURE site:eventpop.me'));
});

test('deterministic fixture regression covers every required historical miss',()=>{
 const out=K.evaluateFixtureRegression();
 assert.equal(out.complete,true);
 assert.equal(out.passed,REQUIRED_CASE_IDS.length);
 assert.equal(out.proof_type,'DETERMINISTIC_HISTORICAL_FIXTURE');
});
