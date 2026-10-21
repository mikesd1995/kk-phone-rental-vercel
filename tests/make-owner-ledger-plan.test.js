'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../server/make-owner-transport-contract');
let P;
try{require.resolve('../server/make-owner-ledger-plan');P=require('../server/make-owner-ledger-plan');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
const run=(name,fn)=>test(name,{skip:!P},fn);
const SCOPE={spreadsheet_id:'1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo',tab:'_Notification_Ledger'};
const CHANNEL='TELEGRAM_OWNER_ALERTS';
const NOW='2026-10-21T02:00:00.000Z';
const RAW='NTF|SYNTHETIC|NEW_WORK|20261021T0859|TELEGRAM';
const row=(patch={})=>({
  'Notification ID':RAW,'Created At':'2026-10-21T01:59:30.000Z',
  'Event Family ID':'SYNTHETIC-FAMILY','Show ID':'SYNTHETIC-SHOW',
  'Change Type':'NEW_WORK','Priority':'P1','Quiet Hours Policy':'NORMAL',
  'Payload':'Synthetic owner alert for source preparation only.',
  'Audit Event ID':'SYNTHETIC-AUDIT','Transport':CHANNEL,'Status':'QUEUED',
  'Attempt Count':0,'Last Attempt At':'','Delivery Evidence':'','Next Retry At':'',
  'Dedup Key':'SYNTHETIC|DEDUP|001','Notes':'Synthetic fixture; no live row payload.',
  'HTTP Status':'','Provider Message ID':'','API Accepted At':'',
  'Delivery Confirmed At':'','Last Error':'','Feedback Source':'',...patch
});
const input=(patch={})=>({...SCOPE,rows:[row()],exact_notification_id:RAW,
  fresh_since:'2026-10-21T01:58:00.000Z',supplied_now:NOW,existing_mapping_snapshot:[],...patch});
const encode=(raw=RAW,patch={})=>P.encodeLedgerIdentity({...SCOPE,transport:CHANNEL,notification_id:raw,...patch});
const reject=(fn,code)=>assert.throws(fn,error=>error.code===code);
const sha=value=>crypto.createHash('sha256').update(value,'utf8').digest('hex');

test('preparatory Ledger helper exposes pure identity and one-candidate planning APIs',()=>{
  assert.ok(P,'source-only preparatory helper does not exist yet');
  for(const name of ['encodeLedgerIdentity','decodeLedgerIdentity','planOwnerLedgerNotification'])assert.equal(typeof P[name],'function');
});

run('pipe identity is reversible with literal transport IDs and fixed source tuple',()=>{
  const encoded=encode('abc|de');
  assert.deepEqual(encoded.transport_identity,{notification_id:'ks1_YWJjfGRl',request_id:'kr1_YWJjfGRl',entity_id:'ke1_YWJjfGRl'});
  assert.deepEqual(encoded.source_tuple,{...SCOPE,transport:CHANNEL,notification_id:'abc|de'});
  assert.deepEqual(P.decodeLedgerIdentity(encoded.transport_identity),encoded.source_tuple);
});

run('literal pipes, whitespace, punctuation and Unicode never sanitize or normalize into one identity',()=>{
  const values=['abc|de','abc_de','abc:de',' abcde','abcde ','abéxyz','abe\u0301xyz','a/+=bc','你好😀'];
  const ids=values.map(value=>encode(value).transport_identity.notification_id);
  assert.equal(new Set(ids).size,values.length);
  for(let i=0;i<values.length;i++)assert.equal(P.decodeLedgerIdentity(encode(values[i]).transport_identity).notification_id,values[i]);
});

run('raw 6..93 UTF-8 byte bounds yield safe 12..128 character IDs without truncation',()=>{
  for(const raw of ['a'.repeat(6),'a'.repeat(93),'ก'.repeat(31)]){
    const encoded=encode(raw);
    for(const id of Object.values(encoded.transport_identity))assert.match(id,/^[a-zA-Z0-9:_-]{12,128}$/);
    assert.equal(P.decodeLedgerIdentity(encoded.transport_identity).notification_id,raw);
  }
  for(const raw of ['a'.repeat(5),'a'.repeat(94),'ก'.repeat(32)])reject(()=>encode(raw),'NOTIFICATION_ID_BYTES_INVALID');
});

run('malformed UTF-16 cannot silently replace into a colliding UTF-8 identity',()=>{
  for(const raw of ['abcde\ud800','abcde\udfff','\ud800abcde'])reject(()=>encode(raw),'STRING_UNICODE_INVALID');
});

run('identity rejects literal C0, DEL and C1 controls instead of sanitizing them',()=>{
  for(const raw of ['abc\nde','abc\tde','abc\0de','abc\u007fde','abc\u0085de','abc\u009fde'])reject(()=>encode(raw),'NOTIFICATION_ID_CONTROL_INVALID');
});

run('decode rejects mismatched prefixes, noncanonical encoding, invalid UTF-8 and extra fields',()=>{
  const ids=encode('abc|de').transport_identity;
  for(const patch of [{notification_id:'ks1_YWJjfGRl='},{request_id:'kr1_YWJjfGRm'},{entity_id:'ke1_!!!!!'},{entity_id:'ke1______8'},{recipient:'owner'}])assert.throws(()=>P.decodeLedgerIdentity({...ids,...patch}));
});

run('fixed source scope and Telegram channel reject caller-selected sheets or channels',()=>{
  for(const patch of [{spreadsheet_id:'other'},{tab:'_Audit_Log'},{transport:'LINE'}])reject(()=>encode(RAW,patch),'LEDGER_SCOPE_INVALID');
  for(const patch of [{spreadsheet_id:'other'},{tab:'_AI_Inbox'}])reject(()=>P.planOwnerLedgerNotification(input(patch)),'LEDGER_SCOPE_INVALID');
  reject(()=>P.planOwnerLedgerNotification(input({rows:[row({Transport:'LINE_OWNER_ALERTS'})]})),'LEDGER_CHANNEL_INVALID');
});

run('one exact candidate produces unsigned preparation with exact wire text/hash and 120-second TTL',()=>{
  const result=P.planOwnerLedgerNotification(input());
  assert.equal(result.status,'PREPARATORY_ONLY');assert.equal(result.send_allowed,false);
  assert.equal(result.mapping_persistence_required,true);assert.equal(result.claim_admitted,false);
  assert.equal(result.descriptor.event_type,'OWNER_ALERT');
  assert.equal(result.descriptor.text,row().Payload);
  assert.equal(result.descriptor.content_version,sha(JSON.stringify(result.immutable_binding)));
  assert.equal(result.text_sha256,'0737f55261b1d4cf895a08ac73288febad881a01a1f5f6f2b39c4b8e4a90b831');
  assert.equal(result.text_sha256,C.hash(result.descriptor.text));
  assert.equal(result.descriptor.created_at,NOW);
  assert.equal(result.descriptor.expires_at,'2026-10-21T02:02:00.000Z');
  assert.equal(result.canonical,C.canonical(result.descriptor));
  assert.equal(result.descriptor.signature,undefined);
  assert.equal(result.descriptor.chat_id,undefined);
  assert.equal(C.verifyEnvelope(result.descriptor,'',Date.parse(NOW)).error_code,'SIGNING_KEY_MISSING');
});

run('identity and immutable revision stay stable across fresh explicit clocks',()=>{
  const first=P.planOwnerLedgerNotification(input());
  const later=P.planOwnerLedgerNotification(input({supplied_now:'2026-10-21T02:00:30.000Z'}));
  assert.deepEqual(later.mapping_record,first.mapping_record);
  assert.equal(later.descriptor.notification_id,first.descriptor.notification_id);
  assert.equal(later.descriptor.content_version,first.descriptor.content_version);
  assert.notEqual(later.descriptor.created_at,first.descriptor.created_at);
  assert.equal(encode().transport_identity.notification_id,first.descriptor.notification_id);
});

run('immutable binding preserves exact raw source, payload, dedup and semantic columns',()=>{
  const result=P.planOwnerLedgerNotification(input());
  assert.deepEqual(result.immutable_binding,[
    'kk-owner-ledger-binding-v1',SCOPE.spreadsheet_id,SCOPE.tab,CHANNEL,RAW,
    row()['Created At'],row().Payload,row()['Dedup Key'],row()['Event Family ID'],
    row()['Show ID'],row()['Change Type'],row().Priority,row()['Quiet Hours Policy']
  ]);
  assert.deepEqual(result.mapping_record.source_tuple,encode().source_tuple);
});

run('same raw identity with payload, dedup or semantic mutation conflicts with supplied prior mapping',()=>{
  const existing=P.planOwnerLedgerNotification(input()).mapping_record;
  for(const patch of [
    {Payload:'Changed synthetic payload'},{'Dedup Key':'SYNTHETIC|DEDUP|002'},
    {'Created At':'2026-10-21T01:59:31.000Z'},{'Event Family ID':'OTHER'},
    {'Show ID':'OTHER'},{'Change Type':'MATERIAL_EVENT_UPDATE'},{Priority:'P0'},
    {'Quiet Hours Policy':'OVERRIDE'}
  ])reject(()=>P.planOwnerLedgerNotification(input({rows:[row(patch)],existing_mapping_snapshot:[existing]})),'IMMUTABLE_BINDING_CONFLICT');
  assert.equal(P.planOwnerLedgerNotification(input({existing_mapping_snapshot:[existing]})).send_allowed,false);
});

run('duplicate raw IDs and duplicate dedup rows fail independently of candidate ordering',()=>{
  const second=row({'Notification ID':'NTF|SYNTHETIC|OTHER|20261021T0859|TELEGRAM'});
  reject(()=>P.planOwnerLedgerNotification(input({rows:[row(),row()]})),'DUPLICATE_NOTIFICATION_ID');
  reject(()=>P.planOwnerLedgerNotification(input({rows:[second,row()]})),'DUPLICATE_DEDUP_KEY');
  const prior=P.planOwnerLedgerNotification(input()).mapping_record;
  reject(()=>P.planOwnerLedgerNotification(input({rows:[second],exact_notification_id:second['Notification ID'],existing_mapping_snapshot:[prior]})),'DEDUP_IDENTITY_CONFLICT');
});

run('Dedup uniqueness stays within the Telegram channel while exact raw ID ambiguity is global',()=>{
  const line=row({'Notification ID':'NTF|SYNTHETIC|NEW_WORK|20261021T0859|LINE',Transport:'LINE_OWNER_ALERTS'});
  assert.equal(P.planOwnerLedgerNotification(input({rows:[line,row()]})).status,'PREPARATORY_ONLY');
  reject(()=>P.planOwnerLedgerNotification(input({rows:[{...line,Transport:CHANNEL},row()]})),'DUPLICATE_DEDUP_KEY');
  reject(()=>P.planOwnerLedgerNotification(input({rows:[{...line,'Notification ID':RAW},row()]})),'DUPLICATE_NOTIFICATION_ID');
});

run('conflicting or duplicate prior mapping snapshots fail closed',()=>{
  const prior=P.planOwnerLedgerNotification(input()).mapping_record;
  reject(()=>P.planOwnerLedgerNotification(input({existing_mapping_snapshot:[prior,prior]})),'DUPLICATE_MAPPING_IDENTITY');
  const wrong={...prior,transport_identity:{...prior.transport_identity,request_id:'kr1_YWJjfGRl'}};
  reject(()=>P.planOwnerLedgerNotification(input({existing_mapping_snapshot:[wrong]})),'MAPPING_RECORD_INVALID');
  reject(()=>P.planOwnerLedgerNotification(input({existing_mapping_snapshot:[{...prior,recipient:'owner'}]})),'INPUT_FIELDS_INVALID');
});

run('unrelated historical HOLD rows do not fail a fresh exact candidate or become selected',()=>{
  const old=row({'Notification ID':'NTF|ZARA|MATERIAL_EVENT_UPDATE|20260830T0636|TELEGRAM',
    'Created At':'2026-08-30T06:36:00.000Z',Status:'HOLD_TRANSPORT_QUARANTINE','Dedup Key':'SYNTHETIC-HISTORICAL'});
  assert.equal(P.planOwnerLedgerNotification(input({rows:[old,row()]})).descriptor.notification_id,encode().transport_identity.notification_id);
  reject(()=>P.planOwnerLedgerNotification(input({rows:[old],exact_notification_id:old['Notification ID']})),'LEDGER_STATUS_NOT_INITIAL_QUEUED');
  const oldQueued={...old,Status:'QUEUED'};
  reject(()=>P.planOwnerLedgerNotification(input({rows:[oldQueued],exact_notification_id:oldQueued['Notification ID']})),'LEDGER_ROW_NOT_FRESH');
});

run('unrelated historical native numeric provider cells do not invalidate a fresh candidate',()=>{
  const historical=row({'Notification ID':'NTF|SYNTHETIC|NEW_WORK|20260825T0913|TELEGRAM',
    'Created At':'2026-08-25T09:13:00+07:00','Dedup Key':'SYNTHETIC|HISTORICAL|SENT',
    Status:'SENT','Attempt Count':1,'HTTP Status':200,'Provider Message ID':234});
  assert.equal(P.planOwnerLedgerNotification(input({rows:[historical,row()]})).status,'PREPARATORY_ONLY');
  for(const patch of [{'HTTP Status':200},{'Provider Message ID':234},{'HTTP Status':0},{'Provider Message ID':0}])reject(()=>P.planOwnerLedgerNotification(input({rows:[row(patch)]})),'LEDGER_PRIOR_ATTEMPT_EVIDENCE');
  for(const value of [NaN,Infinity,null,{},[]])reject(()=>P.planOwnerLedgerNotification(input({rows:[{...historical,'HTTP Status':value},row()]})),'LEDGER_CELL_TYPE_INVALID');
  reject(()=>P.planOwnerLedgerNotification(input({rows:[{...historical,'Last Error':234},row()]})),'LEDGER_CELL_TYPE_INVALID');
});

run('HOLD, SENT, RETRY_WAIT and attempts cannot become an initial preparation',()=>{
  for(const status of ['HOLD_TRANSPORT_QUARANTINE','HOLD','SENT','RETRY_WAIT','SENDING'])reject(()=>P.planOwnerLedgerNotification(input({rows:[row({Status:status})]})),'LEDGER_STATUS_NOT_INITIAL_QUEUED');
  for(const attempts of [1,'1',-1,0.1,'0.0','',null,false])reject(()=>P.planOwnerLedgerNotification(input({rows:[row({'Attempt Count':attempts})]})),'LEDGER_ATTEMPTS_NOT_ZERO');
  assert.equal(P.planOwnerLedgerNotification(input({rows:[row({'Attempt Count':'0'})]})).status,'PREPARATORY_ONLY');
});

run('provider, retry and attempt evidence always block initial preparation',()=>{
  for(const name of ['Last Attempt At','Delivery Evidence','Next Retry At','HTTP Status','Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error','Feedback Source']){
    reject(()=>P.planOwnerLedgerNotification(input({rows:[row({[name]:'synthetic evidence'})]})),'LEDGER_PRIOR_ATTEMPT_EVIDENCE');
  }
});

run('explicit supplied clocks reject missing, malformed, future, old and nonmonotonic rows',()=>{
  for(const supplied_now of [undefined,null,0,new Date(NOW),'2026-10-21','not-time'])reject(()=>P.planOwnerLedgerNotification(input({supplied_now})),'CLOCK_INPUT_INVALID');
  reject(()=>P.planOwnerLedgerNotification(input({fresh_since:'2026-10-21T02:01:00.000Z'})),'CLOCK_RANGE_INVALID');
  for(const created of ['2026-10-21T01:57:59.999Z','2026-10-21T02:00:00.001Z','2026-08-25T09:13:00+07:00'])reject(()=>P.planOwnerLedgerNotification(input({rows:[row({'Created At':created})]})),'LEDGER_ROW_NOT_FRESH');
  reject(()=>P.planOwnerLedgerNotification(input({rows:[row({'Created At':'bad'})]})),'CLOCK_INPUT_INVALID');
});

run('raw payload outer whitespace, empty payload, oversized payload and invalid Unicode reject',()=>{
  for(const Payload of ['',row().Payload+' ',' '+row().Payload,'x'.repeat(2049),'abc\ud800'])assert.throws(()=>P.planOwnerLedgerNotification(input({rows:[row({Payload})]})));
  const Payload='ตัวอย่างข้อความภาษาไทย\nSynthetic 😀';
  const result=P.planOwnerLedgerNotification(input({rows:[row({Payload})]}));
  assert.equal(result.descriptor.text,Payload);assert.equal(result.text_sha256,sha(Payload));
});

run('unknown recipient, callback and shadow fields are forbidden at every input level',()=>{
  for(const field of ['recipient','chat_id','callback_url','reply_markup','event_type','secret','owner_approved']){
    reject(()=>P.planOwnerLedgerNotification(input({[field]:'injected'})),'INPUT_FIELDS_INVALID');
    reject(()=>P.planOwnerLedgerNotification(input({rows:[row({[field]:'injected'})]})),'INPUT_FIELDS_INVALID');
    reject(()=>encode(RAW,{[field]:'injected'}),'INPUT_FIELDS_INVALID');
  }
});

run('plain data validation rejects getters, symbols, inherited records and coercible field types without reading getters',()=>{
  let calls=0;const accessor=row();Object.defineProperty(accessor,'Payload',{enumerable:true,get(){calls++;return 'bad';}});
  reject(()=>P.planOwnerLedgerNotification(input({rows:[accessor]})),'INPUT_FIELDS_INVALID');
  assert.equal(calls,0);
  const getterInput=input();Object.defineProperty(getterInput,'rows',{get(){calls++;return [row()];}});
  reject(()=>P.planOwnerLedgerNotification(getterInput),'INPUT_FIELDS_INVALID');assert.equal(calls,0);
  for(const bad of [null,[],42,'text',Object.assign(Object.create({}),row()),{...row(),[Symbol('shadow')]:'bad'}])assert.throws(()=>P.planOwnerLedgerNotification(input({rows:[bad]})));
  for(const Payload of [null,1,true,[],{},new String('text')])reject(()=>P.planOwnerLedgerNotification(input({rows:[row({Payload})]})),'LEDGER_CELL_TYPE_INVALID');
  for(const bad of [null,{},'rows'])reject(()=>P.planOwnerLedgerNotification(input({rows:bad})),'ROW_COLLECTION_INVALID');
  reject(()=>P.planOwnerLedgerNotification(input({rows:[]})),'EXACT_NOTIFICATION_NOT_FOUND');
});

run('missing exact Sheet columns cannot fabricate an empty provider-evidence field',()=>{
  const missing=row();delete missing['Provider Message ID'];
  reject(()=>P.planOwnerLedgerNotification(input({rows:[missing]})),'INPUT_FIELDS_INVALID');
});

run('no ambient clock, secrets, network, DB, provider, claim or signing capability is used',context=>{
  const source=fs.readFileSync(require.resolve('../server/make-owner-ledger-plan'),'utf8');
  const seen=[];
  const sandbox={module:{exports:{}},exports:{},Buffer,Date,
    process:new Proxy({},{get(){throw Error('ambient process/env forbidden');}}),
    fetch(){throw Error('network forbidden');},
    require(name){seen.push(name);if(name==='node:crypto')return crypto;if(name==='./make-owner-transport-contract')return C;throw Error('I/O import forbidden: '+name);}
  };
  vm.runInNewContext(source,sandbox);
  context.mock.method(Date,'now',()=>{throw Error('ambient clock forbidden');});
  context.mock.method(C,'sign',()=>{throw Error('signing forbidden');});
  context.mock.method(C,'buildEnvelope',()=>{throw Error('signing forbidden');});
  context.mock.method(C,'prepareDispatch',()=>{throw Error('claim/provider forbidden');});
  // Inputs belong to the VM realm so plain-object checks remain meaningful.
  sandbox.fixture=JSON.stringify(input());
  const result=vm.runInNewContext('module.exports.planOwnerLedgerNotification(JSON.parse(fixture))',sandbox);
  assert.equal(result.send_allowed,false);assert.equal(result.claim_admitted,false);
  assert.equal(result.descriptor.signature,undefined);
  assert.ok(seen.every(name=>['node:crypto','./make-owner-transport-contract'].includes(name)));
});
