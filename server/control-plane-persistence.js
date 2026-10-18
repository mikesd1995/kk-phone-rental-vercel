'use strict';

const crypto=require('node:crypto');
const Control=require('./control-plane-contract.js');

const NATURAL_ORIGIN='NATURAL_SCHEDULED';
const DEFAULT_REQUIRED=6;
const HOUR_MS=60*60*1000;
const BANGKOK_OFFSET_MS=7*HOUR_MS;
const REQUIRED_TASK_IDENTITY_FIELDS=Object.freeze([
  'task_id','title','cadence','timezone','prompt_fingerprint'
]);
const ROLE_MINUTE=Object.freeze({SCANNER:0,VERIFIER:30});

function text(value){
  return String(value==null?'':value).trim();
}

function value(record,...keys){
  for(const key of keys){
    if(record && record[key]!==undefined && record[key]!==null) return record[key];
  }
  return undefined;
}

function strictBool(value){
  return value===true || value===false ? value : null;
}

function roleOf(value_){
  return text(value_).toUpperCase();
}

function sha256(value_){
  return crypto.createHash('sha256').update(String(value_),'utf8').digest('hex');
}

function promptFingerprint(record={}){
  const explicit=text(value(
    record,
    'prompt_fingerprint','promptFingerprint','prompt_hash','promptHash','Prompt Fingerprint'
  ));
  if(explicit) return explicit;
  const prompt=value(record,'prompt','Prompt');
  if(prompt===undefined || prompt===null) return '';
  return sha256(String(prompt));
}

function taskIdentity(record={}){
  return {
    task_id:text(value(record,'task_id','taskId','jawbone_id','jawboneId','id','Task ID')),
    title:text(value(record,'title','Title')),
    cadence:text(value(record,'cadence','schedule','rrule','Cadence','Schedule')),
    timezone:text(value(record,'timezone','time_zone','timeZone','tz','Timezone')),
    prompt_fingerprint:promptFingerprint(record)
  };
}

function missingTaskIdentityFields(identity){
  return REQUIRED_TASK_IDENTITY_FIELDS.filter(field=>!text(identity&&identity[field]));
}

function sameTaskIdentity(a,b){
  return REQUIRED_TASK_IDENTITY_FIELDS.every(field=>text(a&&a[field])===text(b&&b[field]));
}

function manifestIdentity(record={}){
  return {
    manifest_id:text(value(record,'manifest_id','manifestId','Manifest ID')),
    run_id:text(value(record,'run_id','runId','Run ID')),
    role:roleOf(value(record,'role','Role')),
    fencing_token:text(value(record,'fencing_token','fencingToken','Fencing Token'))
  };
}

function sameManifestIdentity(a,b){
  return ['manifest_id','run_id','role','fencing_token'].every(field=>text(a&&a[field])===text(b&&b[field]));
}

function scheduledMinute(iso){
  const raw=text(iso);
  const match=raw.match(/^\d{4}-\d{2}-\d{2}T\d{2}:(\d{2}):\d{2}\+07:00$/);
  return match ? Number(match[1]) : null;
}

function validateScheduleEvidence(input,role){
  const scheduled=text(input.scheduled_at);
  const ms=Date.parse(scheduled);
  if(!scheduled || Number.isNaN(ms)){
    return {ok:false,classification:'NATURAL_SCHEDULE_INVALID',scheduled_ms:null};
  }
  if(!scheduled.endsWith('+07:00')){
    return {ok:false,classification:'NATURAL_SCHEDULE_TIMEZONE_OFFSET_INVALID',scheduled_ms:ms};
  }
  const minute=scheduledMinute(scheduled);
  if(minute===null || minute!==ROLE_MINUTE[role]){
    return {ok:false,classification:'NATURAL_SCHEDULE_ROLE_MINUTE_MISMATCH',scheduled_ms:ms};
  }
  return {ok:true,classification:'NATURAL_SCHEDULE_VALID',scheduled_ms:ms};
}

function compactBoundaryMs(raw,utc=false){
  const match=text(raw).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if(!match) return null;
  const parts=match.slice(1).map(Number);
  const [year,month,day,hour,minute,second]=parts;
  const ms=Date.UTC(year,month-1,day,hour,minute,second);
  const date=new Date(ms);
  if(year<1970 || date.getUTCFullYear()!==year || date.getUTCMonth()!==month-1 ||
    date.getUTCDate()!==day || date.getUTCHours()!==hour ||
    date.getUTCMinutes()!==minute || date.getUTCSeconds()!==second) return null;
  return utc?ms:ms-BANGKOK_OFFSET_MS;
}

