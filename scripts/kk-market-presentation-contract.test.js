'use strict';
const assert=require('assert');
const {priceObservationPersistenceGate,monthlyMarketSummary,sameShopPackagePriceChange}=require('../lib/kk-market-presentation-contract');
let n=0;const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++;};const ok=(v,m)=>{assert(v,m);n++;};
const NOW='2026-09-07T02:45:00+07:00';
function row(over={}){return Object.assign({event_key:'EVENT|x|20261001',competitor_account:'shop-a',package_key:'VIVO_X300_PRO+LENS',current_bundle_price:900,last_checked:'2026-09-07T02:40:00+07:00',fresh_until:'2026-09-08T02:40:00+07:00',freshness:'FRESH',queue_status:'OPEN',source_evidence_row:10,exact_event:true},over);}
ok(priceObservationPersistenceGate(row()).eligible,'exact bundle observation persists');
ok(!priceObservationPersistenceGate(row({package_key:'VIVO_X300_PRO'})).eligible,'phone-only never enters bundle persistence');
ok(!priceObservationPersistenceGate(row({source_evidence_row:''})).eligible,'missing lineage blocks persistence');
let s=monthlyMarketSummary([row()],[],{now:NOW,event_key:'EVENT|x|20261001',package_key:'VIVO_X300_PRO+LENS'});eq(s.kind,'REFERENCE','one shop is reference');
s=monthlyMarketSummary([row(),row({competitor_account:'shop-b',current_bundle_price:1100,source_evidence_row:11})],[],{now:NOW,event_key:'EVENT|x|20261001',package_key:'VIVO_X300_PRO+LENS'});eq(s.kind,'RANGE','two shops is range');eq(s.median,null,'two shops has no median');
s=monthlyMarketSummary([row(),row({competitor_account:'shop-b',current_bundle_price:1100,source_evidence_row:11}),row({competitor_account:'shop-c',current_bundle_price:1000,source_evidence_row:12})],[],{now:NOW,event_key:'EVENT|x|20261001',package_key:'VIVO_X300_PRO+LENS'});eq(s.kind,'RANGE_PLUS_MEDIAN','three shops enables median');eq(s.median,1000,'median exact');
s=monthlyMarketSummary([], [row({freshness:'STALE'})], {now:NOW,event_key:'EVENT|x|20261001',package_key:'VIVO_X300_PRO+LENS'});eq(s.status,'STALE','history only displays stale');eq(s.fresh_shops,0,'stale has zero fresh shops');
s=monthlyMarketSummary([], [], {now:NOW,event_key:'EVENT|x|20261001',package_key:'VIVO_X300_PRO+LENS'});eq(s.status,'NO_EXACT_BUNDLE_YET','no history is explicit no-bundle state');
let ch=sameShopPackagePriceChange(row({last_checked:'2026-09-07T01:00:00+07:00',current_bundle_price:1000}),row({last_checked:'2026-09-07T02:00:00+07:00',current_bundle_price:900}),{now:NOW});ok(ch.price_updated&&ch.visual==='PURPLE'&&ch.delta===-100,'same shop package recent delta flags purple');
ch=sameShopPackagePriceChange(row({competitor_account:'shop-a',current_bundle_price:1000}),row({competitor_account:'shop-b',current_bundle_price:900}),{now:NOW});ok(!ch.price_updated,'new competitor is not a price-change event');
ch=sameShopPackagePriceChange(row({package_key:'VIVO_X300_PRO+LENS',current_bundle_price:1000}),row({package_key:'VIVO_X300_PRO',current_bundle_price:900}),{now:NOW});ok(!ch.price_updated,'different package is not same-package change');
console.log(`kk-market-presentation-contract: ${n}/${n} PASS`);
