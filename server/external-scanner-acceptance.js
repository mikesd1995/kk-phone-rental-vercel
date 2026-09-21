'use strict';

const Runtime=require('./external-scanner-runtime');

const HOUR_MS=60*60*1000;
const BANGKOK_OFFSET_MS=7*60*60*1000;
const DEFAULT_REQUIRED=6;
const DEFAULT_FRESHNESS_MS=90*60*1000;
const DEFAULT_RECEIVE_LAG_MS=25*60*1000;
const ALLOWED_STATUS=new Set(['EXPECTED','STARTED','TERMINAL']);
const GITHUB_WITNESS_SOURCE='GITHUB_ACTIONS_CRON';
const GITHUB_WITNESS_VERSION='kk-scanner-github-witness-v1';

function supportedSourceVersion(source,version){
  if(source===Runtime.SOURCE) return version===Runtime.VERSION;
  if(source===GITHUB_WITNESS_SOURCE) return version===GITHUB_WITNESS_VERSION;
  return false;
}

function text(value){
  return String(value==null?'':value).trim();
}

function bangkokIso(ms){
  return new Date(ms+BANGKOK_OFFSET_MS).toISOString().slice(0,19)+'+07:00';
}

function intWithin(value,fallback,min,max){
  const n=Number(value);
  if(!Number.isInteger(n) || n<min || n>max) return fallback;
  return n;
}

function normalizeRow(row={}){
  return {
    occurrence_id:text(row.occurrence_id),
    role:text(row.role),
    scheduled_at:text(row.scheduled_at),
    issued_at:text(row.issued_at),
    source:text(row.source),
    trigger_version:text(row.trigger_version),
    nonce:text(row.nonce),
    payload_hash:text(row.payload_hash).toLowerCase(),
    status:text(row.status),
    mode:text(row.mode),
    received_at:text(row.received_at)
  };
}

function validateWitnessRow(row={},options={}){
  const r=normalizeRow(row);
  const receiveLagMs=Number.isFinite(options.receiveLagMs)
    ? options.receiveLagMs
    : DEFAULT_RECEIVE_LAG_MS;
  const reasons=[];

  if(r.role!=='SCANNER') reasons.push('ROLE');
  if(![Runtime.SOURCE,GITHUB_WITNESS_SOURCE].includes(r.source)) reasons.push('SOURCE');
  if(!supportedSourceVersion(r.source,r.trigger_version)) reasons.push('TRIGGER_VERSION');
  if(r.mode!=='WITNESS_ONLY') reasons.push('MODE');
  if(!ALLOWED_STATUS.has(r.status)) reasons.push('STATUS');
  if(!/^[-A-Za-z0-9_:.]{16,128}$/.test(r.nonce)) reasons.push('NONCE');
  if(!/^[0-9a-f]{64}$/.test(r.payload_hash)){
    reasons.push('PAYLOAD_HASH_FORMAT');
  }else{
    const canonical=Runtime.canonicalizeEnvelope({
      version:r.trigger_version,
      role:r.role,
      occurrence_id:r.occurrence_id,
      scheduled_at:r.scheduled_at,
      issued_at:r.issued_at,
      nonce:r.nonce,
      source:r.source
    });
    const expectedHash=Runtime.sha256(canonical);
    if(r.payload_hash!==expectedHash) reasons.push('PAYLOAD_HASH');
  }

  let scheduledMs=Number.NaN;
  try{
    const expectedOccurrence=Runtime.occurrenceIdFor(r.scheduled_at);
    if(r.occurrence_id!==expectedOccurrence) reasons.push('OCCURRENCE_ID');
    scheduledMs=Date.parse(r.scheduled_at);
  }catch(_err){
    reasons.push('SCHEDULE');
  }

  const issuedMs=Date.parse(r.issued_at);
  if(Number.isNaN(issuedMs)) reasons.push('ISSUED_AT');

  const receivedMs=Date.parse(r.received_at);
  if(Number.isNaN(receivedMs)){
    reasons.push('RECEIVED_AT');
  }else if(!Number.isNaN(scheduledMs) && Math.abs(receivedMs-scheduledMs)>receiveLagMs){
    reasons.push('RECEIVE_LAG');
  }

  return {
    ok:reasons.length===0,
    reasons,
    scheduled_ms:scheduledMs,
    row:r
  };
}

