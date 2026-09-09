'use strict';
const assert=require('node:assert/strict');
const {Sheet,context}=require('./helpers/apps-script-sandbox');
let count=0;
function test(name,fn){try{fn();count++;console.log('PASS '+name);}catch(e){console.error('FAIL '+name+': '+e.stack);process.exitCode=1;}}
// Captured live A5 formula, 2026-09-08, headers/formulas only; no customer data.
const formula=r=>`=IF(D${r}="","",IFERROR("BK-"&TEXT(VLOOKUP(D${r},'01_Events'!$A$5:$C$1000,3,FALSE),"yyyymmdd")&"-"&TEXT(COUNTIF($D$5:D${r},D${r}),"000"),"CHECK EVENT"))`;
const date=new Date('2099-01-01T00:00:00Z');
function fixture(){
  const bookings=new Sheet('00_Master_Booking',[[],[],[],[]]);bookings.formula=formula;
  const events=new Sheet('01_Events',[[],[],[],[],['EV-A','A',date],['EV-B','B',date]]);
  const c=context({'00_Master_Booking':bookings,'01_Events':events},true);
  return {c,bookings,events};
}
function existing(id,event){const r=Array(20).fill('');r[0]=id;r[1]=date;r[2]='confirmed';r[3]=event;return r;}
test('exact live COUNTIF formula derives the prospective ID before any write',()=>{
  const {c,bookings}=fixture();assert.equal(c.kkExpectedBookingIdBeforeWrite_(date,5,'EV-A'),'BK-20990101-001');assert.equal(bookings.writes,0);
});
test('different event same date collision rejected before business write',()=>{
  const {c,bookings}=fixture();bookings.rows.push(existing('BK-20990101-001','EV-A'));
  assert.throws(()=>c.kkExpectedBookingIdBeforeWrite_(date,6,'EV-B'),/PREWRITE_COLLISION/);assert.equal(bookings.writes,0);
});
test('same event increment uses prior event keys rather than global date count',()=>{
  const {c,bookings}=fixture();bookings.rows.push(existing('BK-20990101-001','EV-A'));
  assert.equal(c.kkExpectedBookingIdBeforeWrite_(date,6,'EV-A'),'BK-20990101-002');
});
test('first-hole insertion is rejected and append selector preserves existing row sequence',()=>{
  const {c,bookings}=fixture();bookings.rows.push([],existing('BK-20990101-001','EV-A'));
  assert.equal(c.kkNextAppendBookingRow_(),7);assert.throws(()=>c.kkExpectedBookingIdBeforeWrite_(date,5,'EV-A'),/APPEND_ONLY_REQUIRED/);
});
test('keyword-containing or altered formula never counts as verified semantics',()=>{
  const {c,bookings}=fixture();for(const f of ['="WRONG"&IF(FALSE,SUMPRODUCT(VLOOKUP(D5,A:C,3,FALSE)),"")',formula(5).replace('"BK-"','"XX-"'),formula(6)]){
    bookings.formula=f;assert.throws(()=>c.kkExpectedBookingIdBeforeWrite_(date,5,'EV-A'),/FORMULA_UNSAFE/);
  }
});
test('lookup ambiguity, wildcard keys and out-of-bounds rows fail before mutation',()=>{
  const {c,events}=fixture();for(const key of ['EV*','123','EV?A'])assert.throws(()=>c.kkExpectedBookingIdBeforeWrite_(date,5,key));
  for(const row of [4,5.5,1001,NaN])assert.throws(()=>c.kkExpectedBookingIdBeforeWrite_(date,row,'EV-A'));
  events.rows.push(['ev-a','duplicate',date]);assert.throws(()=>c.kkExpectedBookingIdBeforeWrite_(date,5,'EV-A'),/NOT_EXACT1/);
});
test('prospective ID reservation conflicts across different target rows',()=>{
  const {c}=fixture();const r=['request-A','fp','PREPARED',5,'wf','','','EV-A','TPL',date,'','BK-20990101-001'];
  const receipts=new Sheet('receipts',[[],r]);assert.throws(()=>c.kkAssertBookingTargetNotReserved_(receipts,6,'request-B','BK-20990101-001'),/RESERVED/);
  assert.equal(c.kkAssertBookingTargetNotReserved_(receipts,5,'request-A','BK-20990101-001'),true);
});
test('date formatting follows CRM spreadsheet timezone, never silent script timezone',()=>{
  const {c}=fixture();c.Session.getScriptTimeZone=()=>{throw Error('script timezone must not select formula day');};let tz;
  c.Utilities.formatDate=(d,zone)=>{tz=zone;return '20990101';};assert.equal(c.kkBookingDateKey_(date),'20990101');assert.equal(tz,'Etc/GMT');
});
test('complete create, exact retry, and PREPARED interruption converge without a second business write',()=>{
  const {c,bookings}=fixture();c.kkEnsureLensCompatibilityPatchInstalled_=()=>{};c.kkNormalizeTemplateIdForEvent_=(e,t)=>t;c.kkIsPastEventDate_=()=>false;
  c.kkGetEventById_=()=>({event_date:date,status:'open',active:true});c.kkGetPackageByTemplateId_=()=>({active:true,package_type:'phone_only',model_group:'PHONE'});
  c.kkAssertWebPackageBookable_=()=>{};c.kkFindAvailableAsset_=()=> 'ASSET';c.kkValidateManualAsset_=()=>{};
  bookings.onWrite=(r,col)=>{if(col===2){const event=bookings.rows[r-1][3];const n=bookings.rows.slice(4,r).filter(x=>x[3]===event).length;bookings.rows[r-1][0]='BK-20990101-'+String(n).padStart(3,'0');}};
  const p={request_id:'synthetic-request',event_id:'EV-A',template_id:'TPL',customer_name:'SYNTHETIC'};
  const first=c.kkApiCreateBooking_(p);assert.equal(first.booking_id,'BK-20990101-001');const writes=bookings.writes;
  assert.equal(c.kkApiCreateBooking_(p).idempotent_replay,true);assert.equal(bookings.writes,writes);
  const sh=c.SpreadsheetApp.getActive().getSheetByName('17_Booking_Request_Receipts');sh.rows[1][2]='PREPARED';sh.rows[1][10]='';sh.rows[1][12]='';
  const recovered=c.kkApiCreateBooking_(p);assert.equal(recovered.reconciled_from_prepared,true);assert.equal(bookings.writes,writes);
  assert.throws(()=>c.kkApiCreateBooking_({...p,request_id:'other',event_id:'EV-B'}),/PREWRITE_COLLISION/);assert.equal(bookings.writes,writes);
});
test('receipt mutation after ownership loss is zero writes',()=>{
  const {c}=fixture();const receipts=new Sheet('receipts');const lock=c.kkAcquireDocumentLock_('test',1000);c.LockService.getScriptLock().releaseLock();
  assert.throws(()=>c.kkWriteBookingReceipt_(receipts,2,Array(15).fill('')),/OWNERSHIP_LOST/);assert.equal(receipts.writes,0);lock.releaseLock();
});
test('formula-bearing request identity cannot become a receipt formula',()=>{
  const {c}=fixture();const receipts=new Sheet('receipts');const lock=c.kkAcquireDocumentLock_('test',1000);const row=Array(15).fill('');row[0]='=IMPORTXML("https://example.invalid", "//x")';
  assert.throws(()=>c.kkWriteBookingReceipt_(receipts,2,row),/FORMULA_INPUT_REJECTED/);assert.equal(receipts.writes,0);lock.releaseLock();
});
console.log(`${count} booking formula runtime invariant groups passed (synthetic services, not live bookings)`);
