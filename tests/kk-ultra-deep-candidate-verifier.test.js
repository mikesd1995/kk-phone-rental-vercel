'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const V=require('../server/kk-ultra-deep-candidate-verifier.js');

test('prefilter rejects generic/noise rows before any fetch',()=>{
  const generic=V.prefilter({title:'Google',event_date:'2026-10-12',source_url:'https://google.com/'},'2026-10');
  assert.equal(generic.eligible,false);
  assert.ok(generic.reasons.includes('GENERIC_OR_MISSING_TITLE'));
  const noise=V.prefilter({title:'Bangkok Oktoberfest workshop',event_date:'2026-10-12',source_url:'https://example.com/event'},'2026-10');
  assert.equal(noise.eligible,false);
  assert.ok(noise.reasons.includes('NON_RENTAL_EVENT_SIGNAL'));
});

test('JSON-LD event verifies date venue poster and rental fit',()=>{
  const body=`<!doctype html><html><head>
  <meta property="og:image" content="https://cdn.example/poster.jpg">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"MusicEvent","name":"LYKN REFLEXION CONCERT","startDate":"2026-10-23T19:00:00+07:00","location":{"@type":"Place","name":"IMPACT Arena"},"image":"https://cdn.example/lykn.jpg"}
  </script></head><body></body></html>`;
  const out=V.verifyHtmlCandidate({
    title:'LYKN REFLEXION CONCERT',
    event_date:'2026-10-23',
    source_url:'https://www.thaiticketmajor.com/concert/lykn-reflexion.html'
  },body,{month:'2026-10'});
  assert.equal(out.verified,true);
  assert.equal(out.candidate.venue,'IMPACT Arena');
  assert.equal(out.candidate.event_date,'2026-10-23');
  assert.equal(out.candidate.rental_fit_score,8.2);
  assert.equal(out.poster.image_url,'https://cdn.example/lykn.jpg');
  assert.equal(out.poster.verified,true);
});

test('event page without venue or poster remains HOLD',()=>{
  const body='<html><head><title>Example Concert</title></head><body>Example Concert October 10 2026</body></html>';
  const out=V.verifyHtmlCandidate({
    title:'Example Concert',
    event_date:'2026-10-10',
    source_url:'https://www.eventpop.me/e/example'
  },body,{month:'2026-10'});
  assert.equal(out.verified,false);
  assert.ok(out.blockers.includes('VERIFIED_VENUE_REQUIRED'));
  assert.ok(out.blockers.includes('VERIFIED_POSTER_REQUIRED'));
});

test('known venue in body can satisfy venue when JSON-LD omits location',()=>{
  const body=`<html><head><meta property="og:image" content="https://cdn.example/a.jpg">
  <script type="application/ld+json">{"@type":"MusicEvent","name":"Artist Fan Meeting","startDate":"2026-10-18"}</script>
  </head><body>See you at Union Hall, Bangkok.</body></html>`;
  const out=V.verifyHtmlCandidate({
    title:'Artist Fan Meeting',
    event_date:'2026-10-18',
    source_url:'https://www.eventpop.me/e/artist-fanmeeting'
  },body,{month:'2026-10'});
  assert.equal(out.verified,true);
  assert.equal(out.candidate.venue,'Union Hall');
  assert.equal(out.candidate.rental_fit_score,9);
});

test('batch never upgrades failed source fetch to verified',async()=>{
  const out=await V.verifyBatch([{
    title:'Artist Concert',
    event_date:'2026-10-19',
    source_url:'https://www.thaiticketmajor.com/concert/example.html'
  }],{month:'2026-10'},{fetchFn:async()=>{throw Object.assign(new Error('no'),{code:'OFFLINE'})}});
  assert.equal(out.verified_count,0);
  assert.equal(out.hold_count,1);
  assert.deepEqual(out.holds[0].blockers,['SOURCE_FETCH_FAILED']);
  assert.equal(out.production_writes,0);
});

test('social profile page and merged search title cannot become verified event evidence',async()=>{
  const badTitle='The Mall Lifestore Bangkapi | Bangkok - FacebookTEETEE PHILIPPINES on X: TEETEE_SCHEDULE THE MALL คอนเสิร์ตที่ M GRAND HALL, The Mall Lifestore Bangkapi Bangkok Post - Manga madness at The Mall Bangkae MCC Hall | Bangkok - Facebook The Mall Lifestore';
  assert.ok(badTitle.length>V.MAX_EVENT_TITLE_LENGTH);
  const pre=V.prefilter({
    title:badTitle,
    event_date:'2026-10-18',
    source_url:'https://www.facebook.com/themalllifestorebangkapi/'
  },'2026-10');
  assert.equal(pre.eligible,false);
  assert.ok(pre.reasons.includes('MERGED_OR_OVERSIZED_TITLE'));
  assert.ok(pre.reasons.includes('SOCIAL_PROFILE_NOT_EVENT_EVIDENCE'));

  let calls=0;
  const out=await V.verifyBatch([{
    title:badTitle,
    event_date:'2026-10-18',
    source_url:'https://www.facebook.com/themalllifestorebangkapi/'
  }],{month:'2026-10'},{fetchFn:async()=>{calls++;return {ok:true,text:async()=>'<html></html>'};}});
  assert.equal(calls,0);
  assert.equal(out.verified_count,0);
  assert.equal(out.hold_count,1);
  assert.ok(out.holds[0].blockers.includes('SOCIAL_PROFILE_NOT_EVENT_EVIDENCE'));
});

test('event-specific social permalink remains eligible for downstream verification',()=>{
  const pre=V.prefilter({
    title:'Artist Fan Meeting Bangkok',
    event_date:'2026-10-18',
    source_url:'https://x.com/artist/status/1234567890'
  },'2026-10');
  assert.equal(V.socialEventPermalink('https://x.com/artist/status/1234567890'),true);
  assert.equal(pre.reasons.includes('SOCIAL_PROFILE_NOT_EVENT_EVIDENCE'),false);
});