function canonicalCadence(identity,role){
  if(identity.timezone!=='Asia/Bangkok') return null;
  const lines=text(identity.cadence).split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const event=lines[0]==='BEGIN:VEVENT' && lines[lines.length-1]==='END:VEVENT';
  const entries=event?lines.slice(1,-1):lines;
  if(!entries.length || (!event && entries.length!==1)) return null;
  const rules=entries.filter(line=>line.startsWith('RRULE:'));
  const starts=entries.filter(line=>line.startsWith('DTSTART;TZID=Asia/Bangkok:'));
  if(rules.length!==1 || starts.length>1 || entries.length!==rules.length+starts.length) return null;
  const fields={};
  for(const part of rules[0].slice(6).split(';')){
    const match=part.match(/^([A-Z]+)=([^=]+)$/);
    if(!match || Object.prototype.hasOwnProperty.call(fields,match[1])) return null;
    fields[match[1]]=match[2];
  }
  const allowed=new Set(['FREQ','INTERVAL','BYHOUR','BYMINUTE','BYSECOND','UNTIL']);
  if(Object.keys(fields).some(key=>!allowed.has(key)) ||
    !['HOURLY','DAILY'].includes(fields.FREQ) ||
    (fields.INTERVAL!==undefined && fields.INTERVAL!=='1') ||
    fields.BYMINUTE!==String(ROLE_MINUTE[role]) ||
    (fields.BYSECOND!==undefined && fields.BYSECOND!=='0')) return null;
  let hours=null;
  if(fields.FREQ==='DAILY'){
    if(!/^(?:\d{1,2})(?:,\d{1,2})*$/.test(fields.BYHOUR||'')) return null;
    hours=fields.BYHOUR.split(',').map(Number);
    if(hours.some(hour=>hour>23) || new Set(hours).size!==hours.length) return null;
  }else if(fields.BYHOUR!==undefined) return null;
  const start=starts.length?compactBoundaryMs(starts[0].slice('DTSTART;TZID=Asia/Bangkok:'.length)):null;
  if(starts.length && start===null) return null;
  // Without BYSECOND, a VEVENT inherits DTSTART seconds; only zero-second slots are supported.
  if(start!==null && fields.BYSECOND===undefined && new Date(start).getUTCSeconds()!==0) return null;
  const untilRaw=fields.UNTIL;
  const until=untilRaw===undefined?null:compactBoundaryMs(untilRaw.replace(/Z$/,''),untilRaw.endsWith('Z'));
  if(untilRaw!==undefined && until===null) return null;
  if(start!==null && until!==null && start>until) return null;
  return {hours,minute:ROLE_MINUTE[role],start,until};
}

function matchesCadence(ms,cadence){
  if(!cadence || (cadence.start!==null && ms<cadence.start) ||
    (cadence.until!==null && ms>cadence.until)) return false;
  const local=new Date(ms+BANGKOK_OFFSET_MS);
  return local.getUTCMinutes()===cadence.minute && local.getUTCSeconds()===0 &&
    local.getUTCMilliseconds()===0 && (!cadence.hours || cadence.hours.includes(local.getUTCHours()));
}

function expectedCadenceSlots(cadence,latestMs,required){
  const expected=[];
  let cursor=Math.floor(latestMs/HOUR_MS)*HOUR_MS+cadence.minute*60*1000;
  if(cursor>latestMs) cursor-=HOUR_MS;
  // Supported daily rules have at least one slot per day; at most 48 slots are requested.
  for(let checked=0;checked<required*24+24 && expected.length<required;checked+=1,cursor-=HOUR_MS){
    if(cadence.start!==null && cursor<cadence.start) break;
    if(matchesCadence(cursor,cadence)) expected.push(cursor);
  }
  return expected.reverse();
}

function normalizePlannerRows(rows){
  return (Array.isArray(rows)?rows:[]).map(row=>({
    work_id:text(value(row,'work_id','workId','Work ID')),
    category:text(value(row,'category','Category')),
    evidence_id:text(value(row,'evidence_id','evidenceId','Evidence ID')),
    target_occurrence_id:text(value(row,'target_occurrence_id','targetOccurrenceId','Target Occurrence ID'))
  }));
}

function samePlanner(expected,actual){
  if(expected.length!==actual.length) return false;
  return expected.every((row,index)=>{
    const other=actual[index]||{};
    return row.work_id===other.work_id &&
      row.category===other.category &&
      row.evidence_id===other.evidence_id &&
      row.target_occurrence_id===other.target_occurrence_id;
  });
}

