'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Verifier=require('../server/kk-ultra-deep-candidate-verifier.js');

const html=`<!doctype html><html><head>
<script type="application/ld+json">{
 "@context":"https://schema.org","@type":"Event",
 "name":"Strong Roots Bright Stars with TeeTee & Por",
 "startDate":"2026-10-07T18:00:00+07:00",
 "location":{"@type":"Place","name":"Union Hall"},
 "image":"https://cdn.example/ryo.jpg"
}</script></head><body>official event detail</body></html>`;

test('External Demand verifier may recover a missing search date from authoritative event detail',()=>{
  const candidate={title:'Strong Roots Bright Stars with TeeTee & Por',event_date:null,source_url:'https://www.eventpop.me/e/ryo-strong-roots'};
  const legacy=Verifier.verifyHtmlCandidate(candidate,html,{month:'2026-10'});
  assert.equal(legacy.verified,false);
  assert.ok(legacy.blockers.includes('EVENT_DATE_REQUIRED'));

  const out=Verifier.verifyHtmlCandidate(candidate,html,{month:'2026-10',verification_scope:'EXTERNAL_DEMAND_IDENTITY'});
  assert.equal(out.verified,true);
  assert.equal(out.status,'VERIFIED_FOR_EXTERNAL_DEMAND_GATE');
  assert.equal(out.candidate.event_date,'2026-10-07');
  assert.equal(out.candidate.venue,'Union Hall');
  assert.equal(out.candidate.publish_eligibility.status,'DEFER_TO_EXTERNAL_DEMAND_GATE');
  assert.equal(out.candidate.publish_eligibility.eligible,null);
});

test('External Demand verifier does not use legacy title rental-fit as publish authority',()=>{
  const candidate={title:'Strong Roots Bright Stars with TeeTee & Por',event_date:'2026-10-07',source_url:'https://www.eventpop.me/e/ryo-strong-roots'};
  const legacy=Verifier.verifyHtmlCandidate(candidate,html,{month:'2026-10'});
  assert.equal(legacy.verified,false);
  assert.ok(legacy.blockers.includes('RENTAL_FIT_BELOW_PUBLISH_THRESHOLD'));

  const out=Verifier.verifyHtmlCandidate(candidate,html,{month:'2026-10',verification_scope:'EXTERNAL_DEMAND_IDENTITY'});
  assert.equal(out.verified,true);
  assert.equal(out.candidate.rental_fit_score,5);
  assert.equal(out.candidate.publish_eligibility.decision_authority,'EXTERNAL_DEMAND_SCORE');
});

test('External Demand scope still refuses missing-date generic search pages',()=>{
  const pre=Verifier.prefilter(
    {title:'Strong Roots Bright Stars with TeeTee & Por',event_date:null,source_url:'https://example.com/search-result'},
    '2026-10',
    {verification_scope:'EXTERNAL_DEMAND_IDENTITY'}
  );
  assert.equal(pre.eligible,false);
  assert.ok(pre.reasons.includes('EVENT_DATE_REQUIRED'));
  assert.ok(pre.reasons.includes('EVENT_IDENTITY_NOT_STRONG_ENOUGH'));
});

test('canonical direct runtime explicitly requests External Demand identity verification',()=>{
  const src=fs.readFileSync(path.join(__dirname,'..','server','kk-ultra-deep-direct-zero-cost.js'),'utf8');
  assert.match(src,/verification_scope:'EXTERNAL_DEMAND_IDENTITY'/);
});

test('External Demand identity cannot recover an event on the wrong target month',()=>{
 const wrongMonth=html.replace('2026-10-07T18:00:00+07:00','2026-11-07T18:00:00+07:00');
 const event={title:'Strong Roots Bright Stars with TeeTee & Por',event_date:null,source_url:'https://www.eventpop.me/e/ryo-strong-roots'};
 const result=Verifier.verifyHtmlCandidate(event,wrongMonth,{month:'2026-10',verification_scope:'EXTERNAL_DEMAND_IDENTITY'});
 assert.equal(result.verified,false);
 assert.ok(result.blockers.includes('VERIFIED_TARGET_MONTH_DATE_REQUIRED'));
});
test('External Demand scope must not elevate a candidate without official event details or poster',()=>{
 const event={title:'Brand x Artist Event',event_date:null,source_url:'https://www.eventpop.me/e/brand-x-artist'};
 const result=Verifier.verifyHtmlCandidate(event,'<html><body>No event details</body></html>',{month:'2026-10',verification_scope:'EXTERNAL_DEMAND_IDENTITY'});
 assert.equal(result.verified,false);
 assert.ok(result.blockers.includes('VERIFIED_TARGET_MONTH_DATE_REQUIRED'));
 assert.ok(result.blockers.includes('VERIFIED_POSTER_REQUIRED'));
});

test('canonical direct verifier uses injected HTTP client and never makes an uncontrolled fetch',async()=>{
 const seen=[];
 const fetchImpl=async(url,opts)=>{
  seen.push({url,method:opts.method});
  return {ok:true,status:200,headers:{get:()=>null},text:async()=>html};
 };
 const candidate={title:'Strong Roots Bright Stars with TeeTee & Por',event_date:null,
  source_url:'https://www.eventpop.me/e/ryo-strong-roots'};
 const out=await Verifier.verifyBatch([candidate],
  {month:'2026-10',verification_scope:'EXTERNAL_DEMAND_IDENTITY'},
  {fetchImpl,concurrency:1,timeout_ms:500});
 assert.equal(seen.length,1);
 assert.equal(seen[0].url,candidate.source_url);
 assert.equal(seen[0].method,'GET');
 assert.equal(out.verified_count,1);
 assert.equal(out.verified_candidates[0].publish_eligibility.eligible,null);
 assert.equal(out.production_writes,0);
});
