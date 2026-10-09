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
 const candidates=K.CORPUS.filter(c=>c.case_id!=='remaster-20261010').map((c,i)=>({title:c.title,event_date:c.event_date,source_url:'https://example.com/'+i}));
 const out=K.evaluate(candidates,[]);
 assert.equal(out.complete,false);
 assert.ok(out.missing_cases.includes('remaster-20261010'));
});

test('explicit executed classification is valid proof for a non-eligible known miss',()=>{
 const candidates=K.CORPUS.filter(c=>c.case_id!=='remaster-20261010').map((c,i)=>({title:c.title,event_date:c.event_date,source_url:'https://example.com/'+i}));
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


test('October 21/23/25 brand-event misses are required even when old deterministic fixtures pass',()=>{
 const ids=['herhyness-lingling-20261021','cathydoll-orm-20261023','nars-teeteepor-20261025'];
 const live=K.evaluate([],[],{month:'2026-10',strict_live:true});
 for(const id of ids){
  assert.ok(K.CORPUS.some(x=>x.case_id===id),id);
  assert.ok(live.missing_cases.includes(id),id);
 }
 assert.equal(K.evaluateFixtureRegression().complete,true);
});

test('October brand recall requires an exact day and URL, not a generic brand campaign announcement',()=>{
 const f=K.CORPUS.find(x=>x.case_id==='herhyness-lingling-20261021');
 const missing=K.evaluate([{title:f.title,event_date:'2026-09-16',source_url:'https://www.herhynessbeauty.com/'}],[],{month:'2026-10',strict_live:true});
 assert.ok(missing.missing_cases.includes(f.case_id));
 const discovered=K.evaluate([{title:f.title,event_date:'2026-10-21',source_url:'https://www.herhynessbeauty.com/blogs/blog-the-clean-side/her-hyness-x-lingling-kwong-unlock-the-ultimate-protection-campaign'}],[],{month:'2026-10',strict_live:true});
 assert.ok(!discovered.missing_cases.includes(f.case_id));
 // Known-miss discovery receipt does not qualify a listing for governed storefront publication.
 assert.equal(discovered.production_writes,0);
});


test('October second-pass date-level discovery recall includes nine new independent misses',()=>{
 const ids=[
  'daouoffroad-added-show-20261031','mindy-shoot-your-shot-20261029',
  'sns-ear-candy-fansign-20261031','miu-caltex-kebdao-20261019',
  'lena-dolce-italia-20261012','le7el-debut-20261015',
  'pop-pah-halloween-20261030','endless-us-vol1-20261017',
  'vvv-tornado-shopping-20261025'
 ];
 const live=K.evaluate([],[],{month:'2026-10',strict_live:true});
 for(const id of ids){
  assert.ok(K.CORPUS.some(x=>x.case_id===id),id);
  assert.ok(live.missing_cases.includes(id),id);
 }
 assert.equal(K.evaluateFixtureRegression().complete,true);
});
test('DaouOffroad extra day is separate; existing October 30 round cannot satisfy October 31 live recall',()=>{
 const source='https://event.thaiticketmajor.com/venue/central-world-live-central-world.html';
 const title='DAOUOFFROAD HALLOWEEN FAN PARTY 2026';
 const previous=K.evaluate([{title,event_date:'2026-10-30',source_url:source}],[],{month:'2026-10',strict_live:true});
 assert.ok(previous.missing_cases.includes('daouoffroad-added-show-20261031'));
 const newDay=K.evaluate([{title,event_date:'2026-10-31',source_url:source}],[],{month:'2026-10',strict_live:true});
 assert.ok(!newDay.missing_cases.includes('daouoffroad-added-show-20261031'));
 assert.equal(newDay.production_writes,0);
});


test('October third external-first sweep requires exact dates for six confirmed category leads',()=>{
 const ids=[
  'vvv-tornado-busking-20261014','viral-hits-spotlight-20261017',
  'paseo-pop-stage-20261017','idol-live-stage-20261024',
  'af-halloween-afterlife-20261030',
  'tday-music-playground-20261031'
 ];
 const src=K.CORPUS.filter(x=>ids.includes(x.case_id));
 assert.equal(src.length,6);
 for(const row of src){
  const wrongDate='2026-09-'+row.event_date.slice(-2);
  const miss=K.evaluate([{title:row.title,event_date:wrongDate,source_url:'https://popradar.app/events'}],[],{month:'2026-10',strict_live:true});
  assert.ok(miss.missing_cases.includes(row.case_id),row.case_id);
  const seen=K.evaluate([{title:row.title,event_date:row.event_date,source_url:'https://popradar.app/events'}],[],{month:'2026-10',strict_live:true});
  assert.ok(!seen.missing_cases.includes(row.case_id),row.case_id);
  assert.equal(seen.production_writes,0);
 }
 assert.equal(K.evaluateFixtureRegression().complete,true);
});
test('new small-idol and public award misses force named source expansion in Learning Agent',()=>{
 const Learning=require('../server/kk-ultra-deep-v2-learning-agent.js');
 const learned=Learning.learn({missed_events:[
  {miss_class:'SMALL_IDOL_BUSKING_DATE_GAP',query_terms:['VVV CentralWorld'],source:'PopRadar'},

  {miss_class:'PUBLIC_AWARD_FANDOM_ROSTER_GAP',query_terms:['Viral Hits Spotlight'],source:'PopRadar'}
 ]});
 assert.ok(learned.adaptive.mandatory_expansion.includes('PUBLIC_AWARD_LINEUP'));

 assert.ok(learned.adaptive.query_terms.some(q=>q.includes('VVV Tornado Busking')));
 assert.equal(learned.authority.production_writes,0);
});

test('third-party Halloween nightlife listing does not become a required fandom rental miss',()=>{
 assert.equal(K.CORPUS.some(x=>x.case_id==='sapphic-vampireliar-20261024'),false);
 const Learning=require('../server/kk-ultra-deep-v2-learning-agent.js');
 const learned=Learning.learn({missed_events:[
  {miss_class:'SAPPHIC_INDEPENDENT_FANDOM_EVENT_GAP',source:'nightclub event listing',
   event_name:'Sapphic Vampire Lair Halloween'}
 ]});
 assert.ok(!learned.adaptive.mandatory_expansion.includes('SAPPHIC_FANDOM_EVENT'));
 assert.equal(learned.authority.production_writes,0);
});


test('Beauty Buffet LIPTOK x AUAUSAVE Oct9 is a mandatory named brand-fandom known miss',()=>{
 const id='beautybuffet-liptok-auausave-20261009';
 const row=K.CORPUS.find(c=>c.case_id===id);
 assert.ok(row,'missing August-announced October brand activation must remain in regression');
 assert.equal(row.event_date,'2026-10-09');
 assert.equal(row.miss_class,'BRAND_ARTIST_LUCKY_FAN_LEAD_TIME_GAP');
 assert.ok(row.search_queries.some(q=>q.includes('BeautyBuffetTH')));
 assert.ok(row.search_queries.some(q=>q.includes('25 August')));
 const source='https://www.lemon8-app.com/%40beautybuffet_th/7677921730569159176?region=th';
 const live=K.evaluate([],[],{month:'2026-10',strict_live:true});
 assert.ok(live.missing_cases.includes(id));
 const wrongDay=K.evaluate([{title:'Beauty Buffet LIPTOK Event x AUAUSAVE',event_date:'2026-10-08',source_url:source}],[],{month:'2026-10',strict_live:true});
 assert.ok(wrongDay.missing_cases.includes(id),'different event date is not event-day confirmation');
 const recovered=K.evaluate([{title:'AUAUSAVE MHIIPRAEW AT LIPTOK EVENT',event_date:'2026-10-09',source_url:source}],[],{month:'2026-10',strict_live:true});
 assert.ok(!recovered.missing_cases.includes(id),'official date + recognised alias must be counted');
 assert.equal(recovered.production_writes,0);
 assert.equal(K.evaluateFixtureRegression().complete,true,'fixture is only a matching test, not live proof');
});


test('Beauty Buffet branded August-announcement miss expands official campaign and artist-schedule pivots',()=>{
 const Learning=require('../server/kk-ultra-deep-v2-learning-agent.js');
 const out=Learning.learn({missed_events:[{
  miss_class:'BRAND_ARTIST_LUCKY_FAN_LEAD_TIME_GAP',
  event_name:'Beauty Buffet LIPTOK Event x AUAUSAVE',event_date:'2026-10-09',
  brand:'Beauty Buffet',artists:['AuAuSave','MhiiPraew'],month:'2026-10',
  source:'BeautyBuffetTH brand announcement',query_terms:['BeautyBuffetLiptokEventxAUAUSAVE']
 }]});
 assert.ok(out.adaptive.mandatory_expansion.includes('BRAND_OFFICIAL_SOCIAL'));
 assert.ok(out.adaptive.mandatory_expansion.includes('CAMPAIGN_LEAD_TIME_NEXT_MONTH'));
 assert.ok(out.adaptive.mandatory_expansion.includes('BEAUTY_BRAND_ACTIVATION_PREVIOUS_MONTH_ANNOUNCEMENT'));
 assert.ok(out.adaptive.query_terms.some(x=>x.includes('Beauty Buffet AuAuSave')));
 assert.ok(out.adaptive.query_terms.some(x=>x.includes('previous month')));
 assert.equal(out.authority.production_writes,0);
});

test('November seven known-miss cases include four brand lanes and all four distinct LOLLI days',()=>{
 const nov=K.CORPUS.filter(c=>c.event_date.startsWith('2026-11'));
 const ids=['senka-junior-20261106','loreal-elseve-auau-20261120',
  'lolli-mew-20261126','lolli-jamessu-20261127','lolli-bevertonliew-20261128',
  'lolli-emibonnie-20261129','d7-nunew-20261129'];
 for(const id of ids)assert.ok(nov.some(c=>c.case_id===id),id);
 assert.equal(new Set(nov.map(c=>c.case_id)).size,nov.length);
 const input=K.evaluate([],[],{month:'2026-11',strict_live:true});
 assert.equal(input.complete,false);
 for(const id of ids)assert.ok(input.missing_cases.includes(id),id);
 const oct=K.evaluate([],[],{month:'2026-10',strict_live:true});
 for(const id of ids)assert.ok(!oct.missing_cases.includes(id));
 const fixtures=K.evaluateFixtureRegression();
 assert.equal(fixtures.complete,true,'fixtures match dates but cannot certify live scan');
 assert.equal(fixtures.proof_type,'DETERMINISTIC_HISTORICAL_FIXTURE');
 assert.equal(fixtures.production_writes,0);
});
