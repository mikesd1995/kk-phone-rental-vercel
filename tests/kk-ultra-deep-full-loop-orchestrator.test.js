'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const O=require('../server/kk-ultra-deep-full-loop-orchestrator.js');
const discovery={full:true,status:'READY_FOR_VERIFIER',month:'2026-10'};
const candidate={candidate_id:'E1',event_key:'E1',title:'Event One',event_date:'2026-10-20',venue:'Bangkok',rental_fit_score:8};
test('hidden existing event is never recreated or mutated',async()=>{let writes=0;const r=await O.run({discovery,candidates:[candidate],existing_events:[{event_id:'OLD',event_name:'Event One',event_date:'2026-10-20',active_on_web:false,poster_url:'https://x/a.jpg',packages:[{package_type:'phone_only',price:590}]}]},{existingEventWriterFn:async()=>{writes++;}});assert.equal(r.rows[0].status,'SKIPPED_OWNER_HIDDEN');assert.equal(writes,0);});
test('booking date skips discovery/mutation regardless of market',async()=>{let writes=0;const r=await O.run({discovery,candidates:[candidate],bookings:[{event_date:'2026-10-20',booking_status:'confirmed'}],existing_events:[{event_id:'OLD',event_name:'Event One',event_date:'2026-10-20',active_on_web:true,poster_url:'https://x/a.jpg',packages:[{package_type:'phone_only',price:590}]}],competitor_prices:[{event_key:'E1',exact_event:true,price:790}]},{existingEventWriterFn:async()=>{writes++;}});assert.equal(r.rows[0].status,'SKIPPED_BOOKING_DATE');assert.equal(writes,0);});
test('existing event produces market repricing and poster refresh plan without bypassing writer',async()=>{const r=await O.run({discovery,candidates:[candidate],existing_events:[{event_id:'OLD',event_name:'Event One',event_date:'2026-10-20',active_on_web:true,poster_url:'https://x/a.jpg',packages:[{template_id:'P',package_type:'phone_only',price:790}]}],competitor_prices:[{event_key:'E1',exact_event:true,price:590},{event_key:'E1',exact_event:true,price:690},{event_key:'E1',exact_event:true,price:690}],posters:[{event_key:'E1',verified:true,official:true,image_url:'https://x/b.jpg'}]});assert.equal(r.rows[0].status,'UPDATE_READY');assert.equal(r.rows[0].update_plan.actions[0].override_price,690);assert.equal(r.rows[0].update_plan.actions[1].action,'updateEvent');assert.equal(r.production_writes,0);});
test('existing mutation counts only after exact readback receipt',async()=>{const r=await O.run({discovery,candidates:[candidate],existing_events:[{event_id:'OLD',event_name:'Event One',event_date:'2026-10-20',active_on_web:true,poster_url:'https://x/a.jpg',packages:[{template_id:'P',package_type:'phone_only',price:790}]}],competitor_prices:[{event_key:'E1',exact_event:true,price:690}],posters:[{event_key:'E1',verified:true,official:true,image_url:'https://x/b.jpg'}]},{existingEventWriterFn:async()=>({readback_verified:true})});assert.equal(r.rows[0].status,'UPDATED_VERIFIED');assert.equal(r.production_writes,2);});

test('existing repricing normalizes bundle competitor prices to phone basis',async()=>{
 const rows=O.marketComparableRowsFor(candidate,{
  package_templates:[{package_type:'lens_only',standard_price:200}],
  competitor_prices:[
   {event_key:'E1',exact_event:true,package_type:'PHONE_ONLY',price:690},
   {event_key:'E1',exact_event:true,package_type:'PHONE_LENS',price:990},
   {event_key:'E1',exact_event:true,package_type:'LENS_ONLY',price:200}
  ]
 });
 assert.deepEqual(rows.map(x=>x.price),[690,790]);
 assert.equal(rows.some(x=>x.package_type==='LENS_ONLY'),false);
});
