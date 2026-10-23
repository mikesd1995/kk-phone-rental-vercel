/** Private outbound owner-UAT bridge. No public doGet/doPost and no Telegram provider send. */
var KKOwnerTelegramBridge={send:function(candidate,claim,properties) {
  assertLedgerLock_();
  if (!candidate.controlledUat || candidate.transport!=='TELEGRAM_OWNER_ALERTS') throw new Error('OWNER_CONTROLLED_UAT_BRIDGE_REQUIRED');
  var config=ownerLedgerBridgeConfig_(properties),key=ownerLedgerPendingKey_(candidate.notificationId);
  var store=PropertiesService.getScriptProperties();
  if (store.getProperty(key)) throw new Error('OWNER_LEDGER_EXISTING_PENDING_NO_RESEND');
  readExactLedgerCandidate_(openLedger_().sheet,candidate,claim);
  var pending={version:'kk-owner-ledger-local-v1',status:'ADMISSION_PENDING',candidate:{notificationId:candidate.notificationId,
    payload:candidate.payload,transport:candidate.transport,status:candidate.status,attemptCount:candidate.attemptCount,dedupKey:candidate.dedupKey,
    notes:candidate.notes,sourceSnapshot:candidate.sourceSnapshot,sourceRow:candidate.sourceRow,controlledUat:true,enforceQuietHours:true},
    claim:{notification_id:claim.notification_id,transport:claim.transport,claim_id:claim.claim_id,attempt_count:claim.attempt_count,
      attempted_at:claim.attempted_at,before_row:claim.before_row,claimed_row:claim.claimed_row},envelope:null};
  ownerLedgerSavePending_(store,key,pending); // Persist uncertainty before the network boundary.
  var reply;
  try { reply=ownerLedgerRequest_('admit',candidate,claim,config); }
  catch (unknown) {
    pending.status='ADMISSION_UNKNOWN';try { ownerLedgerSavePending_(store,key,pending); } catch (unavailable) {}
    return {deferred:true,admission_unknown:true}; // Exact SENDING fence remains available for authenticated readback.
  }
  try { ownerLedgerValidateAdmit_(reply,candidate,claim); }
  catch (unconfirmed) {
    pending.status='ADMISSION_RESPONSE_UNCONFIRMED';try { ownerLedgerSavePending_(store,key,pending); } catch (unavailable) {}
    return {deferred:true,admission_unknown:true};
  }
  pending.status='ADMITTED';pending.envelope=reply.envelope;
  try { ownerLedgerSavePending_(store,key,pending); } catch (unavailable) { return {deferred:true,admission_unknown:true}; }
  return {deferred:true};
}};

