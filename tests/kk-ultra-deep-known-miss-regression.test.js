'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const K=require('../server/kk-ultra-deep-known-miss-regression.js');

test('known-miss corpus contains current and historical discovery misses',()=>{
 assert.ok(K.CORPUS.length>=25);
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

test('deterministic fixture regression validates matching only, not live recall',()=>{
 const out=K.evaluateFixtureRegression();
 assert.equal(out.complete,true);
 assert.equal(out.passed,K.CORPUS.length);
 assert.equal(out.proof_type,'DETERMINISTIC_HISTORICAL_FIXTURE');
});

test('month-scoped live recall fails closed with no evidence while synthetic fixture still passes',()=>{
 const fixture=K.evaluateFixtureRegression();
 const live=K.evaluate([],[],{month:'2026-10',strict_live:true});
 assert.equal(fixture.complete,true);
 assert.equal(live.complete,false);
 assert.ok(live.missing_cases.includes('tutoryim-updated-20261018'));
 assert.ok(live.missing_cases.includes('mrfanboy-busking-20261011'));
 assert.ok(live.missing_cases.includes('gelboys-last-painting-20261122'));
 assert.ok(live.missing_cases.includes('dexx-labx-private-20261122'));
 assert.ok(!live.missing_cases.includes('fortreasure-20261129'));
 assert.ok(!live.missing_cases.includes('curel-auu-save-20261219'));
});
test('strict live known-miss classification requires sourced proof; SOURCE_UNAVAILABLE is not a pass',()=>{
 const f=K.CORPUS.find(x=>x.case_id==='gelboys-last-painting-20261122');
 const rows=[{title:f.title,event_date:f.event_date}];
 const u=K.evaluate(rows,[{case_id:f.case_id,executed:true,status:'SOURCE_UNAVAILABLE'}],{month:'2026-10',strict_live:true});
 assert.ok(u.missing_cases.includes(f.case_id));
 const proof=K.evaluate([{...rows[0],source_url:'https://www.sotwe.com/looke_world'}],[],{month:'2026-10',strict_live:true});
 assert.ok(!proof.missing_cases.includes(f.case_id));
});

test('live proof rejects title-only recurrence without exact event date',()=>{
 const c=K.CORPUS.find(x=>x.case_id==='mrfanboy-busking-20261011');
 const missing=K.evaluate([{title:c.title,source_url:'https://x.com/official/status/100'}],[],{month:'2026-10',strict_live:true});
 assert.ok(missing.missing_cases.includes(c.case_id));
 const old=K.evaluate([{title:c.title,event_date:'2026-09-13',source_url:'https://x.com/official/status/100'}],[],{month:'2026-10',strict_live:true});
 assert.ok(old.missing_cases.includes(c.case_id));
 const current=K.evaluate([{title:c.title,event_date:c.event_date,source_url:'https://x.com/official/status/101'}],[],{month:'2026-10',strict_live:true});
 assert.ok(!current.missing_cases.includes(c.case_id));
});

test('Siam Halloween cross-month campaign requires three distinct event-date receipts',()=>{
 const ids=['siam-halloween-20261030','siam-halloween-20261031','siam-halloween-20261101'];
 const nov=K.evaluate([],[],{month:'2026-11',strict_live:true});
 for(const id of ids) assert.ok(nov.missing_cases.includes(id),id);
 const one=K.CORPUS.find(x=>x.case_id===ids[2]);
 const hit={title:one.title,event_date:'2026-11-01',source_url:'https://www.flexconnect.net/category/article/entertainment/'};
 const subset=K.evaluate([hit],[],{month:'2026-11',strict_live:true});
 assert.ok(!subset.missing_cases.includes(ids[2]));
 assert.ok(subset.missing_cases.includes(ids[0]));
 assert.ok(subset.missing_cases.includes(ids[1]));
 const oct=K.evaluate([],[],{month:'2026-10',strict_live:true});
 assert.ok(oct.missing_cases.includes(ids[2]));
});

test('JMNK Oct ticket sale and November concert are both in November discovery obligations',()=>{
 const n=K.evaluate([],[],{month:'2026-11',strict_live:true});
 const o=K.evaluate([],[],{month:'2026-10',strict_live:true});
 assert.ok(n.missing_cases.includes('jmnk-she-serve-20261121'));
 assert.ok(o.missing_cases.includes('jmnk-she-serve-20261121'));
});
