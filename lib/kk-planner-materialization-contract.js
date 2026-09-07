'use strict';

function n(v){
  const x=Number(v);
  return Number.isFinite(x)&&x>0?Math.floor(x):0;
}
function text(v){ return String(v==null?'':v).trim(); }
function upper(v){ return text(v).toUpperCase(); }
function trueish(v){ return v===true || ['TRUE','YES','1'].includes(upper(v)); }
function timestamp(v){
  const ms=Date.parse(text(v));
  return Number.isFinite(ms)?ms:NaN;
}
function watchIdentity(row={}){
  return text(
    row.show_id || row.showId || row['Show ID'] ||
    row.showset_id || row.showsetId || row['Showset ID'] ||
    row.event_family_id || row.eventFamilyId || row['Event Family ID']
  );
}

function assessPlannerWindow(input={}){
  const dedicated=!!input.is_dedicated_window;
  const planCount=n(input.current_plan_count);
  const fallback=!!input.explicit_fallback;
  const fallbackReason=text(input.fallback_reason);
  const recentFallbacks=n(input.recent_fallback_count);

  if(!dedicated){
    return {
      compliant:true,
      allowed_to_execute:true,
      status:'NOT_REQUIRED',
      reliability_debt:false,
      repeated_fallback:false,
      reasons:[]
    };
  }

  if(planCount>0){
    return {
      compliant:true,
      allowed_to_execute:true,
      status:'MATERIALIZED',
      reliability_debt:false,
      repeated_fallback:false,
      reasons:[]
    };
  }

  if(fallback && fallbackReason){
    return {
      compliant:false,
      allowed_to_execute:true,
      status:'FALLBACK_EXCEPTION',
      reliability_debt:true,
      repeated_fallback:recentFallbacks>0,
      reasons:['CURRENT_PLANNER_ROW_MISSING','PLANNER_FALLBACK_EXCEPTION']
    };
  }

  return {
    compliant:false,
    allowed_to_execute:false,
    status:'BLOCKED_NO_PLAN',
    reliability_debt:true,
    repeated_fallback:recentFallbacks>0,
    reasons:['CURRENT_PLANNER_ROW_MISSING','EXPLICIT_FALLBACK_EVIDENCE_MISSING']
  };
}

function plannerReadbackGate(expectedPlanIds=[], readbackRows=[]){
  const expected=expectedPlanIds.map(text).filter(Boolean);
  const actual=readbackRows.map(r=>text(r.plan_id||r.planId||r['Plan ID'])).filter(Boolean);
  const uniqueActual=new Set(actual);
  const missing=expected.filter(id=>!uniqueActual.has(id));
  const duplicateCount=actual.length-uniqueActual.size;
  return {
    ok:expected.length>0 && missing.length===0 && duplicateCount===0,
    expected_count:expected.length,
    readback_count:actual.length,
    missing,
    duplicate_count:duplicateCount
  };
}

function plannerDayHealth(input={}){
  const dedicated=n(input.dedicated_windows_due);
  const withPlan=n(input.dedicated_windows_with_current_plan);
  const fallback=n(input.dedicated_windows_using_fallback);
  const missing=Math.max(0,dedicated-withPlan);

  if(!dedicated){
    return {healthy:true,status:'NO_DEDICATED_WINDOWS_DUE',missing_plans:0,fallback_count:fallback};
  }
  if(withPlan===dedicated && fallback===0){
    return {healthy:true,status:'HEALTHY',missing_plans:0,fallback_count:0};
  }
  if(withPlan===0){
    return {healthy:false,status:'MATERIALIZATION_BROKEN',missing_plans:dedicated,fallback_count:fallback};
  }
  return {healthy:false,status:'PARTIAL_MATERIALIZATION',missing_plans:missing,fallback_count:fallback};
}

/**
 * Fail-closed guard for policy-selected WATCHING rows whose Next Watch boundary
 * is already due. Policy/risk selection stays outside this contract: callers
 * must explicitly mark rows `required_for_current_policy=true` after resolving
 * the live Machine SOT. This keeps the contract version-agnostic while making
 * a due watch impossible to treat as accounted merely because it still has a
 * historical WATCHING label.
 *
 * `materialized_identity_keys` contains stable Show/Showset/Event-Family keys
 * that the current Scanner actually materialized into the governed recheck
 * path for this execution window. A due required watch without one of those
 * keys is reliability debt and blocks a clean completion claim.
 */
function dueWatchMaterializationGate(input={}){
  const now=timestamp(input.now || input.now_iso || input.nowIso);
  if(!Number.isFinite(now)){
    return {
      ok:false,
      status:'INVALID_NOW',
      required_watch_count:0,
      due_watch_count:0,
      materialized_due_count:0,
      missing_identity:[],
      missing_materialization:[],
      invalid_next_watch:[]
    };
  }

  const rows=Array.isArray(input.candidate_rows)?input.candidate_rows:
    (Array.isArray(input.candidateRows)?input.candidateRows:[]);
  const materialized=new Set((input.materialized_identity_keys || input.materializedIdentityKeys || []).map(text).filter(Boolean));
  const required=[];
  const due=[];
  const missingIdentity=[];
  const invalidNextWatch=[];

  for(const row of rows){
    if(!row || typeof row!=='object') continue;
    if(!trueish(row.required_for_current_policy ?? row.requiredForCurrentPolicy)) continue;
    const status=upper(row.status || row.Status);
    if(!status.includes('WATCHING')) continue;

    const id=watchIdentity(row);
    required.push(id);
    const nextRaw=row.next_watch_at || row.nextWatchAt || row['Next Watch At'];
    const next=timestamp(nextRaw);
    if(!Number.isFinite(next)){
      invalidNextWatch.push(id || '<BLANK_IDENTITY>');
      continue;
    }
    if(next>now) continue;
    if(!id){
      missingIdentity.push('<BLANK_IDENTITY>');
      continue;
    }
    due.push(id);
  }

  const uniqueDue=[...new Set(due)];
  const missingMaterialization=uniqueDue.filter(id=>!materialized.has(id));
  const materializedDue=uniqueDue.length-missingMaterialization.length;
  const ok=missingIdentity.length===0 && invalidNextWatch.length===0 && missingMaterialization.length===0;

  return {
    ok,
    status:ok?'DUE_WATCHES_MATERIALIZED':'DUE_WATCH_MATERIALIZATION_GAP',
    required_watch_count:required.length,
    due_watch_count:uniqueDue.length+missingIdentity.length,
    materialized_due_count:materializedDue,
    missing_identity:missingIdentity,
    missing_materialization:missingMaterialization,
    invalid_next_watch:invalidNextWatch
  };
}

module.exports={assessPlannerWindow,plannerReadbackGate,plannerDayHealth,dueWatchMaterializationGate};
