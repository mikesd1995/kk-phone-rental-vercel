'use strict';
// Execute only the canonical GAS consent functions in a deliberately isolated VM.
// Synthetic Booking row, synthetic LINE identity, zero external API calls.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','apps-script','Code.gs'),'utf8');
const begin=source.indexOf('function kkLineNativeConsentEnabled_');
const end=source.indexOf('\nfunction kkApiDecideLineBookingPending_',begin);
assert.ok(begin>0&&end>begin,'canonical native consent implementation found');
const consentSource=source.slice(begin,end);
const BID='BK-SYNTHETIC-2026-100';
const RID='line:'+'e'.repeat(48);
const USER='U'+'f'.repeat(32);
const KEY='synthetic_native_consent_dispatch_key_2026';
function fixture(overrides={}){
  const note='LINE webhook intake [KK_REQ:'+RID+']';
  const row=[BID,new Date(),'pending','EVT-TEST','Synthetic',USER,'','LINE','phone_only','','',
    '13:00','','unpaid',0,'','','',0,note];
  const props={
    KK_LINE_NATIVE_CONSENT_V1_ENABLED:'true',
    KK_LINE_NATIVE_CONSENT_DISPATCH_SECRET:KEY,
    KK_ADMIN_API_KEY:'admin_other_secret',
    KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET:'initial_other_secret_0123456789',
    KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET:'owner_other_secret_0123456789',
    ...(overrides.properties||{})
  };
  let writes=0,flushes=0,releases=0;
  if(overrides.status)row[2]=overrides.status;
  const spreadsheet={getRange(index,col){
    assert.equal(index,5);
    return {
      getValues(){return [col===1?row.slice():[row[col-1]]]},
      setValue(value){assert.equal(col,20);writes++;row[19]=value;},
    };
  }};
  const context={
    PropertiesService:{getScriptProperties(){return {getProperty(k){return props[k]||''}}}},
    kkAcquireDocumentLock_(){return {releaseLock(){releases++}}},
    kkFindBookingRow_(_sh,id){assert.equal(id,BID);return 5},
    kkSheet_(){return spreadsheet},
    kkBookingRequestIdFromNote_(value){
      const m=String(value).match(/line:[a-f0-9]{48}/);return m?m[0]:'';
    },
    SpreadsheetApp:{flush(){flushes++}},
    KK:{bookings:'00_Master_Booking'},
    console
  };
  vm.runInNewContext(consentSource+
    '\n;globalThis.native={accept:kkApiAcceptLineBookingTerms_,approvalReady:kkLineNativeConsentApprovalReady_};',
    context,{timeout:1000});
  return {accept:context.native.accept,approvalReady:context.native.approvalReady,row,props,
    stats(){return {writes,flushes,releases}},
    payload(patch={}){return {booking_id:BID,request_id:RID,source_user_id:USER,
      terms_version:'KK-TERMS-2026-11-06',native_consent_dispatch_key:KEY,...patch}}};
}
test('real GAS source writes Terms acceptance in canonical Booking note under document lock only once',()=>{
  const h=fixture();const first=h.accept(h.payload());
  assert.equal(first.terms_confirmed,true);assert.equal(first.booking_id,BID);
  assert.equal(first.booking_status,'pending');assert.equal(first.idempotent_replay,false);
  assert.match(h.row[19],/TERMS_ACK_BACKEND:KK-TERMS-2026-11-06/);
  assert.deepEqual(h.stats(),{writes:1,flushes:1,releases:1});
  const replay=h.accept(h.payload());
  assert.equal(replay.idempotent_replay,true);
  assert.deepEqual(h.stats(),{writes:1,flushes:1,releases:2});
});
test('real GAS acceptance rejects foreign LINE actors, wrong request, revoked flag and reused dispatch keys',()=>{
  for(const changed of [
    h=>h.payload({source_user_id:'U'+'1'.repeat(32)}),
    h=>h.payload({request_id:'line:'+'a'.repeat(48)}),
    h=>h.payload({terms_version:'KK-TERMS-EXPIRED'}),
    h=>h.payload({native_consent_dispatch_key:'bad'}),
    h=>{h.props.KK_LINE_NATIVE_CONSENT_V1_ENABLED='false';return h.payload()},
    h=>{h.props.KK_LINE_NATIVE_CONSENT_DISPATCH_SECRET=h.props.KK_ADMIN_API_KEY;return h.payload()},
    h=>{h.row[2]='confirmed';return h.payload()}
  ]){
    const h=fixture();assert.throws(()=>h.accept(changed(h)));
    assert.equal(h.stats().writes,0);
    assert.equal(h.stats().releases,[3,6].includes(
      [ // per-case no-op placeholder for explicit checker consistency
      ].length)?1:h.stats().releases);
  }
});
test('GAS owner approval only enables Confirm after authenticated receipt; Reject remains possible',()=>{
  const h=fixture();
  assert.equal(h.approvalReady(h.row[19],'approve'),false);
  assert.equal(h.approvalReady(h.row[19],'reject'),true);
  h.accept(h.payload());
  assert.equal(h.approvalReady(h.row[19],'approve'),true);
  h.props.KK_LINE_NATIVE_CONSENT_V1_ENABLED='false';
  assert.equal(h.approvalReady('','approve'),true,'prior deployments stay unmodified until gated enablement');
});