function evaluateRoleSpecificEvidence(input,analysis){
  const role=analysis.role;
  if(role==='VERIFIER'){
    const readback=input.verifier_manifest_readback;
    if(!readback || typeof readback!=='object'){
      return {ok:false,classification:'VERIFIER_MANIFEST_READBACK_EVIDENCE_MISSING'};
    }
    const manifests=(input.manifests||[]).filter(row=>
      text(value(row,'run_id','runId','Run ID'))===analysis.runtime_run_id &&
      roleOf(value(row,'role','Role'))==='VERIFIER'
    );
    if(manifests.length!==1){
      return {ok:false,classification:'VERIFIER_MANIFEST_FINAL_IDENTITY_NOT_EXACT1'};
    }
    const finalIdentity=manifestIdentity(manifests[0]);
    const expectedIdentity=manifestIdentity(readback.expected||{});
    if(!sameManifestIdentity(finalIdentity,expectedIdentity)){
      return {
        ok:false,
        classification:'VERIFIER_MANIFEST_READBACK_FINAL_IDENTITY_MISMATCH',
        final_identity:finalIdentity,
        expected_identity:expectedIdentity
      };
    }
    const result=Control.evaluateManifestAppendReadback(readback);
    return {
      ok:result.ok===true,
      classification:result.ok===true
        ? 'VERIFIER_MANIFEST_READBACK_EVIDENCED'
        : result.classification,
      manifest_readback:result
    };
  }

  if(role==='SCANNER'){
    const coverage=Array.isArray(input.scanner_run_coverage)?input.scanner_run_coverage:null;
    if(!coverage){
      return {ok:false,classification:'SCANNER_RUN_COVERAGE_EVIDENCE_MISSING'};
    }
    const ownedCoverage=coverage.filter(row=>{
      const runId=text(value(row,'run_id','runId','Run ID','occurrence_id','Occurrence ID'));
      return runId===analysis.runtime_run_id;
    });
    if(ownedCoverage.length<1){
      return {
        ok:false,
        classification:'SCANNER_RUN_COVERAGE_EMPTY',
        expected_runtime_run_id:analysis.runtime_run_id,
        coverage_rows:ownedCoverage.length
      };
    }
    const due=input.scanner_due_work;
    if(!due || typeof due!=='object'){
      return {ok:false,classification:'SCANNER_DUE_WORK_EVIDENCE_MISSING'};
    }
    if(text(due.occurrence_id)!==analysis.runtime_run_id){
      return {
        ok:false,
        classification:'SCANNER_DUE_WORK_RUNTIME_ID_MISMATCH',
        expected_runtime_run_id:analysis.runtime_run_id,
        supplied_occurrence_id:text(due.occurrence_id)
      };
    }
    const result=Control.resolveScannerDueWorkDenominator(due);
    if(!result.ok){
      return {ok:false,classification:result.classification,due_work:result};
    }
    if(!Array.isArray(input.scanner_planner_readback)){
      return {ok:false,classification:'SCANNER_PLANNER_READBACK_MISSING',due_work:result};
    }
    const expected=normalizePlannerRows(result.planner||[]);
    const actual=normalizePlannerRows(input.scanner_planner_readback);
    if(!samePlanner(expected,actual)){
      return {
        ok:false,
        classification:'SCANNER_PLANNER_READBACK_MISMATCH',
        due_work:result,
        expected_planner:expected,
        actual_planner:actual
      };
    }
    return {
      ok:true,
      classification:result.classification==='SCANNER_DUE_WORK_EVIDENCED_NO_OP'
        ? 'SCANNER_DUE_WORK_NO_OP_EVIDENCED'
        : 'SCANNER_DUE_WORK_AND_PLANNER_EVIDENCED',
      due_work:result
    };
  }

  return {ok:false,classification:'ROLE_UNSUPPORTED'};
}

