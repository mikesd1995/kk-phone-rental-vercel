'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../server/kk-booking-lifecycle-shadow.js');
const good={booking_id:'TEST-A',booking_status:'uploaded',payment_status:'paid',amount_received:'1,090',package_price:'1,090',return_status:'returned',file_transfer_status:'sent',drive_link:'https://drive.google.com/drive/folders/1ExampleFolder0123456789'};
test('persisted receipt, returned equipment, upload and link are required',()=>{
 const r=R.checkCompletionTransition(good,{booking_status:'completed'});
 assert.equal(r.ok,true);assert.equal(r.stage,'READY_FOR_GOVERNED_WRITER');assert.equal(r.production_writes,0);
});
test('client cannot spoof persisted payment, return, upload or Drive',()=>{
 const prior={...good,payment_status:'unpaid',return_status:'',file_transfer_status:'',drive_link:''};
 const r=R.checkCompletionTransition(prior,{...good,booking_status:'completed'});
 assert.equal(r.ok,false);assert.equal(r.errors.length,4);
});
test('confirmed, picked_up and returned cannot skip uploaded stage',()=>{
 for(const st of ['confirmed','picked_up','returned']){
  const r=R.checkCompletionTransition({...good,booking_status:st},{booking_status:'completed'});
  assert.equal(r.ok,false);assert.ok(r.errors.includes('COMPLETION_REQUIRES_UPLOADED_STATE'));
 }
});
test('Drive domain must be exact HTTPS, never lookalike',()=>{
 assert.equal(R.validDrive(good.drive_link),true);assert.equal(R.validDrive('https://docs.google.com/document/d/1ExampleDocument0123456'),true);
 for(const url of ['https://drive.google.com.evil.org/x','http://drive.google.com/x','https://drive.google.com@evil.com/a','https://example.com/x','https://drive.google.com/','https://docs.google.com/','https://drive.google.com/drive/folders/demo','https://drive.google.com/drive/folders/1ExampleFolder0123456789#anchor','invalid']){
  assert.equal(R.validDrive(url),false);
 }
});
test('unrelated updates and completed historical rows never rewritten',()=>{
 assert.equal(R.checkCompletionTransition({...good,booking_status:'confirmed'},{booking_status:'prepared'}).ok,true);
 assert.equal(R.checkCompletionTransition({...good,booking_status:'completed'},{booking_status:'completed'}).stage,'ALREADY_COMPLETED_NO_TRANSITION');
});
test('monetary field parses formatted baht values, not suspicious amounts',()=>{
 assert.equal(R.amount('1,090'),1090);assert.equal(R.amount('890'),890);assert.equal(R.amount(''),0);
 assert.equal(R.amount('-1'),null);assert.equal(R.amount('1,xxx'),null);
});
test('Actual completed-only, Future active-only; cancelled excluded',()=>{
 const rows=[{...good,booking_status:'completed'},
 {...good,booking_id:'TEST-B',booking_status:'confirmed',payment_status:'unpaid',amount_received:'990',package_price:'990'},
 {...good,booking_id:'TEST-C',booking_status:'cancelled',payment_status:'paid',amount_received:'500'},
 {...good,booking_id:'TEST-D',booking_status:'',amount_received:'800'}];
 const a=R.audit(rows);assert.equal(a.totals.actual_completed_by_status,1090);
 assert.equal(a.totals.future_active_quote,990);assert.equal(a.totals.forecast_by_status,2080);
 assert.equal(a.issues.cancelled_paid_refund_review,1);
 assert.equal(a.issues.confirmed_unpaid_with_amount_field,1);assert.equal(a.safety.production_writes,0);
});
test('legacy completed with missing evidence is flagged, never auto-reclassified',()=>{
 const a=R.audit([{...good,booking_status:'completed',return_status:'',file_transfer_status:'',drive_link:''}]);
 assert.equal(a.issues.historical_completed_missing_evidence,1);
 assert.equal(a.totals.actual_completed_by_status,1090);
 assert.equal(a.totals.verified_completed_receipt,0);
 assert.equal(a.safety.historical_reclassification_authorized,false);
});

test('read-only snapshot attaches aggregate audit and Admin renders owner warnings',()=>{
 const fs=require('node:fs');
 const src=fs.readFileSync(require.resolve('../server/admin-sheet-fallback.js'),'utf8');
 const ui=fs.readFileSync(require.resolve('../admin/admin.js'),'utf8');
 assert.match(src,/booking_closure_evidence_shadow:BookingLifecycleShadow\.audit\(bookings\)/);
 assert.match(ui,/const closure=data&&data\.booking_closure_evidence_shadow/);
 assert.match(ui,/Booking · หลักฐานปิดงาน/);
 assert.match(ui,/Booking · ราคาจองยังไม่ครบ/);
});
test('aggregate shadow never leaks customer PII or enables writes',()=>{
 const a=R.audit([{booking_id:'B',customer_name:'SECRET',customer_phone:'0123456789',booking_status:'completed',
  payment_status:'paid',amount_received:'590',return_status:'',file_transfer_status:'',drive_link:''}]);
 assert.equal(a.issues.historical_completed_missing_evidence,1);
 assert.equal(JSON.stringify(a).includes('SECRET'),false);
 assert.equal(JSON.stringify(a).includes('0123456789'),false);
 assert.equal(a.safety.production_writes,0);
});

