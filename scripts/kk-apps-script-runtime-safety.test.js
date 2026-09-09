'use strict';
const assert=require('node:assert/strict');
const {Sheet,context}=require('./helpers/apps-script-sandbox');
let count=0;
function test(name,fn){try{fn();count++;console.log('PASS '+name);}catch(e){console.error('FAIL '+name+': '+e.message);process.exitCode=1;}}
function fixture(){
  const row=Array(20).fill('');Object.assign(row,{0:'BK-B',1:new Date('2099-01-01'),2:'confirmed',3:'EV',4:'SYNTHETIC',8:'phone_only',13:'unpaid'});
  const sh=new Sheet('00_Master_Booking',[[],[],[],[],row]);const c=context({'00_Master_Booking':sh});
  c.kkGetEventById_=()=>({event_date:new Date('2099-01-01')});
  return {c,sh,row};
}
test('Web app uses the same script lock as spreadsheet menu, not a null document lock',()=>{
  const c=context();let acquired=0;
  c.LockService.getDocumentLock=()=>null;
  c.LockService.getScriptLock=()=>({tryLock:()=>{acquired++;return true;},hasLock:()=>true,releaseLock:()=>{}});
  assert.ok(c.kkAcquireDocumentLock_('test',1000));assert.equal(acquired,1);
});
test('busy canonical script lock prevents booking mutation',()=>{
  const {c,sh}=fixture();c.LockService.getScriptLock=()=>({tryLock:()=>false});
  assert.throws(()=>c.kkApiUpdateBooking_({row_number:5,booking_id:'BK-B',expected_revision:'synthetic',booking_status:'cancelled'}));
  assert.equal(sh.writes,0);
});
test('row-only legacy update fails closed',()=>{const {c,sh}=fixture();assert.throws(()=>c.kkApiUpdateBooking_({row_number:5,booking_status:'cancelled'}));assert.equal(sh.writes,0);});
test('stale row hint cannot target a different booking',()=>{const {c,sh}=fixture();assert.throws(()=>c.kkApiUpdateBooking_({row_number:5,booking_id:'BK-A',expected_revision:'synthetic',booking_status:'cancelled'}));assert.equal(sh.writes,0);});
test('duplicate canonical booking ID is ambiguous, not first-row-wins',()=>{const {c,sh,row}=fixture();sh.rows.push([...row]);assert.throws(()=>c.kkFindBookingRow_(5,'BK-B'));});
test('stale revision rejects changes even with the correct booking ID',()=>{const {c,sh}=fixture();assert.throws(()=>c.kkApiUpdateBooking_({row_number:5,booking_id:'BK-B',expected_revision:'old',booking_status:'cancelled'}));assert.equal(sh.writes,0);});
test('exact identity and revision update the intended booking with exact readback',()=>{
  const {c,sh,row}=fixture();const r=c.kkApiUpdateBooking_({row_number:5,booking_id:'BK-B',expected_revision:c.kkBookingRevision_(row),booking_status:'cancelled'});
  assert.equal(sh.rows[4][2],'cancelled');assert.equal(r.booking_id,'BK-B');assert.equal(r.revision,c.kkBookingRevision_(sh.rows[4]));
});
test('post-write mismatch is ambiguous and never a success receipt',()=>{
  const {c,sh,row}=fixture();const revision=c.kkBookingRevision_(row);sh.onWrite=()=>{sh.rows[4][4]='CORRUPTED';};
  assert.throws(()=>c.kkApiUpdateBooking_({row_number:5,booking_id:'BK-B',expected_revision:revision,booking_status:'cancelled'}),/READBACK_MISMATCH/);
});
test('snapshot payment tasks use payment status, not received amount',()=>{
  const c=context();const paid=Array(20).fill('');Object.assign(paid,{0:'PAID',2:'confirmed',3:'EV',4:'SYNTHETIC',13:'paid',14:590});const unpaid=[...paid];Object.assign(unpaid,{0:'UNPAID',13:'unpaid',14:0});
  c.PropertiesService={getDocumentProperties:()=>({getProperty:()=>''})};c.kkModelDisplayMap_=()=>({});c.kkGetValues_=n=>n==='00_Master_Booking'?[paid,unpaid]:[];
  c.kkApiDate_=()=>'';c.kkApiDateTime_=()=>'';c.kkApiWebReadyRows_=()=>[];c.kkApiWebPackageRows_=()=>[];c.kkReadCustomerStats_=()=>[];c.kkPhase1Diagnostics_=()=>({});c.SpreadsheetApp.getActive=()=>({getId:()=> 'SYNTHETIC-SHEET'});
  const rows=c.kkApiSnapshot_({}).data.bookings;
  assert.ok(!rows.find(r=>r.booking_id==='PAID').work_task.includes('ตามชำระเงิน'));
  assert.ok(rows.find(r=>r.booking_id==='UNPAID').work_task.includes('ตามชำระเงิน'));
  assert.match(rows[0].revision,/^[a-f0-9]{64}$/);
});
test('missing receipt overlay cannot fall back to the legacy business writer',()=>{
  const {c,sh}=fixture();assert.throws(()=>c.kkApiCreateBooking_({}),/BOOKING_RECEIPT_WRITER_REQUIRED/);assert.equal(sh.writes,0);
});
test('Quick Booking dispatches exactly once through the canonical writer without rewriting request inputs',()=>{
  const c=context();let calls=0,inputWrites=0;const inputs=['EV','TPL','SYNTHETIC','','','LINE','confirmed','','','unpaid',0,''];
  c.SpreadsheetApp.getUi=()=>({alert:()=>{}});c.kkRange_=()=>({getValues:()=>inputs.map(v=>[v]),setValues:()=>{inputWrites++;}});
  c.kkApiCreateBooking_=p=>{calls++;assert.equal(p.event_id,'EV');assert.equal(p.phone_asset_id,'');return {booking_id:'SYNTHETIC',phone_asset_id:'ALLOCATED'};};
  c.kkAddQuickBookingFromDashboard();assert.equal(calls,1);assert.equal(inputWrites,0);
});
test('duplicate request receipt identities fail closed',()=>{
  const c=context({},true);const sh=new Sheet('receipts',[[],['r','f','PREPARED',5],['r','f','COMMITTED',6]]);
  assert.throws(()=>c.kkFindBookingReceipt_(sh,'r'),/NOT_EXACT1/);
});
test('receipt writer rejects readback corruption of every persisted field',()=>{
  const c=context({},true);const expected=['r','f','PREPARED',5,'wf','phone','','EV','TPL',new Date('2099-01-01'),'','BK','{}','version',''];
  for(let field=0;field<expected.length;field++){
    const sh=new Sheet('receipts',[[]]);sh.onWrite=()=>{sh.rows[1][field]='CORRUPTED';};
    const lock=c.kkAcquireDocumentLock_('test',1000);
    assert.throws(()=>c.kkWriteBookingReceipt_(sh,2,expected),/FULL_READBACK_MISMATCH/,'field '+field);
    lock.releaseLock();
  }
});
test('PREPARED without immutable expected ID remains reconciliation-only',()=>{
  const c=context({},true);assert.throws(()=>c.kkFinalizePreparedBookingReceipt_(new Sheet('receipts'),{target_row:5}),/expected booking ID missing/);
});
test('PREPARED recovery cannot commit a wrong identity even when business fingerprint matches',()=>{
  const {sh,row}=fixture();const c=context({'00_Master_Booking':sh},true);const receipts=new Sheet('receipts');
  const receipt={booking_id:'EXPECTED-ID',target_row:5,write_fingerprint:c.kkBookingWriteFingerprint_(row.slice(1))};
  assert.throws(()=>c.kkFinalizePreparedBookingReceipt_(receipts,receipt),/BOOKING_ID_READBACK_MISMATCH/);assert.equal(receipts.writes,0);
});
test('canonical writer releases the actual script lock after a validation error',()=>{
  const c=context({},true);let released=0;
  c.LockService.getScriptLock=()=>({tryLock:()=>true,hasLock:()=>true,releaseLock:()=>{released++;}});
  c.kkEnsureLensCompatibilityPatchInstalled_=()=>{};
  assert.throws(()=>c.kkApiCreateBooking_({}),/Please fill/);assert.equal(released,1);
});
test('nested compatibility helper cannot release the outer booking lock',()=>{
  const c=context();let held=false,acquired=0,released=0;
  c.LockService.getScriptLock=()=>({tryLock:()=>{acquired++;held=true;return true;},hasLock:()=>held,releaseLock:()=>{held=false;released++;}});
  const outer=c.kkAcquireDocumentLock_('outer'),inner=c.kkTryDocumentLock_('inner');
  inner.releaseLock();inner.releaseLock();outer.assertHeld();assert.equal(held,true);assert.equal(acquired,1);assert.equal(released,0);
  outer.releaseLock();assert.equal(held,false);assert.equal(released,1);assert.throws(()=>outer.assertHeld());
});
test('lost ownership never silently reacquires in a nested writer',()=>{
  const c=context();let held=true,acquired=0;
  c.LockService.getScriptLock=()=>({tryLock:()=>{acquired++;return true;},hasLock:()=>held,releaseLock:()=>{}});
  const outer=c.kkAcquireDocumentLock_('outer');held=false;
  assert.throws(()=>c.kkTryDocumentLock_('nested'),/OWNERSHIP_LOST/);assert.throws(()=>outer.assertHeld());assert.equal(acquired,1);outer.releaseLock();
});
test('canonical dispatch survives either Apps Script file evaluation order',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const code=fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8');
  const receipt=fs.readFileSync(path.join(__dirname,'../apps-script/BookingIdempotency.gs'),'utf8');
  for(const order of [[code,receipt],[receipt,code]]){
    const c={};vm.createContext(c);order.forEach(src=>vm.runInContext(src,c));
    let calls=0;c.kkBookingCreateWithReceipt_=payload=>{calls++;return payload.request_id;};
    assert.equal(c.kkApiCreateBooking_({request_id:'synthetic'}),'synthetic');assert.equal(calls,1);
  }
});
console.log(`${count} Apps Script runtime-safety assertions passed (local synthetic services only)`);
