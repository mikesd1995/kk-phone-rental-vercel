'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Source=require('../server/kk-ultra-deep-source-registry.js');
const Query=require('../server/kk-monthly-deep-scan-query-plan.js');
const Gate=require('../server/kk-ultra-deep-full-loop-completion-gate.js');
const Known=require('../server/kk-ultra-deep-known-miss-regression.js');
const Learn=require('../server/kk-ultra-deep-v2-learning-agent.js');

test('required BL GL source families are restored',()=>{
  const byId=new Map(Source.allSources().map(x=>[x.source_id,x]));
  for(const id of ['domundi-mandee','change2561','idolfactory','channel3-bl-gl']){
    assert.equal(byId.get(id)?.required,true,id);
  }
});

test('monthly query plan restores long-tail fandom and brand lanes',()=>{
  const artist=Query.TIER_TERMS.ARTIST_AGENCY.join(' ');
  const fan=Query.TIER_TERMS.FAN_EVENT.join(' ');
  const brand=Query.TIER_TERMS.PRESS_BRAND.join(' ');
  assert.match(artist,/DOMUNDI|Mandee/);
  assert.match(artist,/CHANGE2561/);
  assert.match(fan,/first ep/i);
  assert.match(fan,/hi touch/i);
  assert.match(brand,/top spender/i);
});

test('full-booking date is an accepted safe terminal disposition',()=>{
  const out=Gate.evaluate({
    discovery:{full:true,status:'READY_FOR_VERIFIER'},
    candidates:[],
    verified_candidate_count:1,
    terminal_dispositions:[{event_key:'E1',status:'SKIPPED_FULL_BOOKING_DATE'}],
    final_report_ready:true
  });
  assert.equal(out.complete,true);
  assert.equal(out.completion_mode,'SAFE_NOOP_TERMINAL_DISPOSITIONS');
});

test('RYO and October known misses remain in deterministic corpus',()=>{
  const ids=new Set(Known.CORPUS.map(x=>x.case_id));
  for(const id of ['ryo-teeteepor-20261007','the-weeknd-20261011','meme-fest-20261017','0wave-20261021','pixxie-soundscape-20261030','nct127-redline-20261031']){
    assert.equal(ids.has(id),true,id);
  }
  assert.equal(Known.evaluateFixtureRegression().complete,true);
});

test('brand-social miss expands discovery without allowing KK outcomes into score policy',()=>{
  const out=Learn.learn({
    missed_events:[{
      miss_class:'ARTIST_BRAND_SOCIAL_KEYWORDLESS_APPEARANCE',
      artists:['TeeTee','Por'],
      brands:['RYO'],
      month:'2026-10'
    }],
    booking_outcomes:[{booked:true,revenue:890,fandom:['TeeTeePor']}]
  });
  assert.ok(out.recommendations.includes('MANDATORY_ARTIST_MONTH_SCHEDULE_AND_BRAND_SOCIAL_EXPANSION'));
  assert.ok(out.adaptive.mandatory_expansion.includes('BRAND_OFFICIAL_SOCIAL'));
  assert.ok(out.adaptive.query_terms.some(x=>/RYO TeeTee 2026-10/.test(x)));
  assert.equal(out.scoring_learning.internal_outcomes_affect_external_score,false);
  assert.equal(out.authority.may_change_external_score_from_kk_internal_outcomes,false);
});
