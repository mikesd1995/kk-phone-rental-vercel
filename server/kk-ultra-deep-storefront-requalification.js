'use strict';
const Rent=require('./kk-ultra-deep-rentability-score.js');
const VERSION='KK_ULTRA_DEEP_STOREFRONT_REQUALIFICATION_V1';

function text(v){return String(v==null?'':v).trim();}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d;}
function locked(input={}){return input.owner_hidden===true||input.tombstone_locked===true||text(input.history_state).toUpperCase()==='LOCKED';}
function reopened(input={}){return text(input.history_state).toUpperCase()==='REOPENED';}

function externalQualification(input={},config={}){
  const scoring=input.external_scoring||{};
  const score=Rent.score(scoring,config);
  const coverage=Rent.signalCoverage(scoring);
  const minSignals=Math.max(1,Math.min(Rent.SIGNAL_KEYS.length,Number(config.min_signal_count||4)));
  return {score,coverage,minSignals,insufficient:coverage.present<minSignals};
}

function requalify(input={},config={}){
  const external=externalQualification(input,config);
  const activeBookingCount=Math.max(0,num(input.active_booking_count));
  const ownerKeep=input.owner_keep===true;
  const activeOnWeb=input.active_on_web!==false;
  const apply=input.owner_monthly_reconciliation_apply===true;

  if(locked(input)) return {
    version:VERSION,decision:'OWNER_HIDDEN',apply_visibility_change:false,
    reason:'OWNER_HIDDEN_OR_TOMBSTONE',...external,internal_business_signals_affect_score:false
  };

  if(reopened(input)&&!activeOnWeb) return {
    version:VERSION,
    decision:apply?'RESTORE_OWNER_REOPEN':'RESTORE_OWNER_REOPEN_RECOMMENDED',
    apply_visibility_change:apply,
    reason:'EXPLICIT_OWNER_REOPEN_HISTORY_REQUIRES_VISIBLE_CORE',
    visibility_mutation:apply?{
      type:'UPDATE_VISIBILITY',from:false,to:true,
      evidence:'DURABLE_OWNER_REOPEN_HISTORY',
      visibility_lock_reason:'OWNER_EXPLICIT_REOPEN_RECONCILIATION'
    }:null,
    ...external,internal_business_signals_affect_score:false
  };

  if(ownerKeep&& !activeOnWeb) return {
    version:VERSION,
    decision:apply?'RESTORE_OWNER_KEEP':'RESTORE_OWNER_KEEP_RECOMMENDED',
    apply_visibility_change:apply,
    reason:'EXPLICIT_OWNER_KEEP_REQUIRES_VISIBLE_CORE',
    visibility_mutation:apply?{
      type:'UPDATE_VISIBILITY',from:false,to:true,
      evidence:'EXPLICIT_OWNER_KEEP',
      visibility_lock_reason:'OWNER_KEEP_RECONCILIATION'
    }:null,
    ...external,internal_business_signals_affect_score:false
  };

  if(ownerKeep||reopened(input)) return {
    version:VERSION,decision:'OWNER_KEEP',apply_visibility_change:false,
    reason:ownerKeep?'EXPLICIT_OWNER_KEEP':'EXPLICIT_OWNER_REOPEN_HISTORY_PROTECTS_VISIBILITY',
    ...external,internal_business_signals_affect_score:false
  };

  if(!activeOnWeb) return {
    version:VERSION,decision:'CURRENT_HIDDEN_PRESERVE',apply_visibility_change:false,
    reason:'HIDDEN_WITHOUT_EXPLICIT_REOPEN_DO_NOT_AUTO_REOPEN',
    ...external,internal_business_signals_affect_score:false
  };

  if(activeBookingCount>0) return {
    version:VERSION,decision:'KEEP_PROTECTED_ACTIVE_BOOKING',apply_visibility_change:false,
    reason:'ACTIVE_BOOKING_PROTECTS_VISIBILITY_BUT_DOES_NOT_AFFECT_SCORE',
    active_booking_count:activeBookingCount,...external,internal_business_signals_affect_score:false
  };

  if(external.insufficient) return {
    version:VERSION,decision:'VERIFY_MORE_KEEP',apply_visibility_change:false,
    reason:'INSUFFICIENT_EXTERNAL_EVIDENCE_TO_REMOVE_EXISTING_CARD',
    ...external,internal_business_signals_affect_score:false
  };

  const total=external.score.total;
  if(total>=external.score.thresholds.publish) return {
    version:VERSION,decision:'KEEP',apply_visibility_change:false,
    reason:'EXTERNAL_DEMAND_PUBLISH_THRESHOLD_MET',
    ...external,internal_business_signals_affect_score:false
  };
  if(total>=external.score.thresholds.watch) return {
    version:VERSION,decision:'WATCH_KEEP',apply_visibility_change:false,
    reason:'HYSTERESIS_WATCH_EXISTING_CARD',
    ...external,internal_business_signals_affect_score:false
  };

  return {
    version:VERSION,
    decision:apply?'REMOVE':'REMOVE_RECOMMENDED',
    apply_visibility_change:apply&&activeOnWeb,
    reason:'EXTERNAL_DEMAND_BELOW_REMOVE_THRESHOLD',
    visibility_mutation:apply&&activeOnWeb?{
      type:'UPDATE_VISIBILITY',from:true,to:false,
      evidence:'OWNER_APPROVED_MONTHLY_EXTERNAL_DEMAND_PRUNE',
      visibility_lock_reason:text(input.visibility_lock_reason)||'OWNER_MONTHLY_DEMAND_PRUNE'
    }:null,
    ...external,
    internal_business_signals_affect_score:false
  };
}

