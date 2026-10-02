'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../server/kk-ultra-deep-competitor-scan.js');

test('extracts bounded rental prices but ignores ticket-scale prices',()=>{
 assert.equal(C.priceFromText('vivo X300 690฿ lens +200'),690);
 assert.equal(C.priceFromText('ticket 5900 baht'),null);
});
test('attributes known competitor account from result evidence',()=>{
 assert.equal(C.accountFromRow({title:'@minibestt LYKN rent 690',source_url:'https://x.com/minibestt/status/1'}),'minibestt');
});
test('exact-event competitor scan is zero-write and evidence-grounded',async()=>{
 const out=await C.scanBatch([{title:'LYKN REFLEXION CONCERT',event_key:'e1'}],{ddgs_runner:async()=>[
  {title:'@minibestt LYKN REFLEXION vivo X300 690฿',body:'เช่ามือถือ 690 บาท',source_url:'https://x.com/minibestt/status/1'}
 ]});
 assert.equal(out.production_writes,0);
 assert.equal(out.evidence.length,1);
 assert.equal(out.evidence[0].price,690);
 assert.equal(out.evidence[0].event_key,'e1');
});
