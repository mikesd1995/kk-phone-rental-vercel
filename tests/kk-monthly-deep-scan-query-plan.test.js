'use strict';const test=require('node:test');const assert=require('node:assert/strict');const P=require('../server/kk-monthly-deep-scan-query-plan.js');
test('next month resolves deterministically from supplied date',()=>{const r=P.build({current_date:'2026-09-28',location:'Bangkok Thailand'});assert.equal(r.range.month,'2026-10');assert.equal(r.range.start_date,'2026-10-01');assert.equal(r.range.end_date,'2026-10-31');assert.equal(new Set(r.gap_tasks.map(x=>x.source_tier)).size,18);assert.ok(r.gap_tasks.every(x=>x.date_window&&x.date_window.start==='2026-10-01'&&(x.campaign_lead_time?x.date_window.end==='2026-11-30':x.date_window.end==='2026-10-31')));assert.ok(r.gap_tasks.some(x=>x.query.includes('October 2026')));});
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
 assert.equal(r.gap_tasks.length,16);
 assert.equal(r.operational_tiers.length,16);
 assert.equal(r.audit_required,true);
 assert.ok(r.gap_tasks.every(x=>x.source_id.startsWith('smart-')));
 assert.ok(r.gap_tasks.every(x=>x.query_variants.length<=3));
 assert.ok(r.gap_tasks.some(x=>x.providers.includes('LIVENATION_PUBLIC')));
});

test('named source universe fallbacks survive monthly execution-plan assembly for December missing cases',()=>{
 const p=P.build({month:'2026-12',location:'Bangkok Thailand'});
 const ids=['mcard-future-event-spend-winner-cycle','mediheal-th-artist-lucky-fans','ttm-recent-asia-artist-fancon','illust-fusion-official-events'];
 for(const id of ids){
  const task=p.gap_tasks.find(t=>t.source_id===id);
  assert.ok(task,id);
  assert.ok(Array.isArray(task.query_variants)&&task.query_variants.length>=2,id);
  assert.match([task.query,...task.query_variants].join(' | '),/ธันวาคม 2569/,id);
  assert.equal(task.required,true,id);
 }
 const mcard=p.gap_tasks.find(t=>t.source_id===ids[0]);
 assert.ok(mcard.query_variants.some(q=>/สะสมยอด/.test(q)));
 const illust=p.gap_tasks.find(t=>t.source_id===ids[3]);
 assert.ok(illust.query_variants.some(q=>/WINTER/.test(q)));
 assert.equal(p.production_writes,0);
 assert.equal(p.verifier_required,true);
});
