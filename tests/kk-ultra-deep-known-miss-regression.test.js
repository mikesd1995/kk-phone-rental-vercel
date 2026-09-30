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
 assert.equal(K.sameCase({title:'WeSpark official #bailu Bai Lu WeSpark Exclusive Overseas Fanmeeting'},{title:'MEET & LOVE BAI LU SPECIAL FANMEETING',aliases:['bailu wespark','bai lu special fanmeeting'],event_date:'2026-10-25'}),true);
 assert.equal(K.sameCase({title:'ปล่อยปลาฉลาม Meet TutorYim updated date'},{title:'TUTOR YIM',aliases:['tutor yim','ปล่อยปลาฉลาม'],event_date:'2026-10-18'}),true);
 assert.equal(K.sameCase({title:'FORTREASURE : BEYOND THE HORIZON CONCERT'},{title:'FORTREASURE BEYOND THE HORIZON CONCERT',aliases:['fortreasure concert'],event_date:'2026-11-29'}),true);
});

test('known-miss matching can use fetched page evidence text when page title is generic',()=>{
 const row={title:'Schedule',evidence_text:'30/09/2026 MIN MIN x TeeteePor : The Frozen Candy Land'};
 const caseRow=K.CORPUS.find(x=>x.case_id==='minmin-frozen-candy-20260930');
 assert.equal(K.sameCase(row,caseRow),true);
});

test('known-miss direct evidence seeds exist for independently verified historical misses',()=>{
 for(const id of ['remaster-20261010','pink-aura-20260928','sport-day-after-match-20261001','bai-lu-meet-love-20261025','fortreasure-20261129']){
   const row=K.CORPUS.find(x=>x.case_id===id);
   assert.ok(Array.isArray(row.seed_urls)&&row.seed_urls.length>0);
   assert.ok(row.seed_urls.every(x=>x.startsWith('https://')));
 }
});

test('source unavailable is not acceptance proof for a known miss',()=>{
 const candidates=K.CORPUS.slice(1).map((x,i)=>({title:x.title,event_date:x.event_date,source_url:'https://example.com/'+i}));
 const out=K.evaluate(candidates,[{case_id:'remaster-20261010',executed:true,status:'SOURCE_UNAVAILABLE'}]);
 assert.equal(out.complete,false);
 assert.ok(out.missing_cases.includes('remaster-20261010'));
});
