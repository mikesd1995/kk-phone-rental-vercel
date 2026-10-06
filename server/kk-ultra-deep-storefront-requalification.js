'use strict';
const Rent=require('./kk-ultra-deep-rentability-score.js');
const VERSION='KK_ULTRA_DEEP_STOREFRONT_REQUALIFICATION_V1';

function text(v){return String(v==null?'':v).trim();}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d;}
function locked(input={}){return input.owner_hidden===true||input.tombstone_locked===true||text(input.history_state).toUpperCase()==='LOCKED';}

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

  if(ownerKeep||text(input.history_state).toUpperCase()==='REOPENED') return {
    version:VERSION,decision:'OWNER_KEEP',apply_visibility_change:false,
    reason:ownerKeep?'EXPLICIT_OWNER_KEEP':'EXPLICIT_OWNER_REOPEN_HISTORY_PROTECTS_VISIBILITY',
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
  const out={KEEP:[],WATCH:[],REMOVE:[],OWNER_KEEP:[],PROTECTED:[],VERIFY_MORE:[],OWNER_HIDDEN:[]};
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
    else if(d==='KEEP_PROTECTED_ACTIVE_BOOKING')out.PROTECTED.push(item);
    else if(d==='VERIFY_MORE_KEEP')out.VERIFY_MORE.push(item);
    else if(d==='OWNER_HIDDEN')out.OWNER_HIDDEN.push(item);
  }
  return {version:VERSION,counts:Object.fromEntries(Object.entries(out).map(([k,v])=>[k,v.length])),groups:out};
}

module.exports={VERSION,externalQualification,requalify,report};