function evaluateNaturalOccurrence(input={},options={}){
  const role=roleOf(input.role);
  if(!['SCANNER','VERIFIER'].includes(role)) throw new Error('role must be SCANNER or VERIFIER');

  const result={
    role,
    scheduled_at:input.scheduled_at||null,
    scheduled_ms:null,
    task_id:null,
    origin:text(input.origin),
    runtime_analysis:null,
    role_evidence:null,
    ok:false,
    classification:null,
    blockers:[]
  };

  const schedule=validateScheduleEvidence(input,role);
  result.scheduled_ms=schedule.scheduled_ms;
  if(!schedule.ok){
    result.classification=schedule.classification;
    result.blockers.push('scheduled_at does not match canonical Asia/Bangkok role boundary');
    return result;
  }

  if(result.origin!==NATURAL_ORIGIN || input.manual===true || input.backfilled===true){
    result.classification='NATURAL_PROVENANCE_REJECTED';
    result.blockers.push('occurrence is not exact natural scheduled provenance');
    return result;
  }

  const before=taskIdentity(input.task_before||{});
  const after=taskIdentity(input.task_after||{});
  const canonical=taskIdentity(options.canonical_task||{});
  const beforeMissing=missingTaskIdentityFields(before);
  const afterMissing=missingTaskIdentityFields(after);
  const canonicalMissing=missingTaskIdentityFields(canonical);
  if(beforeMissing.length || afterMissing.length || canonicalMissing.length){
    result.classification='TASK_IDENTITY_EVIDENCE_MISSING';
    result.blockers.push(
      'before:'+beforeMissing.join(','),
      'after:'+afterMissing.join(','),
      'canonical:'+canonicalMissing.join(',')
    );
    return result;
  }

  const beforeEnabled=strictBool(value(input.task_before||{},'enabled','is_enabled','isEnabled'));
  const afterEnabled=strictBool(value(input.task_after||{},'enabled','is_enabled','isEnabled'));
  const canonicalEnabled=strictBool(value(options.canonical_task||{},'enabled','is_enabled','isEnabled'));
  if(beforeEnabled!==true || afterEnabled!==true || canonicalEnabled!==true){
    result.classification='TASK_ENABLED_STATE_NOT_EXACT_TRUE';
    result.blockers.push('before/current/after enabled state must all be explicit boolean true');
    return result;
  }

  if(!sameTaskIdentity(before,after) || !sameTaskIdentity(before,canonical)){
    result.classification='TASK_IDENTITY_DRIFT';
    result.blockers.push('before/after/current canonical task identity must match exactly');
    return result;
  }

  result.task_id=before.task_id;
  if(canonical.timezone!=='Asia/Bangkok'){
    result.classification='TASK_TIMEZONE_NOT_CANONICAL';
    result.blockers.push('canonical task timezone must be Asia/Bangkok');
    return result;
  }
  const cadence=canonicalCadence(canonical,role);
  if(!cadence){
    result.classification='CANONICAL_CADENCE_INVALID';
    result.blockers.push('canonical cadence must be an explicit supported role schedule');
    return result;
  }
  if(!matchesCadence(schedule.scheduled_ms,cadence)){
    result.classification='NATURAL_SCHEDULE_OUTSIDE_CANONICAL_CADENCE';
    result.blockers.push('occurrence is not a slot in the exact canonical schedule');
    return result;
  }

  const runtime=Control.analyzeNaturalOccurrence(input);
  result.runtime_analysis=runtime;
  if(!runtime.acceptance_candidate){
    result.classification='RUNTIME_ACCEPTANCE_REJECTED';
    result.blockers.push(runtime.classification);
    return result;
  }

  const roleEvidence=evaluateRoleSpecificEvidence(input,runtime);
  result.role_evidence=roleEvidence;
  if(!roleEvidence.ok){
    result.classification='ROLE_SPECIFIC_PREFLIGHT_EVIDENCE_REJECTED';
    result.blockers.push(roleEvidence.classification);
    return result;
  }

  result.ok=true;
  result.classification='PASS_NATURAL_OCCURRENCE_EVIDENCED';
  return result;
}

function canonicalRoleTask(snapshot,role){
  const source=snapshot&&snapshot.canonical_tasks;
  if(!source || typeof source!=='object' || Array.isArray(source)) return null;
  return source[role]||source[role.toLowerCase()]||null;
}

function intWithin(value_,fallback,min,max){
  const n=Number(value_);
  return Number.isInteger(n) && n>=min && n<=max ? n : fallback;
}

