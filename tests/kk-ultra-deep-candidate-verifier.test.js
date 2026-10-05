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


test('rejects aggregated search-result titles that previously leaked into storefront',()=>{
  const title='The Mall Lifestore Bangkapi | Bangkok - FacebookTEETEE PHILIPPINES on X: TEETEE_SCHEDULE THE MALL Bangkok Post';
  const pre=V.prefilter({
    title,
    event_date:'2026-10-18',
    source_url:'https://www.facebook.com/themalllifestorebangkapi'
  },'2026-10');
  assert.equal(pre.eligible,false);
  assert.ok(pre.reasons.includes('AGGREGATED_SEARCH_RESULT_TITLE'));
});

test('social page with event words venue and poster cannot authorize auto publish',()=>{
  const body='<html><head><meta property="og:image" content="https://cdn.example/poster.jpg"></head><body>Artist Concert at MCC Hall</body></html>';
  const out=V.verifyHtmlCandidate({
    title:'Artist Concert',
    event_date:'2026-10-18',
    source_url:'https://www.facebook.com/example/posts/123'
  },body,{month:'2026-10'});
  assert.equal(out.verified,false);
  assert.ok(out.blockers.includes('AUTHORITATIVE_EVENT_SOURCE_REQUIRED'));
});

test('structured exact event on non-social official page can authorize publish',()=>{
  const body=`<html><head>
  <script type="application/ld+json">
  {"@type":"MusicEvent","name":"Artist Bangkok Concert","startDate":"2026-10-20","location":{"@type":"Place","name":"Union Hall"},"image":"https://official.example/poster.jpg"}
  </script></head></html>`;
  const out=V.verifyHtmlCandidate({
    title:'Artist Bangkok Concert',
    event_date:'2026-10-20',
    source_url:'https://artist-official.example/events/bangkok-concert'
  },body,{month:'2026-10'});
  assert.equal(out.verified,true);
  assert.equal(out.evidence.authoritative_event_source,true);
});


test('Live Nation Tero /show/ URL is event-specific and eligible for verifier prefilter',()=>{
  const url='https://www.livenationtero.co.th/show/1672772/the-weeknd-after-hours-til-dawn-tour/bangkok/2026-10-11/en';
  assert.equal(V.eventSpecificUrl(url),true);
  const pre=V.prefilter({title:'The Weeknd: After Hours Til Dawn Tour',event_date:'2026-10-11',source_url:url},'2026-10');
  assert.equal(pre.eligible,true);
  assert.deepEqual(pre.reasons,[]);
});
