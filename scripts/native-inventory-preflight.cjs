'use strict';

// Offline preparation only. This module has no runtime client or execution path.
// Hash references and caller-supplied records are NOT verified provider evidence.
const fs=require('node:fs');
const SCHEMA='KK_NATIVE_INVENTORY_PREPARATION_V1';
const PROJECT_ID='zehlsagzrpromtfqqflt';
const MAX_INPUT_BYTES=65536;
const MAX_AGE_SECONDS=900; // Local preparation check, not a Machine SOT policy.
const CATEGORIES=Object.freeze([
  'SCHEDULERS_CRON_STARTUP_PROCESSES','BACKGROUND_OUTBOUND_EXTENSIONS',
  'TRIGGERS_WEBHOOKS','QUEUES_OUTBOXES_RETRIES','NATIVE_ATTEMPTS_ARM_NONCE_FENCES',
  'TRANSACTIONS_RECOVERY_REPLICATION','DATABASE_FUNCTIONS_PRIVILEGED_CODE',
  'EDGE_PROVIDER_PLATFORM_JOBS','EXTERNAL_CALLERS_WRITERS',
  'BUSINESS_DESTINATIONS_READERS','COMPLETENESS_UNEXAMINED_CLASSES'
]);
const DISPOSITIONS=Object.freeze(['QUEUES','OUTBOXES','RETRIES','ATTEMPTS','NONCES','ARM','FENCES']);
const BUDGETS=Object.freeze([
  'resumeRestoreClone','nativeClaim','health','oauth','privateGas',
  'providerCustomerSend','businessWrite','makeRun','scheduleActivation','replay'
]);
const ROOT_KEYS=['schema','collectedAtUTC','project','source','authority','containment','transition','inventory','dispositions'];
const RECORD_KEYS=['name','state','itemCount','heldItemCount','evidenceRef'];
const hash=value=>typeof value==='string'&&/^sha256:[0-9a-f]{64}$/.test(value);
function exact(value,keys){
  if(value===null||typeof value!=='object'||Array.isArray(value)||
     ![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
  const descriptors=Object.getOwnPropertyDescriptors(value),own=Reflect.ownKeys(descriptors);
  return own.length===keys.length&&own.every(k=>typeof k==='string'&&keys.includes(k)&&
    Object.hasOwn(descriptors[k],'value')&&descriptors[k].enumerable);
}
function timestamp(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))return NaN;
  const parsed=Date.parse(value);
  return Number.isFinite(parsed)&&new Date(parsed).toISOString().replace('.000Z','Z')===value.replace('.000Z','Z')?parsed:NaN;
}
function unknownRecord(name){return {name,state:'UNKNOWN',itemCount:null,heldItemCount:null,evidenceRef:null};}
function template(){
  return {
    schema:SCHEMA,collectedAtUTC:null,
    project:{id:PROJECT_ID,status:'UNKNOWN',observedAtUTC:null,evidenceRef:null},
    source:{sha:null,evidenceRef:null},
    authority:{keepOff:true,executionAuthorized:false,budgets:Object.fromEntries(BUDGETS.map(k=>[k,0]))},
    containment:{state:'UNKNOWN',scope:'CURRENT_ACTIVE_NATIVE_AND_EXTERNAL',evidenceRef:null},
    transition:{previousStatus:'INACTIVE',state:'UNKNOWN',evidenceRef:null},
    inventory:CATEGORIES.map(unknownRecord),dispositions:DISPOSITIONS.map(unknownRecord)
  };
}
function recordsComplete(records,names){
  if(!Array.isArray(records)||records.length!==names.length)return false;
  const seen=new Set();
  for(const record of records){
    if(!exact(record,RECORD_KEYS)||!names.includes(record.name)||seen.has(record.name))return false;
    seen.add(record.name);
    if(!hash(record.evidenceRef)||!Number.isSafeInteger(record.itemCount)||record.itemCount<0||
       !Number.isSafeInteger(record.heldItemCount)||record.heldItemCount<0)return false;
    const none=record.state==='EVIDENCED_NONE'&&record.itemCount===0&&record.heldItemCount===0;
    const held=record.state==='EVIDENCED_HELD'&&record.itemCount>0&&record.itemCount===record.heldItemCount;
    if(!(none||held)||(record.name==='COMPLETENESS_UNEXAMINED_CLASSES'&&!none))return false;
  }
  return true;
}
function report(blockers){
  const structuralComplete=blockers.length===0;
  return {
    schema:SCHEMA,status:structuralComplete?'STRUCTURALLY_COMPLETE_REQUIRES_INDEPENDENT_EVIDENCE_REVIEW':'PREPARATION_BLOCKED',
    structuralComplete,blockers,
    requiredInventoryClasses:CATEGORIES.length,requiredDispositionClasses:DISPOSITIONS.length,
    evidenceAuthenticityVerified:false,c1Decision:'NOT_ASSESSED_KEEP_OFF',
    containmentAccepted:false,workerState:'UNKNOWN',runtimeGo:false,executionAuthorized:false,
    operationBudgets:Object.fromEntries(BUDGETS.map(k=>[k,0]))
  };
}
function evaluate(packet,{now=new Date().toISOString(),maxAgeSeconds=MAX_AGE_SECONDS}={}){
  const blockers=[];
  // Reject unexpected data before inspecting values. Never echo untrusted input.
  if(!exact(packet,ROOT_KEYS))return report(['INPUT_SCHEMA_INVALID']);
  if(packet.schema!==SCHEMA)blockers.push('SCHEMA_VERSION_INVALID');
  const clock=timestamp(now),collected=timestamp(packet.collectedAtUTC);
  const ageLimitValid=Number.isSafeInteger(maxAgeSeconds)&&maxAgeSeconds>0&&maxAgeSeconds<=MAX_AGE_SECONDS;
  if(!ageLimitValid||!Number.isFinite(clock)||!Number.isFinite(collected)||collected>clock||clock-collected>maxAgeSeconds*1000)blockers.push('EVIDENCE_TIME_INVALID_OR_STALE');
  const project=packet.project;
  if(!exact(project,['id','status','observedAtUTC','evidenceRef']))blockers.push('PROJECT_OBSERVATION_INVALID');
  else{
    if(project.id!==PROJECT_ID)blockers.push('RUNTIME_PROJECT_MISMATCH');
    if(project.status!=='ACTIVE_HEALTHY')blockers.push('CURRENT_ACTIVE_PROJECT_OBSERVATION_REQUIRED');
    const observed=timestamp(project.observedAtUTC);
    if(!Number.isFinite(observed)||!Number.isFinite(collected)||observed>collected||!Number.isFinite(clock)||observed>clock||!ageLimitValid||clock-observed>maxAgeSeconds*1000||!hash(project.evidenceRef))blockers.push('PROJECT_EVIDENCE_INVALID_OR_STALE');
  }
  const source=packet.source;
  if(!exact(source,['sha','evidenceRef'])||typeof source.sha!=='string'||!/^([0-9a-f]{40})$/.test(source.sha)||!hash(source.evidenceRef))blockers.push('SOURCE_BINDING_REQUIRED');
  const authority=packet.authority;
  if(!exact(authority,['keepOff','executionAuthorized','budgets'])||authority.keepOff!==true||authority.executionAuthorized!==false||
    !exact(authority.budgets,BUDGETS)||BUDGETS.some(k=>authority.budgets[k]!==0))blockers.push('OFF_ZERO_BUDGET_AUTHORITY_REQUIRED');
  const containment=packet.containment;
  if(!exact(containment,['state','scope','evidenceRef'])||containment.state!=='EVIDENCED_HELD'||
    containment.scope!=='CURRENT_ACTIVE_NATIVE_AND_EXTERNAL'||!hash(containment.evidenceRef))blockers.push('CURRENT_ACTIVE_CONTAINMENT_EVIDENCE_REQUIRED');
  const transition=packet.transition;
  if(!exact(transition,['previousStatus','state','evidenceRef'])||transition.previousStatus!=='INACTIVE'||
    transition.state!=='EVIDENCED_CONTINUOUS'||!hash(transition.evidenceRef))blockers.push('INACTIVE_TO_ACTIVE_CONTINUITY_EVIDENCE_REQUIRED');
  if(!recordsComplete(packet.inventory,CATEGORIES))blockers.push('EXHAUSTIVE_INVENTORY_INCOMPLETE');
  if(!recordsComplete(packet.dispositions,DISPOSITIONS))blockers.push('QUEUE_ATTEMPT_ARM_DISPOSITIONS_INCOMPLETE');
  return report(blockers);
}
function readLocalInput(file){
  const fd=fs.openSync(file,'r');
  try{
    if(!fs.fstatSync(fd).isFile()||fs.fstatSync(fd).size>MAX_INPUT_BYTES)throw new Error('input invalid');
    const buffer=Buffer.alloc(MAX_INPUT_BYTES+1);
    const bytes=fs.readSync(fd,buffer,0,buffer.length,0);
    if(bytes>MAX_INPUT_BYTES)throw new Error('input invalid');
    return new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,bytes));
  }finally{fs.closeSync(fd);}
}
function localFileName(file){
  if(typeof file!=='string'||!file||file.startsWith('--')||/[\x00-\x1f]/.test(file)||/^[\\/]{2}/.test(file))return false;
  // A Windows UNC/device path can authenticate over a network without HTTP code.
  // Permit ordinary relative paths or local absolute drive paths; reject schemes,
  // drive-relative paths, alternate data streams and reserved device names.
  const withoutDrive=file.replace(/^[A-Za-z]:[\\/]/,'');
  return !withoutDrive.includes(':')&&!/(?:^|[\\/])(?:CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:[ .]|$)/i.test(file);
}
function run(argv,{readInput=readLocalInput,now,maxAgeSeconds}={}){
  if(Array.isArray(argv)&&(argv.length===0||(argv.length===1&&argv[0]==='--template')))return {exitCode:0,result:template()};
  if(!Array.isArray(argv)||argv.length!==2||argv[0]!=='--input'||!localFileName(argv[1]))return {exitCode:2,result:report(['CLI_ARGUMENTS_INVALID'])};
  try{
    const raw=readInput(argv[1]);
    if(typeof raw!=='string'||Buffer.byteLength(raw)>MAX_INPUT_BYTES)throw new Error('input invalid');
    const result=evaluate(JSON.parse(raw),{now,maxAgeSeconds});
    return {exitCode:result.structuralComplete?0:2,result};
  }catch(_){return {exitCode:2,result:report(['LOCAL_INPUT_INVALID'])};}
}
if(require.main===module){const r=run(process.argv.slice(2));process.stdout.write(JSON.stringify(r.result)+'\n');process.exitCode=r.exitCode;}
module.exports={SCHEMA,PROJECT_ID,MAX_INPUT_BYTES,CATEGORIES,DISPOSITIONS,BUDGETS,template,evaluate,run};
