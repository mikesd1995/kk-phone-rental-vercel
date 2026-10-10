'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Audit=require('../scripts/audit-storefront-posters.js');

const row=(fields={})=>({
  event_id:'EVT-20261015-LE7EL-1ST-DEBUT-ANNIVERSARY',
  event_name:'LE7EL 1st Debut Anniversary',
  event_date_text:'15/10/2026',
  action_for_web:'show',
  poster_image_url:'',
  ...fields
});

test('blank canonical poster is a clear HOLD, never a clean integrity pass',()=>{
 const e=Audit.assessPoster(row());
 assert.equal(e.canonical_missing,true);
 assert.equal(e.status,'FAIL');
 assert.equal(e.canonical_integrity_status,'HOLD_CANONICAL_POSTER_MISSING');
 assert.equal(e.canonical_delivery_ok,false);
});

test('a legacy exact-event fallback can display a card but cannot certify Core poster',()=>{
 const r=row({event_name:'UNLUCKY BAE Final EP',event_date_text:'08/10/2026'});
 const fallback=Audit.emergencyPoster(r);
 assert.ok(fallback.startsWith('/assets/event-posters/'));
 const url=Audit.candidates(fallback)[0];
 const e=Audit.assessPoster(r,new Map([[url,{url,ok:true}]]));
 assert.equal(e.status,'PASS','the customer may see the fallback');
 assert.equal(e.recovered_by_fallback,true);
 assert.equal(e.canonical_missing,true);
 assert.equal(e.canonical_integrity_status,'HOLD_CANONICAL_POSTER_MISSING');
});

test('canonical image failure stays HOLD even if a fallback image works',()=>{
 const r=row({event_name:'UNLUCKY BAE Final EP',event_date_text:'08/10/2026',
   poster_image_url:'https://images.example.test/unavailable.jpg'});
 const canonical=Audit.candidates(r.poster_image_url)[0];
 const alternative=Audit.candidates(Audit.emergencyPoster(r))[0];
 const e=Audit.assessPoster(r,new Map([[canonical,{url:canonical,ok:false}],
   [alternative,{url:alternative,ok:true}]]));
 assert.equal(e.status,'PASS');
 assert.equal(e.recovered_by_fallback,true);
 assert.equal(e.canonical_missing,false);
 assert.equal(e.canonical_delivery_ok,false);
 assert.equal(e.canonical_integrity_status,'HOLD_CANONICAL_POSTER_DELIVERY');
});

test('canonical first source healthy is PASS and not fallback recovered',()=>{
 const r=row({poster_image_url:'https://images.example.test/official-poster.jpg'});
 const url=Audit.candidates(r.poster_image_url)[0];
 const e=Audit.assessPoster(r,new Map([[url,{url,ok:true}]]));
 assert.equal(e.status,'PASS');
 assert.equal(e.canonical_integrity_status,'PASS');
 assert.equal(e.recovered_by_fallback,false);
 assert.equal(e.canonical_delivery_ok,true);
});

test('only exact event/date fallbacks exist, not generic replacement art',()=>{
 assert.equal(Audit.emergencyPoster(row()),'');
 assert.equal(Audit.assessPoster(row({event_name:'MIZUMI Phuwin Moisture Match',
   event_date_text:'05/11/2026'})).canonical_integrity_status,
   'HOLD_CANONICAL_POSTER_MISSING');
});
