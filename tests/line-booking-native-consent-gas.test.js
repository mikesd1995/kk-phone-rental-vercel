'use strict';
// Execute only the canonical GAS consent functions in a deliberately isolated VM.
// Synthetic Booking row, synthetic LINE identity, zero external API calls.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','apps-script','Code.gs'),'utf8');
const begin=source.indexOf('function kkLineNativeConsentRequirePrivateCore_');
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
    KK_LINE_INITIAL_OUTBOX_V1_ENABLED:'true',
    KK_LINE_OWNER_OUTBOX_V1_ENABLED:'true',
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
    kkLineInitialOutboxEnabled_(){return props.KK_LINE_INITIAL_OUTBOX_V1_ENABLED==='true'},
    kkLineOwnerOutboxEnabled_(){return props.KK_LINE_OWNER_OUTBOX_V1_ENABLED==='true'},
    kkBookingRequestIdFromNote_(value){
      const m=String(value).match(/line:[a-f0-9]{48}/);return m?m[0]:'';
    },
    SpreadsheetApp:{flush(){flushes++},getActiveSpreadsheet(){return {getId(){return 'synthetic-private-core-id'}}}},
    DriveApp:{Access:{PRIVATE:'PRIVATE',ANYONE_WITH_LINK:'ANYONE_WITH_LINK',ANYONE:'ANYONE',DOMAIN:'DOMAIN'},
      getFileById(id){assert.equal(id,'synthetic-private-core-id');
        if(overrides.driveUnavailable)throw Error('SYNTHETIC_DRIVE_READ_FAILED');
        return {getSharingAccess(){return overrides.access||'PRIVATE'}};
      }},
    KK:{bookings:'00_Master_Booking'},
    console
  };
  vm.runInNewContext(consentSource+
    '\n;globalThis.native={accept:kkApiAcceptLineBookingTerms_,approvalReady:kkLineNativeConsentApprovalReady_,readiness:kkApiLineNativeConsentReadiness_};',
    context,{timeout:1000});
  return {accept:context.native.accept,approvalReady:context.native.approvalReady,readiness:context.native.readiness,row,props,
    stats(){return {writes,flushes,releases}},
    payload(patch={}){return {booking_id:BID,request_id:RID,source_user_id:USER,
      terms_version:'KK-TERMS-2026-11-06',native_consent_dispatch_key:KEY,...patch}}};
}
test('real GAS source writes Terms acceptance in canonical Booking note under document lock only once',()=>{
  const h=fixture();const first=h.accept(h.payload());
  assert.equal(first.terms_confirmed,true);assert.equal(first.booking_id,BID);
  assert.equal(first.booking_status,'pending');assert.equal(first.idempotent_replay,false);
  assert.match(h.row[19],/TERMS_ACK_BACKEND:KK-TERMS-2026-11-06/);
  assert.match(h.row[19],/TERMS_AT:[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z/);
  assert.deepEqual(h.stats(),{writes:1,flushes:1,releases:1});
  const replay=h.accept(h.payload());
  assert.equal(replay.idempotent_replay,true);
  assert.deepEqual(h.stats(),{writes:1,flushes:1,releases:2});
});
test('real GAS acceptance rejects foreign LINE actors, wrong request, revoked flag and reused dispatch keys',()=>{
  for(const [caseIndex,changed] of [
    h=>h.payload({source_user_id:'U'+'1'.repeat(32)}),
    h=>h.payload({request_id:'line:'+'a'.repeat(48)}),
    h=>h.payload({terms_version:'KK-TERMS-EXPIRED'}),
    h=>h.payload({native_consent_dispatch_key:'bad'}),
    h=>{h.props.KK_LINE_NATIVE_CONSENT_V1_ENABLED='false';return h.payload()},
    h=>{h.props.KK_LINE_NATIVE_CONSENT_DISPATCH_SECRET=h.props.KK_ADMIN_API_KEY;return h.payload()},
    h=>{h.row[2]='confirmed';return h.payload()}
  ].entries()){
    const h=fixture();assert.throws(()=>h.accept(changed(h)));
    assert.equal(h.stats().writes,0);
    assert.equal(h.stats().releases,[0,1,6].includes(caseIndex)?1:0,
      'all acquired locks must release; early authorization rejects never acquire');
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


test('deployed native GAS readiness requires the exact enabled writer, distinct dispatcher and both canonical outboxes',()=>{
  const h=fixture();
  const ready=h.readiness(h.payload());
  assert.equal(ready.native_consent_ready,true);
  assert.equal(ready.native_consent_version,'KK_LINE_NATIVE_CONSENT_V1');
  assert.equal(ready.terms_version,'KK-TERMS-2026-11-06');
  assert.equal(h.stats().writes,0);
  for(const key of ['KK_LINE_NATIVE_CONSENT_V1_ENABLED',
      'KK_LINE_INITIAL_OUTBOX_V1_ENABLED','KK_LINE_OWNER_OUTBOX_V1_ENABLED']){
    const x=fixture();x.props[key]='false';
    assert.throws(()=>x.readiness(x.payload()),/DISABLED|NOT_READY/);
    assert.equal(x.stats().writes,0);
  }
  assert.throws(()=>h.readiness(h.payload({native_consent_dispatch_key:'forged'})));
  assert.equal(h.stats().writes,0);
});

test('private Core access gate denies public sharing on Terms readiness and consent before any customer data mutation',()=>{
  for(const access of ['ANYONE_WITH_LINK','ANYONE','DOMAIN','OTHER']){
    const h=fixture({access});
    assert.throws(()=>h.readiness(h.payload()),/LINE_NATIVE_CONSENT_PUBLIC_CORE_DENIED/);
    assert.throws(()=>h.accept(h.payload()),/LINE_NATIVE_CONSENT_PUBLIC_CORE_DENIED/);
    assert.deepEqual(h.stats(),{writes:0,flushes:0,releases:0});
  }
  const unknown=fixture({driveUnavailable:true});
  assert.throws(()=>unknown.readiness(unknown.payload()),/SYNTHETIC_DRIVE_READ_FAILED/);
  assert.throws(()=>unknown.accept(unknown.payload()),/SYNTHETIC_DRIVE_READ_FAILED/);
  assert.equal(unknown.stats().writes,0);
});
test('canonical Pending / owner durable decision writers invoke privacy gate before any admission claim or outbox intent',()=>{
  const pending=source.slice(source.indexOf('function kkApiCreateLineBookingPending_'),source.indexOf('\n// Initial notifications have a separate',source.indexOf('function kkApiCreateLineBookingPending_')));
  const decision=source.slice(source.indexOf('function kkApiDecideLineBookingPendingDurable_'),source.indexOf('\nfunction kkApiLineOwnerOutboxReadiness_',source.indexOf('function kkApiDecideLineBookingPendingDurable_')));
  for(const body of [pending,decision]){
    assert.match(body,/kkLineNativeConsentRequirePrivateCore_\(\)/);
  }
  assert.ok(pending.indexOf('kkLineNativeConsentRequirePrivateCore_()')<pending.indexOf('kkLineInitialOutboxPrepare_'));
  assert.ok(decision.indexOf('kkLineNativeConsentRequirePrivateCore_()')<decision.indexOf('kkLineOwnerOutboxFind_'));
});
