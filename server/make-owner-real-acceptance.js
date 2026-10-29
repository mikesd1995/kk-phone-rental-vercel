'use strict';
// Pure mirrored fence only. GAS remains the sole durable round-right writer.
const crypto=require('node:crypto'),Wire=require('./make-owner-transport-contract'),Legacy=require('./make-owner-ledger-bridge'),Adapter=require('./make-owner-telegram-adapter');
const FIELDS=['version','round_id','source_sha','environment','cutover_id','activated_at','not_before','slot_id','due_at','expires_at','attempt_budget','provider_binding_sha256'];
const IMMUTABLE_FIELDS=['Notification ID','Created At','Event Family ID','Show ID','Change Type','Priority','Quiet Hours Policy','Payload','Audit Event ID','Transport','Dedup Key'];
const CONTEXT_FIELDS=['version','cutover_id','activated_at','policy_version','consumer_id','max_attempts','script_project_id','spreadsheet_id','tab','transport','environment','poll_id','slot_id','due_at','observed_at','nonce'];
function fail(code){throw Object.assign(new Error(code),{code});}
function exact(v,keys){if(!Wire.isPlainObject(v)||Reflect.ownKeys(v).length!==keys.length||Reflect.ownKeys(v).some(k=>typeof k!=='string'||!keys.includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value')))fail('REAL_ACCEPTANCE_FIELDS_INVALID');return v;}
function stamp(v){if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)fail('REAL_ACCEPTANCE_MANIFEST_INVALID');return Date.parse(v);}
function validateManifest(m){
 exact(m,FIELDS);exact(m.attempt_budget,['TELEGRAM_OWNER_ALERTS','LINE_OWNER_ALERTS']);
 if(FIELDS.filter(k=>k!=='attempt_budget').some(k=>typeof m[k]!=='string'))fail('REAL_ACCEPTANCE_MANIFEST_INVALID');
 if(m.version!=='kk-owner-real-acceptance-round-v1'||!Wire.isReceiptId(m.round_id)||!Wire.isReceiptId(m.cutover_id)||! /^[a-f0-9]{40}$/.test(m.source_sha||'')||m.environment!=='production'||m.slot_id!=='1'||! /^[a-f0-9]{64}$/.test(m.provider_binding_sha256||'')||m.attempt_budget.TELEGRAM_OWNER_ALERTS!==1||m.attempt_budget.LINE_OWNER_ALERTS!==1)fail('REAL_ACCEPTANCE_MANIFEST_INVALID');
 const epoch=stamp(m.activated_at);if(stamp(m.not_before)!==epoch||stamp(m.due_at)!==epoch+900000||stamp(m.expires_at)!==epoch+1020000)fail('REAL_ACCEPTANCE_MANIFEST_INVALID');return m;
}
function hash(v){return crypto.createHash('sha256').update(v,'utf8').digest('hex');}
function digest(m){validateManifest(m);return hash(JSON.stringify(['KK_OWNER_REAL_ACCEPTANCE_MANIFEST_V1',m.version,m.round_id,m.source_sha,m.environment,m.cutover_id,m.activated_at,m.not_before,m.slot_id,m.due_at,m.expires_at,m.attempt_budget.TELEGRAM_OWNER_ALERTS,m.attempt_budget.LINE_OWNER_ALERTS,m.provider_binding_sha256]));}
function config(env={}){
 const names=['KK_OWNER_REAL_ACCEPTANCE_ENABLED','KK_OWNER_REAL_ACCEPTANCE_MANIFEST_JSON','KK_OWNER_REAL_ACCEPTANCE_STATE_JSON','KK_OWNER_REAL_ACCEPTANCE_SOURCE_SHA'];
 let manifest=null;try{manifest=JSON.parse(env.KK_OWNER_REAL_ACCEPTANCE_MANIFEST_JSON||'null');}catch(_){}
 const configured=names.slice(1).some(k=>Object.hasOwn(env,k))||(Object.hasOwn(env,names[0])&&env[names[0]]!=='FALSE');
 return {configured,enabled:env.KK_OWNER_REAL_ACCEPTANCE_ENABLED==='TRUE',manifest,sourceSha:env.KK_OWNER_REAL_ACCEPTANCE_SOURCE_SHA,unexpectedState:Object.hasOwn(env,'KK_OWNER_REAL_ACCEPTANCE_STATE_JSON')};
}
function active(c,now=Date.now()){
 if(c===undefined||c===null||c.configured===false)return null;
 if(c.configured!==true||c.enabled!==true||c.unexpectedState===true)fail('REAL_ACCEPTANCE_DISABLED_OR_UNBOUND');
 const m=validateManifest(c.manifest);if(c.sourceSha!==m.source_sha)fail('REAL_ACCEPTANCE_SOURCE_PIN_MISMATCH');
 if(!Number.isFinite(now)||now<stamp(m.due_at)||now>=stamp(m.expires_at))fail('REAL_ACCEPTANCE_WINDOW_CLOSED');return m;
}
function attestation(m){return {round_id:m.round_id,manifest_sha256:digest(m),deadline:m.expires_at};}
function verifyAttestation(a,m){exact(a,['round_id','manifest_sha256','deadline']);const expected=attestation(m);if(Object.keys(expected).some(k=>a[k]!==expected[k]))fail('REAL_ACCEPTANCE_ATTESTATION_MISMATCH');return a;}
function controls(a,m){exact(a,['round_id','manifest_sha256']);if(a.round_id!==m.round_id||a.manifest_sha256!==digest(m))fail('REAL_ACCEPTANCE_ATTESTATION_MISMATCH');return a;}
function validateContext(m,c,provider,now=Date.now()){
 validateManifest(m);exact(c,CONTEXT_FIELDS);if(Object.values(c).some(v=>typeof v!=='string')||['cutover_id','activated_at','environment','slot_id','due_at'].some(k=>c[k]!==m[k])||c.version!=='kk-owner-canonical-context-v2'||c.policy_version!=='v4.9.44'||! /^[1-4]$/.test(c.max_attempts)||c.script_project_id!==Legacy.SCRIPT_PROJECT_ID||c.spreadsheet_id!==Legacy.SPREADSHEET_ID||c.tab!==Legacy.TAB||c.transport!==Legacy.TRANSPORT||c.consumer_id!=='6176241'||!['cutover_id','poll_id','nonce'].every(k=>Wire.isReceiptId(c[k])))fail('REAL_ACCEPTANCE_CONTEXT_MISMATCH');
 const observed=stamp(c.observed_at);if(observed<stamp(m.due_at)||observed>=stamp(m.expires_at)||observed<now-120000||observed>now+15000)fail('REAL_ACCEPTANCE_CONTEXT_MISMATCH');
 if(now<stamp(m.due_at)||now>=stamp(m.expires_at))fail('REAL_ACCEPTANCE_WINDOW_CLOSED');
 if(Adapter.bindingDigest(Adapter.validateBinding(provider))!==m.provider_binding_sha256)fail('REAL_ACCEPTANCE_PROVIDER_MISMATCH');return c;
}
function immutableSourceHash(r){
 if(!Wire.isPlainObject(r))fail('REAL_ACCEPTANCE_SOURCE_INVALID');
 const values=IMMUTABLE_FIELDS.map(k=>{const v=r[k];if(v instanceof Date&&Number.isFinite(v.getTime()))return v.toISOString();if(typeof v!=='string')fail('REAL_ACCEPTANCE_SOURCE_INVALID');return v;});return hash(JSON.stringify(values));
}
function claimId(m,channel,sourceHash){
 if(!['TELEGRAM_OWNER_ALERTS','LINE_OWNER_ALERTS'].includes(channel)||typeof sourceHash!=='string'||!/^[a-f0-9]{64}$/.test(sourceHash))fail('REAL_ACCEPTANCE_SOURCE_INVALID');
 const bytes=Buffer.from(hash(JSON.stringify(['KK_OWNER_REAL_ACCEPTANCE_CLAIM_V1',digest(m),channel,sourceHash])).slice(0,32),'hex');bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const h=bytes.toString('hex');return 'CLAIM|'+[h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
}
function validateSource(m,r,now=Date.now()){
 validateManifest(m);immutableSourceHash(r);
 if(!r||r.Transport!==Legacy.TRANSPORT||r.Status!=='QUEUED'||![0,'0'].includes(r['Attempt Count'])||['Last Attempt At','Delivery Evidence','Next Retry At','HTTP Status','Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error','Feedback Source'].some(k=>r[k]!==''))fail('REAL_ACCEPTANCE_SOURCE_INVALID');
 if(/^(KKUAT_|CONTROLLED_UAT\|)/.test(r['Notification ID'])||r.Priority==='TEST'||r['Change Type']==='TRANSPORT_UAT'||r['Quiet Hours Policy']==='OWNER_CONTROLLED_UAT'||r['Audit Event ID'].startsWith('CONTROLLED_UAT|')||typeof r.Notes!=='string'||/CLAIM\||OWNER_AUTHORIZED_TRANSPORT_UAT/.test(r.Notes))fail('REAL_ACCEPTANCE_SOURCE_INVALID');
 const created=Date.parse(r['Created At']);if(!Number.isFinite(created)||created<stamp(m.not_before)||created>now)fail('REAL_ACCEPTANCE_SOURCE_INVALID');return r;
}
function validateRecord(m,r,provider,now=Date.now()){
 validateContext(m,r?.context,provider,now);if(!Wire.isPlainObject(r.source_row)||r.attempt_count!==1||r.source_notification_id!==r.source_row['Notification ID'])fail('REAL_ACCEPTANCE_RECORD_MISMATCH');
 validateSource(m,r.source_row,now);let b;try{b=JSON.parse(r.binding_text);}catch(_){fail('REAL_ACCEPTANCE_RECORD_MISMATCH');}
 const s=r.source_row,expected=['kk-owner-ledger-binding-v2',Legacy.SPREADSHEET_ID,Legacy.TAB,Legacy.TRANSPORT,r.source_notification_id,s['Created At'],s.Payload,s['Dedup Key'],s['Event Family ID'],s['Show ID'],s['Change Type'],s.Priority,s['Quiet Hours Policy'],JSON.stringify(r.context),claimId(m,Legacy.TRANSPORT,immutableSourceHash(s))];
 if(JSON.stringify(b)!==JSON.stringify(expected)||r.descriptor?.content_version!==hash(r.binding_text))fail('REAL_ACCEPTANCE_RECORD_MISMATCH');return r;
}
module.exports={FIELDS,IMMUTABLE_FIELDS,validateManifest,digest,config,active,attestation,verifyAttestation,controls,validateContext,immutableSourceHash,claimId,validateSource,validateRecord};
