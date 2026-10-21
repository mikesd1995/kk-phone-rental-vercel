'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Registry=require('../server/kk-ultra-deep-source-registry.js');
const Plan=require('../server/kk-monthly-deep-scan-query-plan.js');
const KnownMiss=require('../server/kk-ultra-deep-known-miss-regression.js');

const CASE_ID='elle-free-to-be-20261022';
const OFFICIAL='https://ellethailand.com/elle-fashion-week-2026-at-iconsiam-schedule-showtime/';

test('runway discovery has a direct ELLE Thailand first-party source and Bangkok River Park venue',()=>{
  const sources=Registry.allSources();
  const elle=sources.find(s=>s.source_id==='elle-thailand-runway');
  assert.ok(elle);
  assert.equal(elle.domain,'ellethailand.com');
  assert.equal(elle.required,false);
  assert.ok(sources.some(s=>s.source_id==='iconsiam-river-park-runway'));
  const universe=Registry.buildUniversePlan({month:'2026-10'});
  assert.ok(universe.tasks.some(t=>t.source_id===elle.source_id&&t.query.includes('site:ellethailand.com')));
  assert.equal(universe.production_writes,0);
});

test('October query plan includes runway and fashion week prompts without write authority',()=>{
  const plan=Plan.build({month:'2026-10'});
  const relevant=plan.gap_tasks.filter(t=>t.source_tier==='PRESS_BRAND'||t.source_tier==='VISUAL_SCHEDULE');
  assert.ok(relevant.some(t=>/fashion week/i.test(t.query)));
  assert.ok(relevant.some(t=>/แฟชั่นวีค/.test(t.query)));
  assert.equal(plan.production_writes,0);
  assert.equal(plan.verifier_required,true);
});

test('real official 22 October ELLE runway is in known-miss corpus and a historical fixture',()=>{
  const c=KnownMiss.CORPUS.find(row=>row.case_id===CASE_ID);
  assert.ok(c);
  assert.equal(c.event_date,'2026-10-22');
  assert.equal(c.miss_class,'FASHION_RUNWAY_CELEBRITY_SCHEDULE_GAP');
  const fixture=KnownMiss.evaluateFixtureRegression();
  const result=fixture.results.find(row=>row.case_id===CASE_ID);
  assert.ok(result);
  assert.equal(result.pass,true);
});

test('strict live recall requires exact date and real evidence; a different runway date cannot satisfy it',()=>{
  const candidate={title:'ELLE Fashion Week 2026 FREE TO BE BY ELLE Presented by XPENG Thailand',event_date:'2026-10-22',source_url:OFFICIAL};
  const verified=KnownMiss.evaluate([candidate],[],{month:'2026-10',strict_live:true});
  assert.equal(verified.results.find(row=>row.case_id===CASE_ID).pass,true);
  const wrongDay=KnownMiss.evaluate([{...candidate,event_date:'2026-10-23'}],[],{month:'2026-10',strict_live:true});
  assert.equal(wrongDay.results.find(row=>row.case_id===CASE_ID).pass,false);
  const noUrl=KnownMiss.evaluate([{...candidate,source_url:''}],[],{month:'2026-10',strict_live:true});
  assert.equal(noUrl.results.find(row=>row.case_id===CASE_ID).pass,false);
});
