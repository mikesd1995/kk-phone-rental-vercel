'use strict';

// Source-only preparation. Nothing here authenticates a Sheet read, admits a
// claim, persists a mapping, signs an envelope or grants dispatch authority.
const crypto=require('node:crypto');
const {VERSION,AUDIENCE,MAX_AGE_MS,MAX_MESSAGE_LENGTH,canonical,hash}=require('./make-owner-transport-contract');
const SPREADSHEET_ID='1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo';
const TAB='_Notification_Ledger';
const TRANSPORT='TELEGRAM_OWNER_ALERTS';
const BINDING_VERSION='kk-owner-ledger-binding-v1';
const HEADERS=[
  'Notification ID','Created At','Event Family ID','Show ID','Change Type',
  'Priority','Quiet Hours Policy','Payload','Audit Event ID','Transport','Status',
  'Attempt Count','Last Attempt At','Delivery Evidence','Next Retry At','Dedup Key',
  'Notes','HTTP Status','Provider Message ID','API Accepted At',
  'Delivery Confirmed At','Last Error','Feedback Source'
];
const EVIDENCE_FIELDS=[
  'Last Attempt At','Delivery Evidence','Next Retry At','HTTP Status',
  'Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error','Feedback Source'
];
const SEMANTIC_FIELDS=['Event Family ID','Show ID','Change Type','Priority','Quiet Hours Policy'];

function fail(code){throw Object.assign(new Error(code),{code});}
function record(value,fields){
  if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail('INPUT_FIELDS_INVALID');
  const keys=Reflect.ownKeys(value),descriptors=Object.getOwnPropertyDescriptors(value);
  if(keys.length!==fields.length||keys.some(key=>typeof key!=='string'||!fields.includes(key)||!Object.hasOwn(descriptors[key],'value')))fail('INPUT_FIELDS_INVALID');
  return value;
}
function array(value,code){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>2000)fail(code);
  const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
  if(keys.length!==value.length+1||keys.some(key=>typeof key!=='string'||(key!=='length'&&!/^(0|[1-9][0-9]*)$/.test(key))||!Object.hasOwn(descriptors[key],'value')))fail(code);
  return value;
}
function string(value,code='LEDGER_CELL_TYPE_INVALID'){
  if(typeof value!=='string')fail(code);
  // Buffer replaces unpaired UTF-16 surrogates. Reject before encoding so
  // distinct malformed strings can never collapse into the replacement byte.
  for(let i=0;i<value.length;i++){
    const unit=value.charCodeAt(i);
    if(unit>=0xd800&&unit<=0xdbff){
      const next=value.charCodeAt(++i);
      if(!(next>=0xdc00&&next<=0xdfff))fail('STRING_UNICODE_INVALID');
    }else if(unit>=0xdc00&&unit<=0xdfff)fail('STRING_UNICODE_INVALID');
  }
  return value;
}
function scope(spreadsheet,tab,transport=TRANSPORT){
  if(spreadsheet!==SPREADSHEET_ID||tab!==TAB||transport!==TRANSPORT)fail('LEDGER_SCOPE_INVALID');
}
function rawId(value){
  string(value,'NOTIFICATION_ID_INVALID');
  if(/[\u0000-\u001f\u007f-\u009f]/.test(value))fail('NOTIFICATION_ID_CONTROL_INVALID');
  const size=Buffer.byteLength(value,'utf8');
  if(size<6||size>93)fail('NOTIFICATION_ID_BYTES_INVALID');
  return value;
}
function identities(raw){
  const encoded=Buffer.from(rawId(raw),'utf8').toString('base64url');
  return {notification_id:'ks1_'+encoded,request_id:'kr1_'+encoded,entity_id:'ke1_'+encoded};
}
function sourceTuple(raw){return {spreadsheet_id:SPREADSHEET_ID,tab:TAB,transport:TRANSPORT,notification_id:raw};}