function ownerLedgerBridgeConfig_(properties) {
  if (ScriptApp.getScriptId()!=='1NYvGpqhx8QJR6onHX07_8gWxSwIAvhblMDDpMWfYLEKK02sK352J0_WF') throw new Error('OWNER_LEDGER_SCRIPT_SCOPE_INVALID');
  var endpoint=properties.KK_OWNER_LEDGER_PRODUCER_ENDPOINT,secret=properties.KK_OWNER_LEDGER_PRODUCER_SECRET;
  var canonical='https://kk-phone-rental.vercel.app/api/kk-make-owner-notify';
  if (typeof endpoint!=='string' || (endpoint!==canonical && endpoint!==canonical+'?owner_transport=v1' &&
    !/^https:\/\/kk-phone-rental-vercel-[a-z0-9]+-mikesd1995s-projects\.vercel\.app\/api\/kk-make-owner-notify\?owner_transport=v1$/.test(endpoint))) throw new Error('OWNER_LEDGER_ENDPOINT_INVALID');
  if (typeof secret!=='string' || secret.length<32 || secret===properties.KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET) throw new Error('OWNER_LEDGER_PRODUCER_SECRET_UNBOUND');
  return {endpoint:endpoint,secret:secret};
}
function ownerLedgerHex_(bytes) { return bytes.map(function(v) { return ('0'+((v+256)%256).toString(16)).slice(-2); }).join(''); }
function ownerLedgerHash_(text) { return ownerLedgerHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8)); }
function ownerLedgerPendingKey_(id) { return 'KK_OWNER_LEDGER_PENDING_'+ownerLedgerHash_(id); }
function ownerLedgerSavePending_(store,key,pending) {
  var text=JSON.stringify(pending);
  if (Utilities.newBlob(text).getBytes().length>8800) throw new Error('OWNER_LEDGER_PENDING_PROPERTY_BOUNDS');
  store.setProperty(key,text);
  if (store.getProperty(key)!==text) throw new Error('OWNER_LEDGER_PENDING_PROPERTY_READBACK_FAILED');
}
function ownerLedgerBinding_(candidate) {
  var r=candidate.sourceRow;
  return ['kk-owner-ledger-binding-v1',CORE_V1.spreadsheetId,CORE_V1.ledgerSheet,'TELEGRAM_OWNER_ALERTS',candidate.notificationId,
    ledgerComparable_(r['Created At']),r.Payload,r['Dedup Key'],r['Event Family ID'],r['Show ID'],r['Change Type'],r.Priority,r['Quiet Hours Policy']];
}
function ownerLedgerIdentities_(id) {
  var raw=Utilities.base64EncodeWebSafe(id,Utilities.Charset.UTF_8).replace(/=+$/,'');
  return {notification_id:'ks1_'+raw,request_id:'kr1_'+raw,entity_id:'ke1_'+raw};
}
function ownerLedgerAttestation_(stage,candidate,claim,config) {
  var a={version:'kk-owner-ledger-producer-v1',action:stage,script_project_id:ScriptApp.getScriptId(),spreadsheet_id:CORE_V1.spreadsheetId,
    tab:CORE_V1.ledgerSheet,transport:'TELEGRAM_OWNER_ALERTS',consumer_id:'6176241',scope:'OWNER_TRANSPORT_UAT',policy_version:'v4.9.44',
    observed_at:new Date().toISOString(),nonce:Utilities.getUuid(),notification_id:candidate.notificationId,claim_id:claim.claim_id};
  if (stage==='admit') { a.before_rows=claim.before_rows;a.claimed_row=claim.claimed_row; }
  var fields=['version','action','script_project_id','spreadsheet_id','tab','transport','consumer_id','scope','policy_version','observed_at','nonce','notification_id','claim_id'];
  var canonical=fields.map(function(k) { return a[k]; });
  canonical.push(stage==='admit'?a.before_rows.map(function(row) { return ledgerHeaders_().map(function(k) { return row[k]; }); }):null);
  canonical.push(stage==='admit'?ledgerHeaders_().map(function(k) { return a.claimed_row[k]; }):null);
  a.signature=ownerLedgerHex_(Utilities.computeHmacSha256Signature(JSON.stringify(canonical),config.secret,Utilities.Charset.UTF_8));
  return a;
}
function ownerLedgerRequest_(stage,candidate,claim,config) {
  var response=UrlFetchApp.fetch(config.endpoint,{method:'post',contentType:'application/json',followRedirects:false,muteHttpExceptions:true,
    payload:JSON.stringify({stage:stage,attestation:ownerLedgerAttestation_(stage,candidate,claim,config)})});
  if (response.getResponseCode()!==200) throw new Error('OWNER_LEDGER_GATEWAY_UNAVAILABLE');
  var raw=response.getContentText();if (raw.length>65536) throw new Error('OWNER_LEDGER_RESPONSE_BOUNDS');
  var reply=safeJson_(raw);if (!reply || reply.ok!==true || reply.send_allowed!==false) throw new Error('OWNER_LEDGER_RESPONSE_INVALID');return reply;
}
function ownerLedgerValidateEnvelope_(envelope,candidate,allowExpired) {
  var expected=ownerLedgerIdentities_(candidate.notificationId),binding=ownerLedgerBinding_(candidate),now=Date.now();
  if (!envelope || Object.keys(envelope).length!==11 || envelope.version!=='kk-make-owner-transport-v1' || envelope.audience!=='KK_OWNER_TELEGRAM_ONLY' ||
    envelope.event_type!=='OWNER_ALERT' || envelope.text!==candidate.payload || envelope.content_version!==ownerLedgerHash_(JSON.stringify(binding)) ||
    typeof envelope.signature!=='string' || !/^[a-f0-9]{64}$/.test(envelope.signature)) throw new Error('OWNER_LEDGER_RESPONSE_BINDING_INVALID');
  Object.keys(expected).forEach(function(k) { if (envelope[k]!==expected[k]) throw new Error('OWNER_LEDGER_RESPONSE_BINDING_INVALID'); });
  var created=parseDate_(envelope.created_at),expires=parseDate_(envelope.expires_at),sourceCreated=parseDate_(candidate.sourceRow['Created At']);
  if (!created || !expires || !sourceCreated || created<sourceCreated || created.getTime()>now+15000 || expires<=created || expires-created>120000 ||
    (!allowExpired && (now>=expires.getTime() || now-created.getTime()>120000))) throw new Error('OWNER_LEDGER_RESPONSE_TTL_INVALID');
}
function ownerLedgerValidateAdmit_(reply,candidate,claim) {
  if (reply.status!=='ADMITTED' || reply.source_notification_id!==candidate.notificationId || reply.sheet_claim_id!==claim.claim_id) throw new Error('OWNER_LEDGER_RESPONSE_BINDING_INVALID');
  ownerLedgerValidateEnvelope_(reply.envelope,candidate,false);
}
/** Returns relay material only to the authenticated editor caller; never logs it. */
function getPreparedOwnerLedgerBridgeEnvelope(notificationId) {
  var pending=ownerLedgerLoadPending_(notificationId);
  if (pending.status!=='ADMITTED' || !pending.envelope) throw new Error('OWNER_LEDGER_ENVELOPE_NOT_PREPARED');
  ownerLedgerValidateEnvelope_(pending.envelope,pending.candidate,false);return pending.envelope;
}
function ownerLedgerLoadPending_(id) {
  if (typeof id!=='string' || !id) throw new Error('OWNER_LEDGER_EXPLICIT_ID_REQUIRED');
  var text=PropertiesService.getScriptProperties().getProperty(ownerLedgerPendingKey_(id)),pending=text && safeJson_(text);
  if (!pending || pending.version!=='kk-owner-ledger-local-v1' || !pending.candidate || pending.candidate.notificationId!==id || !pending.claim || pending.claim.notification_id!==id) throw new Error('OWNER_LEDGER_PENDING_INVALID');
  return pending;
}
function getOwnerLedgerBridgeStatus(notificationId) {
  var pending=ownerLedgerLoadPending_(notificationId);
  return {notification_id:notificationId,status:pending.status,claim_id:pending.claim.claim_id,envelope_prepared:Boolean(pending.envelope),
    expires_at:pending.envelope?pending.envelope.expires_at:'',provider_send_performed:false};
}
/** Projection only. Authenticated native durable SENT evidence is mandatory. No provider call or retry. */
function finalizeOwnerLedgerBridgeAck(notificationId) {
  var lock=LockService.getScriptLock();if (!lock.tryLock(5000)) throw new Error('OWNER_LEDGER_FINALIZE_LOCK_BUSY');
  try {
    var pending=ownerLedgerLoadPending_(notificationId),candidate=pending.candidate,claim=pending.claim;
    var context=openLedger_();
    var reply=ownerLedgerRequest_('readback',candidate,claim,ownerLedgerBridgeConfig_(PropertiesService.getScriptProperties().getProperties()));
    var result=ownerLedgerValidateDurableSent_(reply,candidate,claim,pending.envelope);
    var projected=ownerLedgerReadProjectedAck_(context.sheet,candidate,claim,result);
    if (!projected) projected=projectLedgerAcknowledgement_(context.sheet,context.headers,candidate,claim,result);
    pending.status='SHEET_ACK_VERIFIED';pending.receipt_id=result.evidence.receipt_id;pending.provider_message_id=result.providerMessageId;
    ownerLedgerSavePending_(PropertiesService.getScriptProperties(),ownerLedgerPendingKey_(notificationId),pending);return projected;
  } finally { lock.releaseLock(); }
}
function ownerLedgerReadProjectedAck_(sheet,candidate,claim,result) {
  var values=sheet.getDataRange().getValues(),headers=readHeaders_(values[0]),matches=values.slice(1).filter(function(row) {
    return row[headers['Notification ID']]===candidate.notificationId && row[headers.Transport]===candidate.transport;
  });
  if (matches.length!==1) throw new Error('OWNER_LEDGER_PROJECT_IDENTITY_INVALID');
  if (matches[0][headers.Status]!=='SENT') { readExactLedgerCandidate_(sheet,candidate,claim);return null; }
  var fields={'Delivery Evidence':JSON.stringify(result.evidence),'Next Retry At':'','HTTP Status':result.httpStatus,
    'Provider Message ID':result.providerMessageId,'API Accepted At':result.apiAcceptedAt,'Delivery Confirmed At':'','Last Error':'',
    Notes:appendLedgerNote_(claim.claimed_row.Notes,'API_ACCEPTED'),Status:'SENT'};
  var expected=ledgerPatchedRecord_(claim.claimed_row,fields);
  if (JSON.stringify(ledgerRecordSnapshot_(ledgerNamedRow_(matches[0],headers)))!==JSON.stringify(ledgerRecordSnapshot_(expected))) throw new Error('OWNER_LEDGER_PROJECT_STATE_CHANGED');
  return {notification_id:candidate.notificationId,status:'SENT',transport:candidate.transport,provider_message_id:result.providerMessageId,
    api_accepted_at:result.apiAcceptedAt,delivery_confirmed_at:'',claim_id:claim.claim_id};
}
function ownerLedgerValidateDurableSent_(reply,candidate,claim,envelope) {
  if (!reply || reply.ok!==true || reply.send_allowed!==false || reply.status!=='SENT' || reply.source_notification_id!==candidate.notificationId || reply.sheet_claim_id!==claim.claim_id) throw new Error('OWNER_DURABLE_SENT_REQUIRED');
  var r=reply.record,m=r && r.mapping_record,d=r && r.descriptor,o=r && r.outbox,binding=ownerLedgerBinding_(candidate),ids=ownerLedgerIdentities_(candidate.notificationId);
  if (!r || !m || !d || !o || !m.source_tuple || !m.transport_identity || JSON.stringify(m.immutable_binding)!==JSON.stringify(binding) ||
    r.immutable_binding_text!==JSON.stringify(binding) || r.source_audit_event_id!==candidate.sourceRow['Audit Event ID'] ||
    m.source_tuple.spreadsheet_id!==CORE_V1.spreadsheetId || m.source_tuple.tab!==CORE_V1.ledgerSheet || m.source_tuple.transport!=='TELEGRAM_OWNER_ALERTS' || m.source_tuple.notification_id!==candidate.notificationId) throw new Error('OWNER_DURABLE_BINDING_INVALID');
  ownerLedgerValidateEnvelope_(Object.assign({},d,{signature:envelope?envelope.signature:'0'.repeat(64)}),candidate,true);
  Object.keys(ids).forEach(function(k) { if (m.transport_identity[k]!==ids[k] || d[k]!==ids[k] || o[k]!==ids[k]) throw new Error('OWNER_DURABLE_BINDING_INVALID'); });
  if (envelope && Object.keys(d).some(function(k) { return d[k]!==envelope[k]; })) throw new Error('OWNER_DURABLE_DESCRIPTOR_CHANGED');
  var hash=ownerLedgerHash_(JSON.stringify(binding)),textHash=ownerLedgerHash_(candidate.payload.trim());
  if (o.status!=='SENT' || o.content_version!==hash || d.content_version!==hash || o.text_sha256!==textHash || r.text_sha256!==textHash || o.event_type!=='OWNER_ALERT' ||
    typeof o.receipt_id!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(o.receipt_id) ||
    typeof o.provider_message_id!=='string' || !/^[0-9]{1,20}$/.test(o.provider_message_id)) throw new Error('OWNER_DURABLE_SENT_RECEIPT_INVALID');
  var accepted=parseDate_(o.delivered_at),reserved=parseDate_(o.reserved_at),created=parseDate_(o.created_at),expires=parseDate_(o.expires_at),attempted=parseDate_(claim.attempted_at);
  if (!accepted || !reserved || !created || !expires || !attempted || accepted<reserved || accepted<attempted || accepted>=expires || accepted.getTime()>Date.now() ||
    created.getTime()!==parseDate_(d.created_at).getTime() || expires.getTime()!==parseDate_(d.expires_at).getTime()) throw new Error('OWNER_DURABLE_SENT_TIMESTAMP_INVALID');
  return {httpStatus:200,providerMessageId:o.provider_message_id,apiAcceptedAt:accepted.toISOString(),evidence:{transport:'TELEGRAM',api_ok:true,durable_ack:true,consumer_id:'6176241',
    message_id:o.provider_message_id,receipt_id:o.receipt_id,source_notification_id:candidate.notificationId,notification_id:ids.notification_id,content_version:hash,
    receipt_kind:'NATIVE_DURABLE_PROVIDER_ACK',delivery_confirmed:false}};
}
/** Creates new owner-test fixtures only; never re-ages or selects a historical row. */
function prepareFreshOwnerTransportUatRows() { return prepareOwnerTransportUatRows_(['TELEGRAM_OWNER_ALERTS','LINE_OWNER_ALERTS']); }
function prepareOwnerLineUat() { return prepareOwnerTransportUatRows_(['LINE_OWNER_ALERTS']); }
function prepareOwnerTelegramUat() { return prepareOwnerTransportUatRows_(['TELEGRAM_OWNER_ALERTS']); }
/** One historical no-send claim may be isolated for the owner's 23-Oct ONE NEW test; never retried or rewritten. */
function ownerHistoricalTelegramUatNoSend_(store,properties,context) {
  assertLedgerLock_();
  if (properties.CORE_V1_TRANSPORT_ENABLED!=='FALSE') throw new Error('OWNER_UAT_REQUIRES_GLOBAL_DISABLED');
  if (properties.CORE_V1_UAT_ARMED!=='FALSE' || properties.CORE_V1_UAT_CONFIRMATION) throw new Error('OWNER_UAT_REQUIRES_DISARMED');
  var id='KKUAT_TG_41097307-885b-4aa7-8da2-8db97d4b5e74',claimId='CLAIM|b871e6e4-ac71-45c8-8587-5f86c3158a16',key=ownerLedgerPendingKey_(id);
  var raw=store.getProperty(key),pending=raw && safeJson_(raw);
  if (!pending || pending.version!=='kk-owner-ledger-local-v1' || pending.status!=='ADMISSION_UNKNOWN' || pending.envelope!==null ||
    !pending.candidate || pending.candidate.notificationId!==id || pending.candidate.controlledUat!==true || pending.candidate.transport!=='TELEGRAM_OWNER_ALERTS' ||
    !pending.claim || pending.claim.notification_id!==id || pending.claim.transport!=='TELEGRAM_OWNER_ALERTS' || pending.claim.claim_id!==claimId || pending.claim.attempt_count!==1) throw new Error('OWNER_UAT_HISTORICAL_NO_SEND_REQUIRED');
  if (Object.keys(properties).some(function(k) { if (k.indexOf('KK_OWNER_LEDGER_PENDING_')!==0 || k===key) return false;var p=safeJson_(properties[k]);return !p || p.status!=='SHEET_ACK_VERIFIED'; })) throw new Error('OWNER_UAT_PENDING_RECONCILIATION_REQUIRED');
  var exact=readExactLedgerCandidate_(context.sheet,pending.candidate,pending.claim),r=exact.record,created=parseDate_(r['Created At']),attempted=parseDate_(pending.claim.attempted_at);
  if (!created || !attempted || Date.now()-created.getTime()<=120000 || Date.now()-attempted.getTime()<=120000 ||
    r['Change Type']!=='TRANSPORT_UAT' || r.Priority!=='TEST' || r['Quiet Hours Policy']!=='OWNER_CONTROLLED_UAT' || r['Event Family ID']!=='' || r['Show ID']!=='' ||
    r['Audit Event ID']!=='CONTROLLED_UAT|'+id || r['Dedup Key']!=='OWNER_TRANSPORT_UAT|'+id || typeof r.Payload!=='string' || r.Payload.indexOf('ทดสอบระบบแจ้งเตือน')!==0 ||
    pending.candidate.payload!==r.Payload || pending.candidate.dedupKey!==r['Dedup Key'] || pending.candidate.status!=='QUEUED' || pending.candidate.attemptCount!==0 ||
    !pending.candidate.sourceRow || !pending.claim.before_row || JSON.stringify(ledgerRecordSnapshot_(pending.candidate.sourceRow))!==JSON.stringify(ledgerRecordSnapshot_(pending.claim.before_row)) ||
    JSON.stringify(ledgerRecordSnapshot_(r))!==JSON.stringify(ledgerRecordSnapshot_(ledgerPatchedRecord_(pending.claim.before_row,{Status:'SENDING','Attempt Count':1,'Last Attempt At':pending.claim.attempted_at,Notes:appendLedgerNote_(pending.claim.before_row.Notes,claimId)}))) ||
    pending.claim.before_row.Payload!==r.Payload || pending.claim.before_row.Status!=='QUEUED' || Number(pending.claim.before_row['Attempt Count'])!==0 ||
    r.Notes!=='OWNER_AUTHORIZED_TRANSPORT_UAT|'+id+' | '+claimId ||
    ['Delivery Evidence','Next Retry At','HTTP Status','Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error','Feedback Source'].some(function(k) { return hasLedgerValue_(r[k]); })) throw new Error('OWNER_UAT_HISTORICAL_NO_SEND_REQUIRED');
  return {notification_id:id,claim_id:claimId,status:pending.status,pending_sha256:ownerLedgerHash_(raw),claimed_row_sha256:ownerLedgerHash_(JSON.stringify(ledgerRecordSnapshot_(r))),pending_key:key,pending_raw:raw};
}
/** Logs hashes only, never a candidate, envelope, producer key or unrelated properties. */
function logOwnerHistoricalTelegramUatNoSendPreview() {
  var lock=LockService.getScriptLock();if (!lock.tryLock(5000)) throw new Error('OWNER_UAT_PREPARE_LOCK_BUSY');
  try {
    var store=PropertiesService.getScriptProperties(),p=ownerHistoricalTelegramUatNoSend_(store,store.getProperties(),openLedger_());
    var summary={notification_id:p.notification_id,claim_id:p.claim_id,status:p.status,pending_sha256:p.pending_sha256,claimed_row_sha256:p.claimed_row_sha256};
    console.log(JSON.stringify(summary));return summary;
  } finally { lock.releaseLock(); }
}
/** Private editor preparation only. Native evidence is operator-qualified; its hash is not a live DB assertion. */
function prepareOwnerTelegramUatAfterNoSendReconciliation() {
  var lock=LockService.getScriptLock();if (!lock.tryLock(5000)) throw new Error('OWNER_UAT_PREPARE_LOCK_BUSY');
  try {
    var store=PropertiesService.getScriptProperties(),properties=store.getProperties(),grantKey='KK_OWNER_LEDGER_NEW_TG_UAT_GRANT',consumedKey=grantKey+'_CONSUMED';
    if (store.getProperty(consumedKey)) throw new Error('OWNER_UAT_NEW_GRANT_ALREADY_CONSUMED');
    var context=openLedger_(),old=ownerHistoricalTelegramUatNoSend_(store,properties,context),raw=store.getProperty(grantKey),grant=raw && safeJson_(raw);
    var fields=['version','grant_id','owner_authorization_reference','issued_at','expires_at','old_notification_id','old_claim_id','old_pending_sha256','old_claimed_row_sha256','native_reconciliation_evidence_sha256'];
    var issued=grant && parseDate_(grant.issued_at),expires=grant && parseDate_(grant.expires_at),now=Date.now();
    if (!grant || Object.keys(grant).length!==fields.length || fields.some(function(k) { return typeof grant[k]!=='string'; }) ||
      grant.version!=='kk-owner-new-telegram-uat-grant-v1' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(grant.grant_id) ||
      grant.owner_authorization_reference!=='OWNER_2026-10-23_ONE_NEW_TELEGRAM_UAT' || !issued || !expires ||
      issued.toISOString()!==grant.issued_at || expires.toISOString()!==grant.expires_at || issued.getTime()>now || expires.getTime()<=now || expires-issued<=0 || expires-issued>300000 ||
      grant.old_notification_id!==old.notification_id || grant.old_claim_id!==old.claim_id || grant.old_pending_sha256!==old.pending_sha256 ||
      grant.old_claimed_row_sha256!==old.claimed_row_sha256 || !/^[a-f0-9]{64}$/.test(grant.native_reconciliation_evidence_sha256)) throw new Error('OWNER_UAT_NEW_GRANT_INVALID');
    var before=context.values.map(function(row) { return row.map(ledgerComparable_); }),created=new Date().toISOString(),id='KKUAT_TG_'+Utilities.getUuid(),record={};
    ledgerHeaders_().forEach(function(k) { record[k]=''; });
    Object.assign(record,{'Notification ID':id,'Created At':created,'Change Type':'TRANSPORT_UAT',Priority:'TEST','Quiet Hours Policy':'OWNER_CONTROLLED_UAT',
      Payload:'ทดสอบระบบแจ้งเตือนเจ้าของ KK Phone Rental เพื่อตรวจการเชื่อมต่อเท่านั้น ไม่มีข้อมูลอีเวนต์หรือลูกค้า','Audit Event ID':'CONTROLLED_UAT|'+id,
      Transport:'TELEGRAM_OWNER_ALERTS',Status:'QUEUED','Attempt Count':0,'Dedup Key':'OWNER_TRANSPORT_UAT|'+id,Notes:'OWNER_AUTHORIZED_TRANSPORT_UAT|'+id});
    if (context.values.length>128 || Utilities.newBlob(JSON.stringify(context.values.slice(1).map(function(row) { return ledgerNamedRow_(row,context.headers); }).concat([record]))).getBytes().length>262144) throw new Error('LEDGER_SOURCE_SNAPSHOT_BOUNDS');
    if (context.values.some(function(row) { return row[context.headers['Notification ID']]===id; })) throw new Error('OWNER_UAT_NEW_ID_COLLISION');
    // Record the sole new ID before append. An unknown write outcome is terminal until native reconciliation.
    var consumed=JSON.stringify({version:'kk-owner-new-telegram-uat-consumed-v1',grant:grant,new_notification_id:id,consumed_at:created,status:'CONSUMED_PREPARATION_OUTCOME_UNCONFIRMED'});
    store.setProperty(consumedKey,consumed);
    if (store.getProperty(consumedKey)!==consumed) throw new Error('OWNER_UAT_NEW_GRANT_CONSUME_READBACK_FAILED');
    context.sheet.getRange(context.values.length+1,1,1,23).setValues([ledgerRecordSnapshot_(record)]);SpreadsheetApp.flush();
    var fresh=context.sheet.getDataRange().getValues(),freshHeaders=readHeaders_(fresh[0]);
    if (fresh.length!==before.length+1 || JSON.stringify(fresh.slice(0,before.length).map(function(row) { return row.map(ledgerComparable_); }))!==JSON.stringify(before) ||
      JSON.stringify(ledgerRecordSnapshot_(ledgerNamedRow_(fresh[fresh.length-1],freshHeaders)))!==JSON.stringify(ledgerRecordSnapshot_(record)) || store.getProperty(old.pending_key)!==old.pending_raw ||
      store.getProperty(consumedKey)!==consumed) throw new Error('OWNER_UAT_NEW_GRANT_CREATE_READBACK_FAILED');
    var plan={status:'PREPARED_NO_SEND',notification_ids:[id],telegram_notification_id:id,line_notification_id:'',created_at:created,fresh_until:new Date(Date.parse(created)+120000).toISOString(),
      telegram_content_version:ownerLedgerHash_(JSON.stringify(ownerLedgerBinding_({notificationId:id,sourceRow:record}))),payload:record.Payload,provider_sends:0,armed:false};
    var planRaw=JSON.stringify(plan);store.setProperties({CORE_V1_UAT_NOTIFICATION_IDS:id,CORE_V1_UAT_ARMED:'FALSE',KK_OWNER_LEDGER_LAST_UAT_PLAN:planRaw},false);
    if (store.getProperty('KK_OWNER_LEDGER_LAST_UAT_PLAN')!==planRaw || store.getProperty('CORE_V1_UAT_NOTIFICATION_IDS')!==id ||
      store.getProperty('CORE_V1_UAT_ARMED')!=='FALSE' || store.getProperty('CORE_V1_TRANSPORT_ENABLED')!=='FALSE' || store.getProperty('CORE_V1_UAT_CONFIRMATION') ||
      store.getProperty(old.pending_key)!==old.pending_raw) throw new Error('OWNER_UAT_NEW_GRANT_PLAN_READBACK_FAILED');
    return plan;
  } finally { lock.releaseLock(); }
}
/** Distinct second authorization: both historical claims stay frozen and are never returned for dispatch. */
function ownerRelayTelegramUatNoSend_(store,properties,context) {
  assertLedgerLock_();
  if (ScriptApp.getScriptId()!=='1NYvGpqhx8QJR6onHX07_8gWxSwIAvhblMDDpMWfYLEKK02sK352J0_WF') throw new Error('OWNER_LEDGER_SCRIPT_SCOPE_INVALID');
  if (properties.CORE_V1_TRANSPORT_ENABLED!=='FALSE') throw new Error('OWNER_UAT_REQUIRES_GLOBAL_DISABLED');
  if (properties.CORE_V1_UAT_ARMED!=='FALSE' || properties.CORE_V1_UAT_CONFIRMATION) throw new Error('OWNER_UAT_REQUIRES_DISARMED');
  var pinned=[['KKUAT_TG_41097307-885b-4aa7-8da2-8db97d4b5e74','CLAIM|b871e6e4-ac71-45c8-8587-5f86c3158a16','ADMISSION_UNKNOWN'],
    ['KKUAT_TG_caf84575-743a-4cbe-8588-6e8ee6d2532c','CLAIM|47af8985-f021-403e-bbbd-1f08dc73f8ed','ADMITTED']];
  var keys=pinned.map(function(p) { return ownerLedgerPendingKey_(p[0]); });
  if (Object.keys(properties).some(function(k) { if (k.indexOf('KK_OWNER_LEDGER_PENDING_')!==0 || keys.indexOf(k)>=0) return false;var p=safeJson_(properties[k]);return !p || p.status!=='SHEET_ACK_VERIFIED'; })) throw new Error('OWNER_UAT_PENDING_RECONCILIATION_REQUIRED');
  var frozen=pinned.map(function(p,i) {
    var id=p[0],claimId=p[1],raw=store.getProperty(keys[i]),pending=raw && safeJson_(raw);
    if (!pending || pending.version!=='kk-owner-ledger-local-v1' || pending.status!==p[2] || (i===0?pending.envelope!==null:!pending.envelope) ||
      !pending.candidate || pending.candidate.notificationId!==id || pending.candidate.controlledUat!==true || pending.candidate.transport!=='TELEGRAM_OWNER_ALERTS' ||
      !pending.claim || pending.claim.notification_id!==id || pending.claim.transport!=='TELEGRAM_OWNER_ALERTS' || pending.claim.claim_id!==claimId || pending.claim.attempt_count!==1) throw new Error('OWNER_UAT_RELAY_HISTORICAL_NO_SEND_REQUIRED');
    var exact=readExactLedgerCandidate_(context.sheet,pending.candidate,pending.claim),r=exact.record,created=parseDate_(r['Created At']),attempted=parseDate_(pending.claim.attempted_at);
    if (!created || !attempted || Date.now()-created.getTime()<=120000 || Date.now()-attempted.getTime()<=120000 ||
      r['Change Type']!=='TRANSPORT_UAT' || r.Priority!=='TEST' || r['Quiet Hours Policy']!=='OWNER_CONTROLLED_UAT' || r['Event Family ID']!=='' || r['Show ID']!=='' ||
      r['Audit Event ID']!=='CONTROLLED_UAT|'+id || r['Dedup Key']!=='OWNER_TRANSPORT_UAT|'+id || typeof r.Payload!=='string' || r.Payload.indexOf('ทดสอบระบบแจ้งเตือน')!==0 ||
      pending.candidate.payload!==r.Payload || pending.candidate.dedupKey!==r['Dedup Key'] || pending.candidate.status!=='QUEUED' || pending.candidate.attemptCount!==0 ||
      !pending.candidate.sourceRow || !pending.claim.before_row || JSON.stringify(ledgerRecordSnapshot_(pending.candidate.sourceRow))!==JSON.stringify(ledgerRecordSnapshot_(pending.claim.before_row)) ||
      JSON.stringify(ledgerRecordSnapshot_(r))!==JSON.stringify(ledgerRecordSnapshot_(ledgerPatchedRecord_(pending.claim.before_row,{Status:'SENDING','Attempt Count':1,'Last Attempt At':pending.claim.attempted_at,Notes:appendLedgerNote_(pending.claim.before_row.Notes,claimId)}))) ||
      pending.claim.before_row.Payload!==r.Payload || pending.claim.before_row.Status!=='QUEUED' || Number(pending.claim.before_row['Attempt Count'])!==0 ||
      r.Notes!=='OWNER_AUTHORIZED_TRANSPORT_UAT|'+id+' | '+claimId ||
      ['Delivery Evidence','Next Retry At','HTTP Status','Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error','Feedback Source'].some(function(k) { return hasLedgerValue_(r[k]); })) throw new Error('OWNER_UAT_RELAY_HISTORICAL_NO_SEND_REQUIRED');
    if (i===1) {
      ownerLedgerValidateEnvelope_(pending.envelope,pending.candidate,true);
      if (Date.now()-parseDate_(pending.envelope.expires_at).getTime()<=120000) throw new Error('OWNER_UAT_RELAY_EXPIRED_DESCRIPTOR_REQUIRED');
    }
    return {summary:{notification_id:id,claim_id:claimId,pending_status:pending.status,pending_sha256:ownerLedgerHash_(raw),claimed_row_sha256:ownerLedgerHash_(JSON.stringify(ledgerRecordSnapshot_(r)))},
      key:keys[i],raw:raw,created_at:created.toISOString()};
  });
  var priorKey='KK_OWNER_LEDGER_NEW_TG_UAT_GRANT_CONSUMED',priorRaw=store.getProperty(priorKey),prior=priorRaw && safeJson_(priorRaw),priorGrant=prior && prior.grant;
  var consumedAt=prior && parseDate_(prior.consumed_at),issued=priorGrant && parseDate_(priorGrant.issued_at),expires=priorGrant && parseDate_(priorGrant.expires_at);
  if (!prior || prior.version!=='kk-owner-new-telegram-uat-consumed-v1' || prior.status!=='CONSUMED_PREPARATION_OUTCOME_UNCONFIRMED' || prior.new_notification_id!==pinned[1][0] ||
    !priorGrant || priorGrant.version!=='kk-owner-new-telegram-uat-grant-v1' || priorGrant.owner_authorization_reference!=='OWNER_2026-10-23_ONE_NEW_TELEGRAM_UAT' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(priorGrant.grant_id) ||
    priorGrant.old_notification_id!==pinned[0][0] || priorGrant.old_claim_id!==pinned[0][1] || priorGrant.old_pending_sha256!==frozen[0].summary.pending_sha256 ||
    priorGrant.old_claimed_row_sha256!==frozen[0].summary.claimed_row_sha256 || !consumedAt || consumedAt.toISOString()!==frozen[1].created_at ||
    !issued || !expires || consumedAt<issued || consumedAt>=expires || expires-issued>300000) throw new Error('OWNER_UAT_RELAY_PRIOR_CONSUMED_INVALID');
  return {historical_claims:frozen.map(function(p) { return p.summary; }),frozen:frozen,prior_key:priorKey,prior_raw:priorRaw,prior_grant_id:priorGrant.grant_id,prior_consumed_grant_sha256:ownerLedgerHash_(priorRaw)};
}
/** Only hashes and pinned identities leave this no-network preview. */
function logOwnerRelayTelegramUatNoSendPreview() {
  var lock=LockService.getScriptLock();if (!lock.tryLock(5000)) throw new Error('OWNER_UAT_PREPARE_LOCK_BUSY');
  try {
    var store=PropertiesService.getScriptProperties(),old=ownerRelayTelegramUatNoSend_(store,store.getProperties(),openLedger_());
    var summary={historical_claims:old.historical_claims,prior_consumed_grant_sha256:old.prior_consumed_grant_sha256};console.log(JSON.stringify(summary));return summary;
  } finally { lock.releaseLock(); }
}
/** New, separately consumed owner grant; original preparation, admission and ACK paths stay unchanged. */
function prepareOwnerTelegramUatAfterRelayReconciliation() {
  var lock=LockService.getScriptLock();if (!lock.tryLock(5000)) throw new Error('OWNER_UAT_PREPARE_LOCK_BUSY');
  try {
    var store=PropertiesService.getScriptProperties(),properties=store.getProperties(),grantKey='KK_OWNER_LEDGER_RELAY_TG_UAT_GRANT_20261023',consumedKey=grantKey+'_CONSUMED';
    if (store.getProperty(consumedKey)) throw new Error('OWNER_UAT_RELAY_GRANT_ALREADY_CONSUMED');
    var context=openLedger_(),old=ownerRelayTelegramUatNoSend_(store,properties,context),raw=store.getProperty(grantKey),grant=raw && safeJson_(raw);
    var fields=['version','grant_id','owner_authorization_reference','issued_at','expires_at','prior_consumed_grant_sha256','historical_claims','native_reconciliation_evidence_sha256'];
    var historyFields=['notification_id','claim_id','pending_status','pending_sha256','claimed_row_sha256'],issued=grant && parseDate_(grant.issued_at),expires=grant && parseDate_(grant.expires_at),now=Date.now();
    if (!grant || Object.keys(grant).length!==fields.length || fields.some(function(k) { return k==='historical_claims'?false:typeof grant[k]!=='string'; }) ||
      grant.version!=='kk-owner-relay-telegram-uat-grant-v2' || grant.owner_authorization_reference!=='OWNER_2026-10-23_ONE_ADDITIONAL_NEW_TELEGRAM_UAT' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(grant.grant_id) || grant.grant_id===old.prior_grant_id ||
      !issued || !expires || issued.toISOString()!==grant.issued_at || expires.toISOString()!==grant.expires_at || issued.getTime()>now || expires.getTime()<=now || expires-issued<=0 || expires-issued>300000 ||
      grant.prior_consumed_grant_sha256!==old.prior_consumed_grant_sha256 || !/^[a-f0-9]{64}$/.test(grant.native_reconciliation_evidence_sha256) ||
      !Array.isArray(grant.historical_claims) || grant.historical_claims.length!==2 || grant.historical_claims.some(function(p,i) { return !p || Object.keys(p).length!==historyFields.length || historyFields.some(function(k) { return typeof p[k]!=='string' || p[k]!==old.historical_claims[i][k]; }); })) throw new Error('OWNER_UAT_RELAY_GRANT_INVALID');
    var before=context.values.map(function(row) { return row.map(ledgerComparable_); }),created=new Date().toISOString(),id='KKUAT_TG_'+Utilities.getUuid(),record={};
    ledgerHeaders_().forEach(function(k) { record[k]=''; });
    Object.assign(record,{'Notification ID':id,'Created At':created,'Change Type':'TRANSPORT_UAT',Priority:'TEST','Quiet Hours Policy':'OWNER_CONTROLLED_UAT',
      Payload:'ทดสอบระบบแจ้งเตือนเจ้าของ KK Phone Rental เพื่อตรวจการเชื่อมต่อเท่านั้น ไม่มีข้อมูลอีเวนต์หรือลูกค้า','Audit Event ID':'CONTROLLED_UAT|'+id,
      Transport:'TELEGRAM_OWNER_ALERTS',Status:'QUEUED','Attempt Count':0,'Dedup Key':'OWNER_TRANSPORT_UAT|'+id,Notes:'OWNER_AUTHORIZED_TRANSPORT_UAT|'+id});
    if (context.values.length>128 || Utilities.newBlob(JSON.stringify(context.values.slice(1).map(function(row) { return ledgerNamedRow_(row,context.headers); }).concat([record]))).getBytes().length>262144) throw new Error('LEDGER_SOURCE_SNAPSHOT_BOUNDS');
    if (context.values.some(function(row) { return row[context.headers['Notification ID']]===id; })) throw new Error('OWNER_UAT_NEW_ID_COLLISION');
    var consumed=JSON.stringify({version:'kk-owner-relay-telegram-uat-consumed-v2',grant:grant,new_notification_id:id,consumed_at:created,status:'CONSUMED_PREPARATION_OUTCOME_UNCONFIRMED'});
    store.setProperty(consumedKey,consumed);if (store.getProperty(consumedKey)!==consumed) throw new Error('OWNER_UAT_RELAY_GRANT_CONSUME_READBACK_FAILED');
    context.sheet.getRange(context.values.length+1,1,1,23).setValues([ledgerRecordSnapshot_(record)]);SpreadsheetApp.flush();
    var fresh=context.sheet.getDataRange().getValues(),freshHeaders=readHeaders_(fresh[0]);
    if (fresh.length!==before.length+1 || JSON.stringify(fresh.slice(0,before.length).map(function(row) { return row.map(ledgerComparable_); }))!==JSON.stringify(before) ||
      JSON.stringify(ledgerRecordSnapshot_(ledgerNamedRow_(fresh[fresh.length-1],freshHeaders)))!==JSON.stringify(ledgerRecordSnapshot_(record)) || store.getProperty(old.prior_key)!==old.prior_raw ||
      old.frozen.some(function(p) { return store.getProperty(p.key)!==p.raw; }) || store.getProperty(consumedKey)!==consumed) throw new Error('OWNER_UAT_RELAY_GRANT_CREATE_READBACK_FAILED');
    var plan={status:'PREPARED_NO_SEND',notification_ids:[id],telegram_notification_id:id,line_notification_id:'',created_at:created,fresh_until:new Date(Date.parse(created)+120000).toISOString(),
      telegram_content_version:ownerLedgerHash_(JSON.stringify(ownerLedgerBinding_({notificationId:id,sourceRow:record}))),payload:record.Payload,provider_sends:0,armed:false};
    var planRaw=JSON.stringify(plan);store.setProperties({CORE_V1_UAT_NOTIFICATION_IDS:id,CORE_V1_UAT_ARMED:'FALSE',KK_OWNER_LEDGER_LAST_UAT_PLAN:planRaw},false);
    if (store.getProperty('KK_OWNER_LEDGER_LAST_UAT_PLAN')!==planRaw || store.getProperty('CORE_V1_UAT_NOTIFICATION_IDS')!==id || store.getProperty('CORE_V1_UAT_ARMED')!=='FALSE' ||
      store.getProperty('CORE_V1_TRANSPORT_ENABLED')!=='FALSE' || store.getProperty('CORE_V1_UAT_CONFIRMATION') || store.getProperty(old.prior_key)!==old.prior_raw ||
      old.frozen.some(function(p) { return store.getProperty(p.key)!==p.raw; }) || store.getProperty(consumedKey)!==consumed ||
      JSON.stringify(context.sheet.getDataRange().getValues().map(function(row) { return row.map(ledgerComparable_); }))!==JSON.stringify(fresh.map(function(row) { return row.map(ledgerComparable_); }))) throw new Error('OWNER_UAT_RELAY_GRANT_PLAN_READBACK_FAILED');
    console.log(JSON.stringify({status:plan.status,telegram_notification_id:id,telegram_content_version:plan.telegram_content_version,created_at:created,fresh_until:plan.fresh_until,provider_sends:0,armed:false}));return plan;
  } finally { lock.releaseLock(); }
}
function prepareOwnerTransportUatRows_(transports) {
  var lock=LockService.getScriptLock();if (!lock.tryLock(5000)) throw new Error('OWNER_UAT_PREPARE_LOCK_BUSY');
  try {
    var store=PropertiesService.getScriptProperties(),properties=store.getProperties();
    if (properties.CORE_V1_TRANSPORT_ENABLED!=='FALSE') throw new Error('OWNER_UAT_REQUIRES_GLOBAL_DISABLED');
    if (Object.keys(properties).some(function(k) { return k.indexOf('KK_OWNER_LEDGER_PENDING_')===0 && safeJson_(properties[k]).status!=='SHEET_ACK_VERIFIED'; })) throw new Error('OWNER_UAT_PENDING_RECONCILIATION_REQUIRED');
    var context=openLedger_(),created=new Date().toISOString(),payload='ทดสอบระบบแจ้งเตือนเจ้าของ KK Phone Rental เพื่อตรวจการเชื่อมต่อเท่านั้น ไม่มีข้อมูลอีเวนต์หรือลูกค้า';
    if (context.values.length-1+transports.length>128) throw new Error('LEDGER_SOURCE_SNAPSHOT_BOUNDS');
    var records=transports.map(function(transport) {
      var id='KKUAT_'+(transport==='TELEGRAM_OWNER_ALERTS'?'TG_':'LINE_')+Utilities.getUuid(),record={};ledgerHeaders_().forEach(function(k) { record[k]=''; });
      Object.assign(record,{'Notification ID':id,'Created At':created,'Change Type':'TRANSPORT_UAT',Priority:'TEST','Quiet Hours Policy':'OWNER_CONTROLLED_UAT',Payload:payload,
        'Audit Event ID':'CONTROLLED_UAT|'+id,Transport:transport,Status:'QUEUED','Attempt Count':0,'Dedup Key':'OWNER_TRANSPORT_UAT|'+id,Notes:'OWNER_AUTHORIZED_TRANSPORT_UAT|'+id});return record;
    });
    var ids=records.map(function(r) { return r['Notification ID']; });
    if (context.values.some(function(row) { return ids.indexOf(row[context.headers['Notification ID']])>=0; })) throw new Error('OWNER_UAT_NEW_ID_COLLISION');
    store.setProperties({CORE_V1_UAT_NOTIFICATION_IDS:ids.join(','),CORE_V1_UAT_ARMED:'FALSE'},false);store.deleteProperty('CORE_V1_UAT_CONFIRMATION');
    context.sheet.getRange(context.sheet.getLastRow()+1,1,records.length,23).setValues(records.map(function(r) { return ledgerHeaders_().map(function(k) { return r[k]; }); }));SpreadsheetApp.flush();
    var fresh=context.sheet.getDataRange().getValues();readHeaders_(fresh[0]);
    records.forEach(function(record) { var matching=fresh.slice(1).filter(function(row) { return row[context.headers['Notification ID']]===record['Notification ID']; });
      if (matching.length!==1 || JSON.stringify(ledgerRecordSnapshot_(ledgerNamedRow_(matching[0],context.headers)))!==JSON.stringify(ledgerRecordSnapshot_(record))) throw new Error('OWNER_UAT_CREATE_READBACK_FAILED'); });
    var tg=records.filter(function(r) { return r.Transport==='TELEGRAM_OWNER_ALERTS'; })[0],line=records.filter(function(r) { return r.Transport==='LINE_OWNER_ALERTS'; })[0];
    var plan={status:'PREPARED_NO_SEND',notification_ids:ids,telegram_notification_id:tg?tg['Notification ID']:'',line_notification_id:line?line['Notification ID']:'',created_at:created,fresh_until:new Date(Date.parse(created)+120000).toISOString(),
      telegram_content_version:tg?ownerLedgerHash_(JSON.stringify(ownerLedgerBinding_({notificationId:tg['Notification ID'],sourceRow:tg}))):'',payload:payload,provider_sends:0,armed:false};
    store.setProperty('KK_OWNER_LEDGER_LAST_UAT_PLAN',JSON.stringify(plan));return plan;
  } finally { lock.releaseLock(); }
}
function logFreshOwnerTransportUatPlan() { var raw=PropertiesService.getScriptProperties().getProperty('KK_OWNER_LEDGER_LAST_UAT_PLAN');if (!raw) throw new Error('OWNER_UAT_PLAN_MISSING');console.log(raw); }
function runOwnerLineUat() {
  var store=PropertiesService.getScriptProperties(),properties=store.getProperties(),raw=properties.KK_OWNER_LEDGER_LAST_UAT_PLAN,plan=raw && safeJson_(raw);
  if (properties.CORE_V1_TRANSPORT_ENABLED!=='FALSE' || !plan || !plan.line_notification_id || plan.notification_ids.length!==1 || plan.telegram_notification_id) throw new Error('OWNER_LINE_SINGLE_FRESH_PLAN_REQUIRED');
  var context=openLedger_(),ids=parseCsvSet_(plan.line_notification_id),candidates=collectCandidates_(context.values,context.headers,properties,false,{controlledUatIds:ids,enforceQuietHours:true});
  if (candidates.length!==1 || !candidates[0].controlledUat || candidates[0].transport!=='LINE_OWNER_ALERTS') throw new Error('OWNER_LINE_FRESH_IDENTITY_REQUIRED');
  try {
    store.setProperties({CORE_V1_UAT_NOTIFICATION_IDS:plan.line_notification_id,CORE_V1_UAT_ARMED:'TRUE',CORE_V1_UAT_CONFIRMATION:'SEND_ALLOWLISTED_OWNER_ALERTS'},false);
    var result=runCoreV1ControlledUat();console.log(JSON.stringify(result));return result;
  } finally {
    // The arming write may apply then throw; Core may also return or throw before taking its lock.
    // An unsuccessful attempt must never leave a reusable armed fuse.
    store.setProperty('CORE_V1_UAT_ARMED','FALSE');
    store.deleteProperty('CORE_V1_UAT_CONFIRMATION');
    if (store.getProperty('CORE_V1_UAT_ARMED')!=='FALSE' || store.getProperty('CORE_V1_UAT_CONFIRMATION')) throw new Error('OWNER_UAT_DISARM_READBACK_FAILED');
  }
}