function evaluateWitnessWindow(rows=[],options={}){
  const required=intWithin(options.required,DEFAULT_REQUIRED,1,48);
  const nowMs=Number.isFinite(options.nowMs)?options.nowMs:Date.now();
  const freshnessMs=Number.isFinite(options.freshnessMs)
    ? options.freshnessMs
    : DEFAULT_FRESHNESS_MS;
  const receiveLagMs=Number.isFinite(options.receiveLagMs)
    ? options.receiveLagMs
    : DEFAULT_RECEIVE_LAG_MS;

  const validated=(Array.isArray(rows)?rows:[]).map(row=>validateWitnessRow(row,{receiveLagMs}));
  const valid=validated.filter(x=>x.ok && Number.isFinite(x.scheduled_ms));
  const observed=validated.filter(x=>Number.isFinite(x.scheduled_ms));

  if(observed.length===0){
    return {
      ok:false,
      classification:'WITNESS_STREAK_EMPTY',
      required,
      consecutive:0,
      checked_rows:validated.length,
      invalid_rows:validated.filter(x=>!x.ok).length,
      missing_slots:required,
      scanner_runtime_acceptance:false,
      production_cutover_authorized:false
    };
  }

  const bySchedule=new Map();
  for(const item of valid){
    const list=bySchedule.get(item.scheduled_ms)||[];
    list.push(item);
    bySchedule.set(item.scheduled_ms,list);
  }

  const latestMs=Math.max(...observed.map(x=>x.scheduled_ms));
  const windowStartMs=latestMs-(required-1)*HOUR_MS;
  const expected=[];
  for(let i=0;i<required;i++) expected.push(windowStartMs+i*HOUR_MS);

  const missing=[];
  const duplicate=[];
  for(const slot of expected){
    const count=(bySchedule.get(slot)||[]).length;
    if(count===0) missing.push(bangkokIso(slot));
    if(count>1) duplicate.push({scheduled_at:bangkokIso(slot),count});
  }

  const invalidInWindow=validated.filter(x=>
    !x.ok && Number.isFinite(x.scheduled_ms) &&
    x.scheduled_ms>=windowStartMs && x.scheduled_ms<=latestMs
  );
  const latestAgeMs=nowMs-latestMs;
  const latestIsFresh=latestAgeMs>=-20*60*1000 && latestAgeMs<=freshnessMs;
  const consecutive=missing.length===0 && duplicate.length===0 && invalidInWindow.length===0
    ? required
    : (() => {
        let count=0;
        for(let slot=latestMs;slot>=windowStartMs;slot-=HOUR_MS){
          const rowsAtSlot=bySchedule.get(slot)||[];
          if(rowsAtSlot.length!==1) break;
          const bad=validated.some(x=>!x.ok && x.scheduled_ms===slot);
          if(bad) break;
          count++;
        }
        return count;
      })();

  let classification='WITNESS_STREAK_PASS';
  if(invalidInWindow.length || duplicate.length) classification='WITNESS_DATA_INVALID';
  else if(!latestIsFresh) classification='WITNESS_STREAK_STALE';
  else if(missing.length) classification='WITNESS_STREAK_INCOMPLETE';

  const ok=classification==='WITNESS_STREAK_PASS';

  return {
    ok,
    classification,
    required,
    consecutive,
    checked_rows:validated.length,
    valid_rows:valid.length,
    invalid_rows:validated.filter(x=>!x.ok).length,
    invalid_in_window:invalidInWindow.length,
    duplicate_slots:duplicate,
    missing_slots:missing.length,
    missing_scheduled_at:missing,
    window_start:bangkokIso(windowStartMs),
    window_end:bangkokIso(latestMs),
    latest_age_ms:latestAgeMs,
    latest_is_fresh:latestIsFresh,
    scanner_runtime_acceptance:false,
    production_cutover_authorized:false
  };
}

module.exports={
  HOUR_MS,
  DEFAULT_REQUIRED,
  DEFAULT_FRESHNESS_MS,
  DEFAULT_RECEIVE_LAG_MS,
  GITHUB_WITNESS_SOURCE,
  GITHUB_WITNESS_VERSION,
  supportedSourceVersion,
  validateWitnessRow,
  evaluateWitnessWindow
};