function encodeLedgerIdentity(input){
  record(input,['spreadsheet_id','tab','transport','notification_id']);
  scope(input.spreadsheet_id,input.tab,input.transport);
  return {source_tuple:sourceTuple(rawId(input.notification_id)),transport_identity:identities(input.notification_id)};
}
function decodeLedgerIdentity(input){
  record(input,['notification_id','request_id','entity_id']);
  const parts=[['notification_id','ks1_'],['request_id','kr1_'],['entity_id','ke1_']].map(([key,prefix])=>{
    const value=string(input[key],'TRANSPORT_ID_INVALID');
    if(value.length<12||value.length>128||!value.startsWith(prefix)||!/^[A-Za-z0-9_-]+$/.test(value.slice(4)))fail('TRANSPORT_ID_INVALID');
    return value.slice(4);
  });
  if(parts.some(part=>part!==parts[0]))fail('TRANSPORT_ID_MISMATCH');
  const bytes=Buffer.from(parts[0],'base64url'),raw=bytes.toString('utf8');
  if(bytes.toString('base64url')!==parts[0]||!Buffer.from(raw,'utf8').equals(bytes))fail('TRANSPORT_ID_INVALID');
  return sourceTuple(rawId(raw));
}
function instant(value){
  string(value,'CLOCK_INPUT_INVALID');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))fail('CLOCK_INPUT_INVALID');
  const parsed=Date.parse(value);
  if(!Number.isFinite(parsed))fail('CLOCK_INPUT_INVALID');
  // Reject calendar rollover, e.g. February 30, rather than silently accepting
  // JavaScript's normalization. Offsets are preserved in the raw binding.
  const local=Date.parse(value.slice(0,19)+'Z');
  if(!Number.isFinite(local)||new Date(local).toISOString().slice(0,19)!==value.slice(0,19))fail('CLOCK_INPUT_INVALID');
  return parsed;
}
function checkedRow(value){
  record(value,HEADERS);
  for(const key of HEADERS){
    if(key==='Attempt Count')continue;
    // Native Sheet readback may use numbers for historical provider cells.
    // Preserve the value: the selected candidate still rejects any evidence,
    // including numeric zero, instead of coercing it into an empty string.
    if(['HTTP Status','Provider Message ID'].includes(key)&&typeof value[key]==='number'&&Number.isFinite(value[key]))continue;
    string(value[key]);
  }
  // All rows participate in exact-ID/dedup ambiguity detection; their delivery
  // status and freshness matter only if selected as the one candidate.
  rawId(value['Notification ID']);
  return value;
}
function immutableBinding(row){
  return [BINDING_VERSION,SPREADSHEET_ID,TAB,TRANSPORT,row['Notification ID'],
    row['Created At'],row.Payload,row['Dedup Key'],...SEMANTIC_FIELDS.map(key=>row[key])];
}
function checkedMapping(value){
  record(value,['source_tuple','transport_identity','immutable_binding']);
  record(value.source_tuple,['spreadsheet_id','tab','transport','notification_id']);
  scope(value.source_tuple.spreadsheet_id,value.source_tuple.tab,value.source_tuple.transport);
  let decoded;
  try{decoded=decodeLedgerIdentity(value.transport_identity);}catch(_){fail('MAPPING_RECORD_INVALID');}
  const binding=array(value.immutable_binding,'MAPPING_RECORD_INVALID');
  if(binding.length!==13)fail('MAPPING_RECORD_INVALID');
  binding.forEach(part=>string(part,'MAPPING_RECORD_INVALID'));
  if(decoded.notification_id!==value.source_tuple.notification_id||binding[0]!==BINDING_VERSION||binding[1]!==SPREADSHEET_ID||binding[2]!==TAB||binding[3]!==TRANSPORT||binding[4]!==decoded.notification_id||!binding[7])fail('MAPPING_RECORD_INVALID');
  return value;
}

