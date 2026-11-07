'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Ops=require('../server/kk-admin-ops-projection.js');
const SAMPLE=()=>({ok:true,data:{
 generated_at:'2026-11-08T01:30:00',snapshot_source:'direct-sheet-private-service-account',fallback_reader:'private-service-account',spreadsheet_id:'SHOULD_NOT_SEND',
 events:[{event_id:'EV-1',event_name:'Concert',event_date:'2026-12-01',venue:'Hall',poster_url:'https://example.org/a.jpg',status:'open',active_on_web:true,note:'customer secret'}],
 web_ready:[{event_id:'EV-1',event_name:'Concert',event_date:'2026-12-01',venue:'Hall',available_phone_count:1,action_for_web:'show',line_message_template:'0980000000',event_note:'Private'}],
 web_packages:[{package_id:'PK-1',event_id:'EV-1',package_type:'phone_only',available_count:1,price:590,package_status:'available',web_note:'PRIVATE NOTE'}],
 bookings:[{booking_id:'BK-PRIVATE-123',event_id:'EV-1',booking_status:'confirmed',customer_name:'PRIVATE_CUSTOMER',customer_phone:'0980000000',customer_contact:'PRIVATE_LINE_ID',payment_status:'paid',amount_received:9999},
 {booking_id:'BK-PRIVATE-123',event_id:'EV-1',booking_status:'cancelled',customer_name:'PRIVATE_CUSTOMER'}],
 customers:[{name:'PRIVATE_CUSTOMER'}],current_bookings:[{booking_id:'BK-PRIVATE-123'}],
 visibility_locks:[{event_id:'EV-1',lock_state:'LOCKED',lock_reason:'PRIVATE NOTE'}]
}});
test('server-side allowlist removes personal, payment and internal fields',()=>{
 const x=Ops.project(SAMPLE(),size=>Buffer.alloc(size,1));
 const txt=JSON.stringify(x);
 for(const secret of ['PRIVATE_CUSTOMER','PRIVATE_LINE_ID','0980000000','BK-PRIVATE-123','9999','customer_name','customer_phone','amount_received','line_message_template','spreadsheet_id','lock_reason','web_note','current_bookings']){
  assert.ok(!txt.includes(secret),'must not expose '+secret);
 }
 assert.equal(x.data.events.length,1);assert.equal(x.data.bookings.length,2);assert.equal(x.data.projection_version,Ops.VERSION);
 assert.deepEqual(x.data.visibility_locks,[{event_id:'EV-1',lock_state:'LOCKED'}]);
});
test('pseudonyms detect duplicate booking IDs but cannot be linked across responses',()=>{
 const input=SAMPLE();
 const a=Ops.project(input,size=>Buffer.alloc(size,1));
 const b=Ops.project(input,size=>Buffer.alloc(size,2));
 assert.equal(a.data.bookings[0].booking_id,a.data.bookings[1].booking_id);
 assert.notEqual(a.data.bookings[0].booking_id,b.data.bookings[0].booking_id);
 assert.equal(input.data.bookings[0].booking_id,'BK-PRIVATE-123');
});
test('invalid or missing booking identities remain empty, never fake trusted IDs',()=>{
 const input=SAMPLE();input.data.bookings[0].booking_id='';
 const safe=Ops.project(input).data.bookings;
 assert.equal(safe[0].booking_id,'');assert.ok(safe[1].booking_id);
});
test('missing required arrays are rejected, not treated as zero bookings',()=>{
 for(const name of ['events','web_ready','web_packages','bookings']){
  const input=SAMPLE();delete input.data[name];
  assert.throws(()=>Ops.project(input),new RegExp('OPS_INCOMPLETE_'+name.toUpperCase()));
 }
 assert.throws(()=>Ops.project({ok:false,data:SAMPLE().data}),/OPS_SOURCE_REJECTED/);
});
test('optional missing Owner Locks remain missing, not silently marked safe',()=>{
 const input=SAMPLE();delete input.data.visibility_locks;
 const safe=Ops.project(input);
 assert.equal(Object.hasOwn(safe.data,'visibility_locks'),false);
});
test('malformed rows and oversized source are rejected',()=>{
 const input=SAMPLE();input.data.bookings=[null];
 assert.throws(()=>Ops.project(input),/OPS_INVALID_ROW_BOOKINGS/);
 const oversized=SAMPLE();oversized.data.bookings=Array(20001).fill({});
 assert.throws(()=>Ops.project(oversized),/OPS_ROWS_EXCEEDED_BOOKINGS/);
});
test('negative and nonnumeric counts stay unknown, not available',()=>{
 const x=SAMPLE();x.data.web_ready[0].available_phone_count=-1;x.data.web_packages[0].available_count='Infinity';
 const safe=Ops.project(x);assert.equal(safe.data.web_ready[0].available_phone_count,null);assert.equal(safe.data.web_packages[0].available_count,null);
});