/** Editor entrypoints keep target selection in the private exact last plan. */
function ownerLedgerTelegramUatPlan_(properties) {
  var raw=properties.KK_OWNER_LEDGER_LAST_UAT_PLAN,plan=raw && safeJson_(raw);
  if (properties.CORE_V1_TRANSPORT_ENABLED!=='FALSE' || !plan || plan.status!=='PREPARED_NO_SEND' ||
    !Array.isArray(plan.notification_ids) || plan.notification_ids.length!==1 || typeof plan.telegram_notification_id!=='string' ||
    !plan.telegram_notification_id || plan.notification_ids[0]!==plan.telegram_notification_id || plan.line_notification_id!=='') throw new Error('OWNER_TELEGRAM_SINGLE_FRESH_PLAN_REQUIRED');
  return plan;
}
function runOwnerTelegramUat() {
  var store=PropertiesService.getScriptProperties(),properties=store.getProperties(),plan=ownerLedgerTelegramUatPlan_(properties);
  if (properties.CORE_V1_UAT_ARMED!=='FALSE') throw new Error('OWNER_TELEGRAM_REQUIRES_UAT_DISARMED');
  // An absent producer binding must reject before arming or consuming a claim.
  ownerLedgerBridgeConfig_(properties);
  var context=openLedger_(),ids=parseCsvSet_(plan.telegram_notification_id),candidates=collectCandidates_(context.values,context.headers,properties,false,{controlledUatIds:ids,enforceQuietHours:true});
  if (candidates.length!==1 || !candidates[0].controlledUat || candidates[0].transport!=='TELEGRAM_OWNER_ALERTS') throw new Error('OWNER_TELEGRAM_FRESH_IDENTITY_REQUIRED');
  try {
    store.setProperties({CORE_V1_UAT_NOTIFICATION_IDS:plan.telegram_notification_id,CORE_V1_UAT_ARMED:'TRUE',CORE_V1_UAT_CONFIRMATION:'SEND_ALLOWLISTED_OWNER_ALERTS'},false);
    var result=runCoreV1ControlledUat();console.log(JSON.stringify(result));return result;
  } finally {
    store.setProperty('CORE_V1_UAT_ARMED','FALSE');
    store.deleteProperty('CORE_V1_UAT_CONFIRMATION');
    if (store.getProperty('CORE_V1_UAT_ARMED')!=='FALSE' || store.getProperty('CORE_V1_UAT_CONFIRMATION')) throw new Error('OWNER_UAT_DISARM_READBACK_FAILED');
  }
}
function finalizeLastOwnerTelegramUatAck() {
  var plan=ownerLedgerTelegramUatPlan_(PropertiesService.getScriptProperties().getProperties());
  var result=finalizeOwnerLedgerBridgeAck(plan.telegram_notification_id);
  var summary={notification_id:result.notification_id,status:result.status,transport:result.transport,provider_message_id:result.provider_message_id,
    api_accepted_at:result.api_accepted_at,delivery_confirmed_at:result.delivery_confirmed_at};
  console.log(JSON.stringify(summary));return summary;
}

