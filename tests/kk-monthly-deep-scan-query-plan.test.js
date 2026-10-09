'use strict';const test=require('node:test');const assert=require('node:assert/strict');const P=require('../server/kk-monthly-deep-scan-query-plan.js');
test('next month resolves deterministically from supplied date',()=>{const r=P.build({current_date:'2026-09-28',location:'Bangkok Thailand'});assert.equal(r.range.month,'2026-10');assert.equal(r.range.start_date,'2026-10-01');assert.equal(r.range.end_date,'2026-10-31');assert.deepEqual([...new Set(r.gap_tasks.map(x=>x.source_tier))].sort(),['ANNOUNCEMENT_CHANGE', 'ARTIST_AGENCY', 'AWARD_RED_CARPET', 'BRAND_SPONSOR', 'CAMPAIGN_LEAD_TIME', 'CEREMONY', 'COMPETITOR', 'FAN_EVENT', 'MALL_COMMUNITY', 'OFFICIAL', 'ORGANIZER_PROMOTER', 'PRESS_BRAND', 'PUBLIC_CALENDAR', 'SOCIAL', 'SPORTS_ENTERTAINMENT', 'TICKETING', 'VENUE', 'VISUAL_SCHEDULE']);assert.ok(r.gap_tasks.every(x=>x.date_window&&x.date_window.start==='2026-10-01'&&x.date_window.end===(x.campaign_lead_time?'2026-11-30':'2026-10-31')));assert.ok(r.gap_tasks.some(x=>x.campaign_lead_time&&x.source_tier==='CAMPAIGN_LEAD_TIME'));assert.ok(r.gap_tasks.some(x=>x.query.includes('October 2026')));});
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
 assert.deepEqual([...r.operational_tiers].sort(),['ANNOUNCEMENT_CHANGE', 'ARTIST_AGENCY', 'CAMPAIGN_LEAD_TIME', 'CEREMONY', 'COMPETITOR', 'FAN_EVENT', 'MALL_COMMUNITY', 'OFFICIAL', 'ORGANIZER_PROMOTER', 'PRESS_BRAND', 'PUBLIC_CALENDAR', 'SOCIAL', 'SPORTS_ENTERTAINMENT', 'TICKETING', 'VENUE', 'VISUAL_SCHEDULE']);
 assert.equal(r.audit_required,true);
 assert.ok(r.gap_tasks.every(x=>x.source_id.startsWith('smart-')));
 assert.ok(r.gap_tasks.every(x=>x.query_variants.length<=3));
 assert.ok(r.gap_tasks.some(x=>x.providers.includes('LIVENATION_PUBLIC')));
});
