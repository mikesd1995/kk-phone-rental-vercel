/* KK LINE decision delivery outbox — opt-in, owner-installed, fail-closed.
 * This file is intentionally additive. Never install or enable a live sheet
 * automatically during a booking or webhook execution.
 * Every writer must already hold the canonical DocumentLock.
 */
var KK_LINE_DELIVERY_OUTBOX_SHEET_='19_Line_Delivery_Outbox';
var KK_LINE_DELIVERY_OUTBOX_HEADERS_=[
  'outbox_id','booking_id','decision','recipient_sha256','state',
  'claim_id','claimed_at','provider_request_id','attempt_count','created_at','updated_at'
];

function kkLineDeliveryOutboxEnabled_(){
  // Exact opt-in prevents accidentally enabling delivery from truthy strings.
  return String(PropertiesService.getScriptProperties().getProperty('KK_LINE_DELIVERY_OUTBOX_ENABLED')||'')==='true';
}
function kkLineDeliveryDigest_(value){
  var data=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    String(value),Utilities.Charset.UTF_8);
  return data.map(function(byte){return ('0'+((byte+256)%256).toString(16)).slice(-2);}).join('');
}
function kkLineDeliveryOutboxId_(bookingId,decision){
  return 'KLO-'+kkLineDeliveryDigest_('KK_LINE_DECISION_OUTBOX_V1|'+bookingId+'|'+decision).slice(0,40);
}
function kkLineDeliveryOutboxSheet_(){
  var sh=SpreadsheetApp.getActive().getSheetByName(KK_LINE_DELIVERY_OUTBOX_SHEET_);
  if(!sh)throw new Error('LINE_DELIVERY_OUTBOX_SHEET_MISSING');
  var expected=KK_LINE_DELIVERY_OUTBOX_HEADERS_;
  var actual=sh.getRange(1,1,1,expected.length).getValues()[0];
  if(expected.some(function(h,i){return actual[i]!==h;}))
    throw new Error('LINE_DELIVERY_OUTBOX_SCHEMA_DRIFT');
  if(sh.getLastRow()>50000)throw new Error('LINE_DELIVERY_OUTBOX_ROW_LIMIT');
  return sh;
}
// OWNER-ONLY MANUAL MAINTENANCE FUNCTION. Not reachable via doPost.
// Run explicitly after security review, backup, and owner authorization.
function kkInstallLineDeliveryOutbox_(){
  var lock=kkAcquireDocumentLock_('manual LINE outbox installation',12000);
  try{
    var ss=SpreadsheetApp.getActive();
    var prior=ss.getSheetByName(KK_LINE_DELIVERY_OUTBOX_SHEET_);
    if(prior)return {installed:false,existing:true,rows:kkLineDeliveryOutboxSheet_().getLastRow()};
    var sh=ss.insertSheet(KK_LINE_DELIVERY_OUTBOX_SHEET_);
    sh.getRange(1,1,1,KK_LINE_DELIVERY_OUTBOX_HEADERS_.length)
      .setValues([KK_LINE_DELIVERY_OUTBOX_HEADERS_]);
    SpreadsheetApp.flush();
    kkLineDeliveryOutboxSheet_();
    return {installed:true,existing:false,rows:1};
  }finally{lock.releaseLock();}
}
// Owner can run this read-only in GAS to validate the target before enabling.
function kkLineDeliveryOutboxPreflight_(){
  var enabled=kkLineDeliveryOutboxEnabled_();
  var sh=kkLineDeliveryOutboxSheet_();
  return {enabled:enabled,schema_ok:true,row_count:Math.max(0,sh.getLastRow()-1)};
}
// Authenticated, read-only pre-decision contract handshake; no private data.
function kkApiLineDeliveryOutboxReadiness_(){
  var preflight=kkLineDeliveryOutboxPreflight_();
  return {outbox_contract:'v1',enabled:preflight.enabled,
    schema_ok:preflight.schema_ok};
}
function kkLineDeliveryOutboxFind_(sh,outboxId){
  var count=sh.getLastRow()-1;
  if(count<=0)return null;
  var rows=sh.getRange(2,1,count,KK_LINE_DELIVERY_OUTBOX_HEADERS_.length).getValues();
  var found=null;
  for(var i=0;i<rows.length;i++){
    if(String(rows[i][0]||'')!==outboxId)continue;
    if(found)throw new Error('LINE_DELIVERY_OUTBOX_DUPLICATE_ID');
    found={row_number:i+2,values:rows[i]};
  }
  return found;
}
function kkLineDeliveryOutboxVerify_(found,bookingId,decision,recipient){
  if(!found || String(found.values[0])!==kkLineDeliveryOutboxId_(bookingId,decision) ||
     String(found.values[1])!==bookingId || String(found.values[2])!==decision ||
     String(found.values[3])!==kkLineDeliveryDigest_(recipient)){
    throw new Error('LINE_DELIVERY_OUTBOX_IDENTITY_MISMATCH');
  }
  return found;
}
function kkLineDeliveryOutboxWrite_(sh,found,nextValues){
  // One row write + exact readback while the canonical DocumentLock is held.
  sh.getRange(found.row_number,1,1,KK_LINE_DELIVERY_OUTBOX_HEADERS_.length).setValues([nextValues]);
  SpreadsheetApp.flush();
  var readback=sh.getRange(found.row_number,1,1,KK_LINE_DELIVERY_OUTBOX_HEADERS_.length)
    .getValues()[0];
  if(nextValues.some(function(value,i){return String(value)!==String(readback[i]);}))
    throw new Error('LINE_DELIVERY_OUTBOX_WRITE_READBACK_FAILED');
  return {row_number:found.row_number,values:readback};
}
function kkLineDeliveryOutboxPrepareLocked_(bookingId,decision,recipient){
  if(!kkLineDeliveryOutboxEnabled_())return null;
  var sh=kkLineDeliveryOutboxSheet_();
  var outboxId=kkLineDeliveryOutboxId_(bookingId,decision);
  var found=kkLineDeliveryOutboxFind_(sh,outboxId);
  if(found){
    kkLineDeliveryOutboxVerify_(found,bookingId,decision,recipient);
    return {outbox_id:outboxId,outbox_status:String(found.values[4])};
  }
  // PREPARED intent persists BEFORE the canonical booking status mutation.
  // Crash here leaves the booking pending, not a sent/approved notification.
  var now=new Date().toISOString();
  var values=[outboxId,bookingId,decision,kkLineDeliveryDigest_(recipient),
    'PREPARED','','','',0,now,now];
  var rowNumber=sh.getLastRow()+1;
  kkLineDeliveryOutboxWrite_(sh,{row_number:rowNumber,values:[]},values);
  found=kkLineDeliveryOutboxFind_(sh,outboxId);
  kkLineDeliveryOutboxVerify_(found,bookingId,decision,recipient);
  return {outbox_id:outboxId,outbox_status:'PREPARED'};
}
function kkLineDeliveryOutboxReadyLocked_(bookingId,decision,recipient){
  if(!kkLineDeliveryOutboxEnabled_())return null;
  var sh=kkLineDeliveryOutboxSheet_();
  var id=kkLineDeliveryOutboxId_(bookingId,decision);
  var found=kkLineDeliveryOutboxVerify_(
    kkLineDeliveryOutboxFind_(sh,id),bookingId,decision,recipient);
  var state=String(found.values[4]);
  if(state==='PREPARED'){
    var next=found.values.slice();
    next[4]='READY';
    next[10]=new Date().toISOString();
    found=kkLineDeliveryOutboxWrite_(sh,found,next);
    state='READY';
  }
  if(['READY','CLAIMED','ACCEPTED','FAILED_UNCERTAIN',
      'FAILED_TERMINAL','UNCERTAIN'].indexOf(state)<0)
    throw new Error('LINE_DELIVERY_OUTBOX_STATE_INVALID');
  return {outbox_id:id,outbox_status:state};
}
function kkLineDeliveryOutboxBookingReadback_(bookingId,decision){
  var row=kkFindBookingRow_('',bookingId);
  var current=kkSheet_(KK.bookings).getRange(row,1,1,20).getValues()[0];
  var expected=decision==='approve'?'confirmed':'cancelled';
  if(String(current[0]||'').trim()!==bookingId ||
    String(current[7]||'').toUpperCase().trim()!=='LINE' ||
    String(current[2]||'').toLowerCase().trim()!==expected ||
    !/^line:[a-f0-9]{48}$/.test(String(kkBookingRequestIdFromNote_(current[19])||'')))
    throw new Error('LINE_DELIVERY_OUTBOX_BOOKING_READBACK_FAILED');
  var recipient=String(current[5]||'').trim();
  if(!recipient)throw new Error('LINE_DELIVERY_OUTBOX_RECIPIENT_MISSING');
  return recipient;
}
function kkApiClaimLineBookingNotification_(payload){
  if(!kkLineDeliveryOutboxEnabled_())
    throw new Error('LINE_DELIVERY_OUTBOX_DISABLED');
  var lock=kkAcquireDocumentLock_('claim LINE notification',12000);
  try{
    var bookingId=String(payload.booking_id||'').trim();
    var decision=String(payload.decision||'').trim();
    var outboxId=String(payload.outbox_id||'').trim();
    if(!bookingId||['approve','reject'].indexOf(decision)<0 ||
       outboxId!==kkLineDeliveryOutboxId_(bookingId,decision))
      throw new Error('LINE_DELIVERY_OUTBOX_INVALID_CLAIM');
    var recipient=kkLineDeliveryOutboxBookingReadback_(bookingId,decision);
    var sh=kkLineDeliveryOutboxSheet_();
    var found=kkLineDeliveryOutboxVerify_(
      kkLineDeliveryOutboxFind_(sh,outboxId),bookingId,decision,recipient);
    var state=String(found.values[4]);
    if(state==='PREPARED'){
      // Owner decision is now durably committed; a crash during READY update
      // is reconciled under lock without creating a second intent.
      var prepared=found.values.slice();
      prepared[4]='READY';
      prepared[10]=new Date().toISOString();
      found=kkLineDeliveryOutboxWrite_(sh,found,prepared);
      state='READY';
    }
    if(state==='ACCEPTED')return {
      booking_id:bookingId,decision:decision,outbox_id:outboxId,status:'ALREADY_ACCEPTED'
    };
    if(state==='CLAIMED'){
      var claimedAt=Date.parse(String(found.values[6]||''));
      var expired=!Number.isFinite(claimedAt) || Date.now()-claimedAt>120000;
      if(expired){
        var uncertain=found.values.slice();
        uncertain[4]='UNCERTAIN';
        uncertain[10]=new Date().toISOString();
        kkLineDeliveryOutboxWrite_(sh,found,uncertain);
        state='UNCERTAIN';
      }else{
        return {booking_id:bookingId,decision:decision,outbox_id:outboxId,
          status:'IN_FLIGHT'};
      }
    }
    if(state!=='READY')return {
      booking_id:bookingId,decision:decision,outbox_id:outboxId,
      status:'REQUIRES_MANUAL_RECONCILIATION'
    };
    var claimId=Utilities.getUuid();
    var next=found.values.slice();
    next[4]='CLAIMED';
    next[5]=claimId;
    next[6]=new Date().toISOString();
    next[8]=Number(found.values[8]||0)+1;
    next[10]=next[6];
    if(next[8]!==1)throw new Error('LINE_DELIVERY_OUTBOX_RECLAIM_BLOCKED');
    kkLineDeliveryOutboxWrite_(sh,found,next);
    return {
      booking_id:bookingId,decision:decision,outbox_id:outboxId,
      status:'CLAIMED',claim_id:claimId,customer_contact:recipient
    };
  }finally{lock.releaseLock();}
}
function kkApiAckLineBookingNotification_(payload){
  if(!kkLineDeliveryOutboxEnabled_())
    throw new Error('LINE_DELIVERY_OUTBOX_DISABLED');
  var lock=kkAcquireDocumentLock_('ack LINE notification',12000);
  try{
    var bookingId=String(payload.booking_id||'').trim();
    var decision=String(payload.decision||'').trim();
    var outboxId=String(payload.outbox_id||'').trim();
    var claimId=String(payload.claim_id||'').trim();
    var disposition=String(payload.disposition||'').trim();
    var receipt=String(payload.provider_request_id||'').trim();
    if(!bookingId||['approve','reject'].indexOf(decision)<0||
       outboxId!==kkLineDeliveryOutboxId_(bookingId,decision)||
       !/^[0-9a-fA-F-]{36}$/.test(claimId)||
       ['ACCEPTED','FAILED_UNCERTAIN','FAILED_TERMINAL'].indexOf(disposition)<0||
       (receipt&&!/^[A-Za-z0-9_-]{1,128}$/.test(receipt)))
      throw new Error('LINE_DELIVERY_OUTBOX_INVALID_ACK');
    var recipient=kkLineDeliveryOutboxBookingReadback_(bookingId,decision);
    var sh=kkLineDeliveryOutboxSheet_();
    var found=kkLineDeliveryOutboxVerify_(
      kkLineDeliveryOutboxFind_(sh,outboxId),bookingId,decision,recipient);
    var state=String(found.values[4]);
    if(state==='ACCEPTED' && String(found.values[5])===claimId &&
       disposition==='ACCEPTED')return {
      booking_id:bookingId,decision:decision,outbox_id:outboxId,status:'ALREADY_ACKED'};
    if(state!=='CLAIMED'||String(found.values[5])!==claimId)
      throw new Error('LINE_DELIVERY_OUTBOX_CLAIM_CONFLICT');
    var next=found.values.slice();
    next[4]=disposition;
    next[7]=receipt;
    next[10]=new Date().toISOString();
    kkLineDeliveryOutboxWrite_(sh,found,next);
    return {booking_id:bookingId,decision:decision,outbox_id:outboxId,status:disposition};
  }finally{lock.releaseLock();}
}
