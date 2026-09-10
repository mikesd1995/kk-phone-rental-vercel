'use strict';

const acceptance=require('./kk-runtime-acceptance-contract');

function num(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
function upper(v){ return String(v == null ? '' : v).trim().toUpperCase(); }
function bool(v){ return v===true || upper(v)==='TRUE'; }

function observeExpectedOccurrence(input={}){
  const expectedAt=num(input.expected_at_ms);
  const now=num(input.now_ms);
  const observedAt=num(input.observed_at_ms);
  const grace=Math.max(0,num(input.grace_ms)||300000);
  const due=input.expected_occurrence!==false;

  if(!due) return {status:'NOT_DUE',incident:false,reasons:[],acceptance:null};
  if(expectedAt<=0 || now<=0) return {status:'INVALID_OBSERVATION',incident:true,reasons:['TIME_BASE_REQUIRED'],acceptance:null};
  if(!observedAt){
    if(now<=expectedAt+grace) return {status:'PENDING_WITHIN_GRACE',incident:false,reasons:[],acceptance:null};
    return {status:'INCIDENT',incident:true,reasons:['SCHEDULER_NOT_FIRED'],acceptance:null,lateness_ms:now-expectedAt};
  }

  const runtimeInput=Object.assign({},input.runtime_input||{}, {
    expected_occurrence:true,
    scheduled_trigger_observed:true
  });
  const result=acceptance.runtimeAcceptance(runtimeInput);
  const lateness=Math.max(0,observedAt-expectedAt);
  const reasons=[...result.reasons];
  if(lateness>grace) reasons.push('TRIGGER_LATE_BEYOND_GRACE');

  return {
    status:reasons.length?'INCIDENT':'PASS',
    incident:reasons.length>0,
    reasons:Array.from(new Set(reasons)),
    lateness_ms:lateness,
    acceptance:result
  };
}

function taskTransition(input={}){
  const before=bool(input.enabled_before);
  const after=bool(input.enabled_after);
  if(before&&!after) return {incident:true,code:'TASK_DISABLED_AFTER'};
  if(!before) return {incident:true,code:'TASK_DISABLED_BEFORE'};
  return {incident:false,code:null};
}

function runnerSlo(records=[], options={}){
  const target=Number.isFinite(Number(options.target_ratio))?Number(options.target_ratio):0.99;
  const evaluated=records.filter(r=>r && !['NOT_DUE','PENDING_WITHIN_GRACE'].includes(r.status));
  const passed=evaluated.filter(r=>r.status==='PASS').length;
  const incidents=evaluated.filter(r=>r.incident).length;
  const p0=evaluated.filter(r=>Array.isArray(r.reasons)&&r.reasons.some(code=>acceptance.incidentSeverity(code)==='P0')).length;
  const ratio=evaluated.length?passed/evaluated.length:1;
  return {
    evaluated:evaluated.length,
    passed,
    incidents,
    p0_incidents:p0,
    ratio,
    percent:Number((ratio*100).toFixed(4)),
    target_ratio:target,
    target_met:ratio>=target && p0===0
  };
}

function closureHealth(input={}){
  const reasons=[];
  if(num(input.unresolved_prepared_committing)>0) reasons.push('UNRESOLVED_TRANSACTION');
  if(num(input.stale_active_leases)>0) reasons.push('STALE_ACTIVE_LEASE');
  if(num(input.running_manifests_past_deadline)>0) reasons.push('MANIFEST_STUCK');
  if(num(input.candidate_orphans)>0) reasons.push('CANDIDATE_ORPHAN');
  if(num(input.ai_orphans)>0) reasons.push('AI_ORPHAN');
  return {healthy:reasons.length===0,status:reasons.length?'DEGRADED':'HEALTHY',reasons};
}

module.exports={observeExpectedOccurrence,taskTransition,runnerSlo,closureHealth};
