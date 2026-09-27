'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Prep=require('../server/kk-discovery-commercial-prep.js');

const candidate={candidate_id:'C1',event_key:'EVT-X',title:'Example Fan Event',event_date:'2026-10-01',venue:'Example Mall',artist:['A']};
const price=(id,value)=>({competitor_id:id,event_key:'EVT-X',package_type:'PHONE_LENS',price:value,source_url:'https://example.com/'+id,observed_at:'2026-09-28T00:00:00Z',exact_event:true});
const poster={event_key:'EVT-X',source_tier:'BRAND_SPONSOR',source_url:'https://brand.example/event',image_url:'https://brand.example/poster.jpg',official:true,verified:true};

test('commercial prep computes exact-event median only after three independent competitors',()=>{
 const r=Prep.prepareBatch({candidates:[candidate],competitor_prices:[price('shop-a',890),price('shop-b',1090),price('shop-c',990)],posters:[poster]});
 assert.equal(r.status,'READY_FOR_FINAL_VERIFIER');
 assert.equal(r.candidates[0].pricing.independent_competitors,3);
 assert.equal(r.candidates[0].pricing.market_median,990);
 assert.equal(r.candidates[0].pricing.market_min,890);
 assert.equal(r.candidates[0].pricing.market_max,1090);
 assert.equal(r.production_writes,0);
});

test('commercial prep fails closed when exact-event competitor evidence is insufficient',()=>{
 const r=Prep.prepareBatch({candidates:[candidate],competitor_prices:[price('shop-a',890),price('shop-b',990)],posters:[poster]});
 assert.equal(r.status,'HOLD_FOR_COMMERCIAL_EVIDENCE');
 assert.ok(r.candidates[0].blockers.includes('EXACT_EVENT_COMPETITOR_PRICE_EVIDENCE_INCOMPLETE'));
 assert.equal(r.candidates[0].pricing.market_median,null);
});

test('commercial prep rejects unverified poster and duplicate competitor identities',()=>{
 const r=Prep.prepareBatch({candidates:[candidate],competitor_prices:[price('shop-a',890),price('shop-a',990),price('shop-b',1090)],posters:[{...poster,verified:false}]});
 assert.equal(r.status,'HOLD_FOR_COMMERCIAL_EVIDENCE');
 assert.equal(r.candidates[0].pricing.independent_competitors,2);
 assert.ok(r.candidates[0].blockers.includes('VERIFIED_POSTER_EVIDENCE_MISSING'));
});

test('commercial prep never authorizes final price write or publication',()=>{
 const r=Prep.prepareCandidate(candidate,{competitor_prices:[price('a',890),price('b',990),price('c',1090)],posters:[poster]});
 assert.equal(r.final_price_write_allowed,false);
 assert.equal(r.production_writes,0);
 assert.equal(r.publishes,0);
 assert.equal(r.verifier_required,true);
});
