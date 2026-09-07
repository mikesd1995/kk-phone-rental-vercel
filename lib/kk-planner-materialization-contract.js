'use strict';

function n(v){
  const x=Number(v);
  return Number.isFinite(x)&&x>0?Math.floor(x):0;
}
function text(v){ return String(v==null?'':v).trim(); }

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

module.exports={assessPlannerWindow,plannerReadbackGate,plannerDayHealth};
