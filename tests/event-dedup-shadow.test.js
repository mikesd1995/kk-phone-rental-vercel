'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../server/event-dedup-shadow');

test('punctuation/case variants on same date remain likely duplicate',()=>{
  const result=D.evaluatePair(
    {event_name:'LYKN REFLEXION CONCERT 2026',event_date:'2026-10-12',venue:'IMPACT Arena',artists:['LYKN']},
    {event_name:'Lykn Reflexion Concert 2026!',event_date:'2026/10/12',venue:'Impact Arena',artists:['LYKN']}
  );
  assert.equal(result.disposition,'LIKELY_DUPLICATE');
  assert.equal(result.authoritative,false);
  assert.equal(result.verifier_required,true);
  assert.equal(result.production_writes,0);
});

test('different explicit dates are a hard distinct boundary even when title matches',()=>{
  const result=D.evaluatePair(
    {event_name:'WORLD TOUR BANGKOK',event_date:'2026-10-10',venue:'IMPACT Arena',artist:'PLAVE'},
    {event_name:'WORLD TOUR BANGKOK',event_date:'2026-10-11',venue:'IMPACT Arena',artist:'PLAVE'}
  );
  assert.equal(result.disposition,'DISTINCT_HARD_DATE');
  assert.equal(result.score,0);
});

test('strong title match without dates is advisory possible duplicate only',()=>{
  const result=D.evaluatePair(
    {event_name:'PEEK A POOO PearlPeak Exclusive Fan Meeting',artists:['Pearl','Peak']},
    {event_name:'PEEK-A-POOO Pearl Peak Exclusive Fanmeeting',artists:['Pearl','Peak']}
  );
  assert.equal(result.disposition,'POSSIBLE_DUPLICATE');
  assert.equal(result.authoritative,false);
});

test('unrelated events remain distinct',()=>{
  const result=D.evaluatePair(
    {event_name:'Tiffany Young Fan Concert',event_date:'2026-10-25',venue:'UOB LIVE',artist:'Tiffany Young'},
    {event_name:'Gong Yoo Fan Meeting',event_date:'2026-10-10',venue:'One Bangkok Forum',artist:'Gong Yoo'}
  );
  assert.match(result.disposition,/^DISTINCT/);
});

test('rankCandidates returns highest scoring advisory matches only',()=>{
  const ranked=D.rankCandidates(
    {event_name:'LYKN Reflexion Concert',event_date:'2026-10-12',venue:'IMPACT Arena',artist:'LYKN'},
    [
      {event_id:'EVT-OTHER',event_name:'Other Show',event_date:'2026-10-12',venue:'UOB LIVE',artist:'Other'},
      {event_id:'EVT-LYKN',event_name:'LYKN REFLEXION CONCERT',event_date:'2026-10-12',venue:'IMPACT Arena',artist:'LYKN'}
    ],
    {limit:1}
  );
  assert.equal(ranked.length,1);
  assert.equal(ranked[0].existing_id,'EVT-LYKN');
  assert.equal(ranked[0].disposition,'LIKELY_DUPLICATE');
});