function planOwnerLedgerNotification(input){
  record(input,['spreadsheet_id','tab','rows','exact_notification_id','fresh_since','supplied_now','existing_mapping_snapshot']);
  scope(input.spreadsheet_id,input.tab);
  const exact=rawId(input.exact_notification_id);
  const now=instant(input.supplied_now),fresh=instant(input.fresh_since);
  if(fresh>now)fail('CLOCK_RANGE_INVALID');
  const rows=array(input.rows,'ROW_COLLECTION_INVALID').map(checkedRow);
  const matches=rows.filter(row=>row['Notification ID']===exact);
  if(matches.length===0)fail('EXACT_NOTIFICATION_NOT_FOUND');
  if(matches.length!==1)fail('DUPLICATE_NOTIFICATION_ID');
  const row=matches[0];
  if(row.Transport!==TRANSPORT)fail('LEDGER_CHANNEL_INVALID');
  if(!row['Dedup Key'])fail('LEDGER_DEDUP_KEY_REQUIRED');
  if(rows.filter(other=>other.Transport===TRANSPORT&&other['Dedup Key']===row['Dedup Key']).length!==1)fail('DUPLICATE_DEDUP_KEY');
  if(row.Status!=='QUEUED')fail('LEDGER_STATUS_NOT_INITIAL_QUEUED');
  if(row['Attempt Count']!==0&&row['Attempt Count']!=='0')fail('LEDGER_ATTEMPTS_NOT_ZERO');
  if(EVIDENCE_FIELDS.some(key=>row[key]!==''))fail('LEDGER_PRIOR_ATTEMPT_EVIDENCE');
  const created=instant(row['Created At']);
  if(created<fresh||created>now)fail('LEDGER_ROW_NOT_FRESH');
  if(!row.Payload||row.Payload!==row.Payload.trim()||row.Payload.length>MAX_MESSAGE_LENGTH)fail('LEDGER_PAYLOAD_INVALID');
  const encoded=encodeLedgerIdentity({...sourceTuple(exact)});
  const binding=immutableBinding(row);
  const prior=array(input.existing_mapping_snapshot,'MAPPING_COLLECTION_INVALID').map(checkedMapping);
  const seenIdentity=new Set(),seenDedup=new Set();
  for(const mapping of prior){
    const oldRaw=mapping.source_tuple.notification_id,oldDedup=mapping.immutable_binding[7];
    if(seenIdentity.has(oldRaw))fail('DUPLICATE_MAPPING_IDENTITY');
    if(seenDedup.has(oldDedup))fail('DUPLICATE_MAPPING_DEDUP');
    seenIdentity.add(oldRaw);seenDedup.add(oldDedup);
    if(oldRaw===exact&&JSON.stringify(mapping.immutable_binding)!==JSON.stringify(binding))fail('IMMUTABLE_BINDING_CONFLICT');
    if(oldDedup===row['Dedup Key']&&oldRaw!==exact)fail('DEDUP_IDENTITY_CONFLICT');
  }
  const descriptor={version:VERSION,audience:AUDIENCE,...encoded.transport_identity,
    event_type:'OWNER_ALERT',content_version:crypto.createHash('sha256').update(JSON.stringify(binding),'utf8').digest('hex'),
    text:row.Payload,created_at:new Date(now).toISOString(),expires_at:new Date(now+MAX_AGE_MS).toISOString()};
  // A snapshot comparison cannot replace a future atomic durable unique map,
  // authenticated Ledger reader, policy/quiet-hours renderer or claim admission.
  // OWNER_ALERT is a fixed wire type, not semantic approval of arbitrary text.
  return {status:'PREPARATORY_ONLY',send_allowed:false,claim_admitted:false,
    mapping_persistence_required:true,source_tuple:encoded.source_tuple,
    immutable_binding:binding,
    mapping_record:{...encoded,immutable_binding:binding.slice()},
    descriptor,text_sha256:hash(row.Payload),canonical:canonical(descriptor)};
}

module.exports={encodeLedgerIdentity,decodeLedgerIdentity,planOwnerLedgerNotification};
