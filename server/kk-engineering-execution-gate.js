'use strict';

const VERSION='KK_ENGINEERING_EXECUTION_GATE_V1';
const REQUIRED_PHASES=Object.freeze([
  'CONTEXT_PACK','PLANNER','IMPLEMENTER','INDEPENDENT_REVIEWER','TARGETED_TESTS','RISK_REGRESSION','RELEASE_READBACK'
]);

function evaluate(evidence={}){
  const missing=REQUIRED_PHASES.filter(k=>evidence[k]!==true);
  const failed=Object.entries(evidence.failures||{}).filter(([,v])=>Boolean(v)).map(([k,v])=>`${k}:${v}`);
  return {
    version:VERSION,
    required_phases:[...REQUIRED_PHASES],
    missing,
    failures:failed,
    status:missing.length||failed.length?'BLOCKED':'ENGINEERING_ACCEPTED'
  };
}
module.exports={VERSION,REQUIRED_PHASES,evaluate};