/** Private debugger checkpoint: chunks remain local; only a safe summary may return. */
function ownerLedgerRelayReadOnlyCheckpoint_(summary,chunks) { return Object.freeze(summary); }
/** Read-only complete-value inspection; never renews, signs, admits, sends, logs or writes. */
function inspectLastOwnerTelegramUatRelayReadOnly() {
  var lock=LockService.getScriptLock();if (!lock.tryLock(5000)) throw new Error('OWNER_RELAY_READ_ONLY_LOCK_BUSY');
  try {
    if (ScriptApp.getScriptId()!=='1NYvGpqhx8QJR6onHX07_8gWxSwIAvhblMDDpMWfYLEKK02sK352J0_WF') throw new Error('OWNER_LEDGER_SCRIPT_SCOPE_INVALID');
    var store=PropertiesService.getScriptProperties(),properties={};
    ['CORE_V1_TRANSPORT_ENABLED','CORE_V1_UAT_ARMED','CORE_V1_UAT_CONFIRMATION','KK_OWNER_LEDGER_LAST_UAT_PLAN','CORE_V1_SPREADSHEET_ID'].forEach(function(k) { properties[k]=store.getProperty(k); });
    if (properties.CORE_V1_TRANSPORT_ENABLED!=='FALSE' || properties.CORE_V1_UAT_ARMED!=='FALSE' || properties.CORE_V1_UAT_CONFIRMATION) throw new Error('OWNER_RELAY_READ_ONLY_REQUIRES_DISARMED');
    var plan=ownerLedgerTelegramUatPlan_(properties),id=plan.telegram_notification_id;
    if (!/^KKUAT_TG_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id) || plan.provider_sends!==0 || plan.armed!==false) throw new Error('OWNER_RELAY_READ_ONLY_PLAN_INVALID');
    if (properties.CORE_V1_SPREADSHEET_ID && properties.CORE_V1_SPREADSHEET_ID!==CORE_V1.spreadsheetId) throw new Error('LEDGER_SCOPE_INVALID');
    var sheet=SpreadsheetApp.openById(CORE_V1.spreadsheetId).getSheetByName(CORE_V1.ledgerSheet);
    if (!sheet) throw new Error('LEDGER_SHEET_NOT_FOUND');assertLedgerScope_(sheet);
    var pending=ownerLedgerLoadPending_(id),candidate=pending.candidate,claim=pending.claim;
    if (pending.status!=='ADMITTED' || !pending.envelope || candidate.controlledUat!==true || candidate.transport!=='TELEGRAM_OWNER_ALERTS' || candidate.status!=='QUEUED' || candidate.attemptCount!==0 ||
      claim.transport!=='TELEGRAM_OWNER_ALERTS' || claim.attempt_count!==1 || !/^CLAIM\|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(claim.claim_id)) throw new Error('OWNER_RELAY_READ_ONLY_PENDING_INVALID');
    var exact=readExactLedgerCandidate_(sheet,candidate,claim),r=exact.record,created=parseDate_(r['Created At']);
    if (!created || plan.created_at!==created.toISOString() || plan.fresh_until!==new Date(created.getTime()+120000).toISOString() || plan.payload!==candidate.payload ||
      plan.telegram_content_version!==ownerLedgerHash_(JSON.stringify(ownerLedgerBinding_(candidate))) || candidate.payload!==r.Payload || candidate.dedupKey!==r['Dedup Key'] ||
      r['Change Type']!=='TRANSPORT_UAT' || r.Priority!=='TEST' || r['Quiet Hours Policy']!=='OWNER_CONTROLLED_UAT' || r['Event Family ID']!=='' || r['Show ID']!=='' ||
      r['Audit Event ID']!=='CONTROLLED_UAT|'+id || r['Dedup Key']!=='OWNER_TRANSPORT_UAT|'+id || typeof r.Payload!=='string' || r.Payload.indexOf('ทดสอบระบบแจ้งเตือน')!==0 ||
      !candidate.sourceRow || !claim.before_row || JSON.stringify(ledgerRecordSnapshot_(candidate.sourceRow))!==JSON.stringify(ledgerRecordSnapshot_(claim.before_row)) ||
      JSON.stringify(ledgerRecordSnapshot_(r))!==JSON.stringify(ledgerRecordSnapshot_(ledgerPatchedRecord_(claim.before_row,{Status:'SENDING','Attempt Count':1,'Last Attempt At':claim.attempted_at,Notes:appendLedgerNote_(claim.before_row.Notes,claim.claim_id)}))) ||
      claim.before_row.Status!=='QUEUED' || Number(claim.before_row['Attempt Count'])!==0 || r.Notes!=='OWNER_AUTHORIZED_TRANSPORT_UAT|'+id+' | '+claim.claim_id ||
      ['Delivery Evidence','Next Retry At','HTTP Status','Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error','Feedback Source'].some(function(k) { return hasLedgerValue_(r[k]); })) throw new Error('OWNER_RELAY_READ_ONLY_SOURCE_INVALID');
    ownerLedgerValidateEnvelope_(pending.envelope,candidate,true);
    var serialized=JSON.stringify(pending.envelope),encoded=Utilities.base64EncodeWebSafe(serialized,Utilities.Charset.UTF_8).replace(/=+$/,''),chunks=[];
    for (var i=0;i<encoded.length;i+=80) chunks.push(encoded.slice(i,i+80));
    var summary={status:'READ_ONLY_RELAY_INSPECTION',notification_id:id,field_count:Object.keys(pending.envelope).length,chunk_count:chunks.length,
      max_chunk_length:Math.max.apply(null,chunks.map(function(s) { return s.length; })),encoded_length:encoded.length,utf8_bytes:Utilities.newBlob(serialized).getBytes().length,
      envelope_sha256:ownerLedgerHash_(serialized),text_sha256:ownerLedgerHash_(pending.envelope.text),text_length:pending.envelope.text.length,
      expires_at:pending.envelope.expires_at,expired:Date.now()>=Date.parse(pending.envelope.expires_at),provider_sends:0};
    return ownerLedgerRelayReadOnlyCheckpoint_(summary,chunks);
  } finally { lock.releaseLock(); }
}
