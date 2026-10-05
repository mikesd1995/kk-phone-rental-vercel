'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/kk-ultra-deep-competitor-price-scanner.js');

test('baseline competitor universe contains protected 10 and targets 20',()=>{
 assert.equal(P.BASE_COMPETITORS.length,10);
 assert.equal(P.DEFAULT_TARGET_COMPETITOR_UNIVERSE,20);
 assert.equal(P.DEFAULT_DESIRED_EVENT_COMPETITORS,5);
 assert.ok(P.BASE_COMPETITORS.includes('faleem_rent2'));
});

test('extracts known or credible learned competitor X URLs only',()=>{
 assert.equal(P.competitorFromUrl('https://x.com/faleem_rent2/status/111'),'faleem_rent2');
 assert.equal(P.competitorFromUrl('https://x.com/newrental/status/999',P.BASE_COMPETITORS,'เช่ามือถือ vivo X300'),'newrental');
 assert.equal(P.competitorFromUrl('https://x.com/randomfan/status/999',P.BASE_COMPETITORS,'เจอกันที่งาน'),'');
});

test('semantic parser does not mistake deposit or lens add-on for rental price',()=>{
 const o=P.parseRentalOffer('มัดจำ 500 บาท | เช่าเครื่อง vivo X300 Pro 790 บาท | Lens +200');
 assert.equal(o.rental_price,790);assert.equal(o.deposit,500);assert.equal(o.lens_addon,200);assert.equal(o.package_type,'PHONE_ONLY');
});

test('semantic parser recognizes true phone plus lens bundle',()=>{
 const o=P.parseRentalOffer('vivo X300 Pro พร้อม Lens ราคาเช่า 990 บาท');
 assert.equal(o.rental_price,990);assert.equal(o.package_type,'PHONE_LENS');
});

test('explicit incompatible phone model is rejected',()=>{
 const e=P.rowToEvidence({href:'https://x.com/minibestt/status/1900000000000000000',title:'LYKN REFLEXION CONCERT เช่า iPhone 17 790 บาท',published_at:'2026-10-04T00:00:00Z'},{event_key:'E1',title:'LYKN REFLEXION CONCERT'},{now:'2026-10-05T00:00:00Z'});
 assert.equal(e,null);
});

test('source timestamp is preserved and freshness age can be evaluated later',()=>{
 const e=P.rowToEvidence({href:'https://x.com/minibestt/status/1900000000000000000',title:'LYKN REFLEXION CONCERT เช่า vivo X300 Pro 790 บาท',published_at:'2026-10-04T00:00:00Z'},{event_key:'E1',title:'LYKN REFLEXION CONCERT'},{now:'2026-10-05T00:00:00Z'});
 assert.ok(e);assert.equal(e.source_published_at,'2026-10-04T00:00:00.000Z');assert.equal(e.source_age_days,1);
});

test('requires title overlap for exact-event evidence',()=>{
 const candidate={event_key:'E1',title:'LYKN REFLEXION CONCERT'};
 const good=P.rowToEvidence({href:'https://x.com/minibestt/status/1900000000000000000',title:'LYKN REFLEXION CONCERT เช่า vivo X300 Pro 790฿',published_at:'2026-10-04'},candidate,{now:'2026-10-05'});
 assert.ok(good);assert.equal(good.price,790);assert.equal(good.exact_event,true);
 const bad=P.rowToEvidence({href:'https://x.com/minibestt/status/1900000000000000001',title:'NCT concert เช่า vivo X300 Pro 790฿',published_at:'2026-10-04'},candidate,{now:'2026-10-05'});
 assert.equal(bad,null);
});

test('configured competitor universe can expand beyond baseline 10',()=>{
 const extras=Array.from({length:12},(_,i)=>'extra_rent_'+(i+1));
 const universe=P.configuredUniverse({competitor_universe:extras});
 assert.equal(universe.length,22);assert.ok(universe.includes('extra_rent_12'));
});

test('adaptive scan keeps searching past three shops toward desired five',async()=>{
 let calls=0;
 const handles=['minibestt','fundaybuddy','thisisyour3','fejay4rent','by_minnymicky'];
 const runner=async()=>{const h=handles[Math.min(calls++,handles.length-1)];return [{href:'https://x.com/'+h+'/status/1900000000000000000',title:'LYKN REFLEXION CONCERT เช่า vivo X300 Pro 790 บาท',published_at:'2026-10-04'}];};
 const out=await P.scanCandidate({event_key:'E1',title:'LYKN REFLEXION CONCERT'},{ddgs_runner:runner,desired_independent_competitors:5,now:'2026-10-05'});
 assert.equal(new Set(out.map(x=>x.competitor_id)).size,5);assert.ok(calls>=5);
});

test('scan batch reports expandable universe and remains zero-write',async()=>{
 const out=await P.scanBatch([{event_key:'E1',title:'Unknown Event'}],{ddgs_runner:async()=>[]});
 assert.equal(out.production_writes,0);assert.equal(out.base_competitor_count,10);assert.equal(out.target_competitor_universe,20);
 assert.equal(out.competitor_universe_expandable,true);assert.equal(out.query_strategy,'GENERIC_DISCOVERY_PLUS_EXPANDABLE_PER_COMPETITOR_X');
});
