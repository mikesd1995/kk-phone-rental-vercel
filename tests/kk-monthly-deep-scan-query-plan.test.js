'use strict';const test=require('node:test');const assert=require('node:assert/strict');const P=require('../server/kk-monthly-deep-scan-query-plan.js');
test('next month resolves deterministically from supplied date',()=>{const r=P.build({current_date:'2026-09-28',location:'Bangkok Thailand'});assert.equal(r.range.month,'2026-10');assert.equal(r.range.start_date,'2026-10-01');assert.equal(r.range.end_date,'2026-10-31');assert.equal(new Set(r.gap_tasks.map(x=>x.source_tier)).size,21);assert.ok(r.gap_tasks.every(x=>x.date_window&&x.date_window.start==='2026-10-01'&&(x.campaign_lead_time?x.date_window.end==='2026-11-30':x.date_window.end==='2026-10-31')));assert.ok(r.gap_tasks.some(x=>x.query.includes('October 2026')));});
test('explicit month handles leap-year end date',()=>{assert.equal(P.monthRange({month:'2028-02'}).end_date,'2028-02-29');});

test('monthly plan expands named source universe beyond generic tier queries',()=>{
 const r=P.build({month:'2026-10',location:'Bangkok Thailand'});
 assert.ok(r.source_universe_task_count>=20);
 assert.ok(r.gap_tasks.some(x=>x.source_id==='eventpop'));
 assert.ok(r.gap_tasks.some(x=>x.source_id==='zipevent'));
 assert.ok(r.gap_tasks.some(x=>x.source_id==='iconsiam-hall'));
 assert.ok(r.gap_tasks.some(x=>x.source_id==='watsons-campaigns'));
 assert.ok(r.gap_tasks.filter(x=>x.source_id).every(x=>x.stop_condition==='EXECUTE_AND_RECORD_RECEIPT'));
});

test('generic monthly queries use natural month variants',()=>{
 const r=P.build({month:'2026-10',location:'Bangkok Thailand'});
 const generic=r.gap_tasks.find(x=>!x.source_id && x.source_tier==='OFFICIAL');
 assert.match(generic.query,/October 2026/);
 assert.ok(generic.query_variants.some(q=>/ตุลาคม 2569/.test(q)));
 assert.ok(generic.providers.includes('DDG_HTML'));
 assert.ok(generic.providers.includes('BING_HTML'));
});

test('monthly discovery includes bounded broad fallbacks when exact month queries return no search evidence',()=>{
 const r=P.build({month:'2026-10',location:'Bangkok Thailand'});
 const generic=r.gap_tasks.find(x=>!x.source_id && x.source_tier==='OFFICIAL');
 const all=[generic.query,...generic.query_variants];
 assert.ok(all.some(q=>q.endsWith(' Bangkok')));
 assert.ok(all.some(q=>q.endsWith(' Thailand')));
 assert.ok(all.includes(P.TIER_TERMS.OFFICIAL[0]));
 assert.equal(new Set(all).size,all.length);
});

test('smart operational query plan stays intentionally small and leaves exhaustive coverage to audit',()=>{
 const r=P.buildOperational({month:'2026-10',location:'Bangkok Metropolitan Region Thailand'});
 assert.equal(r.mode,'SMART_OPERATIONAL');
 assert.equal(r.gap_tasks.length,20);
 assert.equal(r.operational_tiers.length,20);
 assert.equal(r.audit_required,true);
 assert.ok(r.gap_tasks.every(x=>x.source_id.startsWith('smart-')));
 assert.ok(r.gap_tasks.every(x=>x.query_variants.length<=3));
 assert.ok(r.gap_tasks.some(x=>x.providers.includes('LIVENATION_PUBLIC')));
});


test('HOWE/MAYA award and red-carpet source tier cannot vanish from daily smart discovery',()=>{
 const monthly=P.build({month:'2026-10'});
 const smart=P.buildOperational({month:'2026-10'});
 const award=smart.gap_tasks.filter(t=>t.source_tier==='AWARD_RED_CARPET');
 assert.equal(award.length,1);
 assert.equal(award[0].source_id,'smart-award-red-carpet');
 assert.match(award[0].query,/HOWE Awards/);
 assert.match(award[0].query,/MAYA Awards/);
 assert.ok(award[0].query_variants.some(q=>/ประกาศรางวัล.*ตุลาคม 2569/.test(q)));
 assert.deepEqual(award[0].date_window,{start:'2026-10-01',end:'2026-10-31'});
 assert.ok(monthly.gap_tasks.some(t=>t.source_tier==='AWARD_RED_CARPET'&&/HOWE Awards/.test(t.query)));
 assert.equal(smart.verifier_required,true);
 assert.equal(smart.production_writes,0);
});


test('Showcase/Gallery/Series Mall tiers are present in both daily smart and monthly scan plans',()=>{
 for(const month of ['2026-10','2026-11','2026-12']){
  const full=P.build({month}),smart=P.buildOperational({month});
  for(const tier of ['MUSIC_SHOWCASE','FAN_PROJECT_GALLERY','MALL_IP_ACTIVATION']){
   assert.ok(full.required_tiers.includes(tier));
   assert.ok(smart.gap_tasks.some(t=>t.source_tier===tier));
   assert.equal(smart.gap_tasks.find(t=>t.source_tier===tier).query_variants.length,3);
   assert.ok(smart.gap_tasks.find(t=>t.source_tier===tier).query.includes(P.TIER_TERMS[tier][0]));
  }
  assert.equal(smart.production_writes,0);
  assert.equal(smart.audit_required,true);
 }
});
