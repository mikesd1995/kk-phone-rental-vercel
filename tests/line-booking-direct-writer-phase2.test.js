'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/line-booking-direct-writer-phase2.js');

function env(extra={}){return Object.assign({
 GOOGLE_SHEET_ID:'12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU',
 GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_EMAIL:'writer@example.test',
 GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY:'-----BEGIN PRIVATE KEY-----\\nTEST\\n-----END PRIVATE KEY-----',
 KK_ADMIN_DIRECT_WRITER_ENABLED:'1',KK_ADMIN_DIRECT_WRITER_ACCEPTED:'1',KK_ADMIN_DIRECT_WRITER_WRITE_PROBE_PASSED:'1',
 KK_LINE_BOOKING_DIRECT_WRITER_PHASE2_ENABLED:'1'
},extra);}
function payload(extra={}){return Object.assign({
 action:'createBooking',request_id:'line:'+'a'.repeat(48),event_id:'EVT-1',template_id:'TPL-1',
 customer_name:'Mint',customer_phone:'0812345678',customer_contact:'U1',contact_channel:'LINE',
 booking_status:'pending',payment_status:'unpaid',pickup_time:'14:00',package_type:'phone_lens_bundle',
 phone_asset_id:'',lens_asset_id:'',booking_note:'LINE intake'
},extra);}

test('Phase 2 is disabled by default and requires deterministic LINE request id',()=>{
 assert.throws(()=>P.assertIntent(Object.assign(payload(),{__env:{}})),e=>e.code==='LINE_BOOKING_PHASE2_DISABLED');
 assert.throws(()=>P.assertIntent(Object.assign(payload({request_id:'random'}),{__env:env()})),e=>e.code==='LINE_BOOKING_REQUEST_ID_REQUIRED');
});
test('pending LINE intake cannot pre-assign phone or lens assets',()=>{
 assert.throws(()=>P.assertIntent(Object.assign(payload({phone_asset_id:'PHONE-1'}),{__env:env()})),e=>e.code==='LINE_BOOKING_PENDING_ASSET_FORBIDDEN');
 assert.throws(()=>P.assertIntent(Object.assign(payload({lens_asset_id:'LENS-1'}),{__env:env()})),e=>e.code==='LINE_BOOKING_PENDING_ASSET_FORBIDDEN');
});
test('planner writes only B:T and can reuse formula-only A row',()=>{
 const p=P.buildPlan(Object.assign(payload(),{__env:env()}),{bookings:[['BK-FORMULA','','','',''],['BK-USED','2026','confirmed','EVT-X']]},new Date('2026-10-01T00:00:00Z'));
 assert.equal(p.row_number,5);
 assert.equal(p.mutations[0].column,2);
 assert.equal(p.mutations[0].values.length,19);
 assert.equal(p.mutations[0].values[1],'pending');
 assert.equal(p.mutations[0].values[8],'');
 assert.equal(p.mutations[0].values[9],'');
 assert.equal(p.canonical_readback.range,'00_Master_Booking!A5:T5');
});
test('canonical readback requires generated ID and blank pending assets',()=>{
 assert.throws(()=>P.canonicalBooking(['','2026','pending','EVT'],5),e=>e.code==='LINE_BOOKING_ID_READBACK_REQUIRED');
 const row=['BK-001','2026','pending','EVT','Mint','U','081','LINE','phone_only','','','','unpaid',0];
 assert.deepEqual(P.canonicalBooking(row,5),{booking_id:'BK-001',row_number:5,booking_status:'pending'});
 row[9]='PHONE-1';
 assert.throws(()=>P.canonicalBooking(row,5),e=>e.code==='LINE_BOOKING_PENDING_ASSET_READBACK');
});
test('atomic batch targets B:T start column and appends audit in same batch',()=>{
 const p=P.buildPlan(Object.assign(payload(),{__env:env()}),{bookings:[]},new Date('2026-10-01T00:00:00Z'));
 const reqs=P.requestBatch(p,{'00_Master_Booking':21,'15_Admin_Audit_Log':15},new Date('2026-10-01T00:00:00Z'));
 assert.equal(reqs.length,2);
 assert.equal(reqs[0].updateCells.range.sheetId,21);
 assert.equal(reqs[0].updateCells.range.startColumnIndex,1);
 assert.equal(reqs[0].updateCells.range.endColumnIndex,20);
 assert.equal(reqs[1].appendCells.sheetId,15);
 assert.match(JSON.stringify(reqs[1]),/line:/);
});
test('idempotent replay returns prior canonical booking without loading or mutating',async()=>{
 let loads=0,batches=0;
 const out=await P.tryExecute(payload(),{
  env:env(),tokenProvider:async()=> 'token',
  findAuditRequest:async id=>({status:'OK',action:'createBooking',row_number:77,result:{booking_id:'BK-77',row_number:25,request_id:id}}),
  loadBookings:async()=>{loads++;return {bookings:[]};},
  executeBatch:async()=>{batches++;}
 });
 assert.equal(out.idempotent_replay,true); assert.equal(out.body.data.booking_id,'BK-77'); assert.equal(loads,0); assert.equal(batches,0);
});
test('successful execution requires canonical A:T readback and audit verification',async()=>{
 const calls=[];
 const out=await P.tryExecute(payload(),{
  env:env(),tokenProvider:async()=> 'token',findAuditRequest:async()=>null,
  loadBookings:async()=>({bookings:[]}),
  sheetMap:async()=>({'00_Master_Booking':21,'15_Admin_Audit_Log':15}),
  executeBatch:async()=>{calls.push('batch');},
  readCanonical:async range=>{calls.push(range);return [['BK-001','2026-10-01','pending','EVT-1','Mint','U1','0812345678','LINE','phone_lens_bundle','','','14:00','', 'unpaid',0,'','','',0,'LINE intake']];},
  verifyAudit:async()=>{calls.push('audit');return {ok:true};}
 });
 assert.equal(out.body.data.booking_id,'BK-001');
 assert.deepEqual(calls,['batch','00_Master_Booking!A5:T5','audit']);
});
test('post-mutation readback failure is uncertain and forbids legacy fallback',async()=>{
 await assert.rejects(()=>P.tryExecute(payload(),{
  env:env(),tokenProvider:async()=> 'token',findAuditRequest:async()=>null,loadBookings:async()=>({bookings:[]}),
  sheetMap:async()=>({'00_Master_Booking':21,'15_Admin_Audit_Log':15}),executeBatch:async()=>({}),
  readCanonical:async()=>[[]],verifyAudit:async()=>({ok:true})
 }),e=>e.code==='LINE_BOOKING_ID_READBACK_REQUIRED'&&e.mutation_committed===true&&e.no_legacy_fallback===true);
});
