/** Private authenticated Execution API only; no public webapp or provider sender. */
var CANONICAL_CONTEXT_FIELDS_=['version','cutover_id','activated_at','policy_version','consumer_id','max_attempts','script_project_id','spreadsheet_id','tab','transport','environment','poll_id','slot_id','due_at','observed_at','nonce'];
function canonicalExact_(v,keys) {
  if (!v || typeof v!=='object' || Array.isArray(v) || Object.keys(v).length!==keys.length || Object.keys(v).some(function(k) { return keys.indexOf(k)<0; })) throw new Error('CANONICAL_FIELDS_INVALID');
}
function canonicalConfig_() {
  var p=PropertiesService.getScriptProperties().getProperties();
  if (p.KK_OWNER_CANONICAL_ENABLED!=='TRUE' || ScriptApp.getScriptId()!=='1NYvGpqhx8QJR6onHX07_8gWxSwIAvhblMDDpMWfYLEKK02sK352J0_WF' ||
    typeof p.KK_OWNER_CANONICAL_SECRET!=='string' || p.KK_OWNER_CANONICAL_SECRET.length<32 || p.KK_OWNER_CANONICAL_SECRET===p.KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET ||
    !p.KK_OWNER_CANONICAL_CUTOVER_ID || !p.KK_OWNER_CANONICAL_ACTIVATED_AT || ['preview','production'].indexOf(p.KK_OWNER_CANONICAL_ENVIRONMENT)<0) throw new Error('CANONICAL_DISABLED_OR_UNBOUND');
  return p;
}
function canonicalSignedText_(a) { return JSON.stringify(['KK_OWNER_CANONICAL_V2',a.action,CANONICAL_CONTEXT_FIELDS_.map(function(k) { return a.context[k]; }),a.data]); }
function canonicalSign_(action,context,data,p) {
  var a={version:'kk-owner-ledger-producer-v2',action:action,context:context,data:data};
  a.signature=ownerLedgerHex_(Utilities.computeHmacSha256Signature(canonicalSignedText_(a),p.KK_OWNER_CANONICAL_SECRET,Utilities.Charset.UTF_8));return a;
}
function canonicalVerify_(a,action,p,projection) {
  canonicalExact_(a,['version','action','context','data','signature']);var c=a.context;canonicalExact_(c,CANONICAL_CONTEXT_FIELDS_);
  if (a.version!=='kk-owner-ledger-producer-v2' || a.action!==action || typeof a.signature!=='string' || !/^[a-f0-9]{64}$/.test(a.signature) ||
    c.version!=='kk-owner-canonical-context-v2' || c.cutover_id!==p.KK_OWNER_CANONICAL_CUTOVER_ID || c.activated_at!==p.KK_OWNER_CANONICAL_ACTIVATED_AT ||
    c.environment!==p.KK_OWNER_CANONICAL_ENVIRONMENT || c.policy_version!=='v4.9.44' || c.consumer_id!=='6176241' || c.max_attempts!==String(maximumAttempts_(p)) || c.script_project_id!==ScriptApp.getScriptId() ||
    c.spreadsheet_id!==CORE_V1.spreadsheetId || c.tab!==CORE_V1.ledgerSheet || c.transport!=='TELEGRAM_OWNER_ALERTS' ||
    CANONICAL_CONTEXT_FIELDS_.some(function(k) { return typeof c[k]!=='string'; }) || !/^[1-9][0-9]*$/.test(c.slot_id) ||
    ['cutover_id','poll_id','nonce'].some(function(k) { return !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(c[k]); })) throw new Error('CANONICAL_CONTEXT_INVALID');
  var expected=canonicalSign_(action,c,a.data,p).signature,diff=0;for(var i=0;i<expected.length;i+=1) diff|=expected.charCodeAt(i)^a.signature.charCodeAt(i);
  if (diff!==0) throw new Error('CANONICAL_SIGNATURE_INVALID');
  var now=Date.now(),epoch=Date.parse(c.activated_at),due=Date.parse(c.due_at),observed=Date.parse(c.observed_at);
  if (!isFinite(epoch) || !isFinite(due) || !isFinite(observed) || due!==epoch+Number(c.slot_id)*900000 || observed<due || observed>due+120000 ||
    (!projection && (observed<now-120000 || observed>now+15000 || now>due+120000))) throw new Error('CANONICAL_CONTEXT_EXPIRED');return c;
}
function canonicalRows_(context) {
  if (context.values.length-1>128) throw new Error('CANONICAL_SNAPSHOT_BOUNDS');
  var rows=context.values.slice(1).map(function(row) { var r=ledgerNamedRow_(row,context.headers);ledgerHeaders_().forEach(function(k) { r[k]=ledgerComparable_(r[k]); });return r; });
  if (Utilities.newBlob(JSON.stringify(rows)).getBytes().length>262144) throw new Error('CANONICAL_SNAPSHOT_BOUNDS');return rows;
}
function canonicalEligible_(candidate,rows,c,p) {
  var r=candidate.sourceRow,created=parseDate_(r['Created At']),observed=parseDate_(c.observed_at),cutoff=parseDate_(c.activated_at);
  if (ledgerHeaders_().some(function(k) { return k!=='Attempt Count' && typeof ledgerComparable_(r[k])!=='string'; })) return false;
  var first=candidate.status==='QUEUED' && candidate.attemptCount===0;
  var retry=candidate.status==='RETRY_WAIT' && candidate.attemptCount>0 && candidate.attemptCount<maximumAttempts_(p) &&
    !!parseDate_(r['Next Retry At']) && parseDate_(r['Next Retry At']).getTime()<=Date.now() && r['HTTP Status']==='429' && r['Last Error']==='TELEGRAM_API_REJECTED_HTTP_429' &&
    !hasLedgerValue_(r['Delivery Evidence']) && !hasLedgerValue_(r['Provider Message ID']) && !hasLedgerValue_(r['API Accepted At']) && !hasLedgerValue_(r['Delivery Confirmed At']) && !hasLedgerValue_(r['Feedback Source']);
  if (candidate.transport!=='TELEGRAM_OWNER_ALERTS' || (!first && !retry) || candidate.controlledUat || candidate.alreadySent || candidate.requiresReconciliation || candidate.duplicateInBatch ||
    !created || !observed || !cutoff || created<cutoff || created>observed || !candidate.notificationId || !candidate.dedupKey ||
    !r['Event Family ID'] || !r['Change Type'] || !r.Priority || !r['Quiet Hours Policy'] || !r['Audit Event ID'] ||
    r['Change Type']==='TRANSPORT_UAT' || r.Priority==='TEST' || r['Quiet Hours Policy']==='OWNER_CONTROLLED_UAT' || /^KKUAT_/.test(candidate.notificationId) ||
    /^CONTROLLED_UAT\|/.test(r['Audit Event ID']) || /OWNER_AUTHORIZED_TRANSPORT_UAT/.test(r.Notes) || (first && /CLAIM\|/.test(r.Notes)) || (retry && !/CLAIM\|/.test(r.Notes))) return false;
  if (first && ['Last Attempt At','Delivery Evidence','Next Retry At','HTTP Status','Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error','Feedback Source'].some(function(k) { return hasLedgerValue_(r[k]); })) return false;
  if (rows.filter(function(x) { return x['Notification ID']===candidate.notificationId; }).length!==1 || rows.filter(function(x) { return x.Transport===candidate.transport && x['Dedup Key']===candidate.dedupKey; }).length!==1) return false;
  return true;
}
/** All witnesses stay in rows. Invalid rows produce hash-only debt, never claims. */
function canonicalRowReason_(r,rows,c) {
  if (ledgerHeaders_().some(function(k) { return k!=='Attempt Count' && typeof r[k]!=='string'; })) return 'CANONICAL_SOURCE_TYPE_INVALID';
  var id=r['Notification ID'];
  if (/[\u0000-\u001f\u007f-\u009f]/.test(id) || Utilities.newBlob(id).getBytes().length<6 || Utilities.newBlob(id).getBytes().length>93) return 'CANONICAL_ID_INVALID';
  for(var u=0;u<id.length;u+=1) { var code=id.charCodeAt(u);if(code>=0xd800 && code<=0xdbff) { var next=id.charCodeAt(++u);if(!(next>=0xdc00 && next<=0xdfff)) return 'CANONICAL_ID_INVALID'; } else if(code>=0xdc00 && code<=0xdfff) return 'CANONICAL_ID_INVALID'; }
  if (rows.filter(function(x) { return x['Notification ID']===id; }).length!==1) return 'CANONICAL_ID_AMBIGUOUS';
  if (rows.filter(function(x) { return x.Transport===r.Transport && x['Dedup Key']===r['Dedup Key']; }).length!==1) return 'CANONICAL_DEDUP_AMBIGUOUS';
  var first=r.Status==='QUEUED' && [0,'0'].indexOf(r['Attempt Count'])>=0 && ['Last Attempt At','Delivery Evidence','Next Retry At','HTTP Status','Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error','Feedback Source'].every(function(k) { return r[k]===''; });
  var retry=r.Status==='RETRY_WAIT' && /^[1-3]$/.test(String(r['Attempt Count'])) && Number(r['Attempt Count'])<maximumAttempts_(PropertiesService.getScriptProperties().getProperties()) &&
    !!parseDate_(r['Next Retry At']) && parseDate_(r['Next Retry At']).getTime()<=Date.now() && r['HTTP Status']==='429' && r['Last Error']==='TELEGRAM_API_REJECTED_HTTP_429' &&
    ['Delivery Evidence','Provider Message ID','API Accepted At','Delivery Confirmed At','Feedback Source'].every(function(k) { return r[k]===''; }) && !!parseDate_(r['Last Attempt At']);
  if (!first && !retry) return 'CANONICAL_SOURCE_ALREADY_ATTEMPTED';
  if (['Event Family ID','Change Type','Priority','Quiet Hours Policy','Audit Event ID','Dedup Key'].some(function(k) { return !r[k]; }) || /^KKUAT_/.test(id) || /^CONTROLLED_UAT\|/.test(r['Audit Event ID']) || /OWNER_AUTHORIZED_TRANSPORT_UAT/.test(r.Notes) || (first && /CLAIM\|/.test(r.Notes)) || (retry && !/CLAIM\|/.test(r.Notes))) return 'CANONICAL_NORMAL_SOURCE_REQUIRED';
  var created=Date.parse(r['Created At']),observed=Date.parse(c.observed_at),cutoff=Date.parse(c.activated_at);
  if (!isFinite(created) || created<cutoff || created>observed || created>Date.now()) return 'CANONICAL_SOURCE_CUTOVER_INVALID';
  if (!r.Payload || r.Payload!==r.Payload.trim() || r.Payload.length>2048) return 'CANONICAL_SOURCE_HELD';
  return '';
}
function canonicalHeldIdentityHash_(value) {
  if (typeof value==='string') return ownerLedgerHash_(JSON.stringify(value));
  var type=value===null || (typeof value==='number' && !isFinite(value))?'null':Array.isArray(value)?'array':typeof value;
  if (['number','boolean','null','array','object'].indexOf(type)<0) throw new Error('CANONICAL_HELD_METADATA_INVALID');
  return ownerLedgerHash_('KK_OWNER_CANONICAL_HELD_NONSTRING_V2\n'+type);
}
function canonicalAssessment_(context,rows,c,p) {
  var candidates=[],held=[];
  rows.forEach(function(r,index) {
    if (r.Transport!=='TELEGRAM_OWNER_ALERTS' || ['QUEUED','RETRY_WAIT'].indexOf(r.Status)<0 || r['Change Type']==='TRANSPORT_UAT' || r.Priority==='TEST' || r['Quiet Hours Policy']==='OWNER_CONTROLLED_UAT') return;
    var reason=canonicalRowReason_(r,rows,c),candidate;
    if (!reason) {
      try {
        // Core selection is isolated per source; complete snapshot/dedup checks above
        // and readExactLedgerCandidate_ still see every original ledger witness.
        var matches=collectCandidates_([context.values[0],context.values[index+1]],context.headers,p,false,{enforceQuietHours:true});
        if (matches.length!==1 || !canonicalEligible_(matches[0],rows,c,p)) reason=isQuietHours_(new Date()) && !canBypassQuietHours_(r.Priority,r['Change Type'])?'QUIET_HOURS_HOLD':'CANONICAL_CORE_SELECTION_HELD';
        else {
          candidate=matches[0];var text=messageForLedgerCandidate_(candidate);
          if (typeof text!=='string' || !text.trim() || text.length>2048) reason='CANONICAL_RENDER_INVALID';
        }
      } catch (error) {
        var known=['SOURCE_URL_REQUIRED','OWNER_ACTION_REQUIRED','NOTIFICATION_TOO_LONG','MACHINE_GARBAGE_PAYLOAD_BLOCKED'];
        reason=known.indexOf(String(error && error.message))>=0?error.message:'CANONICAL_RENDER_INVALID';
      }
    }
    if (reason) held.push({row_index:index+1,notification_id_sha256:canonicalHeldIdentityHash_(r['Notification ID']),reason_code:reason});
    else candidates.push(candidate);
  });
  return {candidates:candidates,held:held};
}
function runCanonicalOwnerLedgerPoll(a) {
  var p=canonicalConfig_(),c=canonicalVerify_(a,'poll',p,false),round=ownerRealAcceptanceConfig_();canonicalExact_(a.data,round?['acceptance_round']:[]);
  if (round) realAcceptanceVerifyRequest_(round,c,a.data.acceptance_round);
  if (p.CORE_V1_TRANSPORT_ENABLED!=='TRUE') throw new Error('CANONICAL_GLOBAL_TRANSPORT_DISABLED');
  var lock=LockService.getScriptLock();if (!lock.tryLock(5000)) throw new Error('CANONICAL_LOCK_BUSY');
  try {
    var context=openLedger_(),rows=canonicalRows_(context),assessment=canonicalAssessment_(context,rows,c,p);
    round=ownerRealAcceptanceConfig_();
    if (round) {
      realAcceptanceVerifyRequest_(round,c,a.data.acceptance_round);realAcceptanceSelect_(rows,round);
      assessment.candidates=assessment.candidates.filter(function(candidate) {
        var allowed=candidate.notificationId===round.state.targets.TELEGRAM_OWNER_ALERTS.notification_id && !round.state.consumed.TELEGRAM_OWNER_ALERTS;
        if (!allowed) assessment.held.push({row_index:rows.indexOf(rows.filter(function(r) { return r['Notification ID']===candidate.notificationId; })[0])+1,notification_id_sha256:canonicalHeldIdentityHash_(candidate.notificationId),reason_code:'CANONICAL_CORE_SELECTION_HELD'});
        return allowed;
      });
    }
    var data={rows:rows,candidates:assessment.candidates.map(function(candidate) { return candidate.notificationId; }),held:assessment.held};
    if (round) data.acceptance_round=realAcceptanceAttestation_(round);
    return canonicalSign_('poll-result',c,data,p);
  } finally { lock.releaseLock(); }
}
function runCanonicalOwnerLedgerClaim(a) {
  var p=canonicalConfig_(),c=canonicalVerify_(a,'claim',p,false),round=ownerRealAcceptanceConfig_();canonicalExact_(a.data,round?['ticket','notification_id','rows','acceptance_round']:['ticket','notification_id','rows']);
  if (round) realAcceptanceVerifyRequest_(round,c,a.data.acceptance_round);
  if (p.CORE_V1_TRANSPORT_ENABLED!=='TRUE') throw new Error('CANONICAL_GLOBAL_TRANSPORT_DISABLED');
  if (typeof a.data.ticket!=='string' || !/^[0-9a-f-]{36}$/.test(a.data.ticket) || !Array.isArray(a.data.rows) || a.data.rows.length>128 || Utilities.newBlob(JSON.stringify(a.data.rows)).getBytes().length>262144) throw new Error('CANONICAL_CLAIM_REQUEST_INVALID');
  var lock=LockService.getScriptLock();if (!lock.tryLock(5000)) throw new Error('CANONICAL_LOCK_BUSY');
  try {
    var context=openLedger_(),rows=canonicalRows_(context),matches=canonicalAssessment_(context,rows,c,p).candidates.filter(function(candidate) { return candidate.notificationId===a.data.notification_id; });
    if (matches.length!==1) throw new Error('CANONICAL_SOURCE_NOT_ELIGIBLE');var candidate=matches[0];
    var before=a.data.rows.filter(function(r) { return r['Notification ID']===candidate.notificationId; });
    if (before.length!==1 || JSON.stringify(ledgerRecordSnapshot_(before[0]))!==JSON.stringify(ledgerRecordSnapshot_(candidate.sourceRow))) throw new Error('CANONICAL_SOURCE_CAS_MISMATCH');
    var text=messageForLedgerCandidate_(candidate);if (typeof text!=='string' || !text.trim() || text.length>2048) throw new Error('CANONICAL_RENDER_INVALID');
    var claim=claimLedgerCandidate_(context.sheet,context.headers,candidate,p,round?{context:c,attestation:a.data.acceptance_round}:undefined);
    var claimed={};ledgerHeaders_().forEach(function(k) { claimed[k]=ledgerComparable_(claim.claimed_row[k]); });
    var data={ticket:a.data.ticket,notification_id:candidate.notificationId,claim_id:claim.claim_id,claimed_row:claimed,text:text};
    if (round) data.acceptance_round=realAcceptanceAttestation_(round);
    return canonicalSign_('claim-result',c,data,p);
  } finally { lock.releaseLock(); }
}
/** Durable ACK is already committed. Repair or read back only; never send or renew. */
function finalizeCanonicalOwnerLedgerAck(a) {
  var p=canonicalConfig_(),c=canonicalVerify_(a,'project',p,true);canonicalExact_(a.data,['record']);var r=a.data.record;
  if (!r || r.status!=='SENT' || !r.descriptor || !r.source_row || !r.claimed_row || typeof r.binding_text!=='string') throw new Error('CANONICAL_DURABLE_SENT_REQUIRED');
  var b=safeJson_(r.binding_text),d=r.descriptor,ids=ownerLedgerIdentities_(r.source_notification_id);
  if (!Array.isArray(b) || b.length!==15 || b[0]!=='kk-owner-ledger-binding-v2' || b[1]!==CORE_V1.spreadsheetId || b[2]!==CORE_V1.ledgerSheet || b[3]!=='TELEGRAM_OWNER_ALERTS' || b[4]!==r.source_notification_id ||
    JSON.stringify(safeJson_(b[13]))!==JSON.stringify(c) || d.content_version!==ownerLedgerHash_(r.binding_text) || r.notification_id!==ids.notification_id || d.notification_id!==ids.notification_id || d.request_id!==ids.request_id || d.entity_id!==ids.entity_id ||
    r.source_row['Notification ID']!==r.source_notification_id || r.source_row.Transport!=='TELEGRAM_OWNER_ALERTS' || !/^CLAIM\|[0-9a-f-]{36}$/.test(b[14]) ||
    typeof r.receipt_id!=='string' || !/^[0-9a-f-]{36}$/.test(r.receipt_id) || typeof r.provider_message_id!=='string' || !/^[1-9][0-9]{0,19}$/.test(r.provider_message_id)) throw new Error('CANONICAL_DURABLE_BINDING_INVALID');
  var source=r.source_row,immutable=[source['Created At'],source.Payload,source['Dedup Key'],source['Event Family ID'],source['Show ID'],source['Change Type'],source.Priority,source['Quiet Hours Policy']];
  for(var n=0;n<immutable.length;n+=1) if (b[n+5]!==immutable[n]) throw new Error('CANONICAL_DURABLE_SOURCE_CHANGED');
  var before=r.before_row || source;
  if (!Number.isInteger(r.attempt_count) || r.attempt_count<1 || r.attempt_count>maximumAttempts_(p) || Number(before['Attempt Count'])!==r.attempt_count-1 || Number(r.claimed_row['Attempt Count'])!==r.attempt_count || before['Created At']!==source['Created At'] || before.Payload!==source.Payload || before['Dedup Key']!==source['Dedup Key']) throw new Error('CANONICAL_ATTEMPT_BINDING_INVALID');
  var claim={notification_id:r.source_notification_id,transport:'TELEGRAM_OWNER_ALERTS',claim_id:b[14],attempt_count:r.attempt_count,attempted_at:r.claimed_row['Last Attempt At'],before_row:before,claimed_row:r.claimed_row};
  var candidate={notificationId:r.source_notification_id,transport:'TELEGRAM_OWNER_ALERTS',payload:source.Payload,dedupKey:source['Dedup Key'],status:before.Status,attemptCount:Number(before['Attempt Count']),notes:before.Notes,sourceRow:before,
    sourceSnapshot:['Notification ID','Created At','Event Family ID','Show ID','Change Type','Priority','Quiet Hours Policy','Payload','Audit Event ID','Transport','Dedup Key'].map(function(k) { return source[k]; }),controlledUat:false,enforceQuietHours:true};
  if (d.text!==messageForLedgerCandidate_(candidate) || d.version!=='kk-make-owner-transport-v1' || d.audience!=='KK_OWNER_TELEGRAM_ONLY' || d.event_type!=='OWNER_ALERT') throw new Error('CANONICAL_DURABLE_RENDER_CHANGED');
  var accepted=parseDate_(r.delivered_at),reserved=parseDate_(r.reserved_at),expires=parseDate_(d.expires_at),created=parseDate_(d.created_at),attempted=parseDate_(claim.attempted_at);
  if (!accepted || !reserved || !expires || !created || !attempted || accepted<reserved || accepted<attempted || accepted>=expires || accepted.getTime()>Date.now() || expires<=created || expires-created>120000) throw new Error('CANONICAL_DURABLE_CLOCK_INVALID');
  var result={httpStatus:200,providerMessageId:r.provider_message_id,apiAcceptedAt:accepted.toISOString(),evidence:{transport:'TELEGRAM',api_ok:true,durable_ack:true,consumer_id:'6176241',message_id:r.provider_message_id,receipt_id:r.receipt_id,
    source_notification_id:r.source_notification_id,notification_id:ids.notification_id,content_version:d.content_version,receipt_kind:'NATIVE_DURABLE_PROVIDER_ACK',delivery_confirmed:false}};
  var lock=LockService.getScriptLock();if (!lock.tryLock(5000)) throw new Error('CANONICAL_LOCK_BUSY');
  try {
    var context=openLedger_(),projected=ownerLedgerReadProjectedAck_(context.sheet,candidate,claim,result);
    if (!projected) projected=projectLedgerAcknowledgement_(context.sheet,context.headers,candidate,claim,result);
    return canonicalSign_('project-result',c,{notification_id:r.source_notification_id,status:projected.status},p);
  } finally { lock.releaseLock(); }
}
/** Projection-only refusal path. It cannot reserve, send, or renew a descriptor. */
function finalizeCanonicalOwnerLedgerRejection(a) {
  var p=canonicalConfig_(),c=canonicalVerify_(a,'project-rejection',p,true);canonicalExact_(a.data,['record']);var r=a.data.record;
  if (!r || ['REJECTION_PENDING','RETRY_WAIT','FAILED'].indexOf(r.status)<0 || !r.source_row || !r.before_row || !r.claimed_row || !r.descriptor ||
    typeof r.binding_text!=='string' || !r.rejection_evidence || typeof r.ticket!=='string' || !/^[0-9a-f-]{36}$/.test(r.ticket) ||
    typeof r.receipt_id!=='string' || !/^[0-9a-f-]{36}$/.test(r.receipt_id) || !Number.isInteger(r.attempt_count) || r.attempt_count<1 || r.attempt_count>maximumAttempts_(p)) throw new Error('CANONICAL_DURABLE_REJECTION_REQUIRED');
  var b=safeJson_(r.binding_text),original=r.source_row,before=r.before_row,claimed=r.claimed_row,e=r.rejection_evidence,ids=ownerLedgerIdentities_(r.source_notification_id);
  if (!Array.isArray(b) || b.length!==15 || b[0]!=='kk-owner-ledger-binding-v2' || b[1]!==CORE_V1.spreadsheetId || b[2]!==CORE_V1.ledgerSheet || b[3]!=='TELEGRAM_OWNER_ALERTS' || b[4]!==r.source_notification_id ||
    JSON.stringify(safeJson_(b[13]))!==JSON.stringify(c) || b[14]!==claimed.Notes.split(' | ').slice(-1)[0] || !/^CLAIM\|[0-9a-f-]{36}$/.test(b[14]) ||
    r.notification_id!==ids.notification_id || r.descriptor.notification_id!==ids.notification_id || r.descriptor.request_id!==ids.request_id || r.descriptor.entity_id!==ids.entity_id ||
    r.descriptor.content_version!==ownerLedgerHash_(r.binding_text) || r.provider_message_id || !parseDate_(r.reserved_at) ||
    original['Notification ID']!==r.source_notification_id || before['Notification ID']!==r.source_notification_id || original['Created At']!==before['Created At'] || original.Payload!==before.Payload || original['Dedup Key']!==before['Dedup Key'] ||
    Number(before['Attempt Count'])!==r.attempt_count-1 || Number(claimed['Attempt Count'])!==r.attempt_count || claimed.Status!=='SENDING' || before.Status!==(r.attempt_count===1?'QUEUED':'RETRY_WAIT')) throw new Error('CANONICAL_DURABLE_REJECTION_BINDING_INVALID');
  var immutable=[original['Created At'],original.Payload,original['Dedup Key'],original['Event Family ID'],original['Show ID'],original['Change Type'],original.Priority,original['Quiet Hours Policy']];
  for(var n=0;n<immutable.length;n+=1) if(b[n+5]!==immutable[n]) throw new Error('CANONICAL_DURABLE_SOURCE_CHANGED');
  var provider=r.provider_binding,dispatch=r.provider_dispatch;
  if(provider && (provider.kind!=='make-custom-telegram-response-v1' || typeof provider.bot_id!=='string' || !/^[1-9][0-9]{3,19}$/.test(provider.bot_id) || !Number.isInteger(provider.module_id) || provider.module_id<1 || provider.module_id===8 || !Number.isInteger(provider.connection_id) || provider.connection_id<1 || provider.connection_id===10356915 || !dispatch || dispatch.attempt_id!==r.ticket || dispatch.receipt_id!==r.receipt_id || !/^[0-9a-f-]{36}$/.test(dispatch.dispatch_id) || JSON.stringify(dispatch.provider_binding)!==JSON.stringify(provider) || e.profile_sha256!==provider.manifest_sha256)) throw new Error('CANONICAL_ADAPTER_BINDING_MISMATCH');
  var status=e.http_status;if(typeof status!=='number' || Math.floor(status)!==status || status<400 || status>=500 || [408,409,425].indexOf(status)>=0 || !e.telegram_response || e.telegram_response.ok!==false || e.telegram_response.error_code!==status ||
    e.scenario_id!=='6176241' || e.module_id!==(provider?provider.module_id:8) || e.connection_id!==(provider?provider.connection_id:10356915) || e.attempt_id!==r.ticket || e.receipt_id!==r.receipt_id || !/^[a-f0-9]{64}$/.test(e.profile_sha256||'') || !/^[a-f0-9]{64}$/.test(e.descriptor_sha256||'')) throw new Error('CANONICAL_REJECTION_EVIDENCE_INVALID');
  var retry=status===429 && r.attempt_count<maximumAttempts_(p) && !!r.next_retry_at;
  if ((status!==429 || r.attempt_count>=maximumAttempts_(p)) && r.next_retry_at) throw new Error('CANONICAL_RETRY_BOUND_INVALID');
  var next=retry?parseDate_(r.next_retry_at):null;
  if (retry && (!next || next.getTime()<parseDate_(r.reserved_at).getTime()+retryMinutes_(r.attempt_count)*60000)) throw new Error('CANONICAL_RETRY_CLOCK_INVALID');
  var fields={'Next Retry At':retry?next.toISOString():'','HTTP Status':String(status),'Last Error':'TELEGRAM_API_REJECTED_HTTP_'+status,
    Notes:appendLedgerNote_(claimed.Notes,retry?'REJECTED_RETRY_SAFE':'REJECTED_TERMINAL'),Status:retry?'RETRY_WAIT':'FAILED'};
  var candidate={notificationId:r.source_notification_id,transport:'TELEGRAM_OWNER_ALERTS',dedupKey:before['Dedup Key'],status:before.Status,attemptCount:Number(before['Attempt Count']),notes:before.Notes,sourceRow:before,
    sourceSnapshot:['Notification ID','Created At','Event Family ID','Show ID','Change Type','Priority','Quiet Hours Policy','Payload','Audit Event ID','Transport','Dedup Key'].map(function(k){return original[k];}),controlledUat:false,enforceQuietHours:true};
  var claim={notification_id:r.source_notification_id,transport:'TELEGRAM_OWNER_ALERTS',claim_id:b[14],attempt_count:r.attempt_count,attempted_at:claimed['Last Attempt At'],before_row:before,claimed_row:claimed};
  var expected=ledgerPatchedRecord_(claimed,fields),lock=LockService.getScriptLock();if(!lock.tryLock(5000))throw new Error('CANONICAL_LOCK_BUSY');
  try{
    var context=openLedger_(),values=context.sheet.getDataRange().getValues(),headers=readHeaders_(values[0]),matches=values.slice(1).filter(function(row){return row[headers['Notification ID']]===r.source_notification_id && row[headers.Transport]==='TELEGRAM_OWNER_ALERTS';});
    if(matches.length!==1)throw new Error('CANONICAL_REJECTION_SHEET_AMBIGUOUS');
    var current=ledgerNamedRow_(matches[0],headers),projected;
    if(current.Status===fields.Status){if(JSON.stringify(ledgerRecordSnapshot_(current))!==JSON.stringify(ledgerRecordSnapshot_(expected)))throw new Error('CANONICAL_REJECTION_PROJECTED_MISMATCH');projected=current;}
    else projected=projectLedgerFields_(context.sheet,candidate,claim,fields);
    return canonicalSign_('project-rejection-result',c,{notification_id:r.source_notification_id,projected_row:projected},p);
  }finally{lock.releaseLock();}
}
