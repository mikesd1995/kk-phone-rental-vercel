'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const K=require('../server/kk-ultra-deep-known-miss-regression.js');

const REQUIRED_CASE_IDS=['remaster-20261010', 'pink-aura-20260928', 'minmin-frozen-candy-20260930', 'sport-day-after-match-20261001', 'you-maniac-blind-date-20261003', 'bai-lu-meet-love-20261025', 'tutoryim-updated-20261018', 'scoopify-james-su-20261024', 'tle-firstone-20261022', 'ryo-teeteepor-20261007', 'the-weeknd-20261011', 'mindaryn-20261016', 'klive-bandage-20261017', 'meme-fest-20261017', '0wave-20261021', 'interstellar-live-20261028', 'pixxie-soundscape-20261030', 'nct127-redline-20261031', 'fortreasure-20261129', 'sing-infinity-20261024', 'love-at-first-trip-20261108', 'elseve-auau-20261120', 'curel-auu-save-20261219', 'tops-beauty-schedule-20261001', 'mrfanboy-busking-20261011', 'teeheng-gen-of-us-20261024', 'gelboys-last-painting-20261122', 'dexx-labx-private-20261122', 'siam-halloween-20261030', 'siam-halloween-20261031', 'siam-halloween-20261101', 'jmnk-she-serve-20261121', 'firstone-8-7-showcase-20261019', 'auausave-gallery-20261101', 'auausave-gallery-20261102', 'grim-lover-fansign-20261118', 'scarlet-heart-premiere-20261104', 'khom-khlang-activation-20261029', 'khom-khlang-activation-20261030', 'khom-khlang-activation-20261031', 'khom-khlang-activation-20261101', 'lovers-gangsters-legend-begins-20261030', 'persona-live-tour-resonance-20261027'];

test('known-miss corpus preserves all forty-three current and historical discovery misses',()=>{
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

test('deterministic fixture regression validates every required case but not live recall',()=>{
 const out=K.evaluateFixtureRegression();
 assert.equal(out.complete,true);
 assert.equal(out.passed,REQUIRED_CASE_IDS.length);
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


test('miss corpus includes the owner-confirmed first-party showcase, gallery, fansign, premiere and mall activation as distinct dates',()=>{
 const byId=new Map(K.CORPUS.map(x=>[x.case_id,x]));
 for(const id of ['firstone-8-7-showcase-20261019','auausave-gallery-20261101','auausave-gallery-20261102','grim-lover-fansign-20261118','scarlet-heart-premiere-20261104','khom-khlang-activation-20261029','khom-khlang-activation-20261030','khom-khlang-activation-20261031','khom-khlang-activation-20261101'])assert.ok(byId.has(id),id);
 assert.ok(K.sameCase({title:'FirstOne 2nd Single 8/7 Showcase',event_date:'2026-10-19'},byId.get('firstone-8-7-showcase-20261019')));
 assert.equal(K.sameCase({title:'Scarlet Heart Thailand',event_date:'2026-11-04'},byId.get('scarlet-heart-premiere-20261104')),false);
 assert.equal(K.sameCase({title:'Journey of AuAuSave Gallery',event_date:'2026-11-01'},byId.get('auausave-gallery-20261102')),false);
 assert.equal(K.sameCase({title:'Khom Khlang Special Episode 5',event_date:'2026-10-29'},byId.get('khom-khlang-activation-20261029')),false);
});

test('strict live recall never treats the owner screenshot or absent original URL as direct-source evidence',()=>{
 const all=K.CORPUS.filter(x=>x.case_id==='firstone-8-7-showcase-20261019'||x.case_id==='auausave-gallery-20261102');
 const bad=K.evaluate(all.map(x=>({title:x.title,event_date:x.event_date})),[],{month:'2026-10',strict_live:true});
 for(const x of all)assert.ok(bad.missing_cases.includes(x.case_id));
 const nov=K.evaluate([],[],{month:'2026-11',strict_live:true});
 assert.ok(nov.missing_cases.includes('khom-khlang-activation-20261029'));
 assert.ok(nov.missing_cases.includes('auausave-gallery-20261101'));
});


test('Oct 27 PERSONA and Oct 30 GMMTV first-episode on-site premiere stay distinct from unrelated TV key art',()=>{
 const p=K.CORPUS.find(x=>x.case_id==='persona-live-tour-resonance-20261027');
 const l=K.CORPUS.find(x=>x.case_id==='lovers-gangsters-legend-begins-20261030');
 assert.equal(p.event_date,'2026-10-27');
 assert.equal(l.event_date,'2026-10-30');
 assert.equal(K.sameCase({title:'PERSONA LIVE TOUR 2026 - Resonance',event_date:'2026-10-27'},p),true);
 assert.equal(K.sameCase({title:'Lovers & Gangsters The Legend Begins',event_date:'2026-10-30'},l),true);
 assert.equal(K.sameCase({title:'หงเสนคลุกฝุ่น Lovers & Gangsters TV channel one31',event_date:'2026-10-30'},l),false);
 assert.equal(K.sameCase({title:'PERSONA LIVE TOUR 2026',event_date:'2026-10-30'},p),false);
 const out=K.evaluate([],[],{month:'2026-10',strict_live:true});
 assert.ok(out.missing_cases.includes(p.case_id));
 assert.ok(out.missing_cases.includes(l.case_id));
});