test('fallback buildFromRaw computes Booking closure audit from canonical persisted fields',()=>{
 const Fallback=require('../server/admin-sheet-fallback.js');
 const raw=Object.fromEntries(Object.keys(Fallback.SPECS).map(k=>[k,[]]));
 raw.bookings=[{__row_number:5,booking_id:'BK-TEST-1',booking_status:'completed',
   payment_status:'paid',amount_received:'590',return_status:'',
   file_transfer_status:'',drive_link:''}];
 const snap=Fallback.buildFromRaw(raw,'SHEET_TEST',Date.now());
 assert.equal(snap.bookings.length,1);
 assert.equal(snap.booking_closure_evidence_shadow.counts.completed,1);
 assert.equal(snap.booking_closure_evidence_shadow.issues.historical_completed_missing_evidence,1);
 assert.equal(snap.booking_closure_evidence_shadow.safety.production_writes,0);
 assert.equal(JSON.stringify(snap.booking_closure_evidence_shadow).includes('BK-TEST-1'),false);
});

test('live System Health still includes aggregate Booking closure warnings',()=>{
 const fs=require('node:fs');
 const ui=fs.readFileSync(require.resolve('../admin/admin.js'),'utf8');
 assert.match(ui,/function bookingClosureGuardRows\(data\)/);
 assert.match(ui,/rows\.push\(\.\.\.bookingClosureGuardRows\(d\)\)/);
 assert.match(ui,/state\.systemHealth\.rows\.concat\(bookingClosureGuardRows\(state\.data\|\|\{\}\)\)/);
});


test('Future uses locked package_price even with zero deposit or a different handover receipt',()=>{
 const a=R.audit([
  {...good,booking_id:'FUTURE-NO-DEPOSIT',booking_status:'confirmed',payment_status:'unpaid',amount_received:0,package_price:'1,290'},
  {...good,booking_id:'FUTURE-HANDOVER',booking_status:'picked_up',payment_status:'paid',amount_received:890,package_price:'990'},
  {...good,booking_id:'EXCLUDED',booking_status:'cancelled',package_price:'700',amount_received:700}
 ]);
 assert.equal(a.totals.future_active_quote,2280);
 assert.equal(a.totals.actual_completed_by_status,0);
 assert.equal(a.totals.forecast_by_status,2280);
 assert.equal(a.issues.active_missing_package_price,0);
 assert.match(a.policy.future_source,/package_price/);
});
test('missing active booking package quote is warned about, never filled using fake cash',()=>{
 const a=R.audit([{...good,booking_id:'MISSING-QUOTE',booking_status:'confirmed',payment_status:'unpaid',amount_received:0,package_price:''}]);
 assert.equal(a.totals.future_active_quote,0);
 assert.equal(a.issues.active_missing_package_price,1);
 assert.equal(a.safety.production_writes,0);
});
test('Admin fallback reads Master column X and includes quote in read-only booking projection',()=>{
 const Fallback=require('../server/admin-sheet-fallback.js');
 assert.equal(Fallback.SPECS.bookings.range,'A4:X');
 const raw=Object.fromEntries(Object.keys(Fallback.SPECS).map(k=>[k,[]]));
 raw.bookings=[{__row_number:5,booking_id:'SHADOW-FUTURE',booking_status:'confirmed',payment_status:'unpaid',amount_received:'0',package_price:'690'}];
 const snap=Fallback.buildFromRaw(raw,'SHADOW_TEST',Date.now());
 assert.equal(snap.bookings[0].package_price,690);
 assert.equal(snap.booking_closure_evidence_shadow.totals.future_active_quote,690);
 assert.equal(snap.booking_closure_evidence_shadow.issues.active_missing_package_price,0);
});


test('completed cannot be approved after upload until customer link has been delivered',()=>{
 const stillUploading=R.checkCompletionTransition({...good,file_transfer_status:'uploaded'},{booking_status:'completed'});
 assert.equal(stillUploading.ok,false);
 assert.ok(stillUploading.errors.includes('DRIVE_UPLOAD_UNVERIFIED'));
 const sent=R.checkCompletionTransition({...good,file_transfer_status:'sent'},{booking_status:'completed'});
 assert.equal(sent.ok,true);
});
test('completed requires full agreed booking price collected on physical handover',()=>{
 for(const receipt of [0,890]){
  const result=R.checkCompletionTransition({...good,amount_received:receipt,package_price:1090},{booking_status:'completed'});
  assert.equal(result.ok,false);
  assert.ok(result.errors.includes('HANDOVER_RECEIPT_UNVERIFIED'));
 }
 assert.equal(R.checkCompletionTransition({...good,amount_received:1090,package_price:1090},{booking_status:'completed'}).ok,true);
 assert.equal(R.checkCompletionTransition({...good,package_price:''},{booking_status:'completed'}).ok,false,'unknown agreed quote must fail closed');
});