function report(rows=[]){
  const out={KEEP:[],WATCH:[],REMOVE:[],OWNER_KEEP:[],RESTORE:[],PROTECTED:[],VERIFY_MORE:[],OWNER_HIDDEN:[],HIDDEN_PRESERVE:[]};
  for(const row of rows||[]){
    const d=text(row&&row.requalification&&row.requalification.decision);
    const item={
      event_key:text(row&&row.event_key),event_id:text(row&&row.canonical_event_id),
      title:text(row&&row.title),event_date:text(row&&row.event_date),
      score:row&&row.requalification&&row.requalification.score&&row.requalification.score.total,
      decision:d,reason:text(row&&row.requalification&&row.requalification.reason)
    };
    if(d==='KEEP')out.KEEP.push(item);
    else if(d==='WATCH_KEEP')out.WATCH.push(item);
    else if(d==='REMOVE'||d==='REMOVE_RECOMMENDED')out.REMOVE.push(item);
    else if(d==='OWNER_KEEP')out.OWNER_KEEP.push(item);
    else if(d==='RESTORE_OWNER_REOPEN'||d==='RESTORE_OWNER_REOPEN_RECOMMENDED'||d==='RESTORE_OWNER_KEEP'||d==='RESTORE_OWNER_KEEP_RECOMMENDED')out.RESTORE.push(item);
    else if(d==='KEEP_PROTECTED_ACTIVE_BOOKING')out.PROTECTED.push(item);
    else if(d==='VERIFY_MORE_KEEP')out.VERIFY_MORE.push(item);
    else if(d==='OWNER_HIDDEN')out.OWNER_HIDDEN.push(item);
    else if(d==='CURRENT_HIDDEN_PRESERVE')out.HIDDEN_PRESERVE.push(item);
  }
  return {version:VERSION,counts:Object.fromEntries(Object.entries(out).map(([k,v])=>[k,v.length])),groups:out};
}

function monthlyDiff(input={}){
  const before=new Set((input.before_visible_event_ids||[]).map(text).filter(Boolean));
  const after=new Set((input.after_visible_event_ids||[]).map(text).filter(Boolean));
  const details=new Map((input.event_details||[]).map(x=>[text(x.event_id||x.event_key),x]));
  const added=[...after].filter(id=>!before.has(id)).map(id=>({event_id:id,...(details.get(id)||{})}));
  const removed=[...before].filter(id=>!after.has(id)).map(id=>({event_id:id,...(details.get(id)||{})}));
  const kept=[...after].filter(id=>before.has(id)).map(id=>({event_id:id,...(details.get(id)||{})}));
  return {
    version:VERSION,
    before_visible_count:before.size,
    after_visible_count:after.size,
    added_count:added.length,
    removed_count:removed.length,
    kept_count:kept.length,
    added,removed,kept
  };
}

module.exports={VERSION,externalQualification,requalify,report,monthlyDiff};