function evaluatePersistenceWindow(snapshot={},role,options={}){
  const normalizedRole=roleOf(role);
  if(!['SCANNER','VERIFIER'].includes(normalizedRole)) throw new Error('role must be SCANNER or VERIFIER');
  const required=intWithin(options.required,DEFAULT_REQUIRED,1,48);
  const canonicalTask=canonicalRoleTask(snapshot,normalizedRole);
  if(!canonicalTask){
    return {
      ok:false,
      role:normalizedRole,
      classification:'CANONICAL_TASK_SNAPSHOT_MISSING',
      required,
      consecutive:0,
      acceptance_credit:0
    };
  }
  const cadence=canonicalCadence(taskIdentity(canonicalTask),normalizedRole);
  if(!cadence){
    return {
      ok:false,
      role:normalizedRole,
      classification:'CANONICAL_CADENCE_INVALID',
      required,
      consecutive:0,
      acceptance_credit:0,
      occurrences:[]
    };
  }

  const occurrences=(Array.isArray(snapshot.occurrences)?snapshot.occurrences:[])
    .filter(item=>roleOf(item&&item.role)===normalizedRole)
    .map(item=>evaluateNaturalOccurrence(item,{canonical_task:canonicalTask}));

  const scheduled=occurrences.filter(x=>Number.isFinite(x.scheduled_ms));
  if(!scheduled.length){
    return {
      ok:false,
      role:normalizedRole,
      classification:'NATURAL_WINDOW_EMPTY',
      required,
      consecutive:0,
      acceptance_credit:0,
      occurrences
    };
  }

  const bySlot=new Map();
  for(const item of scheduled){
    const list=bySlot.get(item.scheduled_ms)||[];
    list.push(item);
    bySlot.set(item.scheduled_ms,list);
  }
  const latestMs=Math.max(...scheduled.map(x=>x.scheduled_ms));
  const expected=expectedCadenceSlots(cadence,latestMs,required);

  const slots=[];
  for(const slot of expected){
    const rows=bySlot.get(slot)||[];
    slots.push({scheduled_ms:slot,count:rows.length,rows});
  }

  let consecutive=0;
  for(const slot of [...expected].reverse()){
    const rows=bySlot.get(slot)||[];
    if(rows.length!==1 || !rows[0].ok) break;
    consecutive+=1;
  }

  const duplicates=slots.filter(x=>x.count>1).map(x=>x.scheduled_ms);
  const missing=slots.filter(x=>x.count===0).map(x=>x.scheduled_ms);
  const missingCount=missing.length+required-expected.length;
  const failed=scheduled.filter(row=>!row.ok && row.scheduled_ms>=(expected[0]??latestMs));
  const taskIds=[...new Set(slots.flatMap(x=>x.rows.map(row=>row.task_id).filter(Boolean)))];

  let classification='PERSISTENCE_WINDOW_PASS';
  if(duplicates.length) classification='PERSISTENCE_WINDOW_DUPLICATE_SLOT';
  else if(missingCount) classification='PERSISTENCE_WINDOW_GAP';
  else if(failed.length) classification='PERSISTENCE_WINDOW_OCCURRENCE_REJECTED';
  else if(taskIds.length!==1) classification='PERSISTENCE_WINDOW_TASK_ID_DRIFT';

  const ok=classification==='PERSISTENCE_WINDOW_PASS' && consecutive===required;
  return {
    ok,
    role:normalizedRole,
    classification:ok?classification:'PERSISTENCE_WINDOW_NOT_ACCEPTED',
    detail_classification:classification,
    required,
    consecutive,
    acceptance_credit:ok?required:0,
    task_ids:taskIds,
    missing_slots:missingCount,
    duplicate_slots:duplicates.length,
    rejected_occurrences:failed.map(x=>({
      scheduled_at:x.scheduled_at,
      classification:x.classification,
      blockers:x.blockers
    })),
    occurrences
  };
}

function auditPersistenceSnapshot(snapshot={},options={}){
  const required=intWithin(options.required,DEFAULT_REQUIRED,1,48);
  const scanner=evaluatePersistenceWindow(snapshot,'SCANNER',{required});
  const verifier=evaluatePersistenceWindow(snapshot,'VERIFIER',{required});
  const pass=scanner.ok && verifier.ok;
  return {
    generated_by:'control-plane-persistence-auditor-v1',
    production_writes:0,
    task_mutations:0,
    acceptance_required_each_role:required,
    scanner,
    verifier,
    pass,
    production_stable_authorized:false,
    hf_production_activation_authorized:false
  };
}

module.exports={
  NATURAL_ORIGIN,
  DEFAULT_REQUIRED,
  HOUR_MS,
  REQUIRED_TASK_IDENTITY_FIELDS,
  sha256,
  promptFingerprint,
  taskIdentity,
  sameTaskIdentity,
  evaluateNaturalOccurrence,
  evaluatePersistenceWindow,
  auditPersistenceSnapshot
};
