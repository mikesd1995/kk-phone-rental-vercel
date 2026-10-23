'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../scripts/admin-gviz-live-snapshot-acceptance.cjs');
function fixture(){
 return {snapshot_source:'direct-sheet-gviz-readonly-fallback',write_actions_enabled:false,
  degraded_read_only:true,events:[{event_id:'EV1'}],bookings:[{booking_id:'BK1'}],
  current_bookings:[],assets:[{asset_id:'AS1'}]};
}
test('live snapshot acceptance verifies nonempty arrays and remains read only without external credentials',async()=>{
 let input;
 const result=await A.accept({buildSnapshot:async opts=>{input=opts;return fixture();},assess:()=>({ok:true})});
 assert.equal(result.ok,true);
 assert.equal(result.counts.bookings,1);
 assert.deepEqual(input.env,{});
 assert.equal(input.cache,false);
 assert.equal(result.write_guard_valid,true);
});
test('live snapshot rejects write-enabled, bad source or empty Booking without returning Booking payload',async()=>{
 for(const patch of [{write_actions_enabled:true},{snapshot_source:'other'},{bookings:[]}]){
  const out=await A.accept({buildSnapshot:async()=>({...fixture(),...patch}),assess:()=>({ok:true})});
  assert.equal(out.ok,false);
  assert.doesNotMatch(JSON.stringify(out),/BK1|EV1|AS1/);
 }
});
test('live snapshot rejects health failure',async()=>{
 const out=await A.accept({buildSnapshot:async()=>fixture(),assess:()=>({ok:false})});
 assert.equal(out.ok,false);
});
