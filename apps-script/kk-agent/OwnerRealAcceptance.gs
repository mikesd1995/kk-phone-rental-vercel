/** One durable finite round, under the existing ledger ScriptLock. No reset API. */
var REAL_ACCEPTANCE_CHANNELS_=['TELEGRAM_OWNER_ALERTS','LINE_OWNER_ALERTS'];
var REAL_ACCEPTANCE_IMMUTABLE_=['Notification ID','Created At','Event Family ID','Show ID','Change Type','Priority','Quiet Hours Policy','Payload','Audit Event ID','Transport','Dedup Key'];
function realAcceptanceExact_(value,keys) {
  if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).length!==keys.length || Object.keys(value).some(function(k) { return keys.indexOf(k)<0; })) throw new Error('REAL_ACCEPTANCE_FIELDS_INVALID');
}
function realAcceptanceManifest_(m) {
  realAcceptanceExact_(m,['version','round_id','source_sha','environment','cutover_id','activated_at','not_before','slot_id','due_at','expires_at','attempt_budget','provider_binding_sha256']);
  var uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (m.version!=='kk-owner-real-acceptance-round-v1' || !uuid.test(m.round_id) || !uuid.test(m.cutover_id) ||
    typeof m.source_sha!=='string' || !/^[0-9a-f]{40}$/.test(m.source_sha) || m.environment!=='production' || m.slot_id!=='1' ||
    typeof m.provider_binding_sha256!=='string' || !/^[0-9a-f]{64}$/.test(m.provider_binding_sha256)) throw new Error('REAL_ACCEPTANCE_MANIFEST_INVALID');
  ['activated_at','not_before','due_at','expires_at'].forEach(function(k) {
    if (typeof m[k]!=='string' || !isFinite(Date.parse(m[k])) || new Date(m[k]).toISOString()!==m[k]) throw new Error('REAL_ACCEPTANCE_CLOCK_INVALID');
  });
  realAcceptanceExact_(m.attempt_budget,REAL_ACCEPTANCE_CHANNELS_);
  if (m.attempt_budget.TELEGRAM_OWNER_ALERTS!==1 || m.attempt_budget.LINE_OWNER_ALERTS!==1 || m.not_before!==m.activated_at ||
    Date.parse(m.due_at)!==Date.parse(m.activated_at)+900000 || Date.parse(m.expires_at)!==Date.parse(m.due_at)+120000) throw new Error('REAL_ACCEPTANCE_MANIFEST_INVALID');
  return m;
}
function realAcceptanceHash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(function(b) { return ('0'+((b+256)%256).toString(16)).slice(-2); }).join('');
}
function realAcceptanceDigest_(m) {
  realAcceptanceManifest_(m);
  return realAcceptanceHash_(JSON.stringify(['KK_OWNER_REAL_ACCEPTANCE_MANIFEST_V1',m.version,m.round_id,m.source_sha,m.environment,m.cutover_id,m.activated_at,m.not_before,m.slot_id,m.due_at,m.expires_at,m.attempt_budget.TELEGRAM_OWNER_ALERTS,m.attempt_budget.LINE_OWNER_ALERTS,m.provider_binding_sha256]));
}
function realAcceptanceSourceHash_(record) {
  return realAcceptanceHash_(JSON.stringify(REAL_ACCEPTANCE_IMMUTABLE_.map(function(k) { return ledgerComparable_(record[k]); })));
}
function realAcceptanceClaimId_(digest,channel,sourceHash) {
  if (!/^[a-f0-9]{64}$/.test(digest) || REAL_ACCEPTANCE_CHANNELS_.indexOf(channel)<0 || !/^[a-f0-9]{64}$/.test(sourceHash)) throw new Error('REAL_ACCEPTANCE_CLAIM_BINDING_INVALID');
  var bytes=realAcceptanceHash_(JSON.stringify(['KK_OWNER_REAL_ACCEPTANCE_CLAIM_V1',digest,channel,sourceHash])).slice(0,32).split('');
  bytes[12]='5';bytes[16]=((parseInt(bytes[16],16)&3)|8).toString(16);var h=bytes.join('');
  return 'CLAIM|'+h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
function realAcceptanceState_(raw,round) {
  var s;try { s=JSON.parse(raw); } catch(error) { throw new Error('REAL_ACCEPTANCE_STATE_INVALID'); }
  realAcceptanceExact_(s,['version','round_id','manifest_sha256','status','targets','consumed','line_started']);
  if (s.version!=='kk-owner-real-acceptance-state-v1' || s.round_id!==round.manifest.round_id || s.manifest_sha256!==round.digest || ['OPEN','CLOSED'].indexOf(s.status)<0 || typeof s.line_started!=='boolean') throw new Error('REAL_ACCEPTANCE_STATE_INVALID');
  realAcceptanceExact_(s.targets,REAL_ACCEPTANCE_CHANNELS_);realAcceptanceExact_(s.consumed,REAL_ACCEPTANCE_CHANNELS_);
  REAL_ACCEPTANCE_CHANNELS_.forEach(function(ch) { var t=s.targets[ch];realAcceptanceExact_(t,['notification_id','immutable_sha256']);
    if (typeof t.notification_id!=='string' || !t.notification_id || !/^[a-f0-9]{64}$/.test(t.immutable_sha256) || typeof s.consumed[ch]!=='boolean') throw new Error('REAL_ACCEPTANCE_STATE_INVALID');
  });
  if (s.targets.TELEGRAM_OWNER_ALERTS.notification_id===s.targets.LINE_OWNER_ALERTS.notification_id || (s.line_started && !s.consumed.LINE_OWNER_ALERTS)) throw new Error('REAL_ACCEPTANCE_STATE_INVALID');
  return s;
}
function realAcceptanceConfig_(properties,now) {
  var p=properties || PropertiesService.getScriptProperties().getProperties();
  var configured=['KK_OWNER_REAL_ACCEPTANCE_MANIFEST_JSON','KK_OWNER_REAL_ACCEPTANCE_STATE_JSON','KK_OWNER_REAL_ACCEPTANCE_SOURCE_SHA'].some(function(k) { return Object.prototype.hasOwnProperty.call(p,k); }) ||
    (Object.prototype.hasOwnProperty.call(p,'KK_OWNER_REAL_ACCEPTANCE_ENABLED') && p.KK_OWNER_REAL_ACCEPTANCE_ENABLED!=='FALSE');
  if (!configured) return null;
  if (p.KK_OWNER_REAL_ACCEPTANCE_ENABLED!=='TRUE') throw new Error('REAL_ACCEPTANCE_DISABLED_STICKY');
  var m;try { m=JSON.parse(p.KK_OWNER_REAL_ACCEPTANCE_MANIFEST_JSON); } catch(error) { throw new Error('REAL_ACCEPTANCE_MANIFEST_INVALID'); }
  realAcceptanceManifest_(m);
  if (p.KK_OWNER_REAL_ACCEPTANCE_SOURCE_SHA!==m.source_sha || p.KK_OWNER_CANONICAL_ENABLED!=='TRUE' || p.KK_OWNER_CANONICAL_CUTOVER_ID!==m.cutover_id ||
    p.KK_OWNER_CANONICAL_ACTIVATED_AT!==m.activated_at || p.KK_OWNER_CANONICAL_ENVIRONMENT!==m.environment || p.CORE_V1_TRANSPORT_ENABLED!=='TRUE') throw new Error('REAL_ACCEPTANCE_PIN_MISMATCH');
  var round={manifest:m,digest:realAcceptanceDigest_(m),state:null};
  if (Object.prototype.hasOwnProperty.call(p,'KK_OWNER_REAL_ACCEPTANCE_STATE_JSON')) round.state=realAcceptanceState_(p.KK_OWNER_REAL_ACCEPTANCE_STATE_JSON,round);
  if (round.state && round.state.status!=='OPEN') throw new Error('REAL_ACCEPTANCE_CLOSED');
  now=now===undefined?Date.now():now;
  if (!isFinite(now) || now<Date.parse(m.due_at) || now>=Date.parse(m.expires_at)) throw new Error('REAL_ACCEPTANCE_DEADLINE');
  return round;
}
function realAcceptanceAttestation_(round) { return {round_id:round.manifest.round_id,manifest_sha256:round.digest,deadline:round.manifest.expires_at}; }
function realAcceptanceVerifyRequest_(round,c,a) {
  if (!round) return;
  realAcceptanceExact_(a,['round_id','manifest_sha256','deadline']);var expected=realAcceptanceAttestation_(round);
  if (Object.keys(expected).some(function(k) { return a[k]!==expected[k]; }) || !c || c.cutover_id!==round.manifest.cutover_id || c.activated_at!==round.manifest.activated_at || c.environment!==round.manifest.environment || c.slot_id!=='1' || c.due_at!==round.manifest.due_at) throw new Error('REAL_ACCEPTANCE_ATTESTATION_INVALID');
}
function realAcceptancePersist_(state) {
  assertLedgerLock_();var store=PropertiesService.getScriptProperties(),raw=JSON.stringify(state);
  store.setProperty('KK_OWNER_REAL_ACCEPTANCE_STATE_JSON',raw);
  if (store.getProperty('KK_OWNER_REAL_ACCEPTANCE_STATE_JSON')!==raw) throw new Error('REAL_ACCEPTANCE_STATE_READBACK_UNCERTAIN');
}
/** Same source-clock syntax/calendar rules as the gateway's sourceStamp. */
function realAcceptanceSourceStamp_(value) {
  var text=ledgerComparable_(value);
  if (typeof text!=='string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?(?:Z|[+-]\d\d:\d\d)$/.test(text) || !isFinite(Date.parse(text))) return NaN;
  var local=text.slice(0,19)+'Z';
  if (new Date(local).toISOString().slice(0,19)!==text.slice(0,19)) return NaN;
  return Date.parse(text);
}
function realAcceptanceNormalizedSource_(record) {
  var r={};ledgerHeaders_().forEach(function(k) { r[k]=ledgerComparable_(record[k]); });return r;
}
function realAcceptanceGenuine_(record,rows,round) {
  var r=realAcceptanceNormalizedSource_(record),created=realAcceptanceSourceStamp_(r['Created At']);
  // Reuse complete static canonical checks (cell types, UTF-8 identity bounds,
  // Unicode/control validity, exact empty evidence, raw payload and scoped uniqueness).
  // Add gateway-only restrictions before either channel can freeze the pair.
  if (canonicalRowReason_(r,rows,{activated_at:round.manifest.activated_at,observed_at:new Date().toISOString()}) ||
    REAL_ACCEPTANCE_CHANNELS_.indexOf(r.Transport)<0 || r.Status!=='QUEUED' || [0,'0'].indexOf(r['Attempt Count'])<0 ||
    !isFinite(created) || created<Date.parse(round.manifest.not_before) || created>Date.now() ||
    r['Change Type']==='TRANSPORT_UAT' || r.Priority==='TEST' || r['Quiet Hours Policy']==='OWNER_CONTROLLED_UAT' ||
    /^CONTROLLED_UAT\|/.test(r['Notification ID'])) return false;
  return true;
}
function realAcceptanceSnapshot_(rows) {
  if (!Array.isArray(rows) || rows.length>128 || Utilities.newBlob(JSON.stringify(rows)).getBytes().length>262144) throw new Error('REAL_ACCEPTANCE_SNAPSHOT_BOUNDS');
}
/** Initial pair eligibility reuses each established consumer's truth/quiet/render gates. */
function realAcceptanceInitialEligible_(rows,round) {
  // Poll already normalizes Sheet Dates; timer/direct claim must see the same cells.
  rows=rows.map(realAcceptanceNormalizedSource_);
  var names=ledgerHeaders_(),headers=readHeaders_(names),p=PropertiesService.getScriptProperties().getProperties();
  var values=[names].concat(rows.map(function(r) { return names.map(function(k) { return r[k]; }); }));
  var c={activated_at:round.manifest.activated_at,observed_at:new Date().toISOString()};
  var telegram=canonicalAssessment_({values:values,headers:headers},rows,c,p).candidates;
  return rows.filter(function(r,index) {
    if (!realAcceptanceGenuine_(r,rows,round)) return false;
    if (r.Transport==='TELEGRAM_OWNER_ALERTS') return telegram.some(function(candidate) { return candidate.notificationId===r['Notification ID']; });
    try {
      var line=collectCandidates_([names,values[index+1]],headers,p,true);
      if (line.length!==1 || line[0].controlledUat || line[0].alreadySent || line[0].requiresReconciliation || line[0].duplicateInBatch) return false;
      var text=messageForLedgerCandidate_(line[0]);
      return typeof text==='string' && !!text.trim();
    } catch(error) { return false; }
  });
}
function realAcceptanceSelect_(rows,round) {
  assertLedgerLock_();realAcceptanceSnapshot_(rows);
  if (!round.state) {
    var eligible=realAcceptanceInitialEligible_(rows,round),pairs=[];
    eligible.filter(function(r) { return r.Transport==='TELEGRAM_OWNER_ALERTS'; }).forEach(function(tg) {
      eligible.filter(function(r) { return r.Transport==='LINE_OWNER_ALERTS'; }).forEach(function(line) {
        if (tg['Notification ID']!==line['Notification ID'] && tg['Dedup Key']!==line['Dedup Key'] && ['Event Family ID','Show ID','Change Type','Audit Event ID','Payload'].every(function(k) { return tg[k]===line[k]; })) pairs.push([tg,line]);
      });
    });
    if (pairs.length!==1) throw new Error('REAL_ACCEPTANCE_GENUINE_PAIR_REQUIRED');
    var s={version:'kk-owner-real-acceptance-state-v1',round_id:round.manifest.round_id,manifest_sha256:round.digest,status:'OPEN',targets:{},consumed:{TELEGRAM_OWNER_ALERTS:false,LINE_OWNER_ALERTS:false},line_started:false};
    pairs[0].forEach(function(r) { s.targets[r.Transport]={notification_id:r['Notification ID'],immutable_sha256:realAcceptanceSourceHash_(r)}; });
    realAcceptancePersist_(s);round.state=s;
  }
  REAL_ACCEPTANCE_CHANNELS_.forEach(function(ch) {
    var t=round.state.targets[ch],matches=rows.filter(function(r) { return r.Transport===ch && r['Notification ID']===t.notification_id; });
    if (matches.length!==1 || realAcceptanceSourceHash_(matches[0])!==t.immutable_sha256 || rows.filter(function(r) { return r['Notification ID']===t.notification_id; }).length!==1 ||
      rows.filter(function(r) { return r.Transport===ch && r['Dedup Key']===matches[0]['Dedup Key']; }).length!==1) throw new Error('REAL_ACCEPTANCE_TARGET_CHANGED');
  });
  return round;
}
function realAcceptanceClaim_(candidate,rows,canonicalRequest) {
  assertLedgerLock_();var round=realAcceptanceConfig_();if (!round) return null;
  if (candidate.transport==='TELEGRAM_OWNER_ALERTS') {
    if (!canonicalRequest) throw new Error('REAL_ACCEPTANCE_CANONICAL_WRITER_REQUIRED');
    realAcceptanceVerifyRequest_(round,canonicalRequest.context,canonicalRequest.attestation);
  }
  realAcceptanceSelect_(rows,round);var ch=candidate.transport,t=round.state.targets[ch];
  if (!t || t.notification_id!==candidate.notificationId || t.immutable_sha256!==realAcceptanceSourceHash_(candidate.sourceRow) || candidate.controlledUat ||
    candidate.alreadySent || candidate.requiresReconciliation || candidate.duplicateInBatch || !realAcceptanceGenuine_(candidate.sourceRow,rows,round) || round.state.consumed[ch]) throw new Error('REAL_ACCEPTANCE_RIGHT_UNAVAILABLE');
  round.state.consumed[ch]=true;realAcceptancePersist_(round.state);
  // No Sheet claim is allowed until consumed state is durable and the deadline still holds.
  realAcceptanceConfig_();return realAcceptanceClaimId_(round.digest,ch,t.immutable_sha256);
}
function realAcceptanceBeforeLine_(candidate,claim) {
  var round=realAcceptanceConfig_();if (!round) return;
  assertLedgerLock_();var s=round.state,t=s && s.targets.LINE_OWNER_ALERTS;
  if (!candidate || !claim || candidate.transport!=='LINE_OWNER_ALERTS' || !t || !s.consumed.LINE_OWNER_ALERTS || s.line_started || t.notification_id!==candidate.notificationId ||
    t.immutable_sha256!==realAcceptanceSourceHash_(candidate.sourceRow) || claim.claim_id!==realAcceptanceClaimId_(round.digest,'LINE_OWNER_ALERTS',t.immutable_sha256)) throw new Error('REAL_ACCEPTANCE_LINE_GRANT_REQUIRED');
  s.line_started=true;realAcceptancePersist_(s);realAcceptanceConfig_();
}
/** Hash-only diagnostic; never returns payload, owner addresses or provider frames. */
function realAcceptanceReadback_() {
  var p=PropertiesService.getScriptProperties().getProperties(),m=realAcceptanceManifest_(JSON.parse(p.KK_OWNER_REAL_ACCEPTANCE_MANIFEST_JSON)),r={manifest:m,digest:realAcceptanceDigest_(m)},s=realAcceptanceState_(p.KK_OWNER_REAL_ACCEPTANCE_STATE_JSON,r);
  return {round_id:m.round_id,source_sha:m.source_sha,manifest_sha256:r.digest,not_before:m.not_before,due_at:m.due_at,expires_at:m.expires_at,status:s.status,targets:s.targets,consumed:s.consumed,line_started:s.line_started};
}
