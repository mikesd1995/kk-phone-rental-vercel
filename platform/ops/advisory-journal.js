'use strict';

const fs=require('node:fs');
const path=require('node:path');
const C=require('../contracts');
const {VERSION,minimizeReport,validateAdvice}=require('./advisory');
const MARKER='kk-local-advisory-journal-v1';
function directory(value) {
  C.text(value); C.requireThat(!/^(?:[a-z]+:\/\/|\\\\|\/\/)/i.test(value),'LOCAL_DIRECTORY_REQUIRED');
  const resolved=path.resolve(value); let cursor=resolved;
  while(true) {if(fs.existsSync(cursor)) C.requireThat(!fs.lstatSync(cursor).isSymbolicLink(),'JOURNAL_SYMLINK_DENIED');const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;}
  return resolved;
}
function writeOnce(file,value) {
  C.assertSafeData(value);
  const fd=fs.openSync(file,'wx',0o600);
  try {fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
}
function read(file) {
  const stat=fs.lstatSync(file);C.requireThat(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=65536,'JOURNAL_FILE_INVALID');
  try {const value=JSON.parse(fs.readFileSync(file,'utf8'));C.assertSafeData(value);return value;}catch {C.fail('JOURNAL_CORRUPT');}
}
function initializeAdvisoryJournal(stateDirectory) {
  const dir=directory(stateDirectory);fs.mkdirSync(dir,{recursive:true});C.requireThat(fs.readdirSync(dir).length===0,'JOURNAL_DIRECTORY_NOT_EMPTY');
  writeOnce(path.join(dir,'journal.json'),{kind:MARKER});return {environment:'local',production_writes:0};
}
function validateAuthority(auth,now) {
  C.utc(now);C.requireThat(auth&&auth.environment==='local'&&auth.enabled===true&&auth.capability==='advisory.generate','ADVISORY_DISABLED');
  C.utc(auth.observed_at);C.utc(auth.expires_at);
  C.requireThat(Date.parse(auth.observed_at)<=Date.parse(now)&&Date.parse(auth.expires_at)>Date.parse(now)&&Date.parse(auth.expires_at)-Date.parse(auth.observed_at)<=3600000,'ADVISORY_AUTHORITY_STALE');
  C.requireThat(Number.isSafeInteger(auth.max_calls)&&auth.max_calls>=1&&auth.max_calls<=3,'ADVISORY_BUDGET_INVALID');
}
async function runAdvisory({stateDirectory,occurrenceId,report,provider,authorize,clock=()=>new Date().toISOString()}) {
  C.id(occurrenceId);C.requireThat(provider&&typeof provider.request==='function'&&typeof authorize==='function','ADVISORY_HOST_REQUIRED');
  const d=provider.descriptor;
  C.assertSafeData(d);C.requireThat(d&&d.provider==='OPENAI_RESPONSES'&&d.adapter==='openai-ops-responses-v1'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(d.model)&&Number.isSafeInteger(d.output_limit)&&d.output_limit>=256&&d.output_limit<=2048&&Number.isSafeInteger(d.timeout_ms)&&d.timeout_ms>=100&&d.timeout_ms<=60000,'PROVIDER_DESCRIPTOR_INVALID');
  const input=minimizeReport(report);const now=clock();C.utc(now);
  const requestHash=C.changeHash({occurrenceId,input,descriptor:d,version:VERSION});
  const dir=directory(stateDirectory);C.requireThat(read(path.join(dir,'journal.json')).kind===MARKER,'JOURNAL_NOT_INITIALIZED');
  const stem=C.changeHash({occurrenceId});const intentPath=path.join(dir,stem+'.intent.json');const resultPath=path.join(dir,stem+'.result.json');
  const lockPath=path.join(dir,'worker.lock');let lock;
  try {lock=fs.openSync(lockPath,'wx',0o600);}catch(e){if(e.code==='EEXIST')C.fail('ADVISORY_BUSY_OR_RECOVERY_REQUIRED');throw e;}
  try {
    if(fs.existsSync(intentPath)) {
      const intent=read(intentPath);C.requireThat(intent.request_hash===requestHash,'ADVISORY_OCCURRENCE_CONFLICT');
      if(!fs.existsSync(resultPath)) C.fail('ADVISORY_RECONCILE_REQUIRED');
      const result=read(resultPath);const {receipt_hash,...content}=result;
      C.requireThat(result.request_hash===requestHash&&receipt_hash===C.changeHash(content),'JOURNAL_CORRUPT');
      return {...result,replayed:true,historical_observation:true,provider_calls_this_invocation:0};
    }
    C.requireThat(!fs.existsSync(resultPath),'JOURNAL_CORRUPT');
    for(const time of [report.observed_at,report.analyzed_at]) {C.utc(time);C.requireThat(Date.parse(time)<=Date.parse(now)&&Date.parse(now)-Date.parse(time)<=3600000,'ADVISORY_REPORT_STALE');}
    const auth=await authorize();const dispatchTime=clock();validateAuthority(auth,dispatchTime);
    for(const time of [report.observed_at,report.analyzed_at]) C.requireThat(Date.parse(time)<=Date.parse(dispatchTime)&&Date.parse(dispatchTime)-Date.parse(time)<=3600000,'ADVISORY_REPORT_STALE');
    const used=fs.readdirSync(dir).filter(name=>name.endsWith('.intent.json')).filter(name=>read(path.join(dir,name)).reserved_calls!==0).length;
    C.requireThat(!input.issues.length||used<auth.max_calls,'ADVISORY_BUDGET_EXHAUSTED');
    // Intent is durable before dispatch. A lost response or interrupted save cannot be retried.
    writeOnce(intentPath,{version:VERSION,request_hash:requestHash,input_hash:input.input_hash,descriptor:d,prepared_at:clock(),status:'PREPARED',reserved_calls:input.issues.length?1:0});
    let terminal;
    if(input.issues.length===0) terminal={status:'NO_RECOMMENDATIONS',provider_calls_attempted:0,response_id:null,usage:null,advice:null,error_code:null};
    else {
      try {
        const response=await provider.request(input);
        C.requireThat(response&&/^resp_[A-Za-z0-9_-]{1,180}$/.test(response.response_id),'PROVIDER_RECEIPT_INVALID');
        C.requireThat(response.usage===null||(response.usage&&Number.isSafeInteger(response.usage.input_tokens)&&response.usage.input_tokens>=0&&Number.isSafeInteger(response.usage.output_tokens)&&response.usage.output_tokens>=0),'PROVIDER_RECEIPT_INVALID');
        terminal={status:'ADVISORY_VALIDATED',provider_calls_attempted:1,response_id:response.response_id,usage:response.usage===null?null:{input_tokens:response.usage.input_tokens,output_tokens:response.usage.output_tokens},advice:validateAdvice(response.advice,input),error_code:null};
      } catch(error) {
        terminal={status:'RECONCILE_REQUIRED',provider_calls_attempted:1,response_id:null,usage:null,advice:null,error_code:error?.code==='PROVIDER_TIMEOUT'?'PROVIDER_TIMEOUT':'PROVIDER_OR_ADVICE_UNVERIFIED'};
      }
    }
    const result={version:VERSION,request_hash:requestHash,input_hash:input.input_hash,report_hash:input.report_hash,descriptor:d,completed_at:clock(),...terminal,execution_authorized:false,full_system_verified:false,production_writes:0,cost_usd:null};
    result.receipt_hash=C.changeHash(result);writeOnce(resultPath,result);
    return {...result,replayed:false,historical_observation:false,provider_calls_this_invocation:terminal.provider_calls_attempted};
  }finally {fs.closeSync(lock);fs.unlinkSync(lockPath);}
}
module.exports={initializeAdvisoryJournal,runAdvisory};
