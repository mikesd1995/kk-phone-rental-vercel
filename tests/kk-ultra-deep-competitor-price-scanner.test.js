'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/kk-ultra-deep-competitor-price-scanner.js');

test('extracts only known competitor X URLs',()=>{
 assert.equal(P.competitorFromUrl('https://x.com/faleem_rent2/status/111'),'faleem_rent2');
 assert.equal(P.competitorFromUrl('https://x.com/minibestt/status/123'),'minibestt');
 assert.equal(P.competitorFromUrl('https://twitter.com/fundaybuddy/status/9'),'fundaybuddy');
 assert.equal(P.competitorFromUrl('https://x.com/randomshop/status/1'),'');
 assert.equal(P.competitorFromUrl('https://example.com/minibestt'),'');
});

test('parses bounded rental prices without accepting ticket-scale values',()=>{
 assert.equal(P.parsePrice('เช่า vivo X300 590฿ + lens 200'),590);
 assert.equal(P.parsePrice('ราคา: 690 บาท'),690);
 assert.equal(P.parsePrice('ticket 6500 บาท'),null);
});

test('requires title overlap for exact-event evidence',()=>{
 const candidate={event_key:'E1',title:'LYKN REFLEXION CONCERT'};
 const good=P.rowToEvidence({
  href:'https://x.com/minibestt/status/123',
  title:'LYKN REFLEXION CONCERT เช่า vivo X300 790฿'
 },candidate);
 assert.ok(good);
 assert.equal(good.price,790);
 assert.equal(good.exact_event,true);

 const bad=P.rowToEvidence({
  href:'https://x.com/minibestt/status/456',
  title:'NCT concert เช่า vivo X300 790฿'
 },candidate);
 assert.equal(bad,null);
});

test('scan batch remains zero-write and dedupes evidence',async()=>{
 const runner=async()=>[
  {href:'https://x.com/minibestt/status/1',title:'LYKN REFLEXION CONCERT vivo X300 790฿'},
  {href:'https://x.com/minibestt/status/1',title:'LYKN REFLEXION CONCERT vivo X300 790฿'},
  {href:'https://x.com/fundaybuddy/status/2',title:'LYKN REFLEXION CONCERT phone rental 890 บาท'}
 ];
 const out=await P.scanBatch([{event_key:'E1',title:'LYKN REFLEXION CONCERT'}],{ddgs_runner:runner});
 assert.equal(out.production_writes,0);
 assert.equal(out.evidence.length,2);
 assert.equal(out.competitor_count,2);
});


test('phone base plus lens add-on is not misclassified as bundle price',()=>{
 assert.equal(P.packageType('vivo X300 เครื่อง 690฿ + Lens +200'),'PHONE_ONLY');
 assert.equal(P.packageType('vivo X300 พร้อม Lens 890฿'),'PHONE_LENS');
});


test('query plan explicitly covers all locked competitor accounts',()=>{
 assert.equal(P.COMPETITORS.length,10);
 assert.ok(P.COMPETITORS.includes('faleem_rent2'));
 const q=P.buildQueries({title:'LYKN REFLEXION CONCERT'});
 assert.ok(q.length>=3+P.COMPETITORS.length);
 for(const handle of P.COMPETITORS){
  assert.ok(q.some(x=>x.includes('site:x.com/'+handle)));
 }
});

test('scan batch reports competitor universe even when exact evidence is absent',async()=>{
 const out=await P.scanBatch([{event_key:'E1',title:'Unknown Event'}],{ddgs_runner:async()=>[]});
 assert.equal(out.evidence_count,0);
 assert.equal(out.competitor_universe_count,P.COMPETITORS.length);
 assert.deepEqual(out.competitor_universe,P.COMPETITORS);
 assert.equal(out.query_strategy,'GENERIC_PLUS_PER_COMPETITOR_X');
});
